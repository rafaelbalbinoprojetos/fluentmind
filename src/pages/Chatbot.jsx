import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  Brain,
  BookOpen,
  Check,
  Clipboard,
  Copy,
  Edit3,
  Focus,
  Heart,
  History,
  MessageCircle,
  Mic,
  PanelRight,
  Paperclip,
  Settings,
  Send,
  Sparkles,
  RotateCcw,
  Trash2,
  Volume2,
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
import { createCorrectedMistake } from "../services/correctedMistakes.js";
import { normalizeMindBlockExpressionText } from "../utils/mindblockText.js";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
const NEO_LOCAL_FAVORITES_KEY = "fluentmind_neo_favorites";
const NEO_LOCAL_NEURAL_KEY = "fluentmind_neo_neural_activity";
const NEO_MEMORY_KEY = "fluentmind_neo_memory";

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

const neoModes = [
  {
    id: "conversation",
    title: "Conversation",
    description: "Practice real-life English naturally.",
    prompt: "Great choice. Let's practice real conversation. I will ask simple questions and correct only what matters.",
  },
  {
    id: "correction",
    title: "Correct my English",
    description: "Write anything and I will correct it gently.",
    prompt: "Perfect. Send me any English sentence and I will correct it gently, with a short explanation and a reusable MindBlock.",
  },
  {
    id: "explain",
    title: "Explain like I'm five",
    description: "Simple explanations with daily-life analogies.",
    prompt: "Nice. Tell me what sounds confusing and I will explain it simply, with daily examples.",
  },
  {
    id: "mindblocks",
    title: "Build MindBlocks",
    description: "Turn useful phrases into saved mental blocks.",
    prompt: "Excellent. Give me a topic and I will turn it into practical MindBlocks you can save and review.",
  },
  {
    id: "pronunciation",
    title: "Pronunciation",
    description: "Practice speaking and rhythm.",
    prompt: "Pronunciation mode is ready as a guided practice. Type a phrase and I will show rhythm, stress and a practice path.",
  },
  {
    id: "listening",
    title: "Listening",
    description: "Train your ear with short expressions.",
    prompt: "Let's train your ear. I will give you short expressions and help you notice natural rhythm.",
  },
  {
    id: "review",
    title: "Review due",
    description: "Strengthen expressions that are fading.",
    prompt: "Let's strengthen what is fading. I can turn your saved expressions into quick review prompts.",
  },
  {
    id: "challenge",
    title: "Random challenge",
    description: "One small challenge to improve today.",
    prompt: "Here is today's challenge: write one natural sentence about your routine. I will make it sound more fluent.",
  },
];

const quickPromptChips = [
  { label: "Correct this", text: "Correct this sentence and explain simply: " },
  { label: "Make it natural", text: "Make this sound natural in English: " },
  { label: "Explain simply", text: "Explain this simply with examples: " },
  { label: "Give examples", text: "Give me natural examples for: " },
  { label: "Save this", text: "Turn this into a MindBlock: " },
  { label: "Practice with me", text: "Practice this with me step by step: " },
];

const neoMoods = {
  curious: { label: "Curious", line: "Let's explore something new today." },
  focused: { label: "Focused", line: "Let's strengthen what you learned yesterday." },
  excited: { label: "Excited", line: "Your brain is building new English paths." },
  proud: { label: "Proud", line: "You are turning mistakes into fluency." },
  helper: { label: "Helper", line: "I will keep it simple and practical." },
};

const defaultNeoMemory = [
  "Your goal is Work English.",
  "You like technology.",
  "You're building FluentMind.",
  "You want to think directly in English.",
];

