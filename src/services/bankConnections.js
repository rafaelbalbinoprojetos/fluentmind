import { supabase } from "../lib/supabase.js";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

// ─── Supabase helpers ──────────────────────────────────────────────────────

export async function listBankConnections(userId) {
  const { data, error } = await supabase
    .from("bank_connections")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createBankConnection({ userId, itemId, institutionId, institutionName, institutionLogo }) {
  const { data, error } = await supabase
    .from("bank_connections")
    .upsert(
      {
        user_id: userId,
        item_id: itemId,
        institution_id: institutionId ?? null,
        institution_name: institutionName,
        institution_logo: institutionLogo ?? null,
        status: "connected",
        last_synced_at: null,
      },
      { onConflict: "user_id,item_id" }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listBankTransactions(userId, { connectionId, limit = 50, offset = 0 } = {}) {
  let query = supabase
    .from("bank_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .range(offset, offset + limit - 1);

  if (connectionId) {
    query = query.eq("connection_id", connectionId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

// ─── API serverless helpers ────────────────────────────────────────────────

async function authHeaders(session) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

export async function fetchConnectToken(session, itemId = null) {
  const res = await fetch(`${API_BASE}/api/pluggy`, {
    method: "POST",
    headers: await authHeaders(session),
    body: JSON.stringify({ action: "connect-token", ...(itemId ? { itemId } : {}) }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Erro ao gerar token de conexão.");
  return data.connectToken;
}

export async function syncBankConnection(session, { itemId, connectionId }) {
  const res = await fetch(`${API_BASE}/api/pluggy`, {
    method: "POST",
    headers: await authHeaders(session),
    body: JSON.stringify({ action: "sync", itemId, connectionId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Erro ao sincronizar.");
  return data;
}

export async function disconnectBankConnection(session, connectionId) {
  const res = await fetch(`${API_BASE}/api/pluggy`, {
    method: "POST",
    headers: await authHeaders(session),
    body: JSON.stringify({ action: "disconnect", connectionId }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Erro ao desconectar.");
  return data;
}
