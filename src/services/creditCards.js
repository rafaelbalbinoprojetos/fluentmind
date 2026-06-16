import { supabase } from "../lib/supabase.js";

const TABLE = "credit_cards";

export async function listCreditCards(filters = {}) {
  let query = supabase.from(TABLE).select("*").order("name", { ascending: true });

  if (filters.userId) {
    query = query.eq("user_id", filters.userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createCreditCard(payload) {
  const { data, error } = await supabase.from(TABLE).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateCreditCard(id, payload) {
  const { data, error } = await supabase.from(TABLE).update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteCreditCard(id) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}
