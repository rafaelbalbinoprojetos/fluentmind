import { supabase } from "../lib/supabase.js";

const TABLE = "overtime_hours";

export async function createOvertime(payload) {
  const { data, error } = await supabase.from(TABLE).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function listOvertime(filters = {}) {
  let query = supabase.from(TABLE).select("*").order("start_time", { ascending: false });

  if (filters.userId) {
    query = query.eq("user_id", filters.userId);
  }

  if (filters.from) {
    query = query.gte("start_time", filters.from);
  }

  if (filters.to) {
    query = query.lte("end_time", filters.to);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function updateOvertime(id, payload) {
  const { data, error } = await supabase.from(TABLE).update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteOvertime(id) {
  const { error } = await supabase.from(TABLE).delete().eq("id", id);
  if (error) throw error;
}
