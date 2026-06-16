import { supabase } from "../lib/supabase.js";

const TABLE = "historico_precos";

export async function listPriceHistory({ symbol, limit = 90 }) {
  if (!symbol) throw new Error("Símbolo obrigatório para histórico de preços.");
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("ativo_symbol", symbol)
    .order("data_registro", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).reverse();
}

export async function insertPriceSnapshot(snapshot) {
  if (!snapshot?.ativo_symbol) throw new Error("ativo_symbol obrigatório.");
  const { data, error } = await supabase.from(TABLE).insert(snapshot).select().single();
  if (error) throw error;
  return data;
}
