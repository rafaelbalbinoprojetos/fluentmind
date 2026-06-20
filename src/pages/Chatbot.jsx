import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  Archive,
  Brain,
  Check,
  Copy,
  Download,
  Focus,
  Headphones,
  Heart,
  Mic,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  Send,
  Share2,
  Sparkles,
  Star,
  Trash2,
  Volume2,
  X,
  Zap,
} from "lucide-react";
import { libraryPlaylists } from "../data/libraryMock.js";
import { useAuth } from "../context/AuthContext.jsx";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

const conversations = [
  { id: "today-1", title: "Thinking in English", group: "Hoje", active: true, tag: "Conversation" },
  { id: "today-2", title: "Correct my routine", group: "Hoje", tag: "Corrections" },
  { id: "yesterday-1", title: "Work English practice", group: "Ontem", tag: "Work" },
  { id: "week-1", title: "Travel expressions", group: "Esta semana", tag: "Travel" },
  { id: "fav-1", title: "Favorite MindBlocks", group: "Favoritas", tag: "Saved" },
];

const initialMessages = [
  {
    id: "m1",
    role: "neo",
    createdAt: "09:24",
    content:
      "Good morning, Rafael. Today we can strengthen your English without translating word by word.\n\nTell me one sentence you want to say naturally, and I will turn it into a MindBlock.",
    detectedExpression: "I'm getting used to it.",
  },
  {
    id: "m2",
    role: "user",
    createdAt: "09:25",
    content: "Como posso dizer estou me acostumando com isso?",
  },
  {
    id: "m3",
    role: "neo",
    createdAt: "09:25",
    content:
      "You can say:\n\n**I'm getting used to it.**\n\nMeaning:\nEstou me acostumando com isso.\n\nExamples:\n- I'm getting used to speaking English every day.\n- I'm getting used to my new routine.\n- I'm getting used to thinking before translating.\n\nCommon mistake:\nDon't say: I am used with it.\nSay: I'm getting used to it.\n\nWould you like to save this MindBlock?",
    detectedExpression: "I'm getting used to it.",
    correction: {
      wrong: "I am used with it.",
      correct: "I'm getting used to it.",
    },
  },
];

const smartContext = {
  summary: "Practicing natural daily fluency, especially adaptation and routine expressions.",
  usefulExpressions: ["I'm getting used to it.", "That makes sense.", "Let me think it through."],
  mistakes: ["I am used with it.", "I have 40 years."],
  vocabulary: ["routine", "adapt", "naturally", "fluency"],
  pattern: "I'm getting used to + noun / verb-ing",
  gain: "+2.4%",
};

function createNeoReply(text) {
  const lower = text.toLowerCase();
  if (lower.includes("40") || lower.includes("years")) {
    return {
      content:
        "Correction detected:\n\nDon't say:\n**I have 40 years.**\n\nSay:\n**I am 40 years old.**\n\nWhy:\nIn English, age uses **be + years old**, not **have**.\n\nUseful pattern:\nI am + age + years old.\n\nExamples:\n- I am 40 years old.\n- My brother is 28 years old.\n- She is 19 years old.\n\nSave this correction to My Mistakes and Review?",
      detectedExpression: "I am 40 years old.",
      correction: { wrong: "I have 40 years.", correct: "I am 40 years old." },
    };
  }

  return {
    content:
      "You can say:\n\n**I'm a little tired.**\n\nMeaning:\nEstou um pouco cansado.\n\nExamples:\n- I'm a little tired after work.\n- I'm a little tired, but I can practice.\n- I'm a little tired today, so I'll study slowly.\n\nRelated expressions:\n- I'm exhausted.\n- I need some rest.\n- I'm running low on energy.\n\nWould you like to save this MindBlock?",
    detectedExpression: "I'm a little tired.",
  };
}

