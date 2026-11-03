import { OpenAI } from "openai";
import { requireUser } from "./_utils/auth.js";
import { reserveAiUsage } from "./_utils/aiUsage.js";
import { chatModelOptions } from "./_utils/chatModel.js";
import { normalizeAnswerEvaluation, normalizeCriteria } from "../shared/learningEvaluation.js";
import { evaluationKey, getCachedEvaluation, setCachedEvaluation, usageMeta } from "./_utils/evaluationCache.js";

// Corrige a resposta do aluno pelo SENTIDO (não por palavras em comum), como um professor faria.
// Modos:
//   translate: o aluno traduziu o significado em português para inglês (resposta esperada = MindBlock);
//   fix:       o aluno reescreveu corrigida uma frase que tinha erro;
//   sentence:  o aluno criou uma frase própria usando uma estrutura;
//   challenge: desafio final do capítulo, avaliado por critérios.

const MODES = {
  translate: "The student saw the Portuguese meaning and had to say it in English. The expected answer is one natural option, NOT the only one: accept any natural, grammatical English with the same meaning (contractions, synonyms, word order variants).",
  fix: "The student saw a sentence with a mistake and had to rewrite it correctly. Accept any correct, natural version that fixes the mistake and keeps the meaning.",
  sentence: "The student had to create their own sentence using the target structure. Judge whether the structure is used correctly and the sentence is grammatical and natural. There is no single expected answer.",
  challenge: "This is the chapter's final challenge. Judge the whole answer against each criterion. Small slips that do not block communication make a criterion \"partial\", not \"not_met\".",
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

function buildPrompt(mode, level, difficulty) {
  return `You are a senior English teacher for Brazilian learners (level ${level || "A2"}${difficulty ? `, lesson content: ${difficulty}` : ""}).
${MODES[mode] || MODES.translate}

Grade like a supportive teacher:
- Meaning first, then grammar, then naturalness. Ignore capitalization and final punctuation.
- A small slip (one article, a typo) that keeps the meaning is "almost", not "wrong".
- Do not demand vocabulary above the student's level.
- Errors that block or change the meaning make the answer "wrong". Answers that ignore the task or the situation are off-topic.
- Do not reward keywords: an answer that only lists the target words without a real sentence is "wrong".
- If you cannot judge reliably (unreadable, mostly Portuguese, ambiguous task), set "confidence": "low".

Return strict JSON:
{
  "score": number 0-100,
  "verdict": "correct" | "almost" | "wrong",
  "onTopic": boolean,       // false when the answer does not address the task/situation
  "confidence": "high" | "low",
  "criteria": [{ "criterion": string, "status": "met" | "partial" | "not_met", "comment": string }], // one per given criterion, same text; [] if none were given. "essential" criteria are the communicative goal: judge them carefully.
  "feedback": string,       // in Portuguese, 1-2 short sentences, specific and encouraging; say WHAT to fix
  "improvement": string,    // in Portuguese, one concrete next step to improve
  "corrected": string,      // the student's own answer fixed with minimal changes (same as the answer if already correct)
  "alternative": string     // another natural way to say it, or "" if none is useful
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
    const { mode = "translate", prompt = "", expected = "", answer = "", level = "A2", criteria = [], difficulty = "", context = "" } = parseBody(req);
    // Critérios aceitam texto (contrato antigo) ou { text, essential }.
    const criteriaList = normalizeCriteria(criteria);
    if (!String(answer).trim()) return res.status(400).json({ error: "Resposta vazia." });
    const request = {
      task: String(prompt).slice(0, 400),
      expected: String(expected).slice(0, 400),
      context: String(context).slice(0, 400),
      criteria: criteriaList.map((item) => ({ criterion: item.text, essential: item.essential })),
      answer: String(answer).slice(0, 1200),
    };
    // Mesma tentativa, mesmo contexto e mesmo aluno: devolve a avaliação já feita sem nova chamada paga.
    const cacheKey = evaluationKey([user.id, mode, level, String(difficulty), request]);
    const cached = getCachedEvaluation(cacheKey);
    if (cached) return res.status(200).json({ ...cached, evaluationMeta: { cached: true } });
    await reserveAiUsage(user);
    const startedAt = Date.now();

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      ...chatModelOptions({ correction: true, temperature: 0, maxTokens: 2048 }),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: buildPrompt(mode, level, String(difficulty).slice(0, 30)) },
        {
          role: "user",
          content: JSON.stringify(request),
        },
      ],
    });
    let parsed = {};
    try {
      parsed = JSON.parse(completion.choices[0]?.message?.content || "{}");
    } catch {
      parsed = { confidence: "low" };
    }
    const evaluation = normalizeAnswerEvaluation(parsed, { criteria: criteriaList, difficulty: String(difficulty) });
    const result = { ...evaluation, suggestedResult: toResult(evaluation.verdict, evaluation.score) };
    const meta = usageMeta(completion, startedAt);
    console.info("[review-check:usage]", JSON.stringify({ mode, ...meta, assessment: evaluation.assessment }));
    // Inconclusivo não vai para o cache: a próxima tentativa merece uma nova avaliação.
    if (evaluation.assessment !== "inconclusive") setCachedEvaluation(cacheKey, result);
    return res.status(200).json({ ...result, evaluationMeta: { cached: false, ...meta } });
  } catch (error) {
    console.error("[review-check]", error);
    const status = error.statusCode || error.status || 500;
    return res.status(status).json({ error: status < 500 ? error.message : "Não foi possível corrigir agora." });
  }
}
