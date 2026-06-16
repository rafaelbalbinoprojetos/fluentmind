import { supabase } from "../lib/supabase.js";

const BILLS_TABLE = "contas_fixas";
const OCCURRENCES_TABLE = "contas_fixas_ocorrencias";

export async function listFixedBills({ userId, activeOnly = false } = {}) {
  if (!userId) return [];

  let query = supabase.from(BILLS_TABLE).select("*").eq("user_id", userId).order("dia_vencimento", {
    ascending: true,
  });

  if (activeOnly) {
    query = query.eq("ativa", true);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createFixedBill(payload) {
  const { data, error } = await supabase.from(BILLS_TABLE).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateFixedBill(id, payload) {
  const { data, error } = await supabase.from(BILLS_TABLE).update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteFixedBill(id) {
  const { error } = await supabase.from(BILLS_TABLE).delete().eq("id", id);
  if (error) throw error;
}

export async function listFixedBillOccurrences({
  userId,
  from,
  to,
  status,
  limit,
} = {}) {
  if (!userId) return [];

  let query = supabase
    .from(OCCURRENCES_TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("data_vencimento", { ascending: true });

  if (from) {
    query = query.gte("data_vencimento", from);
  }

  if (to) {
    query = query.lte("data_vencimento", to);
  }

  if (status && status !== "todos") {
    query = query.eq("status", status);
  }

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function upsertFixedBillOccurrence(payload) {
  const { data, error } = await supabase
    .from(OCCURRENCES_TABLE)
    .upsert(payload, { onConflict: "conta_fixa_id,referencia_mes" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateFixedBillOccurrence(id, payload) {
  const { data, error } = await supabase
    .from(OCCURRENCES_TABLE)
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteFixedBillOccurrence(id) {
  const { error } = await supabase.from(OCCURRENCES_TABLE).delete().eq("id", id);
  if (error) throw error;
}
