import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MotionConfig, motion as Motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Brain,
  Check,
  ChevronRight,
  Flame,
  Layers,
  MessageCircle,
  MessageCircleQuestion,
  Mic,
  Plus,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Star,
  Target,
  X,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import { userStorageKey } from "../../utils/userStorage.js";
import { localDateKey } from "../../utils/dates.js";
import NeuralBrain from "../NeuralBrain.jsx";
import { FIRST_DASHBOARD_EXPERIENCE_KEY } from "../onboarding/OnboardingPage.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import useProgression from "../../hooks/useProgression.js";
import { listMindBlocks } from "../../services/mindblocks.js";
import { listCorrectedMistakes } from "../../services/correctedMistakes.js";
import { listReviewEvents } from "../../services/reviewEvents.js";
import { buildActivityByDate, getOrCreateLearningProfile, listDailyActivity } from "../../services/learningProgress.js";
import { getLearningEvents, LEARNING_EVENTS_UPDATED } from "../../services/learningEventEngine.js";
import { getNextStep } from "../../services/nextStep.js";

// Textos em português das missões do progressionEngine (os ids e as regras não mudam).
const MISSION_COPY = {
  "complete-1-review": { title: "Fazer 1 revisão", description: "Tente lembrar antes de ver a resposta.", to: "/daily-workout" },
  "practice-with-neo": { title: "Praticar com o Neo", description: "Envie 5 mensagens em inglês na conversa.", to: "/neo" },
  "save-1-correction": { title: "Salvar 1 correção", description: "Converse com o Neo. Quando ele corrigir uma frase sua, ela é salva para revisão.", to: "/neo" },
  "save-3-expressions": { title: "Salvar 3 expressões", description: "Crie MindBlocks com frases úteis.", to: "/biblioteca" },
  "listen-3-expressions": { title: "Ouvir 3 expressões", description: "Ouça e repita para treinar ritmo e pronúncia.", to: "/daily-workout" },
  "master-1-expression": { title: "Dominar 1 expressão", description: "Marque um MindBlock como dominado.", to: "/biblioteca" },
  "open-neural-universe": { title: "Abrir o Universo Neural", description: "Veja suas expressões conectadas.", to: "/neural-universe" },
};
// As três primeiras priorizam recuperação ativa, produção e correção.
const PRIMARY_MISSIONS = ["complete-1-review", "practice-with-neo", "save-1-correction"];

const LEVEL_NAMES = {
  "New Thinker": "Pensador iniciante",
  "Daily Learner": "Aprendiz diário",
  "Conversation Builder": "Construtor de conversas",
  "Fluency Explorer": "Explorador da fluência",
  "Mind Architect": "Arquiteto da mente",
  "Neural Builder": "Construtor neural",
  "Thought Shaper": "Modelador de ideias",
  "Neural Master": "Mestre neural",
};

const quickActions = [
  { label: "Tirar dúvidas", description: "Pergunte ao Neo sobre gramática e uso", icon: MessageCircleQuestion, to: "/chatbot" },
  { label: "Adicionar expressão", description: "Salve um MindBlock", icon: Plus, to: "/biblioteca" },
  { label: "Treinar pronúncia", description: "Ouça, grave e compare", icon: Mic, to: "/speaking" },
  { label: "Meus erros", description: "Veja o que o Neo corrigiu", icon: Layers, to: "/meus-erros" },
  { label: "Universo Neural", description: "Suas expressões conectadas", icon: Brain, to: "/neural-universe" },
];

