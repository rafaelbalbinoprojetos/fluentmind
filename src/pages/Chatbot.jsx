import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  Brain,
  Check,
  MessageCircle,
  Mic,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import {
  Link,
} from "react-router-dom";
import {
  createConversationMessage,
  createConversationSession,
  listConversationMessages,
  listConversationSessions,
} from "../services/conversations.js";
import { createMindBlock, listMindBlocks } from "../services/mindblocks.js";
import { addMindBlockToPlaylist, createPlaylist, listPlaylists } from "../services/playlists.js";
import { recordDailyActivity } from "../services/learningProgress.js";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

const welcomeMessages = [
  {
    id: "welcome-neo",
    role: "neo",
    createdAt: "Agora",
    content:
      "Good morning, Rafael. Today we can strengthen your English without translating word by word.\n\nTell me one sentence you want to say naturally, and I will turn it into a MindBlock.",
    detectedExpression: "I'm getting used to it.",
  },
];

function getAssistantName(user) {
  return user?.user_metadata?.assistant_name?.trim() || "Neo";
}

function normalizeSuggestion(value) {
  if (typeof value === "string") {
    return {
      expression: value,
      translation: "",
      category: "Conversation",
      source: "Neo Conversation",
    };
  }

  return {
    expression: value?.expression ?? "",
    translation: value?.translation ?? "",
    category: value?.category ?? "Conversation",
    source: value?.source ?? "Neo Conversation",
    usage: value?.usage ?? "",
    examples: Array.isArray(value?.examples) ? value.examples : [],
    relatedExpressions: Array.isArray(value?.relatedExpressions) ? value.relatedExpressions : [],
    commonMistake: value?.commonMistake ?? null,
    practice: value?.practice ?? "",
    pattern: value?.pattern ?? "",
    patternExplanation: value?.patternExplanation ?? "",
  };
}

function getPrimarySuggestion(message) {
  return message?.suggestedMindBlock
    || (Array.isArray(message?.suggestedMindBlocks) ? message.suggestedMindBlocks[0] : null)
    || message?.detectedExpression
    || null;
}

function getMessageSuggestions(message) {
  const suggestions = Array.isArray(message?.suggestedMindBlocks) && message.suggestedMindBlocks.length
    ? message.suggestedMindBlocks
    : [getPrimarySuggestion(message)].filter(Boolean);

  const unique = new Map();
  suggestions
    .map((item) => normalizeSuggestion(item))
    .filter((item) => item.expression?.trim())
    .forEach((item) => {
      const key = item.expression.trim().toLowerCase();
      if (!unique.has(key)) unique.set(key, item);
    });

  return [...unique.values()];
}

function getSuggestionKey(messageId, suggestion) {
  const normalized = normalizeSuggestion(suggestion);
  return `${messageId || "message"}::${normalized.expression.trim().toLowerCase()}`;
}

function buildMindBlockMeta(form, assistantName) {
  return {
    usage: form.usage || form.notes || "",
    examples: Array.isArray(form.examples) ? form.examples.filter(Boolean) : [],
    relatedExpressions: Array.isArray(form.relatedExpressions) ? form.relatedExpressions : [],
    commonMistake: form.commonMistake || null,
    practice: form.practice || "",
    pattern: form.pattern || `${form.expression?.split(" ").slice(0, 3).join(" ")} + context`,
    patternExplanation: form.patternExplanation || form.practice || "Use this MindBlock naturally in a real conversation.",
    variations: Array.isArray(form.variations) && form.variations.length
      ? form.variations
      : [form.expression].filter(Boolean),
    personalNotes: form.notes || `Saved from a conversation with ${assistantName}.`,
  };
}