const dailyMissions = [
  "Save 3 expressions",
  "Practice pronunciation",
  "Finish 1 review",
  "Speak with Neo for 5 minutes",
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
  const displayName = user?.user_metadata?.display_name?.trim() || user?.email?.split("@")[0] || "Rafael";
  const currentLevel = user?.user_metadata?.learning_preferences?.currentLevel || "Beginner";
  const chatTone = user?.user_metadata?.chat_tone || "Natural";
  const [conversations, setConversations] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [messages, setMessages] = useState(welcomeMessages);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [, setLoadingConversations] = useState(true);
  const [voiceMode, setVoiceMode] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [learningPanelOpen, setLearningPanelOpen] = useState(false);
  const [mobileSheet, setMobileSheet] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState("conversation");
  const [neoMood, setNeoMood] = useState("curious");
  const [memoryEntries, setMemoryEntries] = useState(defaultNeoMemory);
  const [sessionXp, setSessionXp] = useState(0);
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
  const [savedCorrectionIds, setSavedCorrectionIds] = useState([]);

  const realMessages = messages.filter((message) => message.id !== "welcome-neo");
  const isGuidedStart = !activeSessionId && realMessages.length === 0 && !typing;
  const detectedExpressions = realMessages
    .flatMap((message) => getMessageSuggestions(message).map((suggestion) => normalizeSuggestion(suggestion)))
    .filter((item) => item.expression);
  const detectedCorrections = realMessages
    .map((message) => message.correction)
    .filter((correction) => correction?.wrong && correction?.correct);
  const sessionSummary = {
    mode: neoModes.find((mode) => mode.id === selectedMode)?.title || "Conversation",
    messages: realMessages.length,
    mindBlocks: savedSuggestionIds.length,
    corrections: savedCorrectionIds.length || detectedCorrections.length,
    reviewItems: savedSuggestionIds.length + (savedCorrectionIds.length || detectedCorrections.length),
    xp: sessionXp,
    progress: Math.min(98, Math.max(12, realMessages.length * 8 + savedSuggestionIds.length * 12 + detectedCorrections.length * 10)),
  };
  const conversationScore = {
    quality: Math.min(98, 72 + Math.floor(sessionSummary.progress / 5)),
    vocabulary: Math.min(98, 70 + detectedExpressions.length * 4),
    grammar: Math.min(98, 82 + savedCorrectionIds.length * 4),
    participation: Math.min(98, 74 + realMessages.filter((message) => message.role !== "neo").length * 3),
    naturalness: Math.min(98, 76 + savedSuggestionIds.length * 3),
  };

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(NEO_MEMORY_KEY) || "[]");
      if (Array.isArray(stored) && stored.length > 0) setMemoryEntries(stored);
    } catch {
      setMemoryEntries(defaultNeoMemory);
    }
  }, []);

  useEffect(() => {
    if (typing) {
      setNeoMood("focused");
    } else if (savedSuggestionIds.length > 0 || savedCorrectionIds.length > 0) {
      setNeoMood("proud");
    } else if (selectedMode === "challenge" || selectedMode === "mindblocks") {
      setNeoMood("excited");
    } else if (selectedMode === "correction" || selectedMode === "explain") {
      setNeoMood("helper");
    } else {
      setNeoMood("curious");
    }
  }, [selectedMode, savedCorrectionIds.length, savedSuggestionIds.length, typing]);

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
    setSelectedMode("conversation");
    setSessionXp(0);
    setConversations((current) => current.map((item) => ({ ...item, active: false })));
    toast("Nova conversa pronta.");
  };

  const awardXp = useCallback((amount, reason = "New neural connection formed") => {
    setSessionXp((current) => current + amount);
    toast.success(`+${amount} XP · ${reason}`, { icon: "✨" });
  }, []);

  const chooseNeoMode = (mode) => {
    setSelectedMode(mode.id);
    setMessages([
      {
        id: `mode-${mode.id}-${Date.now()}`,
        role: "neo",
        createdAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        content: mode.prompt,
        suggestedMindBlocks: mode.id === "mindblocks" ? [
          {
            expression: "I am getting used to thinking in English.",
            translation: "Estou me acostumando a pensar em ingles.",
            category: "Conversation",
            source: "Neo Experience",
            usage: "Use when describing language progress.",
            examples: ["I am getting used to thinking in English every day."],
          },
        ] : [],
      },
    ]);
  };

  const editMemory = () => {
    const nextValue = window.prompt("Edit Neo memory. Use one item per line.", memoryEntries.join("\n"));
    if (nextValue === null) return;
    const nextEntries = nextValue
      .split("\n")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 8);
    setMemoryEntries(nextEntries.length ? nextEntries : defaultNeoMemory);
    localStorage.setItem(NEO_MEMORY_KEY, JSON.stringify(nextEntries.length ? nextEntries : defaultNeoMemory));
    toast.success("Neo memory updated locally.");
  };

  const applyQuickPrompt = (chip) => {
    setInput((current) => current ? `${chip.text}${current}` : chip.text);
  };

  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado.");
    } catch {
      toast.error("Nao foi possivel copiar.");
    }
  };

  const runMockAction = (label, payload = null) => {
    if (label === "Favorite" && payload?.expression) {
      const current = JSON.parse(localStorage.getItem(NEO_LOCAL_FAVORITES_KEY) || "[]");
      localStorage.setItem(NEO_LOCAL_FAVORITES_KEY, JSON.stringify([...new Set([...current, payload.expression])]));
      toast.success("Favorito salvo localmente.");
      return;
    }

    if (label === "Add to Neural Universe") {
      const current = JSON.parse(localStorage.getItem(NEO_LOCAL_NEURAL_KEY) || "[]");
      localStorage.setItem(NEO_LOCAL_NEURAL_KEY, JSON.stringify([
        ...current,
        {
          id: `neo-${Date.now()}`,
          type: "conversation_mindblock",
          label: payload?.expression || "Neo conversation",
          createdAt: new Date().toISOString(),
        },
      ]));
      awardXp(5, "New neural node created");
      toast.success("Conexao neural registrada localmente.");
      return;
    }

    if (label === "Generate Audio") {
      toast("Audio generation will be available soon.");
      return;
    }

    if (label === "Practice Pronunciation") {
      awardXp(10, "Practice completed");
      toast("Practice Pronunciation will be available soon.");
      return;
    }

    if (label === "Add to Review") {
      awardXp(20, "Review item created");
      toast.success("Marcado para revisao nesta sessao.");
      return;
    }

    if (label === "Add to Playlist") {
      toast("Use o modal de salvar para escolher uma playlist.");
    }
  };

  const endSession = () => {
    awardXp(15, "Conversation completed");
    setSummaryOpen(true);
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
      awardXp(1, "Message sent");

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
          mode: selectedMode,
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
        correction: data.correction || null,
      };
      const storedAssistantMessage = await createConversationMessage({
        userId: user.id,
        sessionId,
        role: "assistant",
        content: reply.content,
        correction: reply.correction,
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
      if (reply.correction?.wrong && reply.correction?.correct) {
        if (reply.correction.source === "user_message") {
          const saved = await saveCorrectionFromChat(reply.correction, storedAssistantMessage.id, {
            silent: true,
            sessionId,
          });
          if (saved) {
            toast.success("Erro detectado e salvo em Meus Erros.");
          }
        } else {
          toast("Correction detected. Save it in Meus Erros when useful.");
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
      const expression = normalizeMindBlockExpressionText(form.expression);
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
      awardXp(5, "New neural node created");
      toast.success("MindBlock salvo na sua biblioteca.");
    } catch (error) {
      console.error(error);
      toast.error(error.message || "Nao foi possivel salvar o MindBlock.");
    } finally {
      setSavingMindBlock(false);
    }
  };

  const saveCorrectionFromChat = useCallback(async (correction, messageId, { silent = false, sessionId = activeSessionId } = {}) => {
    if (!user?.id) {
      if (!silent) toast.error("Sessao expirada. Faca login novamente.");
      return false;
    }
    if (!correction?.wrong || !correction?.correct) {
      if (!silent) toast.error("Correcao incompleta.");
      return false;
    }

    try {
      await createCorrectedMistake({
        conversationId: sessionId,
        messageId,
        originalText: correction.wrong,
        correctedText: correction.correct,
        explanation: correction.explanation,
        category: correction.category || "Conversation",
        level: correction.level || user?.user_metadata?.learning_preferences?.currentLevel || "A2",
      }, { userId: user.id });
      await recordDailyActivity(user.id, {
        expressions_reviewed: 1,
        study_minutes: 1,
      });
      setSavedCorrectionIds((current) => [...new Set([...current, messageId])]);
      awardXp(3, "Neural pathway strengthened");
      if (!silent) toast.success("Correcao salva em Meus Erros.");
      return true;
    } catch (error) {
      console.error("Erro ao salvar correcao:", error);
      if (!silent) toast.error(error.message || "Nao foi possivel salvar a correcao.");
      return false;
    }
  }, [activeSessionId, awardXp, user?.id, user?.user_metadata?.learning_preferences?.currentLevel]);

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

  return (
    <main className={`neo-page neo-experience-v2 ${focusMode ? "is-focus" : ""} ${voiceMode ? "is-voice" : ""} ${learningPanelOpen ? "panel-open" : ""}`}>
      {!focusMode ? (
        <NeoSessionSidebar
          assistantName={assistantName}
          displayName={displayName}
          currentLevel={currentLevel}
          sessionSummary={sessionSummary}
          selectedMode={selectedMode}
          conversations={conversations}
          activeSessionId={activeSessionId}
          onNew={startNewConversation}
          onSelectMode={chooseNeoMode}
        />
      ) : null}

      <section className="neo-chat-shell">
        <NeoChatHeader
          assistantName={assistantName}
          voiceMode={voiceMode}
          focusMode={focusMode}
          mood={neoMoods[neoMood]}
          avatarState={voiceMode ? "listening" : typing ? "thinking" : "idle"}
          currentLevel={currentLevel}
          chatTone={chatTone}
          onToggleVoice={() => setVoiceMode((value) => !value)}
          onToggleFocus={() => setFocusMode((value) => !value)}
          onTogglePanel={() => setLearningPanelOpen((value) => !value)}
          onEndSession={endSession}
          onClear={() => {
            startNewConversation();
          }}
          activeSessionId={activeSessionId}
        />

        {voiceMode ? (
          <VoiceModePanel assistantName={assistantName} onClose={() => setVoiceMode(false)} />
        ) : (
          <div className="neo-message-list" ref={messageListRef}>
            {isGuidedStart ? (
              <NeoGuidedStart
                displayName={displayName}
                modes={neoModes}
                selectedMode={selectedMode}
                onSelectMode={chooseNeoMode}
              />
            ) : null}
            <NeoMemoryCard entries={memoryEntries} onEdit={editMemory} />
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
                correctionSaved={savedCorrectionIds.includes(message.id)}
                onSaveCorrection={(correction) => saveCorrectionFromChat(correction, message.id)}
                onCopy={copyText}
                onMockAction={runMockAction}
              />
            ))}
            {typing ? <NeoTypingIndicator /> : null}
          </div>
        )}

        <NeoComposer
          input={input}
          setInput={setInput}
          onSubmit={submitMessage}
          onVoice={() => setVoiceMode(true)}
          onChip={applyQuickPrompt}
        />
      </section>

      {!focusMode ? (
        <LearningPanel
          open={learningPanelOpen}
          summary={sessionSummary}
          score={conversationScore}
          expressions={detectedExpressions}
          corrections={detectedCorrections}
          saving={savingMindBlock}
          onSaveExpression={(suggestion) => quickSaveSuggestion(suggestion, `panel-${suggestion.expression}`)}
          onPracticeExpression={(suggestion) => {
            setInput(`Practice this expression with me: ${suggestion.expression}`);
            awardXp(10, "Practice started");
          }}
          onMockAction={runMockAction}
          onClose={() => setLearningPanelOpen(false)}
        />
      ) : null}

      <NeoMobileNav onOpen={setMobileSheet} onEndSession={endSession} />

      {mobileSheet ? (
        <NeoBottomSheet
          type={mobileSheet}
          modes={neoModes}
          selectedMode={selectedMode}
          conversations={conversations}
          memoryEntries={memoryEntries}
          summary={sessionSummary}
          expressions={detectedExpressions}
          corrections={detectedCorrections}
          onEndSession={endSession}
          onClose={() => setMobileSheet(null)}
          onSelectMode={(mode) => {
            chooseNeoMode(mode);
            setMobileSheet(null);
          }}
          onEditMemory={editMemory}
        />
      ) : null}

      {summaryOpen ? (
        <NeoSessionSummary
          summary={sessionSummary}
          onClose={() => setSummaryOpen(false)}
        />
      ) : null}

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

