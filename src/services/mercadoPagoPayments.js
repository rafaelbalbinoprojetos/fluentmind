import { supabase } from "../lib/supabase.js";

const TABLE = "mercadopago_payments";

export async function listMercadoPagoPayments({ limit = 30 } = {}) {
  const normalizedLimit = Math.min(Math.max(Number(limit) || 30, 1), 200);
  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .order("processed_at", { ascending: false })
    .limit(normalizedLimit);

  if (error) throw error;
  return data ?? [];
}

