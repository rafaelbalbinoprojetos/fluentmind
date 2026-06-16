/* eslint-env node */
/**
 * POST /api/ultra-access
 * Roteador único para grant e confirm do acesso vitalício.
 * Body: { action: "grant" | "confirm", ...params }
 */
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "./_utils/auth.js";
import { isMasterEmail, sanitizeEmailInput } from "./_utils/accessControl.js";

const supabaseUrl        = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
  : null;

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body;
}

function normalizePlan(value) {
  const v = String(value || "").trim().toLowerCase();
  if (!v || v === "pro") return "premium";
  return v;
}

function toNullableIsoDate(value) {
  if (!value) return null;
  const raw    = String(value).trim();
  if (!raw) return null;
  const parsed = raw.includes("T") ? new Date(raw) : new Date(`${raw}T23:59:59`);
  return isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function buildAppBaseUrl(req) {
  if (process.env.APP_BASE_URL) return String(process.env.APP_BASE_URL).replace(/\/$/, "");
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host  = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

async function findUserByEmail(normalizedEmail) {
  let page = 1;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data?.users ?? [];
    const match = users.find((u) => String(u?.email || "").trim().toLowerCase() === normalizedEmail);
    if (match) return match;
    if (users.length < 1000) break;
    page++;
  }
  return null;
}

// ─── Grant ─────────────────────────────────────────────────────────────────

async function handleGrant(req, actor) {
  const actorEmail = sanitizeEmailInput(actor?.email);
  if (!isMasterEmail(actorEmail)) {
    throw Object.assign(new Error("Apenas usuários master podem conceder acesso vitalício."), { statusCode: 403 });
  }

  const body        = parseBody(req);
  const targetEmail = sanitizeEmailInput(body?.email);
  const plan        = normalizePlan(body?.plan);
  const expiresAt   = toNullableIsoDate(body?.expiresAt);

  if (!targetEmail) throw Object.assign(new Error("Email inválido para concessão."), { statusCode: 400 });

  // Tenta localizar usuário existente — mas não bloqueia se ainda não tiver conta
  const targetUser = await findUserByEmail(targetEmail).catch(() => null);

  const token                 = crypto.randomBytes(24).toString("hex");
  const tokenHash             = crypto.createHash("sha256").update(token).digest("hex");
  const confirmationExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabaseAdmin.from("ultra_access_grants").upsert({
    email: targetEmail, user_id: targetUser?.id ?? null, plan, expires_at: expiresAt,
    granted_at: new Date().toISOString(), granted_by: actor.id ?? null,
    granted_by_email: actorEmail ?? null, revoked_at: null, status: "pending",
    confirmed_at: null, confirmation_sent_at: new Date().toISOString(),
    confirmation_expires_at: confirmationExpiresAt, confirmation_token_hash: tokenHash,
  }, { onConflict: "email" });
  if (error) throw error;

  const baseUrl    = buildAppBaseUrl(req);
  const confirmUrl = `${baseUrl}/acesso-ultra/confirmar?token=${encodeURIComponent(token)}&email=${encodeURIComponent(targetEmail)}`;

  return { ok: true, email: targetEmail, status: "pending", confirmationExpiresAt, confirmUrl,
    note: "Envie este link por email ao usuário ou peça para confirmar direto no app." };
}

// ─── Confirm ───────────────────────────────────────────────────────────────

async function handleConfirm(req, currentUser) {
  const currentEmail = sanitizeEmailInput(currentUser?.email);
  if (!currentEmail) throw Object.assign(new Error("Sessão inválida."), { statusCode: 401 });

  const body  = parseBody(req);
  const token = String(body?.token || "").trim();
  if (!token) throw Object.assign(new Error("Token de confirmação ausente."), { statusCode: 400 });

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

  const { data: grant, error: fetchError } = await supabaseAdmin
    .from("ultra_access_grants")
    .select("id,email,user_id,status,revoked_at,confirmation_expires_at,confirmation_token_hash")
    .eq("email", currentEmail).maybeSingle();
  if (fetchError) throw fetchError;
  if (!grant) throw Object.assign(new Error("Não há convite pendente para este usuário."), { statusCode: 404 });
  if (grant.revoked_at) throw Object.assign(new Error("Este acesso foi revogado."), { statusCode: 400 });
  if (String(grant.status || "").toLowerCase() !== "pending") {
    throw Object.assign(new Error("Este acesso não está pendente de confirmação."), { statusCode: 400 });
  }
  if (!grant.confirmation_token_hash || grant.confirmation_token_hash !== tokenHash) {
    throw Object.assign(new Error("Token de confirmação inválido."), { statusCode: 400 });
  }
  if (!grant.confirmation_expires_at || new Date(grant.confirmation_expires_at).getTime() <= Date.now()) {
    throw Object.assign(new Error("Token expirado. Solicite um novo link."), { statusCode: 400 });
  }

  const { error: updateError } = await supabaseAdmin.from("ultra_access_grants").update({
    status: "active", user_id: currentUser.id ?? grant.user_id ?? null,
    confirmed_at: new Date().toISOString(),
    confirmation_token_hash: null, confirmation_expires_at: null,
  }).eq("id", grant.id);
  if (updateError) throw updateError;

  return { ok: true, status: "active", email: currentEmail };
}

// ─── Handler principal ─────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não suportado." });
  }
  if (!supabaseAdmin) return res.status(500).json({ error: "Supabase admin não configurado." });

  let user;
  try { user = await requireUser(req); }
  catch (err) { return res.status(err.statusCode ?? 401).json({ error: err.message }); }

  const action = parseBody(req).action;

  try {
    let result;
    if (action === "grant")        result = await handleGrant(req, user);
    else if (action === "confirm") result = await handleConfirm(req, user);
    else return res.status(400).json({ error: `Ação desconhecida: ${action}` });
    return res.status(200).json(result);
  } catch (err) {
    console.error(`[ultra-access:${action}]`, err);
    const status = err.statusCode || 500;
    return res.status(status).json({ error: status < 500 ? err.message : "Falha na operação de acesso." });
  }
}
