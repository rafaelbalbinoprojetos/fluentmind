import { supabase, supabaseConfigured } from "../lib/supabase.js";

const SESSIONS_TABLE = "conversation_sessions";
const MESSAGES_TABLE = "conversation_messages";

function ensureSupabase() {
  if (!supabaseConfigured || !supabase) {
    throw new Error("Supabase nao configurado.");
  }
}

function formatTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function sessionGroup(value) {
  if (!value) return "Anteriores";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Anteriores";

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86400000);

  if (diffDays === 0) return "Hoje";
  if (diffDays === 1) return "Ontem";
  if (diffDays <= 7) return "Esta semana";
  return "Anteriores";
}

function titleFromPrompt(prompt) {
  const compact = String(prompt ?? "").replace(/\s+/g, " ").trim();
  if (!compact) return "New conversation";
  return compact.length > 46 ? `${compact.slice(0, 43)}...` : compact;
}

export function mapConversationSession(row, activeSessionId = null) {
  const date = row.started_at ?? row.created_at;

  return {
    id: row.id,
    title: row.title || "New conversation",
    group: row.status === "archived" ? "Arquivadas" : sessionGroup(date),
    active: row.id === activeSessionId,
    tag: row.scenario || row.language || "Conversation",
    status: row.status || "active",
    createdAt: row.created_at ?? null,
    startedAt: row.started_at ?? null,
  };
}

export function mapConversationMessage(row) {
  return {
    id: row.id,
    role: row.role === "assistant" ? "neo" : row.role,
    content: row.content ?? "",
    createdAt: formatTime(row.created_at),
    detectedExpression: null,
    correction: row.correction || null,
  };
}

export async function listConversationSessions(userId, activeSessionId = null) {
  ensureSupabase();
  if (!userId) return [];

  const { data, error } = await supabase
    .from(SESSIONS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => mapConversationSession(row, activeSessionId));
}

export async function createConversationSession({
  userId,
  title,
  firstPrompt,
  language = "english",
  level = null,
  scenario = "Conversation",
}) {
  ensureSupabase();
  if (!userId) throw new Error("Usuario nao identificado.");

  const { data, error } = await supabase
    .from(SESSIONS_TABLE)
    .insert({
      user_id: userId,
      title: title?.trim() || titleFromPrompt(firstPrompt),
      language,
      level,
      scenario,
      status: "active",
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapConversationSession(data, data.id);
}

export async function updateConversationSession(id, patch) {
  ensureSupabase();
  if (!id) throw new Error("Conversa nao identificada.");

  const { data, error } = await supabase
    .from(SESSIONS_TABLE)
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) throw error;
  return mapConversationSession(data, id);
}

export async function listConversationMessages({ userId, sessionId }) {
  ensureSupabase();
  if (!userId || !sessionId) return [];

  const { data, error } = await supabase
    .from(MESSAGES_TABLE)
    .select("*")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapConversationMessage);
}

export async function createConversationMessage({
  userId,
  sessionId,
  role,
  content,
  detectedLanguage = null,
  correction = null,
  suggestedMindBlockId = null,
  tokensUsed = null,
}) {
  ensureSupabase();
  if (!userId || !sessionId) throw new Error("Conversa nao identificada.");
  if (!content?.trim()) throw new Error("Mensagem vazia.");

  const { data, error } = await supabase
    .from(MESSAGES_TABLE)
    .insert({
      user_id: userId,
      session_id: sessionId,
      role: role === "neo" ? "assistant" : role,
      content: content.trim(),
      detected_language: detectedLanguage,
      correction,
      suggested_mindblock_id: suggestedMindBlockId,
      tokens_used: tokensUsed,
    })
    .select("*")
    .single();

  if (error) throw error;
  return mapConversationMessage(data);
}
