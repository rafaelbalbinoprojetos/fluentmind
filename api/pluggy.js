/* eslint-env node */
/**
 * POST /api/pluggy
 * Roteador único para todas as operações Pluggy (economiza slots serverless).
 * Body: { action: "connect-token" | "sync" | "disconnect", ...params }
 * Exclusivo para usuários premium.
 */
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "./_utils/auth.js";
import { isMasterEmail } from "./_utils/accessControl.js";

export const runtime = "nodejs";

const PLUGGY_CLIENT_ID     = process.env.PLUGGY_CLIENT_ID;
const PLUGGY_CLIENT_SECRET = process.env.PLUGGY_CLIENT_SECRET;
const PLUGGY_API_URL       = "https://api.pluggy.ai";

const supabase = (() => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
})();

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") { try { return JSON.parse(req.body); } catch { return {}; } }
  return req.body;
}

function hasPremiumAccess(user) {
  if (!user) return false;
  if (isMasterEmail(user.email)) return true;
  const meta = user.user_metadata ?? {};
  if (meta.plan === "premium") return true;
  const trialExpiresAt = meta.trial_expires_at ? new Date(meta.trial_expires_at) : null;
  return meta.trial_status === "active" && trialExpiresAt && trialExpiresAt.getTime() > Date.now();
}

async function getPluggyApiKey() {
  const res = await fetch(`${PLUGGY_API_URL}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ clientId: PLUGGY_CLIENT_ID, clientSecret: PLUGGY_CLIENT_SECRET }),
  });
  if (!res.ok) throw new Error(`Pluggy auth falhou: ${await res.text()}`);
  return (await res.json()).apiKey;
}

// ─── Actions ───────────────────────────────────────────────────────────────

async function handleConnectToken({ itemId } = {}) {
  const apiKey = await getPluggyApiKey();
  const body   = itemId ? { itemId } : {};
  const res    = await fetch(`${PLUGGY_API_URL}/connect_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Pluggy connect_token falhou: ${await res.text()}`);
  return { connectToken: (await res.json()).accessToken };
}

async function handleSync({ userId, itemId, connectionId }) {
  if (!itemId || !connectionId) throw Object.assign(new Error("itemId e connectionId são obrigatórios."), { statusCode: 400 });

  const { data: conn, error: connErr } = await supabase
    .from("bank_connections").select("id").eq("id", connectionId).eq("user_id", userId).single();
  if (connErr || !conn) throw Object.assign(new Error("Conexão não encontrada."), { statusCode: 404 });

  const apiKey   = await getPluggyApiKey();
  const accRes   = await fetch(`${PLUGGY_API_URL}/accounts?itemId=${itemId}`, { headers: { "X-API-KEY": apiKey } });
  if (!accRes.ok) throw new Error(`Pluggy accounts falhou: ${await accRes.text()}`);
  const accounts = (await accRes.json()).results ?? [];

  let totalUpserted = 0;
  for (const account of accounts) {
    const txRes = await fetch(`${PLUGGY_API_URL}/transactions?accountId=${account.id}&pageSize=100`, { headers: { "X-API-KEY": apiKey } });
    if (!txRes.ok) throw new Error(`Pluggy transactions falhou: ${await txRes.text()}`);
    const txs = (await txRes.json()).results ?? [];

    if (txs.length > 0) {
      const rows = txs.map((t) => ({
        user_id: userId, connection_id: connectionId,
        pluggy_transaction_id: t.id, account_id: account.id, account_name: account.name ?? null,
        description: t.description ?? t.descriptionRaw ?? null,
        amount: t.amount ?? 0, type: t.type ?? null, category: t.category ?? null,
        date: t.date ? t.date.slice(0, 10) : null, balance_after: t.balance ?? null,
        currency_code: t.currencyCode ?? "BRL", raw: t,
      }));
      const { error: upsertErr } = await supabase.from("bank_transactions")
        .upsert(rows, { onConflict: "user_id,pluggy_transaction_id" });
      if (upsertErr) throw upsertErr;
      totalUpserted += rows.length;
    }
  }

  await supabase.from("bank_connections")
    .update({ last_synced_at: new Date().toISOString(), status: "connected" })
    .eq("id", connectionId);

  return { synced: totalUpserted };
}

async function handleDisconnect({ userId, connectionId }) {
  if (!connectionId) throw Object.assign(new Error("connectionId é obrigatório."), { statusCode: 400 });

  const { data: conn, error: connErr } = await supabase
    .from("bank_connections").select("id, item_id").eq("id", connectionId).eq("user_id", userId).single();
  if (connErr || !conn) throw Object.assign(new Error("Conexão não encontrada."), { statusCode: 404 });

  // Tenta deletar no Pluggy (melhor esforço)
  if (PLUGGY_CLIENT_ID && PLUGGY_CLIENT_SECRET) {
    try {
      const apiKey = await getPluggyApiKey();
      await fetch(`${PLUGGY_API_URL}/items/${conn.item_id}`, { method: "DELETE", headers: { "X-API-KEY": apiKey } });
    } catch (e) { console.warn("[pluggy] Falha ao deletar item no Pluggy:", e.message); }
  }

  const { error: deleteErr } = await supabase.from("bank_connections")
    .delete().eq("id", connectionId).eq("user_id", userId);
  if (deleteErr) throw deleteErr;

  return { success: true };
}

// ─── Handler principal ─────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Método não permitido." });

  if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
    return res.status(500).json({ error: "Pluggy não configurado no servidor." });
  }
  if (!supabase) return res.status(500).json({ error: "Supabase não configurado." });

  let user;
  try { user = await requireUser(req); }
  catch (err) { return res.status(err.statusCode ?? 401).json({ error: err.message }); }

  if (!hasPremiumAccess(user)) {
    return res.status(403).json({ error: "Recurso exclusivo para usuários premium." });
  }

  const body   = parseBody(req);
  const action = body.action;

  try {
    let result;
    if (action === "connect-token") {
      result = await handleConnectToken({ itemId: body.itemId ?? null });
    } else if (action === "sync") {
      result = await handleSync({ userId: user.id, itemId: body.itemId, connectionId: body.connectionId });
    } else if (action === "disconnect") {
      result = await handleDisconnect({ userId: user.id, connectionId: body.connectionId });
    } else {
      return res.status(400).json({ error: `Ação desconhecida: ${action}` });
    }
    return res.status(200).json(result);
  } catch (err) {
    console.error(`[pluggy:${action}]`, err);
    if (err.statusCode) return res.status(err.statusCode).json({ error: err.message });

    // Em caso de erro de sync, marca a conexão como erro
    if (action === "sync" && body.connectionId) {
      await supabase.from("bank_connections").update({ status: "error" }).eq("id", body.connectionId).catch(() => {});
    }
    return res.status(500).json({ error: "Falha na operação bancária." });
  }
}
