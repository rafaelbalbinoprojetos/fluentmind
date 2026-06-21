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

function buildSystemPrompt(userName, chatTone) {
  const nameClause = userName
    ? `O nome do usuário é ${userName}. Chame-o pelo primeiro nome quando soar natural.`
    : "Não temos o nome do usuário cadastrado.";

  const toneMap = {
    formal: "Use tom profissional, claro e elegante.",
    natural: "Use tom natural, próximo e inteligente.",
    mineiro_descontraido: "Use tom acolhedor e descontraído, com regionalismos mineiros só ocasionalmente.",
  };

  return `Você é Neo, mentor de fluência do FluentMind.

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
- Não fale como consultor financeiro.
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
    const { messages = [], userName = null, chatTone = "natural" } = body;
    await requireUser(req);

    const conversation = [
      { role: "system", content: buildSystemPrompt(userName, chatTone) },
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
    return res.status(200).json({
      reply: reply || "Não consegui gerar uma resposta agora. Pode tentar reformular?",
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