export default function ChatbotPage() {
  const { user, session } = useAuth();
  const assistantName = getAssistantName(user);
  const mindBlockSaveMode = user?.user_metadata?.mindblock_save_mode || "ask";
  const [, setConversations] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState(welcomeMessages);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [, setLoadingConversations] = useState(true);
  const [voiceMode, setVoiceMode] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const messageListRef = useRef(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState({
    expression: "I'm getting used to it.",
    translation: "Estou me acostumando com isso.",
    category: "Conversation",
  });
  const [playlists, setPlaylists] = useState([]);
  const [savingMindBlock, setSavingMindBlock] = useState(false);
  const [ignoredSuggestionIds, setIgnoredSuggestionIds] = useState([]);
  const [savedSuggestionIds, setSavedSuggestionIds] = useState([]);

  const refreshConversations = useCallback(async (nextActiveSessionId = activeSessionId) => {
    if (!user?.id) return [];
    const nextConversations = await listConversationSessions(user.id, nextActiveSessionId);
    setConversations(nextConversations);
    return nextConversations;
  }, [activeSessionId, user?.id]);

  useEffect(() => {
    let isMounted = true;

    async function loadConversations() {
      if (!user?.id) {
        setLoadingConversations(false);
        return;
      }

      try {
        setLoadingConversations(true);
        const nextConversations = await listConversationSessions(user.id);
        if (!isMounted) return;

        setConversations(nextConversations);
        const firstSession = nextConversations.find((item) => item.status !== "archived") ?? nextConversations[0];

        if (firstSession) {
          setActiveSessionId(firstSession.id);
          const nextMessages = await listConversationMessages({ userId: user.id, sessionId: firstSession.id });
          if (isMounted) {
            setMessages(nextMessages.length > 0 ? nextMessages : welcomeMessages);
            setConversations(nextConversations.map((item) => ({ ...item, active: item.id === firstSession.id })));
          }
        } else {
          setActiveSessionId(null);
          setMessages(welcomeMessages);
        }
      } catch (error) {
        console.error(error);
        toast.error("Nao foi possivel carregar suas conversas.");
      } finally {
        if (isMounted) setLoadingConversations(false);
      }
    }

    loadConversations();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    const list = messageListRef.current;
    if (!list || voiceMode) return;

    list.scrollTo({
      top: list.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, typing, voiceMode]);

  useEffect(() => {
    let isMounted = true;

    async function loadPlaylists() {
      if (!user?.id) return;

      try {
        const nextPlaylists = await listPlaylists(user.id);
        if (isMounted) setPlaylists(nextPlaylists);
      } catch (error) {
        console.error(error);
        toast.error("Nao foi possivel carregar suas playlists.");
      }
    }

    loadPlaylists();
    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const ensureActiveSession = async (firstPrompt) => {
    if (activeSessionId) return { sessionId: activeSessionId, created: false };

    const newSession = await createConversationSession({
      userId: user.id,
      firstPrompt,
      scenario: "Conversation",
    });

    setActiveSessionId(newSession.id);
    await refreshConversations(newSession.id);
    setMessages([]);
    return { sessionId: newSession.id, created: true };
  };

  const startNewConversation = () => {
    setActiveSessionId(null);
    setMessages(welcomeMessages);
    setConversations((current) => current.map((item) => ({ ...item, active: false })));
    toast("Nova conversa pronta.");
  };

  const submitMessage = async (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    if (!session?.access_token || !user?.id) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }

    setInput("");
    setTyping(true);

    try {
      const { sessionId, created } = await ensureActiveSession(text);
      const storedUserMessage = await createConversationMessage({
        userId: user.id,
        sessionId,
        role: "user",
        content: text,
      });
      await recordDailyActivity(user.id, {
        messages_sent: 1,
        conversations_started: created ? 1 : 0,
        study_minutes: 1,
      });

      const visibleMessages = messages[0]?.id === "welcome-neo" ? [] : messages;
      setMessages((current) => {
        const baseMessages = current[0]?.id === "welcome-neo" ? [] : current;
        return [...baseMessages, storedUserMessage];
      });

      const currentMessages = [...visibleMessages, storedUserMessage].map((message) => ({
        role: message.role === "neo" ? "assistant" : "user",
        content: message.content,
      }));

      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          messages: currentMessages,
          userName: user?.user_metadata?.display_name?.trim() || user?.email?.split("@")[0] || null,
          assistantName,
          chatTone: user?.user_metadata?.chat_tone || "natural",
          currentLevel: user?.user_metadata?.learning_preferences?.currentLevel || "A2",
          targetLanguage: user?.user_metadata?.learning_preferences?.targetLanguage || "en",
          assistantVoice: user?.user_metadata?.assistant_voice || "mineirinha",
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const serverMessage = response.status >= 500
          ? data?.details || data?.error
          : data?.error || data?.details;
        throw new Error(serverMessage || `Erro ${response.status}`);
      }

      const replyText = typeof data.reply === "string" ? data.reply : data.reply?.content;
      const reply = {
        content: replyText || "I could not generate a response now. Try asking in another way.",
        detectedExpression: data.detectedExpression || null,
        suggestedMindBlock: data.suggestedMindBlock || null,
        suggestedMindBlocks: data.suggestedMindBlocks || [],
      };
      const storedAssistantMessage = await createConversationMessage({
        userId: user.id,
        sessionId,
        role: "assistant",
        content: reply.content,
      });

      setMessages((current) => [
        ...current,
        {
          ...storedAssistantMessage,
          ...reply,
        },
      ]);
      await refreshConversations(sessionId);
      const suggestions = getMessageSuggestions(reply);
      if (suggestions.length > 0) {
        const saveMode = user?.user_metadata?.mindblock_save_mode || "ask";
        if (saveMode === "auto") {
          await Promise.allSettled(
            suggestions.map((suggestion) => quickSaveSuggestion(suggestion, storedAssistantMessage.id)),
          );
        } else if (saveMode === "ask") {
          setSelectedSuggestion(suggestions[0]);
          toast(`${suggestions.length} MindBlock${suggestions.length > 1 ? "s" : ""} detected.`);
        }
      }
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Não foi possível conversar com Neo agora.");
      setMessages((current) => [
        ...current,
        {
          id: `m-${Date.now()}-neo`,
          role: "neo",
          createdAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          content: `I could not reach Neo right now.\n\nTechnical detail:\n${error.message || "Unknown error"}\n\nPlease check the Vercel function logs or environment variables.`,
        },
      ]);
    } finally {
      setTyping(false);
    }
  };

  const openSaveModal = (suggestion) => {
    setSelectedSuggestion(normalizeSuggestion(suggestion ?? selectedSuggestion));
    setSaveModalOpen(true);
  };

  const ensureDefaultPlaylist = async () => {
    if (playlists.length > 0) return playlists[0];

    const playlist = await createPlaylist({
      userId: user.id,
      name: "Conversation MindBlocks",
      description: "Expressions saved from Neo conversations.",
      color: "violet",
      icon: "brain",
    });

    setPlaylists([playlist]);
    return playlist;
  };

  const saveMindBlockFromChat = async (form, { sourceMessageId = null, suggestionKey = null } = {}) => {
    if (!user?.id) {
      toast.error("Sessao expirada. Faca login novamente.");
      return;
    }

    try {
      setSavingMindBlock(true);
      const expression = form.expression?.trim();
      if (!expression) {
        toast.error("A expressao nao pode ficar vazia.");
        return;
      }

      const existingMindBlocks = await listMindBlocks(user.id);
      const alreadyExists = existingMindBlocks.some((item) => (
        item.expression.trim().toLowerCase() === expression.toLowerCase()
      ));
      if (alreadyExists) {
        const savedKey = suggestionKey || (sourceMessageId ? getSuggestionKey(sourceMessageId, form) : null);
        if (savedKey) setSavedSuggestionIds((current) => [...new Set([...current, savedKey])]);
        setSaveModalOpen(false);
        toast("Esse MindBlock ja existe na sua biblioteca.");
        return;
      }

      let createdDefaultPlaylist = false;
      const targetPlaylist = form.playlist ? playlists.find((item) => item.id === form.playlist) : null;
      let playlist = targetPlaylist;
      if (!playlist) {
        playlist = await ensureDefaultPlaylist();
        createdDefaultPlaylist = playlists.length === 0;
      }
      const mindBlock = await createMindBlock({
        expression,
        translation: form.translation,
        category: form.category,
        notes: form.notes,
        context: form.usage || form.notes,
        isFavorite: Boolean(form.favorite),
        source: "Neo Conversation",
        meta: buildMindBlockMeta({ ...form, expression }, assistantName),
      }, {
        userId: user.id,
        mode: form.review ? "review" : "save",
      });

      if (playlist?.id) {
        await addMindBlockToPlaylist({
          userId: user.id,
          playlistId: playlist.id,
          mindBlockId: mindBlock.id,
        });
        setPlaylists((current) => current.map((item) => (
          item.id === playlist.id ? { ...item, count: (item.count ?? 0) + 1 } : item
        )));
      }
      await recordDailyActivity(user.id, {
        expressions_saved: 1,
        mindblocks_created: 1,
        playlists_created: createdDefaultPlaylist ? 1 : 0,
        study_minutes: 1,
      });

      const savedKey = suggestionKey || (sourceMessageId ? getSuggestionKey(sourceMessageId, form) : null);
      if (savedKey) setSavedSuggestionIds((current) => [...new Set([...current, savedKey])]);
      setSaveModalOpen(false);
      toast.success("MindBlock salvo na sua biblioteca.");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Nao foi possivel salvar o MindBlock.");
    } finally {
      setSavingMindBlock(false);
    }
  };

  const quickSaveSuggestion = async (suggestion, messageId) => {
    const normalized = normalizeSuggestion(suggestion);
    await saveMindBlockFromChat({
      expression: normalized.expression,
      translation: normalized.translation,
      category: normalized.category,
      playlist: playlists[0]?.id ?? "",
      notes: `Saved from a conversation with ${assistantName}.`,
      usage: normalized.usage,
      examples: normalized.examples,
      relatedExpressions: normalized.relatedExpressions,
      commonMistake: normalized.commonMistake,
      practice: normalized.practice,
      pattern: normalized.pattern,
      patternExplanation: normalized.patternExplanation,
      favorite: true,
      review: true,
    }, { sourceMessageId: messageId, suggestionKey: getSuggestionKey(messageId, normalized) });
  };

  const ignoreSuggestion = (messageId, suggestion = null) => {
    const ignoredKey = suggestion ? getSuggestionKey(messageId, suggestion) : messageId;
    setIgnoredSuggestionIds((current) => [...new Set([...current, ignoredKey])]);
    toast("Sugestao ignorada.");
  };

  const mockAction = (message) => toast(message);

  return (
    <main className={`neo-page neo-page-chat-only ${voiceMode ? "is-voice" : ""}`}>
      <section className="neo-chat-shell">
        <NeoChatHeader
          assistantName={assistantName}
          voiceMode={voiceMode}
          onToggleVoice={() => setVoiceMode((value) => !value)}
          onClear={() => {
            startNewConversation();
          }}
          activeSessionId={activeSessionId}
        />

        {voiceMode ? (
          <VoiceModePanel assistantName={assistantName} onClose={() => setVoiceMode(false)} />
        ) : (
          <div className="neo-message-list" ref={messageListRef}>
            {messages.map((message) => (
              <NeoMessage
                key={message.id}
                message={message}
                assistantName={assistantName}
                ignoredSuggestionIds={ignoredSuggestionIds}
                savedSuggestionIds={savedSuggestionIds}
                suggestionsDisabled={mindBlockSaveMode === "never"}
                saving={savingMindBlock}
                onQuickSave={(suggestion) => quickSaveSuggestion(suggestion, message.id)}
                onEdit={(suggestion) => openSaveModal(suggestion)}
                onIgnore={(suggestion) => ignoreSuggestion(message.id, suggestion)}
                onMock={mockAction}
              />
            ))}
            {typing ? <NeoTypingIndicator /> : null}
          </div>
        )}

        <form className="neo-composer" onSubmit={submitMessage}>
          <button type="button" className="neo-icon-button" onClick={() => setVoiceMode(true)} aria-label="Voice mode">
            <Mic className="h-4 w-4" />
          </button>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={1}
            placeholder="Ask Neo to correct, explain, save or practice a phrase..."
          />
          <button type="submit" className="neo-send-button" aria-label="Send">
            <Send className="h-4 w-4" />
          </button>
        </form>
      </section>

      {saveModalOpen ? (
        <SaveMindBlockModal
          suggestion={selectedSuggestion}
          playlists={playlists}
          saving={savingMindBlock}
          onClose={() => setSaveModalOpen(false)}
          onSave={saveMindBlockFromChat}
        />
      ) : null}
    </main>
  );
}

function NeoChatHeader({ assistantName, voiceMode, onToggleVoice, onClear, activeSessionId }) {
  return (
    <header className="neo-chat-header">
      <div>
        <div className="flex items-center gap-3">
          <div className="neo-avatar-small"><Brain className="h-5 w-5" /></div>
          <div>
            <h1>{assistantName}</h1>
            <p>Your personal fluency mentor</p>
          </div>
        </div>
        <div className="neo-status-row">
          <span><i /> Online</span>
          <span>Current mode: {voiceMode ? "Voice" : "Conversation"}</span>
        </div>
      </div>

      <div className="neo-header-actions">
        <button type="button" className={voiceMode ? "is-active" : ""} onClick={onToggleVoice}><Mic className="h-4 w-4" /> Voice Mode</button>
        <button type="button" onClick={onClear}><Trash2 className="h-4 w-4" /> Clear</button>
        <Link to="/conversas" className="neo-header-link">
          <MessageCircle className="h-4 w-4" />
          Conversations
          {activeSessionId ? <span className="sr-only">current conversation saved</span> : null}
        </Link>
      </div>
    </header>
  );
}

function NeoMessage({
  message,
  assistantName,
  ignoredSuggestionIds,
  savedSuggestionIds,
  suggestionsDisabled,
  saving,
  onQuickSave,
  onEdit,
  onIgnore,
  onMock,
}) {
  const isNeo = message.role === "neo";
  const suggestions = getMessageSuggestions(message)
    .map((suggestion) => ({
      ...suggestion,
      key: getSuggestionKey(message.id, suggestion),
    }))
    .filter((suggestion) => !ignoredSuggestionIds.includes(suggestion.key));
  const hasSuggestion = isNeo && !suggestionsDisabled && suggestions.length > 0;

  return (
    <article className={`neo-message-row ${isNeo ? "is-neo" : "is-user"}`}>
      {isNeo ? <div className="neo-message-avatar"><Brain className="h-5 w-5" /></div> : null}
      <div className="neo-message-stack">
        <div className="neo-message-meta">
          <span>{isNeo ? assistantName : "You"}</span>
          <small>{message.createdAt}</small>
        </div>
        <div className="neo-message-bubble">
          <RichMessage content={message.content} />
          {hasSuggestion ? (
            <div className="neo-detected-badge">
              <div className="neo-detected-heading">
                <Sparkles className="h-3.5 w-3.5" />
                <span>{suggestions.length} MindBlock{suggestions.length > 1 ? "s" : ""} detected</span>
              </div>
              <div className="neo-suggestion-list">
                {suggestions.map((suggestion) => {
                  const saved = savedSuggestionIds.includes(suggestion.key);
                  return (
                    <div key={suggestion.key} className="neo-suggestion-item">
                      <div>
                        <strong>{suggestion.expression}</strong>
                        {suggestion.translation ? <small>{suggestion.translation}</small> : null}
                      </div>
                      {saved ? (
                        <span className="neo-saved-pill">Salvo</span>
                      ) : (
                        <div className="neo-suggestion-actions">
                          <button type="button" onClick={() => onQuickSave(suggestion)} disabled={saving}>Salvar</button>
                          <button type="button" onClick={() => onEdit(suggestion)} disabled={saving}>Editar</button>
                          <button type="button" onClick={() => onIgnore(suggestion)} disabled={saving}>Ignorar</button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
          {message.correction ? (
            <div className="neo-correction-card">
              <p>Correction</p>
              <span>Wrong: {message.correction.wrong}</span>
              <strong>Correct: {message.correction.correct}</strong>
              <button type="button" onClick={() => onMock("Correction saved to My Mistakes and Review.")}>Save correction</button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function RichMessage({ content }) {
  return (
    <div className="neo-rich-text">
      {content.split("\n").map((line, index) => {
        if (!line.trim()) return <br key={index} />;
        if (line.startsWith("- ")) return <li key={index}>{line.slice(2)}</li>;
        if (line.includes("**")) {
          const clean = line.replaceAll("**", "");
          return <p key={index}><strong>{clean}</strong></p>;
        }
        return <p key={index}>{line}</p>;
      })}
    </div>
  );
}

function NeoTypingIndicator() {
  return (
    <div className="neo-typing">
      <Brain className="h-4 w-4" />
      <span>Neo is building your MindBlocks...</span>
      <i /><i /><i />
    </div>
  );
}

function VoiceModePanel({ assistantName, onClose }) {
  return (
    <section className="neo-voice-panel">
      <button type="button" className="neo-close-voice" onClick={onClose}><X className="h-4 w-4" /></button>
      <div className="neo-voice-brain"><Brain className="h-16 w-16" /></div>
      <p>Listening</p>
      <h2>Speak naturally. {assistantName} will turn your voice into MindBlocks.</h2>
      <div className="neo-voice-states">
        <span>Listening</span>
        <span>Thinking</span>
        <span>Responding</span>
      </div>
    </section>
  );
}

function SaveMindBlockModal({ suggestion, playlists, saving, onClose, onSave }) {
  const normalizedSuggestion = normalizeSuggestion(suggestion);
  const [form, setForm] = useState({
    expression: normalizedSuggestion.expression,
    translation: normalizedSuggestion.translation,
    category: normalizedSuggestion.category,
    playlist: playlists[0]?.id ?? "",
    difficulty: "B1",
    tags: "conversation, natural",
    notes: "Saved from a conversation with Neo.",
    usage: normalizedSuggestion.usage,
    examples: normalizedSuggestion.examples,
    relatedExpressions: normalizedSuggestion.relatedExpressions,
    commonMistake: normalizedSuggestion.commonMistake,
    practice: normalizedSuggestion.practice,
    pattern: normalizedSuggestion.pattern,
    patternExplanation: normalizedSuggestion.patternExplanation,
    favorite: true,
    generateAudio: true,
    review: true,
    neural: true,
  });

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  return (
    <div className="neo-modal-wrap" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close modal" />
      <section className="neo-save-modal">
        <div className="neo-save-header">
          <div>
            <p>New MindBlock</p>
            <h2>Save expression</h2>
          </div>
          <button type="button" onClick={onClose}><X className="h-5 w-5" /></button>
        </div>
        <div className="neo-save-body">
          <NeoField label="Expression" value={form.expression} onChange={(value) => update("expression", value)} />
          <NeoField label="Translation" value={form.translation} onChange={(value) => update("translation", value)} />
          <NeoField label="Category" value={form.category} onChange={(value) => update("category", value)} />
          <label>
            <span>Playlist</span>
            <select value={form.playlist} onChange={(event) => update("playlist", event.target.value)}>
              {playlists.length === 0 ? <option value="">Create default playlist</option> : null}
              {playlists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}
            </select>
          </label>
          <NeoField label="Difficulty" value={form.difficulty} onChange={(value) => update("difficulty", value)} />
          <NeoField label="Tags" value={form.tags} onChange={(value) => update("tags", value)} />
          <label className="sm:col-span-2">
            <span>Notes</span>
            <textarea value={form.notes} onChange={(event) => update("notes", event.target.value)} rows={3} />
          </label>
          {[
            ["favorite", "Favorite"],
            ["generateAudio", "Generate audio automatically"],
            ["review", "Add to review queue"],
            ["neural", "Add to Neural Universe"],
          ].map(([key, label]) => (
            <label key={key} className="neo-check-row">
              <input type="checkbox" checked={form[key]} onChange={(event) => update(key, event.target.checked)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <footer className="neo-save-footer">
          <button type="button" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="button" className="fm-gradient" onClick={() => onSave(form)} disabled={saving}>
            <Check className="h-4 w-4" /> {saving ? "Saving..." : "Save MindBlock"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function NeoField({ label, value, onChange }) {
  return (
    <label>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
