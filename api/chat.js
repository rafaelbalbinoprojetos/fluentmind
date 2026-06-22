/* eslint-env node */
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

function extractMindBlockSuggestion(reply) {
  if (!reply) return null;

  const text = String(reply);
  const youCanSaySection = text.match(/You can say:\s*([\s\S]*?)(?:\n{2,}|\nMeaning:|\nExamples:|Related expressions:|Common mistake:|Practice:|$)/i)?.[1] ?? "";
  const listSuggestionMatch = youCanSaySection.match(/(?:^|\n)\s*(?:\d+\.|[-•])\s*["“]?([^"\n”]{2,120})["”]?/);
  const expressionMatch = text.match(/You can say:\s*(?:\n+)?\s*(.+?)(?:\n{2,}|\nMeaning:|\nExamples:|$)/i)
    || text.match(/\*\*([^*\n]{3,120})\*\*/);
  const meaningMatch = text.match(/Meaning:\s*(?:\n+)?\s*(.+?)(?:\n{2,}|\nExamples:|Related expressions:|Common mistake:|Practice:|$)/i);

  const { expression, translation: inlineTranslation } = splitExpressionAndTranslation(listSuggestionMatch?.[1] || expressionMatch?.[1]);
  if (!expression || expression.length < 3 || expression.length > 160) return null;

  const translation = cleanSuggestionLine(meaningMatch?.[1]);
  return {
    expression,
    translation: inlineTranslation || translation || "",
    category: "Conversation",
    source: "Neo Conversation",
  };
}

function extractMindBlockSuggestions(reply) {
  if (!reply) return [];

  const text = String(reply);
  const youCanSaySection = text.match(/You can say:\s*([\s\S]*?)(?:\n{2,}|\nMeaning:|\nExamples:|Related expressions:|Common mistake:|Practice:|$)/i)?.[1] ?? "";
  const listMatches = [...youCanSaySection.matchAll(/(?:^|\n)\s*(?:\d+\.|[-•])\s*["“]?([^"\n”]{2,160})["”]?/g)];

  const suggestions = listMatches
    .map((match) => splitExpressionAndTranslation(match[1]))
    .filter((item) => item.expression && item.expression.length >= 2 && item.expression.length <= 160)
    .map((item) => ({
      ...item,
      category: "Conversation",
      source: "Neo Conversation",
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
