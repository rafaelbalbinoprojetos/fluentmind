import { supabase } from "../lib/supabase.js";
import { sanitizeEmailInput, ULTRA_ACCESS_TABLE } from "../config/accessControl.js";

const TABLE = ULTRA_ACCESS_TABLE;
const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
const ULTRA_SELECT_FULL = "id,email,granted_at,granted_by_email,revoked_at,status,plan,expires_at,confirmation_expires_at,user_id";
const ULTRA_SELECT_LEGACY = "id,email,granted_at,granted_by_email,revoked_at,plan,expires_at,user_id";

function normalizePlan(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "pro") return "premium";
  return normalized || "premium";
}

function normalizeExpiresAt(value) {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  const raw = String(value).trim();
  if (!raw) return null;
  if (raw.includes("T")) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  const parsed = new Date(`${raw}T23:59:59`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
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

async function queryUltraAccessWithLegacyFallback(buildQuery) {
  let query = buildQuery(ULTRA_SELECT_FULL);
  let result = await query;

  if (!result.error) {
    return result;
  }

  const message = String(result.error?.message || "").toLowerCase();
  const missingStatus = message.includes("status") && (message.includes("column") || message.includes("does not exist"));
  const missingConfirmation =
    message.includes("confirmation_") && (message.includes("column") || message.includes("does not exist"));

  if (!missingStatus && !missingConfirmation) {
    return result;
  }

  query = buildQuery(ULTRA_SELECT_LEGACY);
  result = await query;
  return result;
}

export async function fetchUltraAccessPass(email) {
  const normalizedEmail = sanitizeEmailInput(email);
  if (!normalizedEmail) {
    return { record: null, active: false, plan: null, expiresAt: null, isLifetime: false };
  }

  const { data, error } = await queryUltraAccessWithLegacyFallback((columns) =>
    supabase
      .from(TABLE)
      .select(columns)
      .eq("email", normalizedEmail)
      .order("granted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );

  if (error) {
    throw error;
  }

  const record = data ?? null;
  const active = isActiveGrant(record);
  const plan = record?.plan ? normalizePlan(record.plan) : null;
  const expiresAt = record?.expires_at ?? null;
  const isLifetime = active && !expiresAt;

  return { record, active, plan, expiresAt, isLifetime };
}

export async function fetchUltraAccessPassByUserId(userId, email) {
  if (!userId) {
    return fetchUltraAccessPass(email);
  }

  const { data, error } = await queryUltraAccessWithLegacyFallback((columns) =>
    supabase
      .from(TABLE)
      .select(columns)
      .eq("user_id", userId)
      .order("granted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );

  if (error) {
    throw error;
  }

  const record = data ?? null;
  const active = isActiveGrant(record);
  const plan = record?.plan ? normalizePlan(record.plan) : null;
  const expiresAt = record?.expires_at ?? null;
  const isLifetime = active && !expiresAt;

  return { record, active, plan, expiresAt, isLifetime };
}

export async function hasUltraAccess(email) {
  const { active, plan } = await fetchUltraAccessPass(email);
  return active && normalizePlan(plan) === "premium";
}

export async function listUltraAccessPasses() {
  const { data, error } = await queryUltraAccessWithLegacyFallback((columns) =>
    supabase
      .from(TABLE)
      .select(columns)
      .order("email", { ascending: true }),
  );

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function grantUltraAccess(email, { grantedBy, grantedByEmail, plan, expiresAt } = {}) {
  const normalizedEmail = sanitizeEmailInput(email);
  if (!normalizedEmail) {
    throw new Error("Informe um email válido para liberar o acesso.");
  }

  const payload = {
    email: normalizedEmail,
    granted_at: new Date().toISOString(),
    granted_by: grantedBy ?? null,
    granted_by_email: grantedByEmail ?? null,
    revoked_at: null,
    plan: normalizePlan(plan),
    expires_at: normalizeExpiresAt(expiresAt),
  };

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: "email" })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function requestUltraAccessGrant(
  email,
  { plan, expiresAt, accessToken } = {},
) {
  if (!accessToken) {
    throw new Error("Sessão inválida para concessão.");
  }

  const normalizedEmail = sanitizeEmailInput(email);
  if (!normalizedEmail) {
    throw new Error("Informe um email válido para liberar o acesso.");
  }

  const response = await fetch(`${API_BASE}/api/ultra-access`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      action: "grant",
      email: normalizedEmail,
      plan: normalizePlan(plan),
      expiresAt: normalizeExpiresAt(expiresAt),
    }),
  });

  const rawText = await response.text();
  let data = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const isLocalDev = typeof window !== "undefined" && /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
    if (response.status === 404 && isLocalDev) {
      // No Vite dev server, rotas /api não existem por padrão.
      const granted = await grantUltraAccess(normalizedEmail, {
        plan: normalizePlan(plan),
        expiresAt: normalizeExpiresAt(expiresAt),
      });
      return {
        ok: true,
        fallbackMode: "direct_supabase",
        email: normalizedEmail,
        status: "active",
        grant: granted,
      };
    }
    throw new Error(data?.error || `Erro ${response.status}`);
  }

  return data ?? {};
}

export async function confirmUltraAccess({ token, accessToken } = {}) {
  if (!accessToken) {
    throw new Error("Sessão inválida para confirmação.");
  }
  const normalizedToken = String(token || "").trim();
  if (!normalizedToken) {
    throw new Error("Token de confirmação ausente.");
  }

  const response = await fetch(`${API_BASE}/api/ultra-access`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ action: "confirm", token: normalizedToken }),
  });

  const rawText = await response.text();
  let data = null;
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    throw new Error(data?.error || `Erro ${response.status}`);
  }

  return data ?? {};
}

export async function revokeUltraAccessPass(identifier) {
  const normalizedEmail = typeof identifier === "string" ? sanitizeEmailInput(identifier) : null;
  const filterById = identifier && typeof identifier === "object" ? identifier.id : null;

  if (!normalizedEmail && !filterById) {
    throw new Error("Selecione qual acesso deseja remover.");
  }

  let query = supabase
    .from(TABLE)
    .update({ revoked_at: new Date().toISOString() })
    .select()
    .single();

  if (filterById) {
    query = query.eq("id", filterById);
  } else if (normalizedEmail) {
    query = query.eq("email", normalizedEmail).is("revoked_at", null);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return data;
}
