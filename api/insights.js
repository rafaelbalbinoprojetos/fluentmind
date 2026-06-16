/* eslint-env node */
import { createClient } from "@supabase/supabase-js";
import { OpenAI } from "openai";
import { requireUser } from "./_utils/auth.js";
import { consumeAiUsage, resolveAiPlan } from "./_utils/aiUsage.js";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabase = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : null;

const MODEL = process.env.OPENAI_MODEL || "gpt-4.1-mini";

const DAY_MS = 24 * 60 * 60 * 1000;

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

function ensureSupabase() {
  if (!supabase) {
    throw new Error("Supabase client not configured.");
  }
}

async function fetchFinancialData(userId, { days = 90 } = {}) {
  ensureSupabase();
  const periodEnd = new Date();
  const periodStart = new Date(Date.now() - days * DAY_MS);
  const from = periodStart.toISOString().slice(0, 10);
  const to = periodEnd.toISOString().slice(0, 10);

  const [expensesRes, incomesRes] = await Promise.all([
    supabase.from("expenses").select("*").eq("user_id", userId).gte("date", from).lte("date", to).order("date", { ascending: false }),
    supabase.from("incomes").select("*").eq("user_id", userId).gte("date", from).lte("date", to).order("date", { ascending: false }),
  ]);

  if (expensesRes.error) throw expensesRes.error;
  if (incomesRes.error) throw incomesRes.error;

  return {
    expenses: expensesRes.data ?? [],
    incomes: incomesRes.data ?? [],
    periodStart: from,
    periodEnd: to,
  };
}

function summarizeFacts({ expenses, incomes, periodStart, periodEnd }) {
  const totalExpenses = expenses.reduce((sum, item) => sum + Math.abs(Number(item.value) || 0), 0);
  const totalIncomes = incomes.reduce((sum, item) => sum + Math.abs(Number(item.value) || 0), 0);

  const byCategory = expenses.reduce((acc, item) => {
    const key = item.category || "outros";
    acc[key] = (acc[key] || 0) + Math.abs(Number(item.value) || 0);
    return acc;
  }, {});

  const topExpenses = [...expenses]
    .sort((a, b) => Math.abs(Number(b.value) || 0) - Math.abs(Number(a.value) || 0))
    .slice(0, 5)
    .map((item) => ({
      date: item.date,
      value: Math.abs(Number(item.value) || 0),
      category: item.category,
      description: item.description,
    }));

  return {
    periodStart,
    periodEnd,
    totalExpenses,
    totalIncomes,
    expensesByCategory: byCategory,
    topExpenses,
    counts: {
      expenses: expenses.length,
      incomes: incomes.length,
    },
  };
}

async function generateInsightFromFacts(facts) {
  const prompt = `
Você é um analista financeiro pessoal do KORDEN.
Receba os "fatos" abaixo e devolva APENAS um JSON com:
{
  "summary": "texto curto em português",
  "highlights": ["bullet 1", "bullet 2", ...],
  "actions": ["ação prática 1", "ação prática 2", ...]
}
Regras:
- Seja direto e positivo, mas realista.
- Foque em 3 a 5 bullets.
- Sugira ações práticas específicas (ex: "limitar alimentação a R$ X" e não genérico).
`;

  const completion = await openai.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: prompt },
      {
        role: "user",
        content: `Fatos:\n${JSON.stringify(facts, null, 2)}`,
      },
    ],
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw);
  return {
    summary: parsed.summary ?? "Resumo indisponível",
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
    actions: Array.isArray(parsed.actions) ? parsed.actions : [],
  };
}

async function saveInsight(userId, facts, insight) {
  ensureSupabase();
  const payload = {
    user_id: userId,
    summary: insight.summary,
    highlights: insight.highlights,
    actions: insight.actions,
    period_start: facts.periodStart,
    period_end: facts.periodEnd,
    raw: facts,
  };

  const { data, error } = await supabase.from("insights").insert(payload).select("*").single();
  if (error) throw error;
  return data;
}

async function listInsights(userId, { limit = 20 } = {}) {
  ensureSupabase();
  const { data, error } = await supabase
    .from("insights")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export default async function handler(req, res) {
  if (!openai.apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY não configurada." });
  }
  if (!supabase) {
    return res.status(500).json({ error: "SUPABASE_URL ou SUPABASE_SERVICE_KEY ausentes." });
  }

  let userId = null;
  let plan = "basic";
  try {
    const user = await requireUser(req);
    userId = user.id;
    plan = await resolveAiPlan(user);
  } catch (error) {
    const status = error.statusCode || 401;
    return res.status(status).json({ error: error.message || "Token inválido." });
  }

  const body = parseBody(req);

  if (req.method === "GET") {
    try {
      const insights = await listInsights(userId, { limit: 30 });
      return res.status(200).json({ insights });
    } catch (error) {
      console.error("[insights] list error", error);
      return res.status(500).json({ error: "Falha ao listar insights.", details: error.message });
    }
  }

  if (req.method === "POST") {
    try {
      await consumeAiUsage({
        userId,
        plan,
        deltas: { ai_relatorios: 1 },
        enforceLimits: false,
      });
      const data = await fetchFinancialData(userId, { days: body.days ?? 90 });
      if ((data.expenses?.length ?? 0) === 0 && (data.incomes?.length ?? 0) === 0) {
        return res.status(200).json({ ok: false, message: "Sem dados recentes para gerar insights." });
      }

      const facts = summarizeFacts(data);
      const insight = await generateInsightFromFacts(facts);
      const saved = await saveInsight(userId, facts, insight);

      return res.status(200).json({
        ok: true,
        insight: saved,
      });
    } catch (error) {
      console.error("[insights] generate error", error);
      const status = error.statusCode || 500;
      const errorMessage = status < 500 ? error.message : "Não foi possível gerar o insight agora.";
      return res.status(status).json({
        error: errorMessage,
        details: status < 500 ? undefined : error.message,
        code: error.code,
        hint: "Verifique se a tabela 'insights' existe e as credenciais SUPABASE_SERVICE_KEY estão corretas.",
        stage: "generate",
      });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Método não suportado." });
}
