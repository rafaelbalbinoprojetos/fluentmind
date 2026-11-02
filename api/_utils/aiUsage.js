/* eslint-env node */
import { createClient } from "@supabase/supabase-js";
import { isMasterEmail } from "./accessControl.js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : null;


const ULTRA_ACCESS_TABLE = "ultra_access_grants";

function normalizeEmail(value) {
  if (!value) return "";
  return String(value).trim().toLowerCase();
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
  try {
    ensureSupabase();
  } catch (error) {
    console.warn("[aiUsage] Supabase admin not configured while checking Ultra access.", error?.message || error);
    return false;
  }
  const normalizedEmail = normalizeEmail(email);
  if (!userId && !normalizedEmail) return false;

  const baseQuery = () => supabaseAdmin
    .from(ULTRA_ACCESS_TABLE)
    .select("id, revoked_at, status, plan, expires_at, user_id")
    .order("granted_at", { ascending: false })
    .limit(1);

  let grant = null;

  if (userId) {
    const { data, error } = await baseQuery().eq("user_id", userId).maybeSingle();
    if (error) throw error;
    if (!error && data) {
      grant = data;
    }
  }

  // Legacy grants may predate user binding. Never use a grant bound to someone else.
  if (!grant && normalizedEmail) {
    const { data, error } = await baseQuery().eq("email", normalizedEmail).is("user_id", null).maybeSingle();
    if (error) throw error;
    grant = data;
  }

  if (!isActiveGrant(grant)) return false;
  const plan = normalizePlan(grant?.plan);
  return plan === "premium";
}

export async function resolveAiPlan(user) {
  const metadata = user?.app_metadata ?? {};
  const plan = metadata.plan ?? "free";
  const trialStatus = metadata.trial_status;
  const trialExpiresAt = metadata.trial_expires_at;
  const trialActive = trialStatus === "active" && trialExpiresAt && new Date(trialExpiresAt).getTime() > Date.now();
  const premiumByPlan = plan === "premium";
  const premiumByUltra = await hasUltraAccess({ userId: user?.id, email: user?.email }).catch((error) => {
    console.warn("[aiUsage] Could not check Ultra access.", error?.message || error);
    return false;
  });
  const premiumByMasterEmail = isMasterEmail(user?.email);

  return premiumByPlan || premiumByUltra || premiumByMasterEmail || trialActive ? "pro" : "basic";
}

// Reserve before calling any paid provider. The RPC atomically checks and increments.
export async function consumeAiUsage({ userId, plan, deltas } = {}) {
  if (!userId) throw Object.assign(new Error("Usuário não identificado."), { statusCode: 401 });
  if (plan !== "pro") {
    throw Object.assign(new Error("Recurso disponível apenas no plano Pro ou durante o teste gratuito."), {
      statusCode: 403, code: "plan_required",
    });
  }
  const amount = deltas?.ai_chat;
  if (!Number.isInteger(amount) || amount < 1 || Object.keys(deltas).some((key) => key !== "ai_chat")) {
    throw Object.assign(new Error("Consumo de IA inválido."), { statusCode: 400 });
  }
  ensureSupabase();
  const { data, error } = await supabaseAdmin.rpc("consume_ai_usage", {
    p_user_id: userId, p_amount: amount, p_limit: 300,
  });
  if (error) {
    const limited = error.code === "P0001" && error.message === "ai_limit_reached";
    throw Object.assign(new Error(limited
      ? "Limite mensal de IA atingido (300 operações)."
      : "Não foi possível reservar a cota de IA. Tente novamente mais tarde."), {
      statusCode: limited ? 429 : 503,
      code: limited ? "limit_reached" : "usage_unavailable",
    });
  }
  return data;
}

export async function reserveAiUsage(user) {
  const plan = await resolveAiPlan(user);
  return consumeAiUsage({ userId: user.id, plan, deltas: { ai_chat: 1 } });
}