function NeoSessionSidebar({ assistantName, displayName, currentLevel, sessionSummary, selectedMode, conversations, activeSessionId, onNew, onSelectMode }) {
  return (
    <aside className="neo-left-sidebar neo-session-sidebar">
      <div className="neo-avatar-card">
        <div className="neo-avatar-large"><Brain className="h-7 w-7" /></div>
        <div>
          <h2>{assistantName}</h2>
          <p>Fluency mentor</p>
        </div>
      </div>
      <button type="button" className="neo-new-button" onClick={onNew}>
        <PlusIcon /> New conversation
      </button>

      <section className="neo-left-memory">
        <p>Neo Memory</p>
        <dl>
          <div><dt>Name</dt><dd>{displayName}</dd></div>
          <div><dt>Goal</dt><dd>Work English</dd></div>
          <div><dt>Current Level</dt><dd>{currentLevel}</dd></div>
          <div><dt>Favorite Topics</dt><dd>Programming · Technology · Travel</dd></div>
          <div><dt>Most Used Expressions</dt><dd>{Math.max(5, sessionSummary.mindBlocks + sessionSummary.messages)}</dd></div>
          <div><dt>Current Streak</dt><dd>4 days</dd></div>
        </dl>
      </section>

      <div className="neo-sidebar-section">
        <h3>Practice modes</h3>
        <div className="neo-mode-mini-list">
          {neoModes.slice(0, 6).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => onSelectMode(mode)}
              className={selectedMode === mode.id ? "is-active" : ""}
            >
              <span>{mode.title}</span>
              <small>{mode.description}</small>
            </button>
          ))}
        </div>
      </div>

      <div className="neo-sidebar-section">
        <h3>Recent sessions</h3>
        <div className="neo-conversation-groups">
          {(conversations || []).slice(0, 5).map((conversation) => (
            <div key={conversation.id} className={`neo-conversation-item ${conversation.id === activeSessionId ? "is-active" : ""}`}>
              <span>{conversation.title || conversation.name || "Neo conversation"}</span>
              <small>{conversation.scenario || "Conversation"}</small>
            </div>
          ))}
          {(!conversations || conversations.length === 0) ? <p className="fm-muted text-sm">No saved sessions yet.</p> : null}
        </div>
      </div>
    </aside>
  );
}

