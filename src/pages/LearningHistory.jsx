import React, { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BookOpen,
  Brain,
  CheckCircle2,
  Clock3,
  Headphones,
  MessageCircle,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { getLearningEvents, LEARNING_EVENTS_UPDATED } from "../services/learningEventEngine.js";
import useProgression from "../hooks/useProgression.js";

const EVENT_META = {
  expression_saved: {
    label: "MindBlock salvo",
    icon: Brain,
    tone: "violet",
    description: (payload) => payload.expression || "Nova expressão adicionada à biblioteca.",
  },
  correction_saved: {
    label: "Correção salva",
    icon: CheckCircle2,
    tone: "green",
    description: (payload) => payload.correctText || payload.correctedText || "Erro transformado em aprendizado.",
  },
  learning_journey_step_completed: {
    label: "Etapa da jornada",
    icon: BookOpen,
    tone: "cyan",
    description: (payload) => `${payload.title || "Capítulo"} · ${formatStep(payload.stepId)}`,
  },
  learning_chapter_completed: {
    label: "Capítulo concluído",
    icon: Trophy,
    tone: "amber",
    description: (payload) => payload.title || "Novo capítulo concluído.",
  },
  review_completed: {
    label: "Revisão concluída",
    icon: RotateCcw,
    tone: "blue",
    description: (payload) => payload.expression || payload.result || "Memória fortalecida.",
  },
  mistake_reviewed: {
    label: "Erro revisado",
    icon: Target,
    tone: "green",
    description: (payload) => payload.correctText || payload.result || "Caminho neural corrigido.",
  },
  conversation_completed: {
    label: "Conversa concluída",
    icon: MessageCircle,
    tone: "violet",
    description: (payload) => payload.label || "Sessão com Neo finalizada.",
  },
  favorite_added: {
    label: "Favorito adicionado",
    icon: Star,
    tone: "amber",
    description: (payload) => payload.expression || "Expressão marcada como favorita.",
  },
  expression_mastered: {
    label: "Expressão dominada",
    icon: Sparkles,
    tone: "green",
    description: (payload) => payload.expression || "MindBlock marcado como dominado.",
  },
  daily_mission_completed: {
    label: "Missão diária",
    icon: Zap,
    tone: "amber",
    description: (payload) => payload.title || "Missão concluída.",
  },
  practice_completed: {
    label: "Prática concluída",
    icon: Target,
    tone: "cyan",
    description: () => "Prática registrada no seu progresso.",
  },
  audio_generated_mock: {
    label: "Áudio gerado",
    icon: Headphones,
    tone: "blue",
    description: (payload) => payload.reason || "Pronúncia reforçada com áudio.",
  },
};

const FILTERS = [
  { id: "all", label: "Tudo" },
  { id: "journey", label: "Jornada", types: ["learning_journey_step_completed", "learning_chapter_completed"] },
  { id: "library", label: "Biblioteca", types: ["expression_saved", "favorite_added", "expression_mastered"] },
  { id: "review", label: "Revisão", types: ["review_completed", "mistake_reviewed", "correction_saved"] },
  { id: "practice", label: "Prática", types: ["conversation_completed", "practice_completed", "audio_generated_mock"] },
];

const DATE_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});

function formatStep(stepId) {
  const labels = {
    lesson: "Aula principal",
    vocabulary: "Vocabulário",
    mindblocks: "MindBlocks",
    examples: "Exemplos reais",
    mistakes: "Erros comuns",
    review: "Revisão",
    listening: "Escuta",
    practice: "Exercícios",
    conversation: "Conversa com Neo",
    challenge: "Desafio final",
  };
  return labels[stepId] || stepId || "Etapa concluída";
}

function getEventMeta(event) {
  return EVENT_META[event.type] || {
    label: "Atividade registrada",
    icon: Activity,
    tone: "cyan",
    description: () => event.type,
  };
}

