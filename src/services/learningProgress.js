import { supabase, supabaseConfigured } from "../lib/supabase.js";

const ACTIVITY_TABLE = "daily_activity";
const PROFILE_TABLE = "user_learning_profiles";

function ensureSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Supabase nao configurado.");
  }
}

function toDateKey(date) {
  return date.toISOString().slice(0, 10);
}

export function getLastDateKeys(days = 7) {
  return Array.from({ length: days }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (days - 1 - index));
    return toDateKey(date);
  });
}

export async function getOrCreateLearningProfile(user) {
  ensureSupabase();
  if (!user?.id) return null;

  const { data: existing, error: readError } = await supabase
    .from(PROFILE_TABLE)
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (readError) throw readError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .insert({
      user_id: user.id,
      display_name: user.user_metadata?.display_name || user.email?.split("@")[0] || null,
      native_language: "pt-BR",
      target_language: "en",
      current_level: "A2",
      last_active_date: toDateKey(new Date()),
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function updateLearningProfile(userId, patch = {}) {
  ensureSupabase();
  if (!userId) throw new Error("Usuario nao identificado.");

  const allowedFields = [
    "display_name",
    "native_language",
    "target_language",
    "current_level",
    "daily_expression_goal",
    "last_active_date",
  ];
  const next = {
    user_id: userId,
  };

  allowedFields.forEach((field) => {
    if (patch[field] !== undefined) next[field] = patch[field];
  });

  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .upsert(next, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function listDailyActivity(userId, { days = 7 } = {}) {
  ensureSupabase();
  if (!userId) return [];

  const dateKeys = getLastDateKeys(days);
  const { data, error } = await supabase
    .from(ACTIVITY_TABLE)
    .select("*")
    .eq("user_id", userId)
    .gte("activity_date", dateKeys[0])
    .lte("activity_date", dateKeys[dateKeys.length - 1])
    .order("activity_date", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function recordDailyActivity(userId, increments = {}) {
  ensureSupabase();
  if (!userId) return null;

  const activityDate = toDateKey(new Date());
  const { data: existing, error: readError } = await supabase
    .from(ACTIVITY_TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("activity_date", activityDate)
    .maybeSingle();

  if (readError) throw readError;

  const numericFields = [
    "expressions_saved",
    "expressions_reviewed",
    "conversations_started",
    "messages_sent",
    "study_minutes",
    "reviews_easy",
    "reviews_good",
    "reviews_hard",
    "reviews_again",
    "mindblocks_created",
    "playlists_created",
  ];

  const nextRow = {
    user_id: userId,
    activity_date: activityDate,
  };

  numericFields.forEach((field) => {
    nextRow[field] = (Number(existing?.[field]) || 0) + (Number(increments[field]) || 0);
  });

  const { data, error } = await supabase
    .from(ACTIVITY_TABLE)
    .upsert(nextRow, { onConflict: "user_id,activity_date" })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export function buildActivityByDate(activityRows, days = 7) {
  const byDate = new Map((activityRows ?? []).map((row) => [row.activity_date, row]));

  return getLastDateKeys(days).map((dateKey) => byDate.get(dateKey) ?? {
    activity_date: dateKey,
    expressions_saved: 0,
    expressions_reviewed: 0,
    conversations_started: 0,
    messages_sent: 0,
    study_minutes: 0,
    reviews_easy: 0,
    reviews_good: 0,
    reviews_hard: 0,
    reviews_again: 0,
    mindblocks_created: 0,
    playlists_created: 0,
  });
}