function NeoAvatar({ state = "idle", size = "small" }) {
  return (
    <div className={`neo-live-avatar is-${state} is-${size}`}>
      <Brain className={size === "large" ? "h-10 w-10" : "h-5 w-5"} />
      <span className="neo-avatar-orbit" />
      <span className="neo-avatar-wave one" />
      <span className="neo-avatar-wave two" />
      <span className="neo-avatar-particle one" />
      <span className="neo-avatar-particle two" />
    </div>
  );
}

function NeoGuidedStart({ displayName, modes, selectedMode, onSelectMode }) {
  return (
    <section className="neo-guided-start">
      <div className="neo-guided-hero">
        <div className="neo-hero-brain"><Brain className="h-10 w-10" /></div>
        <p>MindBlocks Method</p>
        <h2>Hi {displayName}, what do you want to practice today?</h2>
        <span>Choose a mode and I will guide you step by step.</span>
      </div>
      <div className="neo-mode-grid">
        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            onClick={() => onSelectMode(mode)}
            className={selectedMode === mode.id ? "is-active" : ""}
          >
            <Sparkles className="h-5 w-5" />
            <strong>{mode.title}</strong>
            <small>{mode.description}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

function NeoMemoryCard({ entries, onEdit }) {
  return (
    <section className="neo-memory-card">
      <div>
        <p>I remember:</p>
        <ul>
          {entries.slice(0, 4).map((entry) => <li key={entry}>{entry}</li>)}
        </ul>
      </div>
      <button type="button" onClick={onEdit}>Edit Memory</button>
    </section>
  );
}

function NeoComposer({ input, setInput, onSubmit, onVoice, onChip }) {
  return (
    <form className="neo-composer neo-composer-v2" onSubmit={onSubmit}>
      <div className="neo-prompt-chips">
        {quickPromptChips.map((chip) => (
          <button key={chip.label} type="button" onClick={() => onChip(chip)}>
            {chip.label}
          </button>
        ))}
      </div>
      <div className="neo-composer-row">
        <button type="button" className="neo-icon-button" aria-label="Attach context" onClick={() => toast("Attachments will be available soon.")}>
          <Paperclip className="h-4 w-4" />
        </button>
        <button type="button" className="neo-icon-button" onClick={onVoice} aria-label="Voice mode">
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
      </div>
    </form>
  );
}

function LearningPanel({
  open,
  summary,
  score,
  expressions,
  corrections,
  saving,
  onSaveExpression,
  onPracticeExpression,
  onMockAction,
  onClose,
}) {
  return (
    <aside className={`neo-right-sidebar neo-learning-panel ${open ? "is-open" : ""}`}>
      <div className="neo-panel-header">
        <div>
          <p>Learning Panel</p>
          <h2>Session intelligence</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Close learning panel"><X className="h-4 w-4" /></button>
      </div>

      <section className="neo-intel-card">
        <p>Current session</p>
        <div className="neo-panel-stats">
          <span>Mode <strong>{summary.mode}</strong></span>
          <span>Messages <strong>{summary.messages}</strong></span>
          <span>MindBlocks <strong>{summary.mindBlocks}</strong></span>
          <span>Corrections <strong>{summary.corrections}</strong></span>
          <span>Review items <strong>{summary.reviewItems}</strong></span>
          <span>Session XP <strong>{summary.xp}</strong></span>
          <span>Progress <strong>{summary.progress}%</strong></span>
          <span>Neural Growth <strong>{summary.progress + summary.mindBlocks}%</strong></span>
        </div>
        <div className="fm-progress-track mt-3 h-2 overflow-hidden rounded-full">
          <div className="fm-progress-fill h-full rounded-full" style={{ width: `${summary.progress}%` }} />
        </div>
      </section>

      <section className="neo-intel-card">
        <p>Conversation Score</p>
        <div className="neo-score-list">
          {Object.entries(score).map(([key, value]) => (
            <div key={key}>
              <span>{key.replace(/^\w/, (letter) => letter.toUpperCase())}</span>
              <strong>{value}%</strong>
              <i><b style={{ width: `${value}%` }} /></i>
            </div>
          ))}
        </div>
      </section>

      <section className="neo-intel-card">
        <p>Useful expressions</p>
        <div className="neo-panel-expression-list">
          {expressions.slice(0, 5).map((item) => (
            <article key={item.expression}>
              <strong>{item.expression}</strong>
              {item.translation ? <small>{item.translation}</small> : null}
              <div>
                <button type="button" onClick={() => onMockAction("Generate Audio", item)}>Listen</button>
                <button type="button" onClick={() => onSaveExpression(item)} disabled={saving}>Save</button>
                <button type="button" onClick={() => onPracticeExpression(item)}>Practice</button>
                <button type="button" onClick={() => onMockAction("Add to Review", item)}>Review</button>
              </div>
            </article>
          ))}
          {expressions.length === 0 ? <small>No expressions detected yet.</small> : null}
        </div>
      </section>

      <section className="neo-intel-card">
        <p>Corrections</p>
        <div className="neo-correction-mini-list">
          {corrections.slice(0, 4).map((item) => (
            <div key={`${item.wrong}-${item.correct}`}>
              <span>{item.wrong}</span>
              <strong>{item.correct}</strong>
            </div>
          ))}
          {corrections.length === 0 ? <small>No corrections found yet.</small> : null}
        </div>
      </section>

      <section className="neo-intel-card">
        <p>Suggested next steps</p>
        <div className="neo-next-steps">
          <Link to="/insights">Review 3 saved expressions</Link>
          <button type="button" onClick={() => toast("Pronunciation practice will be available soon.")}>Practice pronunciation</button>
          <Link to="/neural-universe">Open Neural Universe</Link>
        </div>
      </section>

      <section className="neo-intel-card">
        <p>Today's Mission</p>
        <div className="neo-mission-list">
          {dailyMissions.map((mission, index) => (
            <div key={mission}>
              <span>{mission}</span>
              <strong>{index === 0 ? `${Math.min(3, summary.mindBlocks)}/3` : index === 2 ? `${Math.min(1, summary.reviewItems)}/1` : "0/1"}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="neo-intel-card">
        <p>Neural activity</p>
        <div className="neo-neural-line">
          <span>Core</span>
          <i />
          <span>Conversation</span>
          <i />
          <span>MindBlock</span>
        </div>
      </section>
    </aside>
  );
}

function NeoMobileNav({ onOpen, onEndSession }) {
  return (
    <nav className="neo-mobile-nav-v3" aria-label="Neo mobile tools">
      <button type="button" onClick={() => onOpen("tools")}><PanelRight className="h-4 w-4" />Tools</button>
      <button type="button" onClick={() => onOpen("practice")}><Sparkles className="h-4 w-4" />Practice</button>
      <button type="button" onClick={onEndSession}><Check className="h-4 w-4" />End</button>
    </nav>
  );
}

function NeoBottomSheet({
  type,
  modes,
  selectedMode,
  conversations,
  memoryEntries,
  summary,
  expressions,
  corrections,
  onEndSession,
  onClose,
  onSelectMode,
  onEditMemory,
}) {
  const title = {
    tools: "Learning tools",
    practice: "Practice",
    session: "Current Session",
    memory: "Things I remember",
    history: "History",
  }[type] || "Learning tools";

  return (
    <div className="neo-sheet-backdrop" role="dialog" aria-modal="true">
      <button type="button" className="neo-sheet-dismiss" onClick={onClose} aria-label="Close sheet" />
      <section className="neo-bottom-sheet">
        <div className="neo-sheet-handle" />
        <header>
          <h2>{title}</h2>
          <button type="button" onClick={onClose}><X className="h-4 w-4" /></button>
        </header>

        {type === "tools" ? (
          <div className="neo-sheet-tools">
            <button type="button" onClick={() => onSelectMode(modes.find((mode) => mode.id === "conversation") || modes[0])}>
              <MessageCircle className="h-4 w-4" />
              <span><strong>New practice</strong><small>Choose a conversation path</small></span>
            </button>
            <button type="button" onClick={() => onSelectMode(modes.find((mode) => mode.id === "review") || modes[0])}>
              <RotateCcw className="h-4 w-4" />
              <span><strong>Review due</strong><small>Strengthen saved expressions</small></span>
            </button>
            <button type="button" onClick={() => onSelectMode(modes.find((mode) => mode.id === "correction") || modes[0])}>
              <Check className="h-4 w-4" />
              <span><strong>Correct my English</strong><small>Send a phrase and Neo corrects it</small></span>
            </button>
            <Link to="/biblioteca">
              <BookOpen className="h-4 w-4" />
              <span><strong>Open library</strong><small>See saved MindBlocks</small></span>
            </Link>
            <Link to="/neural-universe">
              <Brain className="h-4 w-4" />
              <span><strong>Neural Universe</strong><small>View your learning map</small></span>
            </Link>
            <button type="button" onClick={onEndSession}>
              <Check className="h-4 w-4" />
              <span><strong>End session</strong><small>Show summary and XP</small></span>
            </button>
          </div>
        ) : null}

        {type === "practice" ? (
          <div className="neo-sheet-grid">
            {modes.map((mode) => (
              <button key={mode.id} type="button" onClick={() => onSelectMode(mode)} className={selectedMode === mode.id ? "is-active" : ""}>
                <strong>{mode.title}</strong>
                <small>{mode.description}</small>
              </button>
            ))}
          </div>
        ) : null}

        {type === "session" ? (
          <div className="neo-sheet-stats">
            <span>Messages <strong>{summary.messages}</strong></span>
            <span>Expressions <strong>{expressions.length}</strong></span>
            <span>Corrections <strong>{corrections.length}</strong></span>
            <span>Session XP <strong>{summary.xp}</strong></span>
            <span>Neural Growth <strong>{summary.progress}%</strong></span>
          </div>
        ) : null}

        {type === "memory" ? (
          <div className="neo-sheet-memory">
            {memoryEntries.map((entry) => <p key={entry}>{entry}</p>)}
            <button type="button" onClick={onEditMemory}>Edit Memory</button>
          </div>
        ) : null}

        {type === "history" ? (
          <div className="neo-sheet-history">
            {(conversations || []).slice(0, 8).map((conversation) => (
              <div key={conversation.id}>
                <strong>{conversation.title || conversation.name || "Neo conversation"}</strong>
                <small>{conversation.scenario || "Conversation"}</small>
              </div>
            ))}
            {(!conversations || conversations.length === 0) ? <p>No saved conversations yet.</p> : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function NeoSessionSummary({ summary, onClose }) {
  return (
    <div className="neo-modal-wrap" role="dialog" aria-modal="true">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Close summary" />
      <section className="neo-summary-modal">
        <header>
          <div>
            <p>Conversation Summary</p>
            <h2>Today you practiced</h2>
          </div>
          <button type="button" onClick={onClose}><X className="h-5 w-5" /></button>
        </header>
        <div className="neo-summary-grid">
          <span>Learned <strong>{summary.mindBlocks || 5} expressions</strong></span>
          <span>Corrected <strong>{summary.corrections || 2} mistakes</strong></span>
          <span>Created <strong>{summary.mindBlocks || 3} MindBlocks</strong></span>
          <span>Earned <strong>{summary.xp} XP</strong></span>
          <span>Studied <strong>{Math.max(1, Math.ceil(summary.messages * 1.5))} minutes</strong></span>
        </div>
        <footer>
          <button type="button" onClick={() => toast.success("Summary saved locally.")}>Save Summary</button>
          <Link to="/insights">Review Tomorrow</Link>
          <Link to="/biblioteca">Open Library</Link>
          <Link to="/neural-universe">Open Neural Universe</Link>
        </footer>
      </section>
    </div>
  );
}

function PlusIcon() {
  return <span className="text-lg leading-none">+</span>;
}

function NeoChatHeader({
  assistantName,
  voiceMode,
  focusMode,
  mood,
  avatarState,
  currentLevel,
  chatTone,
  onToggleVoice,
  onToggleFocus,
  onTogglePanel,
  onEndSession,
  onClear,
  activeSessionId,
}) {
  return (
    <header className="neo-chat-header">
      <div>
        <div className="flex items-center gap-3">
          <NeoAvatar state={avatarState} />
          <div>
            <h1>{assistantName}</h1>
            <p>Your personal fluency mentor</p>
          </div>
        </div>
        <div className="neo-status-row">
          <span><i /> Online</span>
          <span>Neo mood: {mood?.label || "Curious"}</span>
          <span>Current mode: {voiceMode ? "Voice" : "Conversation"}</span>
          <span>Level: {currentLevel}</span>
          <span>Tone: {chatTone}</span>
          <span>Goal: Think in English</span>
        </div>
        <p className="neo-mood-line">{mood?.line || "Let's explore something new today."}</p>
      </div>

      <div className="neo-header-actions">
        <button type="button" onClick={onClear}><MessageCircle className="h-4 w-4" /> New conversation</button>
        <button type="button" className={voiceMode ? "is-active" : ""} onClick={onToggleVoice}><Mic className="h-4 w-4" /> Voice Mode</button>
        <button type="button" className={focusMode ? "is-active" : ""} onClick={onToggleFocus}><Focus className="h-4 w-4" /> Focus Mode</button>
        <Link to="/conversas" className="neo-header-link">
          <History className="h-4 w-4" />
          History
          {activeSessionId ? <span className="sr-only">current conversation saved</span> : null}
        </Link>
        <Link to="/configuracoes" className="neo-header-link"><Settings className="h-4 w-4" /> Settings</Link>
        <button type="button" className="neo-panel-toggle" onClick={onTogglePanel}><PanelRight className="h-4 w-4" /> Learning Panel</button>
        <button type="button" onClick={onEndSession}><Check className="h-4 w-4" /> End Session</button>
        <button type="button" onClick={onClear}><Trash2 className="h-4 w-4" /> Clear</button>
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
  correctionSaved,
  onSaveCorrection,
  onCopy,
  onMockAction,
}) {
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [practiceChecked, setPracticeChecked] = useState(false);
  const isNeo = message.role === "neo";
  const suggestions = getMessageSuggestions(message)
    .map((suggestion) => ({
      ...suggestion,
      key: getSuggestionKey(message.id, suggestion),
    }))
    .filter((suggestion) => !ignoredSuggestionIds.includes(suggestion.key));
  const hasSuggestion = isNeo && !suggestionsDisabled && suggestions.length > 0;
  const primarySuggestion = suggestions[0] ?? null;

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
          {!isNeo ? (
            <div className="neo-user-message-actions">
              <button type="button" onClick={() => onCopy(message.content)}><Copy className="h-3.5 w-3.5" /> Copy</button>
              <button type="button" onClick={() => toast("Message editing will be available soon.")}><Edit3 className="h-3.5 w-3.5" /> Edit</button>
            </div>
          ) : null}
          {hasSuggestion ? (
            <div className="neo-detected-badge">
              <div className="neo-detected-heading">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Useful expression detected</span>
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
                          <button type="button" onClick={() => onMockAction("Generate Audio", suggestion)} disabled={saving}>Listen</button>
                          <button type="button" onClick={() => onMockAction("Practice Pronunciation", suggestion)} disabled={saving}>Practice</button>
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
              <p>Correction detected</p>
              <span>Wrong: {message.correction.wrong}</span>
              <strong>Correct: {message.correction.correct}</strong>
              {message.correction.explanation ? <small>{message.correction.explanation}</small> : null}
              <div className="neo-correction-actions">
                <button type="button" onClick={() => onSaveCorrection(message.correction)} disabled={correctionSaved}>
                  {correctionSaved ? "Saved in Meus Erros" : "Save correction"}
                </button>
                <button type="button" onClick={() => onMockAction("Add to Review", message.correction)}>Add to review</button>
                <button type="button" onClick={() => onMockAction("Practice Pronunciation", message.correction)}>Practice again</button>
              </div>
            </div>
          ) : null}
          {isNeo ? (
            <details className="neo-response-tools">
              <summary><Sparkles className="h-3.5 w-3.5" /> Actions and practice</summary>
              <div className="neo-response-actions">
                <button type="button" onClick={() => (primarySuggestion ? onQuickSave(primarySuggestion) : toast("No MindBlock detected in this response."))}>
                  <Sparkles className="h-3.5 w-3.5" /> Save MindBlock
                </button>
                <button type="button" onClick={() => (message.correction ? onSaveCorrection(message.correction) : toast("No correction detected in this response."))}>
                  <X className="h-3.5 w-3.5" /> Save Correction
                </button>
                <button type="button" onClick={() => onMockAction("Generate Audio", primarySuggestion)}><Volume2 className="h-3.5 w-3.5" /> Generate Audio</button>
                <button type="button" onClick={() => onMockAction("Practice Pronunciation", primarySuggestion)}><Mic className="h-3.5 w-3.5" /> Practice</button>
                <button type="button" onClick={() => onMockAction("Add to Review", primarySuggestion)}><RotateCcw className="h-3.5 w-3.5" /> Add to Review</button>
                <button type="button" onClick={() => onMockAction("Add to Playlist", primarySuggestion)}><BookOpen className="h-3.5 w-3.5" /> Playlist</button>
                <button type="button" onClick={() => onMockAction("Add to Neural Universe", primarySuggestion)}><Brain className="h-3.5 w-3.5" /> Neural</button>
                <button type="button" onClick={() => onMockAction("Favorite", primarySuggestion)}><Heart className="h-3.5 w-3.5" /> Favorite</button>
                <button type="button" onClick={() => onCopy(message.content)}><Clipboard className="h-3.5 w-3.5" /> Copy</button>
              </div>
            </details>
          ) : null}
          {isNeo ? (
            <QuickPractice
              suggestion={primarySuggestion}
              answer={practiceAnswer}
              checked={practiceChecked}
              onAnswer={setPracticeAnswer}
              onCheck={() => {
                setPracticeChecked(true);
                onMockAction("Practice Pronunciation", primarySuggestion);
              }}
            />
          ) : null}
        </div>
      </div>
    </article>
  );
}

function QuickPractice({ suggestion, answer, checked, onAnswer, onCheck }) {
  const seed = suggestion?.expression?.split(" ").slice(0, 3).join(" ") || "I'm interested in";

  return (
    <section className="neo-quick-practice">
      <p>Practice Challenge</p>
      <span>Create one sentence using:</span>
      <strong>{seed}</strong>
      <div>
        <input value={answer} onChange={(event) => onAnswer(event.target.value)} placeholder="Type your sentence..." />
        <button type="button" onClick={onCheck} disabled={!answer.trim()}>Check</button>
      </div>
      {checked ? (
        <small>{answer.toLowerCase().includes(seed.toLowerCase().split(" ")[0]) ? "Good. Keep the sentence natural and complete." : `Try including "${seed}" in your sentence.`}</small>
      ) : null}
    </section>
  );
}

function buildMessageBlocks(content) {
  const lines = String(content || "").split("\n");
  const sections = [];
  let current = { title: "Main idea", lines: [] };

  lines.forEach((line) => {
    const clean = line.trim();
    const heading = clean.match(/^(?:#{2,4}\s+([A-Za-z0-9 &'/-]+)|([A-Z][A-Za-z &]+):)$/);
    if (heading && current.lines.some((item) => item.trim())) {
      sections.push(current);
      current = { title: (heading[1] || heading[2]).trim(), lines: [] };
      return;
    }
    current.lines.push(line);
  });
  if (current.lines.some((item) => item.trim())) sections.push(current);
  return sections;
}

function RichMessage({ content }) {
  const blocks = buildMessageBlocks(content);
  const shouldCollapse = blocks.length > 2 || String(content || "").length > 700;

  if (shouldCollapse) {
    return (
      <div className="neo-rich-blocks">
        {blocks.map((block, index) => (
          <details key={`${block.title}-${index}`} open={index === 0}>
            <summary>
              <span>{block.title}</span>
              <small>{block.lines.filter((line) => line.trim()).length} items</small>
            </summary>
            <RichMessageLines lines={block.lines} />
          </details>
        ))}
      </div>
    );
  }

  return <RichMessageLines lines={String(content || "").split("\n")} />;
}

function RichMessageLines({ lines }) {
  return (
    <div className="neo-rich-text">
      {lines.map((line, index) => {
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
