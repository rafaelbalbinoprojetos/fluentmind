import { supabase, supabaseConfigured } from "../lib/supabase.js";

const TABLE = "review_events";

function ensureSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Supabase nao configurado.");
  }
}

export async function listReviewEvents(userId, { limit = 500 } = {}) {
  ensureSupabase();
  if (!userId) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("reviewed_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function createReviewEvent({
  userId,
  mindBlockId,
  result,
  answerText = null,
  expectedText = null,
  responseTimeMs = null,
}) {
  ensureSupabase();
  if (!userId) throw new Error("Usuario nao identificado.");
  if (!mindBlockId) throw new Error("MindBlock nao identificado.");

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      mindblock_id: mindBlockId,
      result,
      answer_text: answerText,
      expected_text: expectedText,
      response_time_ms: responseTimeMs,
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}
