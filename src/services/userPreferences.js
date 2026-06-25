import { supabase, supabaseConfigured } from "../lib/supabase.js";

const TABLE = "user_preferences";

export const DEFAULT_USER_PREFERENCES = {
  displayName: "",
  assistantName: "Neo",
  assistantVoice: "mineirinha",
  chatTone: "natural",
  mindBlockSaveMode: "ask",
  themeId: "fluentmind-night",
  interfaceLanguage: "pt-BR",
  nativeLanguage: "pt-BR",
  targetLanguage: "en",
  currentLevel: "A2",
  dailyExpressionGoal: 30,
  practiceFocus: "expressions",
  showToasts: true,
  mobileNavPaths: [
    "/dashboard",
    "/learning-journey",
    "/historico",
    "/biblioteca",
    "/playlists",
    "/insights",
    "/chatbot",
    "/conversas",
    "/meus-erros",
    "/configuracoes",
  ],
  extra: {},
};

export function buildPreferencesFromMetadata(metadata = {}, user = null) {
  const learning = metadata.learning_preferences ?? {};
  return {
    ...DEFAULT_USER_PREFERENCES,
    displayName: metadata.display_name ?? user?.email?.split("@")[0] ?? "",
    assistantName: metadata.assistant_name ?? DEFAULT_USER_PREFERENCES.assistantName,
    assistantVoice: metadata.assistant_voice ?? metadata.preferred_voice ?? DEFAULT_USER_PREFERENCES.assistantVoice,
    chatTone: metadata.chat_tone ?? DEFAULT_USER_PREFERENCES.chatTone,
    mindBlockSaveMode: metadata.mindblock_save_mode ?? DEFAULT_USER_PREFERENCES.mindBlockSaveMode,
    themeId: metadata.theme_id ?? DEFAULT_USER_PREFERENCES.themeId,
    targetLanguage: learning.targetLanguage ?? DEFAULT_USER_PREFERENCES.targetLanguage,
    currentLevel: learning.currentLevel ?? DEFAULT_USER_PREFERENCES.currentLevel,
    dailyExpressionGoal: Number(learning.dailyGoal ?? DEFAULT_USER_PREFERENCES.dailyExpressionGoal),
    practiceFocus: learning.practiceFocus ?? DEFAULT_USER_PREFERENCES.practiceFocus,
    showToasts: learning.showToasts !== false,
    mobileNavPaths: Array.isArray(metadata.mobile_nav_paths)
      ? metadata.mobile_nav_paths
      : DEFAULT_USER_PREFERENCES.mobileNavPaths,
  };
}

export function mapPreferenceRow(row, fallback = DEFAULT_USER_PREFERENCES) {
  if (!row) return fallback;
  return {
    ...fallback,
    displayName: row.display_name ?? fallback.displayName,
    assistantName: row.assistant_name ?? fallback.assistantName,
    assistantVoice: row.assistant_voice ?? fallback.assistantVoice,
    chatTone: row.chat_tone ?? fallback.chatTone,
    mindBlockSaveMode: row.mindblock_save_mode ?? fallback.mindBlockSaveMode,
    themeId: row.theme_id ?? fallback.themeId,
    interfaceLanguage: row.interface_language ?? fallback.interfaceLanguage,
    nativeLanguage: row.native_language ?? fallback.nativeLanguage,
    targetLanguage: row.target_language ?? fallback.targetLanguage,
    currentLevel: row.current_level ?? fallback.currentLevel,
    dailyExpressionGoal: Number(row.daily_expression_goal ?? fallback.dailyExpressionGoal),
    practiceFocus: row.practice_focus ?? fallback.practiceFocus,
    showToasts: row.show_toasts !== false,
    mobileNavPaths: Array.isArray(row.mobile_nav_paths) ? row.mobile_nav_paths : fallback.mobileNavPaths,
    extra: row.extra ?? fallback.extra,
    updatedAt: row.updated_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

function toPreferenceRow(userId, preferences = {}) {
  return {
    user_id: userId,
    display_name: preferences.displayName ?? null,
    assistant_name: preferences.assistantName ?? DEFAULT_USER_PREFERENCES.assistantName,
    assistant_voice: preferences.assistantVoice ?? DEFAULT_USER_PREFERENCES.assistantVoice,
    chat_tone: preferences.chatTone ?? DEFAULT_USER_PREFERENCES.chatTone,
    mindblock_save_mode: preferences.mindBlockSaveMode ?? DEFAULT_USER_PREFERENCES.mindBlockSaveMode,
    theme_id: preferences.themeId ?? DEFAULT_USER_PREFERENCES.themeId,
    interface_language: preferences.interfaceLanguage ?? DEFAULT_USER_PREFERENCES.interfaceLanguage,
    native_language: preferences.nativeLanguage ?? DEFAULT_USER_PREFERENCES.nativeLanguage,
    target_language: preferences.targetLanguage ?? DEFAULT_USER_PREFERENCES.targetLanguage,
    current_level: preferences.currentLevel ?? DEFAULT_USER_PREFERENCES.currentLevel,
    daily_expression_goal: Number(preferences.dailyExpressionGoal ?? DEFAULT_USER_PREFERENCES.dailyExpressionGoal),
    practice_focus: preferences.practiceFocus ?? DEFAULT_USER_PREFERENCES.practiceFocus,
    show_toasts: preferences.showToasts !== false,
    mobile_nav_paths: Array.isArray(preferences.mobileNavPaths)
      ? preferences.mobileNavPaths
      : DEFAULT_USER_PREFERENCES.mobileNavPaths,
    extra: preferences.extra ?? {},
    updated_at: new Date().toISOString(),
  };
}

export async function getOrCreateUserPreferences(user) {
  const fallback = buildPreferencesFromMetadata(user?.user_metadata ?? {}, user);
  if (!user?.id || !supabaseConfigured || !supabase) return fallback;

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.warn("[preferences] Supabase load skipped:", error.message);
    return fallback;
  }

  if (data) return mapPreferenceRow(data, fallback);

  const row = toPreferenceRow(user.id, fallback);
  const { data: created, error: createError } = await supabase
    .from(TABLE)
    .upsert(row, { onConflict: "user_id" })
    .select("*")
    .single();

  if (createError) {
    console.warn("[preferences] Supabase create skipped:", createError.message);
    return fallback;
  }

  return mapPreferenceRow(created, fallback);
}

export async function updateUserPreferences(userId, patch = {}, current = DEFAULT_USER_PREFERENCES) {
  const next = { ...current, ...patch };
  if (!userId || !supabaseConfigured || !supabase) return next;

  const row = toPreferenceRow(userId, next);
  const { data, error } = await supabase
    .from(TABLE)
    .upsert(row, { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) {
    console.warn("[preferences] Supabase update skipped:", error.message);
    throw error;
  }

  return mapPreferenceRow(data, next);
}
