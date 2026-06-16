/* eslint-env node */
import { createClient } from "@supabase/supabase-js";
import { OpenAI } from "openai";
import { requireUser } from "./_utils/auth.js";
import { consumeAiUsage, resolveAiPlan } from "./_utils/aiUsage.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "15mb",
    },
  },
};

export const runtime = "nodejs";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : null;

const STATEMENT_SYSTEM_PROMPT = `
Você é um assistente financeiro que lê extratos bancários em PDF para usuários brasileiros.
Extraia cada lançamento do extrato (texto já foi convertido) e retorne APENAS um JSON no formato:
{
  "transactions": [
    {
      "type": "expense" | "revenue",
      "amount": number,
      "date": "YYYY-MM-DD",
      "description": "texto curto",
      "category": "categoria sugerida",
      "payment_method": "pix|cartao|boleto|dinheiro|transferencia|outro",
      "raw": "linha original do extrato (opcional)"
    }
  ]
}

Regras:
- Use sempre valores positivos; use "expense" para saídas e "revenue" para entradas.
- Datas devem estar em ISO (YYYY-MM-DD). Se não existir, deixe nulo.
- payment_method: prefira cartao, pix, dinheiro ou boleto; se não tiver certeza, deixe nulo.
- Agrupe valores que sejam a mesma compra/lançamento em apenas um item.
- Não inclua texto fora do JSON.
`;

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

function normalizeText(value) {
  return (value ?? "").toString().toLowerCase();
}

function defaultDateISO() {
  const now = new Date();
  return now.toISOString().slice(0, 10);
}

function parseNumeric(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const normalized = normalizeText(value).replace(/[^\d,-.]/g, "").replace(",", ".");
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

const EXPENSE_CATEGORY_KEYWORDS = {
  alimentacao: ["alimenta", "comida", "lanche", "restaurante", "mercado", "supermercado", "padaria", "bebida"],
  transporte: ["transporte", "uber", "taxi", "combustivel", "gasolina", "etanol", "estacionamento", "passagem", "metro", "onibus", "carro"],
  moradia: ["aluguel", "condominio", "luz", "energia", "agua", "internet", "iptu", "ipva", "gas"],
  lazer: ["lazer", "cinema", "streaming", "viagem", "passeio", "show", "bar", "festa", "jogo", "netflix", "spotify"],
  saude: ["saude", "farmacia", "remedio", "medic", "hospital", "consulta", "dentista", "academia", "psicologo"],
};

const REVENUE_CATEGORY_KEYWORDS = {
  salario: ["salario", "pagamento", "folha", "holerite"],
  freelance: ["freelance", "job", "servico", "consultoria", "projeto"],
  investimento: ["dividendo", "juros", "rendimento", "aluguel"],
};

const PAYMENT_METHOD_KEYWORDS = {
  pix: ["pix", "transferencia", "transf", "ted", "doc"],
  cartao: ["cartao", "cartão", "credito", "crédito", "debito", "débito", "visa", "master", "amex"],
  dinheiro: ["dinheiro", "cash", "especie"],
  boleto: ["boleto"],
};

function normalizeExpenseCategory(rawCategory, description = "") {
  const source = `${rawCategory ?? ""} ${description ?? ""}`.toLowerCase();
  for (const [category, keywords] of Object.entries(EXPENSE_CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => source.includes(keyword))) {
      return category;
    }
  }
  const clean = normalizeText(rawCategory);
  if (clean && Object.keys(EXPENSE_CATEGORY_KEYWORDS).includes(clean)) return clean;
  return "outros";
}

function normalizeRevenueCategory(rawCategory, description = "") {
  const source = `${rawCategory ?? ""} ${description ?? ""}`.toLowerCase();
  for (const [category, keywords] of Object.entries(REVENUE_CATEGORY_KEYWORDS)) {
    if (keywords.some((keyword) => source.includes(keyword))) {
      return category;
    }
  }
  const clean = normalizeText(rawCategory);
  if (clean && Object.keys(REVENUE_CATEGORY_KEYWORDS).includes(clean)) return clean;
  return "outros";
}

function normalizePaymentMethod(rawValue, description = "") {
  const source = `${rawValue ?? ""} ${description ?? ""}`.toLowerCase();
  for (const [method, keywords] of Object.entries(PAYMENT_METHOD_KEYWORDS)) {
    if (keywords.some((keyword) => source.includes(keyword))) {
      return method;
    }
  }
  const clean = normalizeText(rawValue);
  const allowed = ["pix", "cartao", "dinheiro", "boleto"];
  if (clean && allowed.includes(clean)) return clean;
  return null; // evita violar constraint
}

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase client not configured.");
  }
}

async function extractTextFromPdf(buffer) {
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);
  return (result?.text || "").trim();
}