function getEventXp(event) {
  const payloadXp = Number(event.payload?.xp ?? event.payload?.xpReward ?? event.payload?.xpEarned);
  if (Number.isFinite(payloadXp) && payloadXp > 0) return payloadXp;
  if (event.type === "learning_journey_step_completed") return 2;
  if (event.type === "expression_saved") return 5;
  if (event.type === "correction_saved") return 3;
  if (event.type === "conversation_completed") return 15;
  return 0;
}

function groupEventsByDate(events) {
  return events.reduce((groups, event) => {
    const date = new Date(event.createdAt);
    const key = Number.isNaN(date.getTime()) ? "Sem data" : DATE_FORMATTER.format(date);
    if (!groups[key]) groups[key] = [];
    groups[key].push(event);
    return groups;
  }, {});
}

export default function LearningHistoryPage() {
  const progression = useProgression();
  const [events, setEvents] = useState(() => getLearningEvents());
  const [activeFilter, setActiveFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const syncEvents = () => setEvents(getLearningEvents());
    window.addEventListener(LEARNING_EVENTS_UPDATED, syncEvents);
    window.addEventListener("storage", syncEvents);
    return () => {
      window.removeEventListener(LEARNING_EVENTS_UPDATED, syncEvents);
      window.removeEventListener("storage", syncEvents);
    };
  }, []);

  const orderedEvents = useMemo(
    () => [...events].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [events],
  );

  const filteredEvents = useMemo(() => {
    const filter = FILTERS.find((item) => item.id === activeFilter);
    const query = search.trim().toLowerCase();
    return orderedEvents.filter((event) => {
      const filterMatch = !filter?.types || filter.types.includes(event.type);
      const searchable = [
        event.type,
        event.source,
        event.payload?.title,
        event.payload?.expression,
        event.payload?.translation,
        event.payload?.category,
        event.payload?.correctText,
        event.payload?.correctedText,
        event.payload?.wrongText,
        event.payload?.originalText,
      ].filter(Boolean).join(" ").toLowerCase();
      return filterMatch && (!query || searchable.includes(query));
    });
  }, [activeFilter, orderedEvents, search]);

  const groupedEvents = useMemo(() => groupEventsByDate(filteredEvents), [filteredEvents]);
  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayEvents = orderedEvents.filter((event) => event.createdAt?.slice(0, 10) === today);
    return {
      total: orderedEvents.length,
      today: todayEvents.length,
      xp: orderedEvents.reduce((sum, event) => sum + getEventXp(event), 0),
      journey: orderedEvents.filter((event) => event.type.startsWith("learning_journey")).length,
    };
  }, [orderedEvents]);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] px-3 py-4 text-[var(--text-primary)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-6">
        <section className="fm-card overflow-hidden rounded-[34px] border p-5 shadow-2xl sm:p-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_360px] lg:items-center">
            <div>
              <p className="fm-accent text-xs font-black uppercase tracking-[0.22em]">Histórico de Aprendizado</p>
              <h1 className="mt-3 text-4xl font-black leading-tight sm:text-6xl">Sua evolução, passo a passo.</h1>
              <p className="fm-muted mt-4 max-w-2xl text-base leading-7 sm:text-lg">
                Cada aula, conversa, expressão salva e revisão vira um registro da construção do seu cérebro fluente.
              </p>
            </div>
            <aside className="rounded-[30px] border border-[var(--border-soft)] bg-white/[0.04] p-5">
              <span className="fm-muted text-xs font-black uppercase tracking-[0.18em]">Estado atual</span>
              <strong className="mt-3 block text-5xl font-black">Level {progression.currentLevel}</strong>
              <p className="fm-muted mt-2 text-sm">{progression.currentLevelName}</p>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-black/20 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-300"
                  style={{ width: `${Math.min(100, Math.round((progression.xpInCurrentLevel / Math.max(1, progression.xpToNextLevel)) * 100))}%` }}
                />
              </div>
            </aside>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-4">
          <HistoryStat icon={Activity} label="Eventos totais" value={stats.total} />
          <HistoryStat icon={Clock3} label="Hoje" value={stats.today} />
          <HistoryStat icon={Zap} label="XP rastreado" value={stats.xp} />
          <HistoryStat icon={BookOpen} label="Jornada" value={stats.journey} />
        </section>

        <section className="fm-card rounded-[30px] border p-4 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setActiveFilter(filter.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-black transition ${
                    activeFilter === filter.id
                      ? "border-cyan-400/60 bg-cyan-400/15 text-[var(--text-primary)]"
                      : "border-[var(--border-soft)] bg-white/[0.03] text-[var(--text-secondary)] hover:bg-white/[0.06]"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
            <label className="flex min-w-0 items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-white/[0.04] px-4 py-3 lg:w-80">
              <Search className="h-4 w-4 text-[var(--text-muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar no histórico..."
                className="min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
            </label>
          </div>
        </section>

        <section className="fm-card rounded-[34px] border p-4 sm:p-6">
          {filteredEvents.length === 0 ? (
            <EmptyHistory />
          ) : (
            <div className="space-y-8">
              {Object.entries(groupedEvents).map(([dateLabel, dateEvents]) => (
                <div key={dateLabel}>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="h-px flex-1 bg-[var(--border-soft)]" />
                    <strong className="fm-muted text-xs uppercase tracking-[0.18em]">{dateLabel}</strong>
                    <span className="h-px flex-1 bg-[var(--border-soft)]" />
                  </div>
                  <div className="space-y-3">
                    {dateEvents.map((event) => (
                      <HistoryEvent key={event.id} event={event} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function HistoryStat({ icon: Icon, label, value }) {
  return (
    <article className="fm-card rounded-[28px] border p-5">
      <div className="flex items-center justify-between gap-4">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300">
          <Icon className="h-5 w-5" />
        </span>
        <strong className="text-3xl font-black">{value}</strong>
      </div>
      <p className="fm-muted mt-4 text-sm font-bold">{label}</p>
    </article>
  );
}

function HistoryEvent({ event }) {
  const meta = getEventMeta(event);
  const Icon = meta.icon;
  const createdAt = new Date(event.createdAt);
  const xp = getEventXp(event);
  const detail = meta.description(event.payload || {});
  return (
    <article className="group rounded-[26px] border border-[var(--border-soft)] bg-white/[0.035] p-4 transition hover:border-cyan-400/35 hover:bg-cyan-400/[0.06]">
      <div className="flex gap-4">
        <span className={`history-event-icon history-event-icon-${meta.tone}`}>
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-base font-black">{meta.label}</strong>
            <span className="fm-muted text-xs font-bold">
              {Number.isNaN(createdAt.getTime()) ? "Agora" : TIME_FORMATTER.format(createdAt)}
            </span>
          </div>
          <p className="fm-muted mt-2 text-sm leading-6">{detail}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {xp > 0 ? <span className="fm-chip rounded-full px-3 py-1 text-xs font-black">+{xp} XP</span> : null}
            <span className="fm-chip rounded-full px-3 py-1 text-xs font-bold">{event.source || "app"}</span>
            <span className="fm-chip rounded-full px-3 py-1 text-xs font-bold">{event.type}</span>
          </div>
        </div>
      </div>
    </article>
  );
}

function EmptyHistory() {
  return (
    <div className="py-16 text-center">
      <Sparkles className="mx-auto h-10 w-10 text-cyan-300" />
      <h2 className="mt-4 text-2xl font-black">Nenhuma atividade encontrada.</h2>
      <p className="fm-muted mx-auto mt-2 max-w-md text-sm">
        Continue a jornada, converse com Neo ou salve MindBlocks para preencher seu histórico de aprendizado.
      </p>
    </div>
  );
}
