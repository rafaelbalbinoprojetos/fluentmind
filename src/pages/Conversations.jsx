import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Archive, Brain, ChevronRight, MessageCircle, Search, Sparkles } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { listConversationMessages, listConversationSessions } from "../services/conversations.js";

export default function ConversationsPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadConversations() {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const rows = await listConversationSessions(user.id);
        if (!mounted) return;
        setConversations(rows);
        const firstId = rows[0]?.id ?? null;
        setSelectedId(firstId);
        if (firstId) {
          const firstMessages = await listConversationMessages({ userId: user.id, sessionId: firstId });
          if (mounted) setMessages(firstMessages);
        }
      } catch (error) {
        console.error(error);
        toast.error("Nao foi possivel carregar suas conversas.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadConversations();
    return () => {
      mounted = false;
    };
  }, [user?.id]);

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return conversations;
    return conversations.filter((conversation) => (
      conversation.title.toLowerCase().includes(term)
      || conversation.tag.toLowerCase().includes(term)
      || conversation.group.toLowerCase().includes(term)
    ));
  }, [conversations, search]);

  const selectedConversation = conversations.find((item) => item.id === selectedId);
  const assistantMessages = messages.filter((message) => message.role === "neo");
  const userMessages = messages.filter((message) => message.role === "user");
  const usefulExpressions = assistantMessages
    .map((message) => message.detectedExpression)
    .filter(Boolean)
    .slice(0, 6);

  const selectConversation = async (conversationId) => {
    setSelectedId(conversationId);
    try {
      const nextMessages = await listConversationMessages({ userId: user.id, sessionId: conversationId });
      setMessages(nextMessages);
    } catch (error) {
      console.error(error);
      toast.error("Nao foi possivel abrir esta conversa.");
    }
  };

  return (
    <main className="space-y-6">
      <section className="fm-card rounded-[30px] border p-6 shadow-lg">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">Historico inteligente</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight">Conversas</h1>
            <p className="fm-muted mt-2 text-sm">Revise seus chats, expressoes detectadas e progresso de conversacao.</p>
          </div>
          <Link to="/chatbot" className="fm-gradient inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold">
            <MessageCircle className="h-4 w-4" />
            Abrir Chatbot
          </Link>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.82fr,1.18fr]">
        <aside className="fm-card rounded-[30px] border p-5 shadow-md">
          <label className="fm-input flex min-h-11 items-center gap-3 rounded-2xl border px-4">
            <Search className="fm-subtle h-4 w-4" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar conversas..."
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>

          <div className="mt-5 space-y-3">
            {loading ? <ConversationSkeleton /> : null}
            {!loading && filteredConversations.length === 0 ? (
              <div className="fm-inner rounded-2xl border p-5 text-sm">
                <Brain className="fm-secondary h-6 w-6" />
                <p className="mt-3 font-semibold">Nenhuma conversa ainda.</p>
                <p className="fm-muted mt-1 text-xs">Comece no chatbot para criar seu primeiro historico.</p>
              </div>
            ) : null}
            {filteredConversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => selectConversation(conversation.id)}
                className={`fm-inner w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${
                  conversation.id === selectedId ? "ring-2 ring-violet-400/60" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{conversation.title}</p>
                    <p className="fm-subtle mt-1 text-xs">{conversation.group} · {conversation.tag}</p>
                  </div>
                  <ChevronRight className="fm-subtle h-4 w-4" />
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard label="Mensagens" value={String(messages.length)} />
            <SummaryCard label="Suas perguntas" value={String(userMessages.length)} />
            <SummaryCard label="Respostas IA" value={String(assistantMessages.length)} />
          </div>

          <article className="fm-card rounded-[30px] border p-6 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">{selectedConversation?.title ?? "Selecione uma conversa"}</h2>
                <p className="fm-muted mt-1 text-sm">{selectedConversation?.group ?? "Historico"} · {selectedConversation?.tag ?? "Conversation"}</p>
              </div>
              {selectedConversation ? (
                <Link to="/chatbot" className="fm-chip rounded-full border px-3 py-2 text-xs font-semibold">
                  Continuar conversa
                </Link>
              ) : null}
            </div>

            <div className="mt-6 space-y-3">
              {messages.slice(-8).map((message) => (
                <div key={message.id} className={`rounded-2xl border p-4 ${message.role === "neo" ? "fm-inner" : "bg-violet-500/10 border-violet-400/20"}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em]">{message.role === "neo" ? "Assistente" : "Voce"} · {message.createdAt}</p>
                  <p className="fm-muted mt-2 whitespace-pre-line text-sm">{message.content}</p>
                </div>
              ))}
            </div>
          </article>

          <article className="fm-card rounded-[30px] border p-6 shadow-md">
            <div className="flex items-center gap-2">
              <Sparkles className="fm-secondary h-5 w-5" />
              <h2 className="text-lg font-semibold">Expressoes detectadas</h2>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {usefulExpressions.length > 0 ? usefulExpressions.map((expression) => (
                <span key={expression} className="fm-chip rounded-full border px-3 py-2 text-xs font-semibold">{expression}</span>
              )) : (
                <span className="fm-muted text-sm">As proximas expressoes salvas pelo chat aparecem aqui.</span>
              )}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}

function SummaryCard({ label, value }) {
  return (
    <article className="fm-card rounded-3xl border p-5 shadow-md">
      <p className="fm-muted text-sm">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </article>
  );
}

function ConversationSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="fm-inner h-20 animate-pulse rounded-2xl border" />
      ))}
    </div>
  );
}
