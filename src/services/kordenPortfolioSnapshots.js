import { supabase } from "../lib/supabase.js";

const TABLE = "korden_portfolio_snapshots";

export async function upsertPortfolioSnapshot(snapshot) {
  const userId = String(snapshot?.user_id || "").trim();
  const snapshotDate = String(snapshot?.snapshot_date || "").trim();
  if (!userId || !snapshotDate) {
    throw new Error("user_id e snapshot_date sao obrigatorios para salvar snapshot.");
  }

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(snapshot, { onConflict: "user_id,snapshot_date" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function listRecentPortfolioSnapshots({ userId, limit = 2 }) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    throw new Error("userId eh obrigatorio para listar snapshots.");
  }
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", normalizedUserId)
    .order("snapshot_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
