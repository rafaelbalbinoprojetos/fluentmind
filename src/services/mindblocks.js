import { supabase, supabaseConfigured } from "../lib/supabase.js";

const TABLE = "mindblocks";

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

function formatRelativeReviewDate(value) {
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

function statusFromRow(row) {
  if (row.next_review_at) {
    const dueDate = new Date(row.next_review_at);
    if (!Number.isNaN(dueDate.getTime()) && dueDate.getTime() <= Date.now()) {
      return "review_due";
    }
  }

  const mastery = normalizeMastery(row.mastery_level);
  if (mastery >= 90) return "mastered";
  if (mastery > 0 || Number(row.times_reviewed) > 0) return "learning";
  return "new";
}

export function mapMindBlockRow(row, playlistIds = []) {
  const status = statusFromRow(row);
  const mastery = normalizeMastery(row.mastery_level);
  const notes = row.notes ?? "";

  return {
    id: row.id,
    expression: row.expression_en ?? "",
    translation: row.meaning_pt ?? "",
    category: row.category || "Daily Fluency",
    playlistIds,
    tags: [],
    status,
    mastery,
    difficulty: "A2",
    isFavorite: false,
    isReviewDue: status === "review_due",
    lastReviewedAt: formatRelativeReviewDate(row.last_reviewed_at),
    nextReviewAt: formatRelativeReviewDate(row.next_review_at),
    createdAt: row.created_at ? row.created_at.slice(0, 10) : "",
    timesReviewed: Number(row.times_reviewed) || 0,
    source: row.source || "Manual",
    notes,
    personalNotes: notes,
    examples: row.context ? [row.context] : [],
    context: row.context ?? "",
  };
}

function toMindBlockInsert(payload, userId, mode = "save") {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  return {
    user_id: userId,
    expression_en: payload.expression.trim(),
    meaning_pt: payload.translation.trim(),
    context: payload.context?.trim() || payload.notes?.trim() || null,
    category: payload.category || "Daily Fluency",
    source: payload.source || "Manual",
    notes: payload.notes?.trim() || null,
    mastery_level: mode === "review" ? 10 : 0,
    times_reviewed: 0,
    next_review_at: mode === "review" ? new Date().toISOString() : tomorrow,
  };
}

function toMindBlockPatch(patch) {
  const next = {};

  if (patch.expression !== undefined) next.expression_en = patch.expression;
  if (patch.translation !== undefined) next.meaning_pt = patch.translation;
  if (patch.category !== undefined) next.category = patch.category;
  if (patch.source !== undefined) next.source = patch.source;
  if (patch.notes !== undefined || patch.personalNotes !== undefined) next.notes = patch.notes ?? patch.personalNotes;
  if (patch.mastery !== undefined) next.mastery_level = normalizeMastery(patch.mastery);
  if (patch.timesReviewed !== undefined) next.times_reviewed = Math.max(0, Number(patch.timesReviewed) || 0);
  if (patch.lastReviewedAt !== undefined) {
    next.last_reviewed_at = patch.lastReviewedAt === "Today" ? new Date().toISOString() : patch.lastReviewedAt;
  }
  if (patch.nextReviewAt !== undefined) {
    if (patch.nextReviewAt === "Today") {
      next.next_review_at = new Date().toISOString();
    } else {
      const match = String(patch.nextReviewAt).match(/^In (\d+) days$/);
      next.next_review_at = match
        ? new Date(Date.now() + Number(match[1]) * 24 * 60 * 60 * 1000).toISOString()
        : patch.nextReviewAt;
    }
  }

  if (patch.status === "review_due" || patch.isReviewDue === true) {
    next.next_review_at = new Date().toISOString();
  } else if (patch.status === "mastered") {
    next.mastery_level = normalizeMastery(patch.mastery ?? 90);
    next.last_reviewed_at = new Date().toISOString();
    next.next_review_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  }

  return next;
}

export async function listMindBlocks(userId) {
  ensureSupabase();
  if (!userId) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapMindBlockRow(row));
}

export async function createMindBlock(payload, { userId, mode = "save" } = {}) {
  ensureSupabase();
  if (!userId) throw new Error("Usuario nao identificado.");

  const { data, error } = await supabase
    .from(TABLE)
    .insert(toMindBlockInsert(payload, userId, mode))
    .select("*")
    .single();

  if (error) throw error;
  return mapMindBlockRow(data);
}

export async function updateMindBlock(id, patch) {
  ensureSupabase();
  if (!id) throw new Error("MindBlock nao identificado.");
  const dbPatch = toMindBlockPatch(patch);

  if (Object.keys(dbPatch).length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from(TABLE)
    .update(dbPatch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapMindBlockRow(data);
}

export async function deleteMindBlock(id) {
  ensureSupabase();
  if (!id) throw new Error("MindBlock nao identificado.");

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", id);

  if (error) throw error;
}
