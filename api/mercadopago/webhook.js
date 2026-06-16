/* eslint-env node */
import { createClient } from "@supabase/supabase-js";
import { DEFAULT_PLAN_ID, PLAN_DETAILS } from "../../src/data/plans.js";

const MERCADO_PAGO_API = "https://api.mercadopago.com/v1";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const mercadoPagoAccessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;

const supabase =
  supabaseUrl && supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, { auth: { persistSession: false } })
    : null;

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

function normalizePlan(plan) {
  const normalized = String(plan || "").trim().toLowerCase();
  if (!normalized) return DEFAULT_PLAN_ID;
  if (PLAN_DETAILS[normalized]) return normalized;
  return DEFAULT_PLAN_ID;
}

function toNullableIsoDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function extractNotificationInfo(req, body) {
  const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
  const queryId = url.searchParams.get("id");
  const queryTopic = (url.searchParams.get("topic") || url.searchParams.get("type") || "").toLowerCase();
  const bodyType = String(body?.type || body?.topic || "").toLowerCase();
  const type = bodyType || queryTopic;

  const candidateId =
    body?.data?.id ??
    body?.resource?.id ??
    queryId ??
    (typeof body?.id === "string" || typeof body?.id === "number" ? body.id : null);

  const id = candidateId !== null && candidateId !== undefined ? String(candidateId).trim() : "";
  return { id, type };
}

async function fetchMercadoPagoPayment(paymentId) {
  const response = await fetch(`${MERCADO_PAGO_API}/payments/${encodeURIComponent(paymentId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${mercadoPagoAccessToken}`,
      "Content-Type": "application/json",
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || payload?.error || `Falha ao consultar payment ${paymentId}`);
  }
  return payload;
}

async function resolveUserAndPlanFromPayment(payment) {
  const metadata = payment?.metadata ?? {};
  const payer = payment?.payer ?? {};
  const externalReference = String(payment?.external_reference || "").trim();

  let userId = String(metadata?.userId || metadata?.user_id || "").trim();
  const emailFromPayment = String(metadata?.email || payer?.email || "").trim().toLowerCase();
  let plan = normalizePlan(metadata?.plan);

  if (!userId && externalReference.includes("-")) {
    const [planFromReference, ...rest] = externalReference.split("-");
    const possiblePlan = normalizePlan(planFromReference);
    const possibleUserId = rest.join("-").trim();
    if (possibleUserId) {
      userId = possibleUserId;
      plan = possiblePlan;
    }
  }

  if (userId) {
    return { userId, plan, email: emailFromPayment };
  }

  if (!emailFromPayment) {
    return { userId: "", plan, email: "" };
  }

  const { data: users, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) {
    throw error;
  }

  const matchedUser = (users?.users ?? []).find(
    (user) => String(user?.email || "").trim().toLowerCase() === emailFromPayment,
  );

  return {
    userId: matchedUser?.id || "",
    plan,
    email: emailFromPayment,
  };
}

async function updateUserPlanMetadata({ userId, plan }) {
  const { data: existingUser, error: getUserError } = await supabase.auth.admin.getUserById(userId);
  if (getUserError) {
    throw getUserError;
  }

  const currentMetadata = existingUser?.user?.user_metadata ?? {};
  const nextMetadata = {
    ...currentMetadata,
    plan,
    has_seen_welcome: true,
  };

  // Pagamento aprovado substitui o período de avaliação.
  nextMetadata.trial_status = "expired";
  nextMetadata.trial_started_at = null;
  nextMetadata.trial_expires_at = null;

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: nextMetadata,
  });

  if (updateError) {
    throw updateError;
  }
}

