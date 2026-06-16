import { supabase } from "../lib/supabase.js";

const TABLE = "carteira";
const RENTABILITY_VIEW = "vw_rentabilidade_carteira";

function normalizeAssetSymbol(value) {
  const trimmed = (value ?? "").trim().toUpperCase();
  if (!trimmed) return "";
  if (!trimmed.includes(".") && /^[A-Z]{4}\d{1,2}$/.test(trimmed)) {
    return `${trimmed}.SA`;
  }
  return trimmed;
}

export async function listPortfolioPositions({ userId }) {
  if (!userId) throw new Error("userId eh obrigatorio para listar a carteira.");
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("data_compra", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertPortfolioPosition({ id, userId, ativoSymbol, ...rest }) {
  if (!userId || !ativoSymbol) {
    throw new Error("userId e ativoSymbol sao obrigatorios.");
  }

  const normalizedSymbol = normalizeAssetSymbol(ativoSymbol);
  const payload = {
    user_id: userId,
    ativo_symbol: normalizedSymbol,
    ...rest,
  };

  let targetId = id ?? null;

  if (!targetId) {
    const symbolCandidates =
      normalizedSymbol === ativoSymbol ? [normalizedSymbol] : [normalizedSymbol, ativoSymbol];

    const { data: existingList, error: findError } = await supabase
      .from(TABLE)
      .select("id, ativo_symbol")
      .eq("user_id", userId)
      .in("ativo_symbol", symbolCandidates);

    if (findError) throw findError;

    if (existingList && existingList.length > 0) {
      targetId = existingList[0].id;
    }
  }

  if (targetId) {
    const { data, error } = await supabase.from(TABLE).update(payload).eq("id", targetId).select().single();
    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase.from(TABLE).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function deletePortfolioPosition({ userId, ativoSymbol }) {
  if (!userId || !ativoSymbol) {
    throw new Error("userId e ativoSymbol sao obrigatorios para exclusao.");
  }
  const normalizedSymbol = normalizeAssetSymbol(ativoSymbol);
  const symbolCandidates = normalizedSymbol === ativoSymbol ? [normalizedSymbol] : [normalizedSymbol, ativoSymbol];
  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("user_id", userId)
    .in("ativo_symbol", symbolCandidates);
  if (error) throw error;
}

export async function getPortfolioRentability({ userId }) {
  if (!userId) throw new Error("userId eh obrigatorio para calcular rentabilidade.");
  const { data, error } = await supabase.from(RENTABILITY_VIEW).select("*").eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}


