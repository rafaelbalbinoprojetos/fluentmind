import { supabase } from "../lib/supabase.js";

const TABLE = "ativos";

export async function getAssetBySymbol(symbol) {
  if (!symbol) throw new Error("Símbolo ausente para consulta de ativo.");
  const { data, error } = await supabase.from(TABLE).select("*").eq("symbol", symbol).maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function upsertAsset(payload) {
  if (!payload?.symbol) {
    throw new Error("Símbolo obrigatório para inserir/atualizar ativo.");
  }
  const { data, error } = await supabase.from(TABLE).upsert(payload, { onConflict: "symbol" }).select().single();
  if (error) throw error;
  return data;
}

export async function listAssets({ search, limit = 20, types } = {}) {
  let query = supabase.from(TABLE).select("*").order("nome", { ascending: true }).limit(limit);

  if (types?.length) {
    query = query.in("tipo", types);
  }

  if (search?.trim()) {
    const value = search.trim();
    query = query.or(`symbol.ilike.%${value}%,nome.ilike.%${value}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
