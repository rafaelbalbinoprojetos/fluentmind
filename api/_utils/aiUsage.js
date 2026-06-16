/* eslint-env node */
import { createClient } from "@supabase/supabase-js";
import { isMasterEmail } from "./accessControl.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : null;

const USAGE_TABLE = "ai_usage";
const ULTRA_ACCESS_TABLE = "ultra_access_grants";

const LIMITS_BY_PLAN = {
  basic: {
    ai_registros: 0,
    ai_analises: 0,
    ai_relatorios: 0,
    ai_chat: 0,
  },
  pro: {
    ai_registros: 200,
    ai_analises: 40,
    ai_relatorios: 10,
    ai_chat: 300,
  },
};

const USAGE_LABELS = {
  ai_registros: "registros via IA",
  ai_analises: "análises",
  ai_relatorios: "relatórios inteligentes",
  ai_chat: "chat financeiro",
};

function normalizeEmail(value) {
  if (!value) return "";
  return String(value).trim().toLowerCase();
}

function monthStartISO(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)).toISOString().slice(0, 10);
}

function ensureSupabase() {
  if (!supabaseAdmin) {
    const error = new Error("Supabase admin client not configured.");
    error.statusCode = 500;
    throw error;
  }
}

function isActiveGrant(record) {
  if (!record || record.revoked_at) return false;
  const status = String(record.status || "active").toLowerCase();
  if (status !== "active") return false;
  if (!record.expires_at) return true;
  const expiry = new Date(record.expires_at);
  if (Number.isNaN(expiry.getTime())) return false;
  return expiry.getTime() > Date.now();
}

function normalizePlan(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "premium";
  if (normalized === "pro") return "premium";
  return normalized;
}

async function hasUltraAccess({ userId, email } = {}) {
  ensureSupabase();
  const normalizedEmail = normalizeEmail(email);
  if (!userId && !normalizedEmail) return false;

  const baseQuery = supabaseAdmin
    .from(ULTRA_ACCESS_TABLE)
    .select("id, revoked_at, status, plan, expires_at, user_id")
    .order("granted_at", { ascending: false })
    .limit(1);

  let grant = null;

  if (userId) {
    const { data, error } = await baseQuery.eq("user_id", userId).maybeSingle();
    if (!error && data) {
      grant = data;
    }
  }

  if (!grant && normalizedEmail) {
    const { data, error } = await baseQuery.eq("email", normalizedEmail).maybeSingle();
    if (!error && data) {
      grant = data;
    }
  }

  if (!isActiveGrant(grant)) return false;
  const plan = normalizePlan(grant?.plan);
  return plan === "premium";
}

export async function resolveAiPlan(user) {
  const metadata = user?.user_metadata ?? {};
  const plan = metadata.plan ?? "free";
  const trialStatus = metadata.trial_status;
  const trialExpiresAt = metadata.trial_expires_at;
  const trialActive = trialStatus === "active" && trialExpiresAt && new Date(trialExpiresAt).getTime() > Date.now();
  const premiumByPlan = plan === "premium";
  const premiumByUltra = await hasUltraAccess({ userId: user?.id, email: user?.email });
  const premiumByMasterEmail = isMasterEmail(user?.email);

  return premiumByPlan || premiumByUltra || premiumByMasterEmail || trialActive ? "pro" : "basic";
}

async function loadUsageRow(userId) {
  ensureSupabase();
  const { data, error } = await supabaseAdmin
    .from(USAGE_TABLE)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    const err = new Error(error.message || "Falha ao consultar uso de IA.");
    err.statusCode = 500;
    throw err;
  }

  return data ?? null;
}

function resetIfNewMonth(row, currentMonth) {
  if (!row || !row.month || row.month.slice(0, 10) === currentMonth) {
    return row;
  }

  return {
    ...row,
    month: currentMonth,
    ai_registros: 0,
    ai_analises: 0,
    ai_relatorios: 0,
    ai_chat: 0,
  };
}

function buildLimitMessage(key, limit) {
  const label = USAGE_LABELS[key] ?? "uso de IA";
  return `Limite mensal atingido para ${label} (${limit}).`;
}

export async function consumeAiUsage({ userId, plan, deltas, enforceLimits = true } = {}) {
  ensureSupabase();
  if (!userId) {
    const error = new Error("Usuário não identificado para uso de IA.");
    error.statusCode = 400;
    throw error;
  }

  const planKey = plan === "pro" ? "pro" : "basic";
  const limits = LIMITS_BY_PLAN[planKey];
  const hasUsage = Object.values(deltas || {}).some((value) => Number(value) > 0);

  if (planKey === "basic" && hasUsage) {
    const error = new Error("Recurso disponível apenas no plano Pro.");
    error.statusCode = 403;
    error.code = "plan_required";
    throw error;
  }

  const month = monthStartISO();
  const existing = await loadUsageRow(userId);
  const normalized = resetIfNewMonth(existing ?? {
    user_id: userId,
    month,
    ai_registros: 0,
    ai_analises: 0,
    ai_relatorios: 0,
    ai_chat: 0,
  }, month);

  const updated = {
    ...normalized,
  };

  for (const [key, deltaRaw] of Object.entries(deltas || {})) {
    const delta = Number(deltaRaw) || 0;
    if (!delta) continue;
    const currentValue = Number(updated[key]) || 0;
    const nextValue = currentValue + delta;
    const limit = limits?.[key];

    if (enforceLimits && typeof limit === "number" && nextValue > limit) {
      const error = new Error(buildLimitMessage(key, limit));
      error.statusCode = 429;
      error.code = "limit_reached";
      throw error;
    }

    updated[key] = nextValue;
  }

  updated.month = month;
  updated.updated_at = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from(USAGE_TABLE)
    .upsert(updated, { onConflict: "user_id" })
    .select()
    .single();

  if (error) {
    const err = new Error(error.message || "Falha ao registrar uso de IA.");
    err.statusCode = 500;
    throw err;
  }

  return data;
}