async function extractTransactionsFromPdf(buffer) {
  const model = process.env.OPENAI_STATEMENT_MODEL || process.env.OPENAI_MODEL || "gpt-4.1";
  const text = await extractTextFromPdf(buffer);

  if (!text) {
    throw new Error("PDF sem texto extraível.");
  }

  const maxChars = 12000;
  const clipped = text.length > maxChars ? `${text.slice(0, maxChars)}\n\n[texto truncado]` : text;

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: STATEMENT_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Texto do extrato:\n\n${clipped}`,
      },
    ],
  });

  const rawContent = completion.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(rawContent);
  const transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
  return transactions;
}

async function persistTransactions(userId, transactions) {
  ensureSupabase();
  const summary = {
    expensesCreated: 0,
    revenuesCreated: 0,
    skipped: 0,
    errors: [],
    saved: [],
  };

  for (const tx of transactions) {
    const amountRaw = parseNumeric(tx.amount ?? tx.value);
    if (!Number.isFinite(amountRaw)) {
      summary.skipped += 1;
      summary.errors.push("Valor não identificado em um lançamento.");
      continue;
    }

    const typeRaw = normalizeText(tx.type);
    const type = typeRaw === "expense" ? "expense" : typeRaw === "income" || typeRaw === "revenue" ? "revenue" : amountRaw < 0 ? "expense" : "revenue";
    const amount = Math.abs(amountRaw);
    const description = tx.description?.toString().trim() || tx.memo?.toString().trim() || tx.raw?.toString().trim() || null;
    const dateISO = tx.date ? tx.date.slice(0, 10) : defaultDateISO();
    const paymentMethod = normalizePaymentMethod(tx.payment_method ?? tx.paymentMethod, description);

    try {
      if (type === "expense") {
        const category = normalizeExpenseCategory(tx.category, description);
        const { data, error } = await supabase
          .from("expenses")
          .insert({
            user_id: userId,
            value: amount,
            date: dateISO,
            category,
            payment_method: paymentMethod,
            description,
          })
          .select("*")
          .single();

        if (error) throw new Error(error.message || error.details || "Erro ao salvar despesa.");
        summary.expensesCreated += 1;
        summary.saved.push({ type, amount, date: dateISO, category, description, id: data?.id });
      } else {
        const category = normalizeRevenueCategory(tx.category, description);
        const { data, error } = await supabase
          .from("incomes")
          .insert({
            user_id: userId,
            value: amount,
            category,
            date: dateISO,
            description,
          })
          .select("*")
          .single();

        if (error) throw new Error(error.message || error.details || "Erro ao salvar renda.");
        summary.revenuesCreated += 1;
        summary.saved.push({ type, amount, date: dateISO, category, description, id: data?.id });
      }
    } catch (error) {
      summary.errors.push(error.message || "Falha ao salvar um lançamento.");
    }
  }

  return summary;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não suportado." });
  }

  if (!openai.apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY não configurada." });
  }

  try {
    const body = parseBody(req);
    const { fileBase64, fileName = "extrato.pdf" } = body;
    const user = await requireUser(req);
    const userId = user.id;
    const plan = await resolveAiPlan(user);

    await consumeAiUsage({
      userId,
      plan,
      deltas: { ai_relatorios: 1 },
    });

    if (!fileBase64) {
      return res.status(400).json({ error: "Arquivo do extrato não recebido." });
    }

    if (!supabase) {
      return res.status(500).json({ error: "SUPABASE_URL ou SUPABASE_SERVICE_KEY ausentes." });
    }

    const normalizedBase64 = fileBase64.includes(",") ? fileBase64.split(",").pop() : fileBase64;
    const buffer = Buffer.from(normalizedBase64, "base64");

    console.log("[statement] Recebido arquivo", {
      fileName,
      sizeBytes: buffer?.length ?? 0,
      userId,
    });

    if (!buffer?.length) {
      return res.status(400).json({ error: "Arquivo inválido ou vazio." });
    }

    const maxSize = 15 * 1024 * 1024;
    if (buffer.length > maxSize) {
      return res.status(400).json({ error: "Arquivo muito grande. Envie um PDF de até 15MB." });
    }

    if (!buffer?.length) {
      return res.status(400).json({ error: "Arquivo inválido ou vazio." });
    }

    let transactions;
    try {
      transactions = await extractTransactionsFromPdf(buffer);
    } catch (error) {
      console.error("[statement] Falha ao extrair transações do PDF:", error);
      return res.status(500).json({
        error: "Não foi possível ler o PDF.",
        details: error.message,
        stage: "extract",
      });
    }

    if (!transactions?.length) {
      return res.status(200).json({ ok: false, summary: "Não identifiquei lançamentos no extrato enviado." });
    }

    const persistSummary = await persistTransactions(userId, transactions);

    const messageParts = [];
    if (persistSummary.expensesCreated) {
      messageParts.push(`${persistSummary.expensesCreated} despesa(s)`);
    }
    if (persistSummary.revenuesCreated) {
      messageParts.push(`${persistSummary.revenuesCreated} renda(s)`);
    }

    const summaryText =
      messageParts.length > 0
        ? `Extrato processado: registrei ${messageParts.join(" e ")} automaticamente.`
        : "Não foi possível registrar os lançamentos do extrato.";

    return res.status(200).json({
      ok: true,
      summary: summaryText,
      details: persistSummary,
    });
  } catch (error) {
    console.error("[statement] Erro ao processar extrato:", error);
    const status = error.statusCode || 500;
    const errorMessage = status < 500 ? error.message : "Não foi possível processar o extrato bancário.";
    return res.status(status).json({
      error: errorMessage,
      details: status < 500 ? undefined : error.message,
      stage: "persist",
    });
  }
}
