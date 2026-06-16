import { supabase } from "../lib/supabase.js";

const TABLE = "carteira";

export async function listInvestments(filters = {}) {
  let query = supabase
    .from(TABLE)
    .select("*")
    .order("data_compra", { ascending: false });

  if (filters.userId) {
    query = query.eq("user_id", filters.userId);
  }

  if (filters.from) {
    query = query.gte("data_compra", filters.from);
  }

  if (filters.to) {
    query = query.lte("data_compra", filters.to);
  }

  if (filters.type) {
    query = query.eq("tipo", filters.type);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((item) => ({
    ...item,
    date: item.data_compra,
    value: Number(item.quantidade ?? 0) * Number(item.preco_medio ?? 0),
  }));
}

export async function createInvestment(payload) {
  const { data, error } = await supabase.from(TABLE).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateInvestment(id, payload) {
  const { data, error } = await supabase.from(TABLE).update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteInvestment(id) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}
