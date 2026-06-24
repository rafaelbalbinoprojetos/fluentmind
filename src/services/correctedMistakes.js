import { supabase, supabaseConfigured } from "../lib/supabase.js";

const TABLE = "corrected_mistakes";

function ensureSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Supabase nao configurado.");
  }
}

function normalizeMastery(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(100, Math.max(0, numeric));
}

function formatRelativeDate(value) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfDate.getTime() - startOfToday.getTime()) / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  if (diffDays === -1) return "Yesterday";
  if (diffDays > 1) return `In ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}

export function mapCorrectedMistake(row) {
  const nextReviewDate = row.next_review_at ? new Date(row.next_review_at) : null;
  const isReviewDue = nextReviewDate && !Number.isNaN(nextReviewDate.getTime())
    ? nextReviewDate.getTime() <= Date.now()
    : false;

  return {
    id: row.id,
    userId: row.user_id,
    conversationId: row.conversation_id,
    messageId: row.message_id,
    originalText: row.original_text ?? "",
    correctedText: row.corrected_text ?? "",
    explanation: row.explanation ?? "",
    category: row.category || "Conversation",
    level: row.level || "A2",
    status: row.status || "new",
    mastery: normalizeMastery(row.mastery_level),
    timesReviewed: Number(row.times_reviewed) || 0,
    nextReviewAt: formatRelativeDate(row.next_review_at),
    lastReviewedAt: formatRelativeDate(row.last_reviewed_at),
    nextReviewAtRaw: row.next_review_at ?? null,
    lastReviewedAtRaw: row.last_reviewed_at ?? null,
    createdAt: row.created_at ?? null,
    isReviewDue,
  };
}

export async function listCorrectedMistakes(userId) {
  ensureSupabase();
  if (!userId) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapCorrectedMistake);
}

export async function createCorrectedMistake(payload, { userId } = {}) {
  ensureSupabase();
  if (!userId) throw new Error("Usuario nao identificado.");
  if (!payload?.originalText?.trim()) throw new Error("Texto original nao informado.");
  if (!payload?.correctedText?.trim()) throw new Error("Texto corrigido nao informado.");

  const { data, error } = await supabase
    .from(TABLE)
    .insert({
      user_id: userId,
      conversation_id: payload.conversationId || null,
      message_id: payload.messageId || null,
      original_text: payload.originalText.trim(),
      corrected_text: payload.correctedText.trim(),
      explanation: payload.explanation?.trim() || null,
      category: payload.category || "Conversation",
      level: payload.level || "A2",
      status: payload.status || "review_due",
      mastery_level: normalizeMastery(payload.mastery ?? 0),
      next_review_at: payload.nextReviewAt || new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapCorrectedMistake(data);
}

export async function updateCorrectedMistake(id, patch = {}) {
  ensureSupabase();
  if (!id) throw new Error("Erro corrigido nao identificado.");

  const next = {};
  if (patch.originalText !== undefined) next.original_text = patch.originalText;
  if (patch.correctedText !== undefined) next.corrected_text = patch.correctedText;
  if (patch.explanation !== undefined) next.explanation = patch.explanation;
  if (patch.category !== undefined) next.category = patch.category;
  if (patch.level !== undefined) next.level = patch.level;
  if (patch.status !== undefined) next.status = patch.status;
  if (patch.mastery !== undefined) next.mastery_level = normalizeMastery(patch.mastery);
  if (patch.timesReviewed !== undefined) next.times_reviewed = Math.max(0, Number(patch.timesReviewed) || 0);
  if (patch.lastReviewedAt !== undefined) next.last_reviewed_at = patch.lastReviewedAt;
  if (patch.nextReviewAt !== undefined) next.next_review_at = patch.nextReviewAt;

  if (Object.keys(next).length === 0) return null;

  const { data, error } = await supabase
    .from(TABLE)
    .update(next)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapCorrectedMistake(data);
}

export async function deleteCorrectedMistake(id) {
  ensureSupabase();
  if (!id) throw new Error("Erro corrigido nao identificado.");

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", id);

  if (error) throw error;
}
