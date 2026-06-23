/* global process */
import { OpenAI } from "openai";
import { requireUser } from "./_utils/auth.js";

function getOpenAiClient() {
  const apiKey = process.env.OPENAI_API_KEY || process.env.CHATGPT_API_KEY || process.env.OPENAI_KEY;
  return apiKey ? new OpenAI({ apiKey }) : null;
}

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

function buildSystemPrompt(userName, chatTone, assistantName = "Neo") {
  const safeAssistantName = String(assistantName || "Neo").trim() || "Neo";
  const nameClause = userName
    ? `O nome do usuário é ${userName}. Chame-o pelo primeiro nome quando soar natural.`
    : "Não temos o nome do usuário cadastrado.";

  const toneMap = {
    formal: "Use tom profissional, claro e elegante.",
    natural: "Use tom natural, próximo e inteligente.",
    coach: "Use tom de coach de fluência: incentive, corrija com suavidade e traga exemplos práticos.",
  };

  return `Você é ${safeAssistantName}, mentor de fluência do FluentMind.

O FluentMind ajuda brasileiros a aprender inglês pensando em MindBlocks: expressões naturais, padrões reutilizáveis, correções e revisão ativa.

${nameClause}
${toneMap[chatTone] || toneMap.natural}

Regras:
- Responda como mentor de fluência, não como chatbot genérico.
- Se o usuário perguntar como dizer algo em inglês, dê a forma mais natural primeiro.
- Explique significado em português quando ajudar.
- Sempre que útil, inclua exemplos naturais.
- Corrija erros com gentileza.
- Sugira expressões relacionadas.
- Aponte erros comuns quando houver.
- Sugira salvar expressões úteis como MindBlock.
- Não invente dados pessoais.

Formato recomendado quando fizer sentido:
You can say:
...

Meaning:
...

Examples:
- ...

Related expressions:
- ...

Common mistake:
...

Practice:
...

Data atual: ${new Date().toISOString()}`;
}

function cleanSuggestionLine(value) {
  return String(value || "")
    .replace(/\*\*/g, "")
    .replace(/^[-•\s]+/, "")
    .replace(/^["“]|["”]$/g, "")
    .trim();
}

function splitExpressionAndTranslation(value) {
  const clean = cleanSuggestionLine(value);
  const parts = clean.split(/\s+[–—-]\s+/);

  if (parts.length >= 2) {
    return {
      expression: cleanSuggestionLine(parts[0]),
      translation: cleanSuggestionLine(parts.slice(1).join(" - ")),
    };
  }

  const parentheticalMatch = clean.match(/^(.+?)\s*\(([^()]{2,180})\)$/);
  if (parentheticalMatch) {
    return {
      expression: cleanSuggestionLine(parentheticalMatch[1]),
      translation: cleanSuggestionLine(parentheticalMatch[2]),
    };
  }

  return {
    expression: clean,
    translation: "",
  };
}