const SOURCES = ["profile", "mindBlocks", "corrections", "reviewEvents", "activity"];
const SOURCE_LABELS = {
  profile: "perfil",
  mindBlocks: "expressões",
  corrections: "correções",
  reviewEvents: "histórico de revisões",
  activity: "atividade da semana",
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function getDisplayName(user, profile, preferences) {
  return profile?.display_name
    || preferences?.displayName
    || user?.user_metadata?.display_name
    || user?.email?.split("@")[0]
    || "aluno";
}

function hasActivity(row) {
  return [
    "expressions_saved",
    "expressions_reviewed",
    "conversations_started",
    "messages_sent",
    "study_minutes",
    "mindblocks_created",
  ].some((field) => Number(row?.[field]) > 0);
}

function calculateActivityStreak(activity) {
  const rows = [...(activity ?? [])].reverse();
  let streak = 0;
  for (const row of rows) {
    if (hasActivity(row)) {
      streak += 1;
    } else if (streak > 0) {
      break;
    }
  }
  return streak;
}

function formatActivityTime(date) {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h atrás`;
  return `${Math.round(hours / 24)} dias atrás`;
}

// Cada fonte carrega sozinha: se uma falhar, as outras continuam valendo.
async function loadSources(user) {
  const loaders = {
    profile: () => getOrCreateLearningProfile(user),
    mindBlocks: () => listMindBlocks(user.id),
    corrections: () => listCorrectedMistakes(user.id),
    reviewEvents: () => listReviewEvents(user.id, { limit: 500 }),
    activity: async () => buildActivityByDate(await listDailyActivity(user.id, { days: 7 }), 7),
  };
  const results = await Promise.allSettled(SOURCES.map((key) => loaders[key]()));
  const data = {};
  const failed = [];
  results.forEach((result, index) => {
    const key = SOURCES[index];
    if (result.status === "fulfilled") {
      data[key] = result.value;
    } else {
      console.error(`[dashboard] Falha ao carregar ${key}:`, result.reason);
      failed.push(key);
    }
  });
  return { data, failed };
}

function buildStats({ data, progression, today }) {
  const { mindBlocks, corrections, reviewEvents, profile, activity } = data;
  const reviewedFromEvents = Array.isArray(reviewEvents)
    && reviewEvents.some((event) => event.reviewed_at && localDateKey(new Date(event.reviewed_at)) === today);
  const reviewMission = progression.dailyMissions?.find((mission) => mission.id === "complete-1-review");
  const streakFromData = Number(profile?.streak_days) || (activity ? calculateActivityStreak(activity) : null);
  return {
    dueReviews: Array.isArray(mindBlocks) ? mindBlocks.filter((item) => item.isReviewDue).length : null,
    dueCorrections: Array.isArray(corrections) ? corrections.filter((item) => item.isReviewDue).length : null,
    mindBlockCount: Array.isArray(mindBlocks) ? mindBlocks.length : null,
    reviewedToday: Boolean(reviewMission?.completed) || reviewedFromEvents,
    streak: streakFromData ?? (Number(progression.streak) || 0),
  };
}

export default function FluentMindDashboard() {
  const { user, userPreferences, updateUserPreferences } = useAuth();
  const progression = useProgression();
  const [coachOpen, setCoachOpen] = useState(false);
  const [load, setLoad] = useState({ status: "loading", data: {}, failed: [] });
  const [learningEvents, setLearningEvents] = useState(() => getLearningEvents());
  const [showWelcome, setShowWelcome] = useState(() => {
    if (userPreferences?.extra?.firstDashboardExperience === true) return true;
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(userStorageKey(FIRST_DASHBOARD_EXPERIENCE_KEY, user?.id)) === "true";
  });

  const greeting = useMemo(() => getGreeting(), []);
  const displayName = getDisplayName(user, load.data.profile, userPreferences);
  const today = localDateKey();
  const stats = useMemo(() => buildStats({ data: load.data, progression, today }), [load.data, progression, today]);
  const nextStep = useMemo(() => getNextStep({
    dueReviews: stats.dueReviews,
    dueCorrections: stats.dueCorrections,
    reviewedToday: stats.reviewedToday,
    journeyProgress: progression.learningJourney,
  }), [progression.learningJourney, stats]);

  const reload = useCallback(async () => {
    if (!user?.id) {
      setLoad({ status: "ready", data: {}, failed: [] });
      return;
    }
    setLoad((current) => ({ ...current, status: "loading" }));
    const { data, failed } = await loadSources(user);
    setLoad((current) => ({ status: "ready", data: { ...current.data, ...data }, failed }));
  }, [user]);

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setLoad({ status: "ready", data: {}, failed: [] });
      return undefined;
    }
    loadSources(user).then(({ data, failed }) => {
      if (active) setLoad({ status: "ready", data, failed });
    });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    if (userPreferences?.extra?.firstDashboardExperience === true) setShowWelcome(true);
  }, [userPreferences?.extra?.firstDashboardExperience]);

  useEffect(() => {
    const syncEvents = () => setLearningEvents(getLearningEvents());
    window.addEventListener(LEARNING_EVENTS_UPDATED, syncEvents);
    window.addEventListener("storage", syncEvents);
    return () => {
      window.removeEventListener(LEARNING_EVENTS_UPDATED, syncEvents);
      window.removeEventListener("storage", syncEvents);
    };
  }, []);

  const dismissWelcome = () => {
    window.localStorage.removeItem(userStorageKey(FIRST_DASHBOARD_EXPERIENCE_KEY, user?.id));
    updateUserPreferences?.({ extra: { firstDashboardExperience: false } }).catch((error) => {
      console.warn("[dashboard] Falha ao salvar primeira experiencia:", error.message);
    });
    setShowWelcome(false);
  };

  const loading = load.status === "loading" && !Object.keys(load.data).length;
  const recentExpressions = (load.data.mindBlocks ?? []).slice(0, 3);

  return (
    <MotionConfig reducedMotion="user">
      <div className="fm-dashboard fm-premium-dashboard relative min-h-full overflow-hidden rounded-[28px] border px-4 py-5 shadow-lg sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="fm-neural-grid absolute inset-0 opacity-50" />
        </div>

        <div className="relative z-10 space-y-5">
          <CompactHero greeting={greeting} displayName={displayName} progression={progression} mindBlockCount={stats.mindBlockCount} />

          {showWelcome ? <WelcomeNote displayName={displayName} onDismiss={dismissWelcome} /> : null}

          {load.failed.length ? <PartialError failed={load.failed} onRetry={reload} retrying={load.status === "loading"} /> : null}

          <NextStepCard step={nextStep} stats={stats} loading={loading} />

          <ProgressCards stats={stats} progression={progression} loading={loading} />

          <DailyMissions missions={progression.dailyMissions ?? []} />

          <RecentExpressions expressions={recentExpressions} loading={loading} failed={load.failed.includes("mindBlocks")} />

          <QuickActions />

          <details className="fm-home-details group">
            <summary className="fm-ghost-button inline-flex cursor-pointer list-none items-center gap-2 rounded-2xl px-5 py-3 text-sm font-bold">
              Ver atividade recente <ChevronRight className="h-4 w-4 transition group-open:rotate-90" aria-hidden="true" />
            </summary>
            <div className="mt-5 grid gap-5 xl:grid-cols-2">
              <CategorySummary mindBlocks={load.data.mindBlocks} />
              <ActivityFeed learningEvents={learningEvents} />
            </div>
          </details>
        </div>

        <button
          type="button"
          onClick={() => setCoachOpen(true)}
          className="fm-coach-button fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold shadow-lg"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          Falar com o Neo
        </button>
        {coachOpen ? <CoachPanel onClose={() => setCoachOpen(false)} /> : null}
      </div>
    </MotionConfig>
  );
}

function CompactHero({ greeting, displayName, progression, mindBlockCount }) {
  const levelName = LEVEL_NAMES[progression.currentLevelName] || progression.currentLevelName;
  return (
    <section className="fm-home-hero" aria-labelledby="home-greeting">
      <div className="fm-home-hero-copy">
        <h1 id="home-greeting">{greeting}, {displayName}</h1>
        <p>
          {mindBlockCount
            ? `Você já tem ${mindBlockCount} ${mindBlockCount === 1 ? "expressão salva" : "expressões salvas"}. Vamos usar o que você sabe.`
            : "Um passo por vez: aprender, lembrar e usar em conversa."}
        </p>
        <p className="fm-home-level">
          Nível de prática {progression.currentLevel} · {levelName}
        </p>
      </div>
      <div className="fm-home-hero-brain" aria-hidden="true">
        <NeuralBrain
          level={progression.currentLevel}
          xp={progression.xpInCurrentLevel}
          nextLevelXp={progression.xpToNextLevel}
          nodes={mindBlockCount || 0}
          connections={0}
          mastery={0}
          size="md"
          mode="hero"
          mood="focused"
          showStats={false}
        />
      </div>
    </section>
  );
}

function WelcomeNote({ displayName, onDismiss }) {
  return (
    <section className="fm-home-welcome" aria-label="Boas-vindas">
      <div>
        <h2>Boas-vindas ao FluentMind, {displayName}.</h2>
        <p>O card “Seu próximo passo” sempre mostra o que fazer agora e por quê. Comece por ele.</p>
      </div>
      <button type="button" onClick={onDismiss} className="fm-ghost-button rounded-full p-2" aria-label="Dispensar boas-vindas">
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </section>
  );
}

function PartialError({ failed, onRetry, retrying }) {
  return (
    <div className="fm-home-alert" role="alert">
      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
      <p>
        Não foi possível carregar: {failed.map((key) => SOURCE_LABELS[key]).join(", ")}. O restante da tela usa os dados que chegaram.
      </p>
      <button type="button" onClick={onRetry} disabled={retrying} className="fm-ghost-button inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold">
        <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />
        Tentar de novo
      </button>
    </div>
  );
}

// Títulos escritos como objetivo de aprendizagem; o motor de recomendação não muda.
function nextStepHeadline(step, stats) {
  if (step.id === "review" && stats.dueReviews > 0) {
    return {
      title: `Lembrar ${stats.dueReviews} ${stats.dueReviews === 1 ? "expressão" : "expressões"} antes de esquecer`,
      lead: "Sessão curta de revisão: tente lembrar cada expressão antes de ver a resposta.",
    };
  }
  if (step.id === "corrections" && stats.dueCorrections > 0) {
    return {
      title: `Revisar ${stats.dueCorrections} ${stats.dueCorrections === 1 ? "erro corrigido" : "erros corrigidos"} pelo Neo`,
      lead: "Reescreva a frase certa de memória para o erro não voltar.",
    };
  }
  return { title: step.title, lead: null };
}

function NextStepCard({ step, stats, loading }) {
  const headline = loading ? null : nextStepHeadline(step, stats);
  return (
    <section className="fm-next-step" aria-labelledby="next-step-title" aria-busy={loading}>
      <div className="fm-next-step-body">
        <p className="fm-home-eyebrow">Seu próximo passo</p>
        {loading ? (
          <div className="mt-2 space-y-2" aria-hidden="true">
            <div className="fm-skeleton h-7 w-2/3" />
            <div className="fm-skeleton h-4 w-full max-w-xl" />
          </div>
        ) : (
          <>
            <h2 id="next-step-title">{headline.title}</h2>
            <p className="fm-next-step-lead">{headline.lead || step.reason}</p>
            <p className="fm-next-step-why">
              <span className="sr-only">Por que esta recomendação: </span>
              <span aria-hidden="true">Por quê: </span>
              {[headline.lead ? step.reason : null, ...step.evidence].filter(Boolean).join(" · ")}
            </p>
          </>
        )}
      </div>
      {loading ? (
        <button type="button" disabled className="fm-cta-primary">
          Continuar meu aprendizado <ArrowRight className="fm-cta-arrow h-5 w-5" aria-hidden="true" />
        </button>
      ) : (
        <Link to={step.to} className="fm-cta-primary">
          Continuar meu aprendizado <ArrowRight className="fm-cta-arrow h-5 w-5" aria-hidden="true" />
        </Link>
      )}
    </section>
  );
}

function StatCard({ icon: Icon, label, value, note, tone, children }) {
  return (
    <article className={`fm-home-stat is-${tone}`}>
      <div className="flex items-center gap-2">
        <span className="fm-home-stat-badge" aria-hidden="true"><Icon className="h-4 w-4" /></span>
        <p>{label}</p>
      </div>
      <strong>{value}</strong>
      {children}
      <span className="fm-home-stat-note">{note}</span>
    </article>
  );
}

function ProgressCards({ stats, progression, loading }) {
  const xpPercent = Math.min(100, Math.round((progression.xpInCurrentLevel / Math.max(1, progression.xpToNextLevel)) * 100));
  const show = (value) => (loading ? "…" : value ?? "—");
  return (
    <section className="fm-home-stats" aria-label="Seu progresso">
      <div className="fm-home-stat-group">
        <h2 className="fm-home-eyebrow">Hoje</h2>
        <div className="fm-home-stat-row">
          <StatCard icon={RotateCcw} tone="today" label="Para revisar" value={show(stats.dueReviews)} note="na revisão espaçada" />
          <StatCard icon={Flame} tone="today" label="Sequência" value={show(stats.streak)} note={stats.streak === 1 ? "dia seguido" : "dias seguidos"} />
        </div>
      </div>
      <div className="fm-home-stat-group">
        <h2 className="fm-home-eyebrow">Seu acervo</h2>
        <div className="fm-home-stat-row">
          <StatCard icon={BookOpen} tone="growth" label="Expressões salvas" value={show(stats.mindBlockCount)} note="MindBlocks" />
          <StatCard icon={Zap} tone="growth" label={`XP · nível de prática ${progression.currentLevel}`} value={progression.totalXp.toLocaleString("pt-BR")} note="mede prática, não nível de inglês">
            <div
              className="fm-home-xp-track"
              role="progressbar"
              aria-label="XP até o próximo nível de prática"
              aria-valuemin={0}
              aria-valuemax={progression.xpToNextLevel}
              aria-valuenow={progression.xpInCurrentLevel}
            >
              <div style={{ width: `${xpPercent}%` }} />
            </div>
          </StatCard>
        </div>
      </div>
    </section>
  );
}

function MissionItem({ mission }) {
  const copy = MISSION_COPY[mission.id] || { title: mission.title, description: mission.description, to: "/daily-workout" };
  const done = Boolean(mission.completed);
  const progress = Math.min(mission.progress, mission.target);
  const percent = Math.round((progress / Math.max(1, mission.target)) * 100);
  const content = (
    <>
      <span className="fm-home-mission-check" aria-hidden="true">{done ? <Check className="h-4 w-4" strokeWidth={3} /> : null}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{copy.title}</span>
        <span className="fm-home-mission-desc">{copy.description}</span>
        {done ? null : (
          <span className="fm-home-mission-bar" aria-hidden="true"><span style={{ width: `${percent}%` }} /></span>
        )}
      </span>
      <span className="fm-home-mission-count">
        <span className="sr-only">{done ? "Concluída. " : "Progresso: "}</span>
        {done ? `+${mission.xpReward} XP` : `${progress}/${mission.target}`}
      </span>
      {done ? null : <ChevronRight className="fm-home-mission-arrow h-4 w-4" aria-hidden="true" />}
    </>
  );
  return (
    <li>
      {done ? (
        <div className="fm-home-mission is-complete">{content}</div>
      ) : (
        <Link to={copy.to} className="fm-home-mission" aria-label={`${copy.title}: ${progress} de ${mission.target}. Fazer agora`}>
          {content}
        </Link>
      )}
    </li>
  );
}

function DailyMissions({ missions }) {
  const primary = PRIMARY_MISSIONS.map((id) => missions.find((mission) => mission.id === id)).filter(Boolean);
  const others = missions.filter((mission) => !PRIMARY_MISSIONS.includes(mission.id));
  const doneCount = primary.filter((mission) => mission.completed).length;
  const allDone = primary.length > 0 && doneCount === primary.length;

  return (
    <section className="fm-home-section" aria-labelledby="missions-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="fm-home-eyebrow">Missão de hoje</p>
          <h2 id="missions-title" className="fm-home-title">Lembrar, falar e corrigir</h2>
        </div>
        <div className="fm-home-trail" role="img" aria-label={`${doneCount} de ${primary.length} missões feitas`}>
          {primary.map((mission) => <span key={mission.id} className={`fm-home-trail-dot ${mission.completed ? "is-done" : ""}`} />)}
          <span className="fm-home-trail-text" aria-hidden="true">{doneCount} de {primary.length} feitas</span>
        </div>
      </div>

      {allDone ? (
        <div className="fm-home-success" role="status">
          <span className="fm-home-success-seal" aria-hidden="true"><Brain className="h-5 w-5" /></span>
          <div>
            <p className="font-black">Missão de hoje concluída</p>
            <p className="text-sm">Você lembrou, falou e corrigiu. É isso que fixa o idioma.</p>
          </div>
        </div>
      ) : null}

      <ul className="mt-4 space-y-2">
        {primary.map((mission) => <MissionItem key={mission.id} mission={mission} />)}
      </ul>

      {others.length ? (
        <details className="mt-3">
          <summary className="fm-secondary cursor-pointer text-sm font-semibold">
            Missões extras ({others.filter((mission) => mission.completed).length}/{others.length})
          </summary>
          <ul className="mt-3 space-y-2">
            {others.map((mission) => <MissionItem key={mission.id} mission={mission} />)}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function RecentExpressions({ expressions, loading, failed }) {
  return (
    <section className="fm-home-section" aria-labelledby="recent-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="recent-title" className="fm-home-title">Expressões recentes</h2>
        <Link to="/biblioteca" className="fm-secondary inline-flex items-center gap-1 text-sm font-semibold">
          Ver biblioteca <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
      {loading ? (
        <div className="mt-4 grid gap-3 md:grid-cols-3" aria-hidden="true">
          {[0, 1, 2].map((key) => <div key={key} className="fm-skeleton h-28" />)}
        </div>
      ) : expressions.length ? (
        <ul className="mt-4 grid gap-3 md:grid-cols-3">
          {expressions.map((item) => (
            <li key={item.id || item.expression} className="fm-home-expression">
              <p className="fm-home-expression-en" lang="en">{item.expression}</p>
              {item.translation ? <p className="fm-home-expression-pt">{item.translation}</p> : null}
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-3">
                {item.category ? <span className="fm-home-tag">{item.category}</span> : <span />}
                <Link
                  to="/chatbot"
                  state={{ neoExpressionContext: { expression: item.expression, translation: item.translation, category: item.category, source: "dashboard_recent_expression" } }}
                  className="fm-home-chip-button"
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" /> Praticar com o Neo
                </Link>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="fm-muted mt-3 text-sm">
          {failed
            ? "Suas expressões não carregaram agora. Elas continuam salvas."
            : "Você ainda não salvou expressões. Elas aparecem aqui quando você salvar MindBlocks na Jornada ou na Biblioteca."}
        </p>
      )}
    </section>
  );
}

function QuickActions() {
  return (
    <section className="fm-home-section" aria-labelledby="quick-title">
      <h2 id="quick-title" className="text-lg font-black">Outras atividades</h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {quickActions.map((action) => (
          <li key={action.to}>
            <Link to={action.to} className="fm-home-action">
              <action.icon className="h-5 w-5" aria-hidden="true" />
              <span className="font-semibold">{action.label}</span>
              <span className="fm-subtle text-xs">{action.description}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CategorySummary({ mindBlocks }) {
  if (!Array.isArray(mindBlocks) || !mindBlocks.length) {
    return (
      <article className="fm-brain-insights">
        <h2 className="text-lg font-black">Suas categorias</h2>
        <p className="fm-muted mt-2 text-sm">Sem expressões salvas ainda.</p>
      </article>
    );
  }
  const counts = mindBlocks.reduce((acc, item) => {
    const category = item.category || "Sem categoria";
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  return (
    <article className="fm-brain-insights">
      <h2 className="text-lg font-black">Categorias com mais expressões</h2>
      <ul className="mt-3 space-y-2">
        {top.map(([category, count]) => (
          <li key={category} className="fm-insight-item">
            <Target className="h-4 w-4" aria-hidden="true" />
            <span>{category}</span>
            <strong className="ml-auto">{count}</strong>
          </li>
        ))}
      </ul>
    </article>
  );
}

const EVENT_COPY = {
  expression_saved: ["Expressão salva", "expression", BookOpen],
  correction_saved: ["Correção salva", null, Check],
  conversation_completed: ["Conversa concluída", null, MessageCircle],
  review_completed: ["Revisão feita", "expression", RotateCcw],
  expression_mastered: ["Expressão dominada", "expression", Target],
  favorite_added: ["Favoritada", "expression", Star],
  playlist_created: ["Playlist criada", "name", Layers],
};

function ActivityFeed({ learningEvents }) {
  const items = learningEvents.slice(-6).reverse().map((event) => {
    const payload = event.payload || {};
    const [title, field, icon] = EVENT_COPY[event.type] || ["Atividade", null, Sparkles];
    const body = event.type === "correction_saved" && payload.correctText
      ? `${payload.wrongText} → ${payload.correctText}`
      : field ? payload[field] : null;
    return { id: event.id, title, body, time: formatActivityTime(event.createdAt), icon };
  });

  return (
    <article className="fm-activity-feed">
      <h2 className="text-lg font-black">Atividade recente</h2>
      {items.length ? (
        <ul className="fm-activity-list">
          {items.map((item) => (
            <li key={item.id} className="fm-activity-item">
              <span><item.icon className="h-4 w-4" aria-hidden="true" /></span>
              <div>
                <strong>{item.title}</strong>
                {item.body ? <p lang="en">{item.body}</p> : null}
              </div>
              <small>{item.time}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="fm-muted mt-2 text-sm">Nada registrado ainda neste dispositivo.</p>
      )}
    </article>
  );
}

function CoachPanel({ onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const options = [
    { label: "Corrigir uma frase minha", to: "/chatbot", icon: MessageCircleQuestion },
    { label: "Conversar por 5 minutos", to: "/neo", icon: MessageCircle },
    { label: "Revisar minhas expressões", to: "/insights", icon: RotateCcw },
  ];
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end bg-black/35 p-4 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="coach-title" onClick={onClose}>
      <Motion.div
        className="fm-popover w-full max-w-md rounded-[28px] border p-5 shadow-lg"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="coach-title" className="text-xl font-semibold">O que você quer fazer com o Neo?</h2>
            <p className="fm-muted mt-1 text-sm">Escolha uma prática.</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} className="fm-ghost-button rounded-full p-2" aria-label="Fechar">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-5 grid gap-3">
          {options.map((option) => (
            <Link key={option.to} to={option.to} className="fm-home-action flex-row items-center justify-between">
              <span className="font-semibold">{option.label}</span>
              <option.icon className="h-4 w-4" aria-hidden="true" />
            </Link>
          ))}
        </div>
      </Motion.div>
    </div>
  );
}
