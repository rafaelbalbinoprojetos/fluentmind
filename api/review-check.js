import { OpenAI } from "openai";
import { requireUser } from "./_utils/auth.js";
import { reserveAiUsage } from "./_utils/aiUsage.js";
import { chatModelOptions } from "./_utils/chatModel.js";

// Corrige a resposta do aluno pelo SENTIDO (não por palavras em comum), como um professor faria.
// Modos:
//   translate: o aluno traduziu o significado em português para inglês (resposta esperada = MindBlock);
//   fix:       o aluno reescreveu corrigida uma frase que tinha erro;
//   sentence:  o aluno criou uma frase própria usando uma estrutura.

const MODES = {
  translate: "The student saw the Portuguese meaning and had to say it in English. The expected answer is one natural option, NOT the only one: accept any natural, grammatical English with the same meaning (contractions, synonyms, word order variants).",
  fix: "The student saw a sentence with a mistake and had to rewrite it correctly. Accept any correct, natural version that fixes the mistake and keeps the meaning.",
  sentence: "The student had to create their own sentence using the target structure. Judge whether the structure is used correctly and the sentence is grammatical and natural. There is no single expected answer.",
};

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function buildPrompt(mode, level) {
  return `You are a senior English teacher for Brazilian learners (level ${level || "A2"}).
${MODES[mode] || MODES.translate}

Grade like a supportive teacher:
- Meaning first, then grammar, then naturalness. Ignore capitalization and final punctuation.
- A small slip (one article, a typo) that keeps the meaning is "almost", not "wrong".
- Do not demand vocabulary above the student's level.

Return strict JSON:
{
  "score": number 0-100,
  "verdict": "correct" | "almost" | "wrong",
  "feedback": string,   // in Portuguese, 1-2 short sentences, specific and encouraging; say WHAT to fix
  "corrected": string,  // the student's own answer fixed with minimal changes (same as the answer if already correct)
  "alternative": string // another natural way to say it, or "" if none is useful
}`;
}

function toResult(verdict, score) {
  if (verdict === "wrong" || score < 50) return "again";
  if (verdict === "almost" || score < 80) return "hard";
  return score >= 95 ? "easy" : "good";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não suportado." });
  }
  const apiKey = process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY || process.env.OPENAI_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY não configurada." });

  try {
    const user = await requireUser(req);
    const { mode = "translate", prompt = "", expected = "", answer = "", level = "A2" } = parseBody(req);
    if (!String(answer).trim()) return res.status(400).json({ error: "Resposta vazia." });
    await reserveAiUsage(user);

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      ...chatModelOptions({ correction: true, temperature: 0, maxTokens: 2048 }),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildPrompt(mode, level) },
        {
          role: "user",
          content: JSON.stringify({
            task: String(prompt).slice(0, 400),
            expected: String(expected).slice(0, 400),
            answer: String(answer).slice(0, 600),
          }),
        },
      ],
    });
    const parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
    const verdict = ["correct", "almost", "wrong"].includes(parsed.verdict) ? parsed.verdict : score >= 80 ? "correct" : score >= 50 ? "almost" : "wrong";
    return res.status(200).json({
      score,
      verdict,
      suggestedResult: toResult(verdict, score),
      feedback: String(parsed.feedback || "").trim(),
      corrected: String(parsed.corrected || "").trim(),
      alternative: String(parsed.alternative || "").trim(),
    });
  } catch (error) {
    console.error("[review-check]", error);
    const status = error.statusCode || error.status || 500;
    return res.status(status).json({ error: status < 500 ? error.message : "Não foi possível corrigir agora." });
  }
}