export default function ChatbotPage() {
  const { user, session } = useAuth();
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [voiceMode, setVoiceMode] = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [selectedExpression, setSelectedExpression] = useState("I'm getting used to it.");

  const mindBlocksCreated = useMemo(
    () => messages.filter((message) => message.detectedExpression).length,
    [messages],
  );

  const submitMessage = async (event) => {
    event.preventDefault();
    const text = input.trim();
    if (!text) return;
    if (!session?.access_token) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }

    const userMessage = {
      id: `m-${Date.now()}-user`,
      role: "user",
      content: text,
      createdAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setTyping(true);

    try {
      const currentMessages = [...messages, userMessage].map((message) => ({
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
          chatTone: user?.user_metadata?.chat_tone || "natural",
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
      };

      setMessages((current) => [
        ...current,
        {
          id: `m-${Date.now()}-neo`,
          role: "neo",
          createdAt: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
          ...reply,
        },
      ]);
      if (reply.detectedExpression) {
        setSelectedExpression(reply.detectedExpression);
        toast("Useful expression detected.");
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

  const openSaveModal = (expression) => {
    setSelectedExpression(expression || selectedExpression);
    setSaveModalOpen(true);
  };

  const mockAction = (message) => toast(message);

  return (
    <main className={`neo-page ${focusMode ? "is-focus" : ""} ${voiceMode ? "is-voice" : ""}`}>
      {!focusMode ? (
        <NeoConversationSidebar conversations={conversations} />
      ) : null}

      <section className="neo-chat-shell">
        <NeoChatHeader
          focusMode={focusMode}
          voiceMode={voiceMode}
          onToggleFocus={() => setFocusMode((value) => !value)}
          onToggleVoice={() => setVoiceMode((value) => !value)}
          onClear={() => {
            setMessages(initialMessages);
            toast("Conversation cleared.");
          }}
          onExport={() => mockAction("Export options coming soon.")}
        />

        <TodayExpressionCard onSave={() => openSaveModal("I'm looking forward to it.")} />

        {voiceMode ? (
          <VoiceModePanel onClose={() => setVoiceMode(false)} />
        ) : (
          <div className="neo-message-list">
            {messages.map((message) => (
              <NeoMessage
                key={message.id}
                message={message}
                onSave={() => openSaveModal(message.detectedExpression)}
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

      {!focusMode ? (
        <NeoIntelligencePanel context={smartContext} mindBlocksCreated={mindBlocksCreated} />
      ) : null}

      {saveModalOpen ? (
        <SaveMindBlockModal
          expression={selectedExpression}
          onClose={() => setSaveModalOpen(false)}
          onSave={() => {
            setSaveModalOpen(false);
            toast.success("MindBlock successfully created.");
          }}
        />
      ) : null}
    </main>
  );
}

function NeoConversationSidebar({ conversations }) {
  const groups = ["Hoje", "Ontem", "Esta semana", "Favoritas", "Arquivadas"];

  return (
    <aside className="neo-left-sidebar">
      <div className="neo-avatar-card">
        <div className="neo-avatar-large"><Brain className="h-8 w-8" /></div>
        <div>
          <h2>Neo</h2>
          <p>Fluency mentor</p>
        </div>
      </div>

      <button type="button" className="neo-new-button">
        <Plus className="h-4 w-4" /> New Conversation
      </button>

      <label className="neo-search">
        <Search className="h-4 w-4" />
        <input placeholder="Search conversations..." />
      </label>

      <div className="neo-tag-row">
        {["Speaking", "Corrections", "Review", "Work"].map((tag) => <span key={tag}>{tag}</span>)}
      </div>

      <div className="neo-conversation-groups">
        {groups.map((group) => (
          <section key={group}>
            <h3>{group}</h3>
            <div className="grid gap-2">
              {conversations.filter((item) => item.group === group).map((item) => (
                <button key={item.id} type="button" className={`neo-conversation-item ${item.active ? "is-active" : ""}`}>
                  <span>{item.title}</span>
                  <small>{item.tag}</small>
                </button>
              ))}
              {group === "Arquivadas" ? (
                <button type="button" className="neo-conversation-item">
                  <span>Archived practice</span>
                  <small><Archive className="inline h-3 w-3" /> 3 chats</small>
                </button>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

function NeoChatHeader({ focusMode, voiceMode, onToggleFocus, onToggleVoice, onClear, onExport }) {
  return (
    <header className="neo-chat-header">
      <div>
        <div className="flex items-center gap-3">
          <div className="neo-avatar-small"><Brain className="h-5 w-5" /></div>
          <div>
            <h1>Neo</h1>
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
        <button type="button" className={focusMode ? "is-active" : ""} onClick={onToggleFocus}><Focus className="h-4 w-4" /> Focus Mode</button>
        <button type="button" onClick={onClear}><Trash2 className="h-4 w-4" /> Clear</button>
        <button type="button" onClick={onExport}><Download className="h-4 w-4" /> Export</button>
      </div>
    </header>
  );
}

function TodayExpressionCard({ onSave }) {
  return (
    <section className="neo-today-card">
      <div>
        <p>Today's Expression</p>
        <h2>I'm looking forward to it.</h2>
        <span>Estou ansioso por isso.</span>
      </div>
      <div className="neo-mini-actions">
        <button type="button" onClick={() => toast("Audio available.")}><Volume2 className="h-4 w-4" /> Listen</button>
        <button type="button" onClick={onSave}><Star className="h-4 w-4" /> Save</button>
        <button type="button" onClick={() => toast("Pronunciation practice coming soon.")}><Mic className="h-4 w-4" /> Practice</button>
      </div>
    </section>
  );
}

function NeoMessage({ message, onSave, onMock }) {
  const isNeo = message.role === "neo";

  return (
    <article className={`neo-message-row ${isNeo ? "is-neo" : "is-user"}`}>
      {isNeo ? <div className="neo-message-avatar"><Brain className="h-5 w-5" /></div> : null}
      <div className="neo-message-stack">
        <div className="neo-message-meta">
          <span>{isNeo ? "Neo" : "You"}</span>
          <small>{message.createdAt}</small>
        </div>
        <div className="neo-message-bubble">
          <RichMessage content={message.content} />
          {message.detectedExpression ? (
            <div className="neo-detected-badge">
              <Sparkles className="h-3.5 w-3.5" /> Useful expression detected
              <button type="button" onClick={onSave}>Save</button>
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
        {isNeo ? <NeoResponseActions onSave={onSave} onMock={onMock} /> : null}
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

function NeoResponseActions({ onSave, onMock }) {
  const actions = [
    { label: "Save MindBlock", icon: Star, action: onSave },
    { label: "Generate Audio", icon: Headphones, action: () => onMock("Audio available.") },
    { label: "Practice Pronunciation", icon: Mic, action: () => onMock("Pronunciation practice coming soon.") },
    { label: "Add to Neural Universe", icon: Brain, action: () => onMock("Added to Neural Universe.") },
    { label: "Add to Playlist", icon: Plus, action: () => onMock("Playlist picker coming soon.") },
    { label: "Add to Review", icon: RotateCcw, action: () => onMock("Added to Review.") },
    { label: "Favorite", icon: Heart, action: () => onMock("Favorited.") },
    { label: "Copy", icon: Copy, action: () => onMock("Copied.") },
    { label: "Share", icon: Share2, action: () => onMock("Share link coming soon.") },
  ];

  return (
    <div className="neo-response-actions">
      {actions.map((item) => {
        const Icon = item.icon;
        return (
          <button key={item.label} type="button" onClick={item.action}>
            <Icon className="h-3.5 w-3.5" /> {item.label}
          </button>
        );
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

function VoiceModePanel({ onClose }) {
  return (
    <section className="neo-voice-panel">
      <button type="button" className="neo-close-voice" onClick={onClose}><X className="h-4 w-4" /></button>
      <div className="neo-voice-brain"><Brain className="h-16 w-16" /></div>
      <p>Listening</p>
      <h2>Speak naturally. Neo will turn your voice into MindBlocks.</h2>
      <div className="neo-voice-states">
        <span>Listening</span>
        <span>Thinking</span>
        <span>Responding</span>
      </div>
    </section>
  );
}

function NeoIntelligencePanel({ context, mindBlocksCreated }) {
  return (
    <aside className="neo-right-sidebar">
      <section className="neo-intel-card">
        <p>Conversation Summary</p>
        <h2>{context.summary}</h2>
      </section>
      <IntelList title="Useful Expressions" items={context.usefulExpressions} tone="accent" />
      <IntelList title="Detected Mistakes" items={context.mistakes} tone="danger" />
      <IntelList title="New Vocabulary" items={context.vocabulary} />
      <section className="neo-intel-card">
        <p>Grammar Pattern</p>
        <h2>{context.pattern}</h2>
      </section>
      <section className="neo-intel-grid">
        <div><span>{mindBlocksCreated}</span><small>MindBlocks created</small></div>
        <div><span>{context.gain}</span><small>Estimated fluency gain</small></div>
      </section>
      <section className="neo-intel-card">
        <p>Neural Connections</p>
        <div className="neo-neural-mini">
          <span>Core</span><i /><span>Daily</span><i /><span>Expression</span>
        </div>
      </section>
    </aside>
  );
}

function IntelList({ title, items, tone = "" }) {
  return (
    <section className="neo-intel-card">
      <p>{title}</p>
      <div className="neo-intel-list">
        {items.map((item) => <span key={item} className={tone}>{item}</span>)}
      </div>
    </section>
  );
}

function SaveMindBlockModal({ expression, onClose, onSave }) {
  const [form, setForm] = useState({
    expression,
    translation: expression === "I'm looking forward to it." ? "Estou ansioso por isso." : "Estou me acostumando com isso.",
    category: "Daily Fluency",
    playlist: "daily-fluency",
    difficulty: "B1",
    tags: "conversation, natural",
    notes: "Saved from a conversation with Neo.",
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
              {libraryPlaylists.map((playlist) => <option key={playlist.id} value={playlist.id}>{playlist.name}</option>)}
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
          <button type="button" onClick={onClose}>Cancel</button>
          <button type="button" className="fm-gradient" onClick={onSave}><Check className="h-4 w-4" /> Save MindBlock</button>
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