async function registerAccessGrant({ userId, email, plan, payment }) {
  const normalizedEmail = String(email || "").trim().toLowerCase();
  if (!normalizedEmail) return;

  const paidAtRaw = payment?.date_approved || payment?.date_last_updated || payment?.date_created || null;
  const paidAt = paidAtRaw ? new Date(paidAtRaw) : new Date();
  const expiresAt = new Date(paidAt.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const payload = {
    email: normalizedEmail,
    user_id: userId || null,
    plan,
    expires_at: expiresAt,
    granted_at: new Date().toISOString(),
    granted_by_email: "mercadopago-webhook@system.local",
    status: "active",
    confirmed_at: new Date().toISOString(),
    revoked_at: null,
    confirmation_token_hash: null,
    confirmation_expires_at: null,
    confirmation_sent_at: null,
  };

  const { error } = await supabase.from("ultra_access_grants").upsert(payload, { onConflict: "email" });
  if (error) {
    console.warn("[mercadopago:webhook] nao foi possivel registrar ultra_access_grants:", error.message);
  }
}

async function registerPaymentAudit({ payment, userId, plan, webhookResult, webhookReason = null }) {
  const paymentId = String(payment?.id || "").trim();
  if (!paymentId) return;

  const metadata = payment?.metadata ?? {};
  const payer = payment?.payer ?? {};
  const payload = {
    payment_id: paymentId,
    status: String(payment?.status || "unknown").toLowerCase(),
    user_id: userId || String(metadata?.userId || metadata?.user_id || "").trim() || null,
    payer_email: String(metadata?.email || payer?.email || "").trim().toLowerCase() || null,
    plan: normalizePlan(plan || metadata?.plan),
    amount: Number.isFinite(Number(payment?.transaction_amount)) ? Number(payment?.transaction_amount) : null,
    currency: String(payment?.currency_id || "").trim().toUpperCase() || null,
    payment_method: String(payment?.payment_method_id || "").trim().toLowerCase() || null,
    external_reference: String(payment?.external_reference || "").trim() || null,
    approved_at: toNullableIsoDate(payment?.date_approved),
    processed_at: new Date().toISOString(),
    webhook_result: webhookResult,
    webhook_reason: webhookReason,
    source: "mercadopago-webhook",
    raw: payment,
  };

  const { error } = await supabase.from("mercadopago_payments").upsert(payload, { onConflict: "payment_id" });
  if (error) {
    console.warn("[mercadopago:webhook] nao foi possivel registrar mercadopago_payments:", error.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Método não suportado." });
  }

  if (!mercadoPagoAccessToken) {
    return res.status(500).json({ ok: false, error: "MERCADOPAGO_ACCESS_TOKEN não configurado." });
  }

  if (!supabase) {
    return res.status(500).json({ ok: false, error: "SUPABASE_URL/SUPABASE_SERVICE_KEY não configurados." });
  }

  try {
    const body = parseBody(req);
    const { id: notificationId, type } = extractNotificationInfo(req, body);

    // Mercado Pago envia várias notificações; para esse fluxo só processamos pagamentos.
    if (type && !type.includes("payment")) {
      return res.status(200).json({ ok: true, ignored: true, reason: `topic ${type} ignorado` });
    }

    if (!notificationId) {
      return res.status(200).json({ ok: true, ignored: true, reason: "notificacao sem id" });
    }

    const payment = await fetchMercadoPagoPayment(notificationId);
    const status = String(payment?.status || "").toLowerCase();

    if (status !== "approved") {
      await registerPaymentAudit({
        payment,
        userId: "",
        plan: "",
        webhookResult: "ignored",
        webhookReason: `status_${status || "desconhecido"}`,
      });
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: `payment ${notificationId} com status ${status || "desconhecido"}`,
      });
    }

    const { userId, plan, email } = await resolveUserAndPlanFromPayment(payment);
    if (!userId) {
      await registerPaymentAudit({
        payment,
        userId: "",
        plan,
        webhookResult: "ignored",
        webhookReason: "usuario_nao_identificado",
      });
      return res.status(200).json({
        ok: true,
        ignored: true,
        reason: "usuario nao identificado no pagamento",
      });
    }

    await updateUserPlanMetadata({ userId, plan });
    await registerAccessGrant({ userId, email, plan, payment });
    await registerPaymentAudit({
      payment,
      userId,
      plan,
      webhookResult: "processed",
      webhookReason: null,
    });

    return res.status(200).json({
      ok: true,
      processed: true,
      paymentId: notificationId,
      userId,
      plan,
      status,
    });
  } catch (error) {
    console.error("[mercadopago:webhook] erro:", error);
    return res.status(500).json({
      ok: false,
      error: error?.message || "Falha ao processar webhook do Mercado Pago.",
    });
  }
}
