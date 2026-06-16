import { supabase } from "../lib/supabase.js";

const TABLE = "incomes";

export async function createRevenue(payload) {
  const { data, error } = await supabase.from(TABLE).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function listRevenues(filters = {}) {
  let query = supabase.from(TABLE).select("*").order("date", { ascending: false });

  if (filters.userId) {
    query = query.eq("user_id", filters.userId);
  }

  if (filters.from) {
    query = query.gte("date", filters.from);
  }

  if (filters.to) {
    query = query.lte("date", filters.to);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function updateRevenue(id, payload) {
  const { data, error } = await supabase.from(TABLE).update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRevenue(id) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}

export async function deleteAllRevenuesByUser(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    throw new Error("Usuário não identificado para exclusão de rendas.");
  }
  const { error } = await supabase.from(TABLE).delete().eq("user_id", normalizedUserId);
  if (error) throw error;
}