function extractSection(text, startLabel, endLabels = []) {
  const escapedStart = startLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedEnds = endLabels.map((label) => label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const headingPrefix = "(?:#{1,6}\\s*)?";
  const endPattern = escapedEnds.length ? `(?:\\n\\s*${headingPrefix}(?:${escapedEnds.join("|")}):|$)` : "$";
  const match = String(text || "").match(new RegExp(`${headingPrefix}${escapedStart}:\\s*([\\s\\S]*?)${endPattern}`, "i"));
  return match?.[1]?.trim() || "";
}

function cleanListItem(value) {
  return cleanSuggestionLine(value)
    .replace(/^\d+\.\s*/, "")
    .replace(/^Para\s+[^:]+:\s*/i, "")
    .replace(/^\*\*|\*\*$/g, "")
    .trim();
}

function isTranslationOnly(value) {
  const clean = cleanListItem(value);
  return /^\([^()]{2,180}\)$/.test(clean);
}

function extractList(section) {
  return String(section || "")
    .split("\n")
    .map((line) => cleanListItem(line.replace(/\*\*/g, "")))
    .filter((line) => line && !/^#+\s*/.test(line))
    .slice(0, 8);
}

function extractCommonMistake(section) {
  const text = cleanSuggestionLine(section).replace(/\n+/g, " ");
  if (!text) return null;

  const wrong = text.match(/(?:Wrong|Errado):\s*([^.;]+)/i)?.[1]?.trim() || "";
  const correct = text.match(/(?:Correct|Correto|Forma correta):\s*([^.;]+)/i)?.[1]?.trim() || "";

  if (wrong || correct) {
    return {
      wrong,
      correct,
      explanation: text,
    };
  }

  return {
    wrong: "",
    correct: "",
    explanation: text,
  };
}

function buildSuggestionMetadata(reply) {
  const labels = ["You can say", "Meaning", "Examples", "Related expressions", "Common mistake", "Practice"];
  const meaning = extractSection(reply, "Meaning", labels.filter((label) => label !== "Meaning"));
  const examples = extractList(extractSection(reply, "Examples", labels.filter((label) => label !== "Examples")));
  const related = extractList(extractSection(reply, "Related expressions", labels.filter((label) => label !== "Related expressions")))
    .map((item) => splitExpressionAndTranslation(item))
    .filter((item) => item.expression);
  const commonMistake = extractCommonMistake(extractSection(reply, "Common mistake", labels.filter((label) => label !== "Common mistake")));
  const practice = extractSection(reply, "Practice", labels.filter((label) => label !== "Practice"));

  return {
    usage: cleanSuggestionLine(meaning).replace(/\n+/g, " "),
    examples,
    relatedExpressions: related,
    commonMistake,
    practice: cleanSuggestionLine(practice).replace(/\n+/g, " "),
  };
}

function extractMindBlockSuggestion(reply) {
  if (!reply) return null;

  const text = String(reply);
  const labels = ["You can say", "Meaning", "Examples", "Related expressions", "Common mistake", "Practice"];
  const youCanSaySection = extractSection(text, "You can say", labels.filter((label) => label !== "You can say"));
  const listSuggestionMatch = youCanSaySection.match(/(?:^|\n)\s*(?:\d+\.|[-•])\s*["“]?([^"\n”]{2,120})["”]?/);
  const expressionMatch = text.match(/You can say:\s*(?:\n+)?\s*(.+?)(?:\n{2,}|\nMeaning:|\nExamples:|$)/i)
    || text.match(/\*\*([^*\n]{3,120})\*\*/);
  const meaningMatch = text.match(/Meaning:\s*(?:\n+)?\s*(.+?)(?:\n{2,}|\nExamples:|Related expressions:|Common mistake:|Practice:|$)/i);

  const { expression, translation: inlineTranslation } = splitExpressionAndTranslation(listSuggestionMatch?.[1] || expressionMatch?.[1]);
  if (!expression || expression.length < 3 || expression.length > 160) return null;

  const translation = cleanSuggestionLine(meaningMatch?.[1]);
  const metadata = buildSuggestionMetadata(reply);
  return {
    expression,
    translation: inlineTranslation || translation || "",
    category: "Conversation",
    source: "Neo Conversation",
    ...metadata,
  };
}

function extractMindBlockSuggestions(reply) {
  if (!reply) return [];

  const text = String(reply);
  const labels = ["You can say", "Meaning", "Examples", "Related expressions", "Common mistake", "Practice"];
  const youCanSaySection = extractSection(text, "You can say", labels.filter((label) => label !== "You can say"));
  const listLines = youCanSaySection
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const metadata = buildSuggestionMetadata(reply);
  const suggestions = listLines
    .map((line, index) => {
      const match = line.match(/^(?:\d+\.|[-•])\s*["“]?([^"\n”]{2,160})["”]?/);
      if (!match || isTranslationOnly(match[1])) return null;

      const suggestion = splitExpressionAndTranslation(match[1]);
      const nextLine = listLines[index + 1] || "";
      const translationOnly = nextLine.match(/^[-•]?\s*\(([^()]{2,180})\)$/);
      if (!suggestion.translation && translationOnly) {
        suggestion.translation = cleanSuggestionLine(translationOnly[1]);
      }

      return suggestion;
    })
    .filter(Boolean)
    .filter((item) => item.expression && item.expression.length >= 2 && item.expression.length <= 160)
    .map((item) => ({
      ...item,
      category: "Conversation",
      source: "Neo Conversation",
      ...metadata,
    }));

  if (suggestions.length > 0) return suggestions;

  const single = extractMindBlockSuggestion(reply);
  return single ? [single] : [];
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não suportado." });
  }

  const openai = getOpenAiClient();
  if (!openai) {
    return res.status(500).json({
      error: "OPENAI_API_KEY não configurada.",
      details: "Configure OPENAI_API_KEY na Vercel sem aspas. Também aceito CHATGPT_API_KEY ou OPENAI_KEY como fallback.",
    });
  }

  try {
    const body = parseBody(req);
    const { messages = [], userName = null, chatTone = "natural", assistantName = "Neo" } = body;
    await requireUser(req);

    const conversation = [
      { role: "system", content: buildSystemPrompt(userName, chatTone, assistantName) },
      ...messages
        .filter((message) => message?.content)
        .slice(-12)
        .map((message) => ({
          role: message.role === "assistant" ? "assistant" : "user",
          content: String(message.content),
        })),
    ];

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: conversation,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content?.trim();
    const suggestedMindBlocks = extractMindBlockSuggestions(reply);
    const suggestedMindBlock = suggestedMindBlocks[0] ?? null;

    return res.status(200).json({
      reply: reply || "Não consegui gerar uma resposta agora. Pode tentar reformular?",
      detectedExpression: suggestedMindBlock?.expression ?? null,
      suggestedMindBlock,
      suggestedMindBlocks,
    });
  } catch (error) {
    console.error("[chat]", error);
    const status = error.statusCode || error.status || 500;
    return res.status(status).json({
      error: status < 500 ? error.message : "Não foi possível processar sua mensagem.",
      details: error.message,
    });
  }
}
