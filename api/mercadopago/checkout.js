/* eslint-env node */
import crypto from "crypto";
import { DEFAULT_PLAN_ID, PLAN_DETAILS } from "../../src/data/plans.js";

const MERCADO_PAGO_API = "https://api.mercadopago.com/checkout/preferences";

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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método não suportado." });
  }

  const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!accessToken) {
    return res.status(500).json({ error: "Credenciais do Mercado Pago não configuradas." });
  }

  const body = parseBody(req);
  const { plan = DEFAULT_PLAN_ID, userId, email } = body;

  if (!userId || !email) {
    return res.status(400).json({ error: "userId e email são obrigatórios para iniciar o checkout." });
  }

  const planKey = typeof plan === "string" ? plan.toLowerCase() : DEFAULT_PLAN_ID;
  const planConfig = PLAN_DETAILS[planKey] ?? PLAN_DETAILS[DEFAULT_PLAN_ID];

  const origin = req.headers.origin || process.env.APP_ORIGIN || "https://grana.app";
  const successUrl = process.env.MERCADOPAGO_SUCCESS_URL || `${origin}/assinatura/sucesso`;
  const failureUrl = process.env.MERCADOPAGO_FAILURE_URL || `${origin}/assinatura/erro`;
  const pendingUrl = process.env.MERCADOPAGO_PENDING_URL || `${origin}/assinatura/pendente`;
  const notificationUrl = process.env.MERCADOPAGO_WEBHOOK_URL || `${origin}/api/mercadopago/webhook`;

  const preferencePayload = {
    items: [
      {
        id: `granaapp-${planConfig.id}`,
        title: planConfig.name,
        description: planConfig.description,
        quantity: 1,
        currency_id: planConfig.currency ?? "BRL",
        unit_price: planConfig.price,
      },
    ],
    payer: {
      email,
    },
    statement_descriptor: "KORDEN",
    auto_return: "approved",
    back_urls: {
      success: successUrl,
      failure: failureUrl,
      pending: pendingUrl,
    },
    metadata: {
      plan: planConfig.id,
      userId,
      email,
    },
    external_reference: `${planConfig.id}-${userId}`,
    notification_url: notificationUrl,
    binary_mode: true,
  };

  try {
    const response = await fetch(MERCADO_PAGO_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Idempotency-Key": crypto.randomUUID?.() ?? `${userId}-${Date.now()}`,
      },
      body: JSON.stringify(preferencePayload),
    });

    const payload = await response.json();

    if (!response.ok) {
      console.error("[mercadopago] Erro ao criar preferência:", payload);
      const message = payload?.message || payload?.error || "Não foi possível gerar o checkout.";
      return res.status(response.status).json({ error: message });
    }

    return res.status(200).json({
      preferenceId: payload.id,
      checkoutUrl: payload.init_point || payload.sandbox_init_point,
    });
  } catch (error) {
    console.error("[mercadopago] Erro inesperado:", error);
    return res.status(500).json({ error: "Erro inesperado ao criar checkout." });
  }
}
