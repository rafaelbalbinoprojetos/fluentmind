import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  BookMarked,
  BookOpen,
  Brain,
  CalendarCheck2,
  Check,
  ChevronRight,
  Clock3,
  Flame,
  Headphones,
  Heart,
  Library,
  MessageCircle,
  Mic2,
  MoreHorizontal,
  Play,
  Plus,
  RotateCcw,
  Search,
  Shuffle,
  Sparkles,
  Star,
  Target,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import BrainCompanion from "../BrainCompanion.jsx";
import EvolvingBrain from "../EvolvingBrain.jsx";
import NeuralBrain from "../NeuralBrain.jsx";
import { FIRST_DASHBOARD_EXPERIENCE_KEY } from "../onboarding/OnboardingPage.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import useProgression from "../../hooks/useProgression.js";
import { listMindBlocks } from "../../services/mindblocks.js";
import { listPlaylists } from "../../services/playlists.js";
import { listReviewEvents } from "../../services/reviewEvents.js";
import { buildActivityByDate, getOrCreateLearningProfile, listDailyActivity } from "../../services/learningProgress.js";
import { getLearningEvents, LEARNING_EVENTS_UPDATED } from "../../services/learningEventEngine.js";

const progressBars = [
  { day: "Seg", value: 54 },
  { day: "Ter", value: 72 },
  { day: "Qua", value: 48 },
  { day: "Qui", value: 84 },
  { day: "Sex", value: 66 },
  { day: "Sab", value: 92 },
  { day: "Dom", value: 78 },
];

const dayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"];

const quickActions = [
  { label: "Nova conversa", shortcut: "N", description: "Pratique com IA", icon: MessageCircle, to: "/chatbot" },
  { label: "Treino do dia", shortcut: "T", description: "Siga o caminho de hoje", icon: Target, to: "/daily-workout" },
  { label: "Revisão rápida", shortcut: "R", description: "Fortaleça a memória", icon: RotateCcw, to: "/insights" },
  { label: "Adicionar expressão", shortcut: "S", description: "Salve um MindBlock", icon: Plus, to: "/biblioteca" },
  { label: "Explorar Universo Neural", shortcut: "U", description: "Veja seu mapa mental", icon: Brain, to: "/neural-universe" },
];

const weekDays = ["S", "T", "Q", "Q", "S", "S", "D"];

const motivationalMessages = [
  "🧠 Your brain grows with every expression.",
  "🚀 One conversation closer to fluency.",
  "🔥 Consistency beats motivation.",
  "💬 Think in English. Don't translate.",
  "🌍 Small blocks. Big fluency.",
  "✨ Your future self speaks English naturally.",
  "🎯 Every saved expression strengthens your brain.",
  "⚡ Tiny habits create fluent minds.",
  "🌎 Every day is another neural connection.",
  "💡 Fluency starts with one sentence.",
  "🎧 Listen more. Translate less.",
  "🧩 Every MindBlock builds confidence.",
  "🧠 You're training your brain, not memorizing words.",
];

const dailyExpressions = [
  { phrase: "I'm looking forward to it.", translation: "Estou ansioso por isso.", category: "Natural response" },
  { phrase: "Nice to meet you.", translation: "Prazer em conhecer você.", category: "First conversation" },
  { phrase: "That sounds good to me.", translation: "Isso me parece bom.", category: "Agreement" },
  { phrase: "Could you say that again?", translation: "Você poderia dizer isso de novo?", category: "Listening" },
  { phrase: "I need a little more time.", translation: "Eu preciso de um pouco mais de tempo.", category: "Work English" },
  { phrase: "Let me check and get back to you.", translation: "Deixe-me verificar e te retorno.", category: "Professional" },
  { phrase: "I see what you mean.", translation: "Entendo o que você quer dizer.", category: "Conversation" },
];

const NEO_CONTEXT_KEY = "fluentmind_neo_expression_context";
const REPEAT_CONTEXT_KEY = "fluentmind_repeat_expression_context";
const SAVED_EXPRESSION_KEY = "fluentmind_mock_saved_expression";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "Bom dia";
  }
  if (hour < 18) {
    return "Boa tarde";
  }
  return "Boa noite";
}

function getDayIndex(length, offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day = Math.floor((now - start) / 86400000);
  return (day + offset) % length;
}

function getAdaptiveDashboardMessage(context) {
  if (context.goalProgress >= 100) {
    return { title: "🎉 Excelente!", subtitle: "Pronto para mais um desafio?", brainState: "goal-complete" };
  }
  if (context.streakDays >= 7) {
    return { title: "🔥 Não quebre a sequência.", subtitle: "Uma semana mais forte que antes.", brainState: "streak" };
  }
  if (context.daysInactive >= 7) {
    return { title: "😴 Seu cérebro sentiu falta da prática.", subtitle: "Vamos acordar sua fluência.", brainState: "sleeping" };
  }
  if (context.daysInactive >= 2) {
    return { title: "😴 Seu eu do futuro está esperando.", subtitle: "Um pequeno MindBlock já reinicia o ritmo.", brainState: "inactive" };
  }
  if (context.pendingReviews >= 20) {
    return { title: "📚 Sua memória precisa de reforço.", subtitle: "Revisar hoje protege o progresso de ontem.", brainState: "review-complete" };
  }
  if (context.studiedTodayMinutes >= 45) {
    return { title: "⚡ Você está em ritmo forte hoje.", subtitle: "Seu cérebro está criando reflexos de fluência.", brainState: "goal-complete" };
  }
  return { title: "☀️ Vamos fazer o dia contar.", subtitle: motivationalMessages[getDayIndex(motivationalMessages.length)], brainState: "idle" };
}

function getDisplayName(user, profile) {
  return profile?.display_name
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

function calculateDaysInactive(activity) {
  const rows = [...(activity ?? [])].reverse();
  const inactive = rows.findIndex((row) => hasActivity(row));
  if (inactive === -1) return rows.length || 0;
  return inactive;
}

function buildUserContext({ profile, mindBlocks, reviewEvents, activity }) {
  const today = activity?.[activity.length - 1] ?? {};
  const weeklyStudyMinutes = (activity ?? []).reduce((total, row) => total + (Number(row.study_minutes) || 0), 0);
  const weeklyReviewed = (activity ?? []).reduce((total, row) => total + (Number(row.expressions_reviewed) || 0), 0);
  const todaySaved = Number(today.expressions_saved) || Number(today.mindblocks_created) || 0;
  const todayReviewed = Number(today.expressions_reviewed) || 0;
  const dailyGoal = Number(profile?.daily_expression_goal) || 30;
  const reviewedFallback = reviewEvents?.filter((event) => {
    if (!event.reviewed_at) return false;
    return event.reviewed_at.slice(0, 10) === new Date().toISOString().slice(0, 10);
  }).length ?? 0;
  const goalDone = todaySaved + todayReviewed + reviewedFallback;

  return {
    streakDays: Number(profile?.streak_days) || calculateActivityStreak(activity),
    goalProgress: Math.min(100, Math.round((goalDone / dailyGoal) * 100)),
    goalDone,
    dailyGoal,
    pendingReviews: mindBlocks?.filter((item) => item.isReviewDue).length ?? 0,
    studiedTodayMinutes: Number(today.study_minutes) || 0,
    weeklyStudyMinutes,
    weeklyReviewed,
    brainLevel: Math.max(1, Math.floor((Number(profile?.fluentmind_score) || mindBlocks?.length || 1) / 10)),
    daysInactive: calculateDaysInactive(activity),
    fluentmindScore: Number(profile?.fluentmind_score) || Math.min(100, Math.round((mindBlocks?.length || 0) * 2 + weeklyReviewed)),
  };
}

function buildStats({ mindBlocks, playlists }, context) {
  const hours = context.weeklyStudyMinutes > 0 ? `${(context.weeklyStudyMinutes / 60).toFixed(1)}h` : "0h";

  return [
    { label: "Expressões", value: String(mindBlocks?.length ?? 0), change: `${context.goalDone}/${context.dailyGoal} hoje`, icon: BookOpen },
    { label: "Playlists", value: String(playlists?.length ?? 0), change: "listas ativas", icon: Library },
    { label: "Horas estudadas", value: hours, change: `${context.studiedTodayMinutes} min hoje`, icon: Clock3 },
    { label: "Sequência", value: String(context.streakDays), change: "dias seguidos", icon: Zap, tone: "warning" },
  ];
}

function buildRecentExpressions(mindBlocks) {
  return (mindBlocks ?? []).slice(0, 3).map((item) => ({
    phrase: item.expression,
    translation: item.translation,
    category: item.category,
    difficulty: item.difficulty || "A2",
    mastery: item.mastery || 0,
  }));
}

function buildTodayExpression(mindBlocks) {
  const due = (mindBlocks ?? []).find((item) => item.isReviewDue || item.status === "review_due");
  const recent = (mindBlocks ?? [])[0];
  const source = due || recent;

  if (source?.expression) {
    return {
      phrase: source.expression,
      translation: source.translation,
      category: source.isReviewDue || source.status === "review_due" ? "Revisão pendente" : source.category,
      sourceMindBlockId: source.id,
    };
  }

  return dailyExpressions[getDayIndex(dailyExpressions.length)];
}

function buildWeeklyProgress(activity) {
  if (!activity?.length) return progressBars;

  const rawValues = activity.map((row) => (
    (Number(row.study_minutes) || 0)
    + (Number(row.expressions_saved) || 0) * 3
    + (Number(row.expressions_reviewed) || 0) * 2
  ));
  const maxValue = Math.max(0, ...rawValues);

  return activity.map((row, index) => {
    const rawValue = rawValues[index] ?? 0;
    return {
      day: dayLabels[index] ?? row.activity_date?.slice(5),
      value: maxValue > 0 ? Math.max(8, Math.round((rawValue / maxValue) * 100)) : 0,
    };
  });
}

export default function FluentMindDashboard() {
  const { user } = useAuth();
  const [coachOpen, setCoachOpen] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    profile: null,
    mindBlocks: [],
    playlists: [],
    reviewEvents: [],
    activity: [],
  });
  const [learningEvents, setLearningEvents] = useState(() => getLearningEvents());
  const [showFirstExperience, setShowFirstExperience] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(FIRST_DASHBOARD_EXPERIENCE_KEY) === "true";
  });
  const progression = useProgression();
  const greeting = useMemo(() => getGreeting(), []);
  const displayName = useMemo(() => getDisplayName(user, dashboardData.profile), [dashboardData.profile, user]);
  const dailyExpression = useMemo(() => buildTodayExpression(dashboardData.mindBlocks), [dashboardData.mindBlocks]);
  const userContext = useMemo(() => buildUserContext(dashboardData), [dashboardData]);
  const adaptiveMessage = useMemo(() => getAdaptiveDashboardMessage(userContext), [userContext]);
  const stats = useMemo(() => buildStats(dashboardData, userContext), [dashboardData, userContext]);
  const recentExpressions = useMemo(() => buildRecentExpressions(dashboardData.mindBlocks), [dashboardData.mindBlocks]);
  const weeklyProgress = useMemo(() => buildWeeklyProgress(dashboardData.activity), [dashboardData.activity]);
  const dailyHeroMessage = useMemo(() => motivationalMessages[getDayIndex(motivationalMessages.length)], []);

  const completeFirstExperience = () => {
    window.localStorage.removeItem(FIRST_DASHBOARD_EXPERIENCE_KEY);
    setShowFirstExperience(false);
  };

  useEffect(() => {
    let isMounted = true;

    async function loadDashboardData() {
      if (!user?.id) return;

      try {
        const [profile, mindBlocks, playlists, reviewEvents, activityRows] = await Promise.all([
          getOrCreateLearningProfile(user),
          listMindBlocks(user.id),
          listPlaylists(user.id),
          listReviewEvents(user.id, { limit: 500 }),
          listDailyActivity(user.id, { days: 7 }),
        ]);

        if (!isMounted) return;
        setDashboardData({
          profile,
          mindBlocks,
          playlists,
          reviewEvents,
          activity: buildActivityByDate(activityRows, 7),
        });
      } catch (error) {
        console.error(error);
      }
    }

    loadDashboardData();
    return () => {
      isMounted = false;
    };
  }, [user]);

  useEffect(() => {
    const syncEvents = () => setLearningEvents(getLearningEvents());
    window.addEventListener(LEARNING_EVENTS_UPDATED, syncEvents);
    window.addEventListener("storage", syncEvents);
    return () => {
      window.removeEventListener(LEARNING_EVENTS_UPDATED, syncEvents);
      window.removeEventListener("storage", syncEvents);
    };
  }, []);

  return (
    <div className="fm-dashboard fm-premium-dashboard relative min-h-full overflow-hidden rounded-[28px] border px-4 py-5 shadow-lg sm:px-6 lg:px-8">
      <AnimatedBackground />

      <div className="relative z-10 space-y-6">
        {showFirstExperience ? <FirstLearningExperience displayName={displayName} onComplete={completeFirstExperience} /> : null}

        <PremiumDashboardHero
          greeting={greeting}
          displayName={displayName}
          message={dailyHeroMessage}
          progression={progression}
          context={userContext}
          learningEvents={learningEvents}
          mindBlocks={dashboardData.mindBlocks}
          playlists={dashboardData.playlists}
        />

        <DailyMissionCenter progression={progression} dailyExpression={dailyExpression} />

        <GrowthSection
          mindBlocks={dashboardData.mindBlocks}
          playlists={dashboardData.playlists}
          progression={progression}
          context={userContext}
          learningEvents={learningEvents}
        />

        <section className="grid gap-5 xl:grid-cols-[0.9fr,1.1fr]">
          <BrainInsights mindBlocks={dashboardData.mindBlocks} context={userContext} learningEvents={learningEvents} />
          <ActivityFeed learningEvents={learningEvents} progression={progression} mindBlocks={dashboardData.mindBlocks} />
        </section>

        <ModernRecentExpressions expressions={recentExpressions} />

        <section className="grid gap-5 xl:grid-cols-[1fr,0.72fr]">
          <PremiumQuickActions />
          <QuoteCard />
        </section>
      </div>

      <AiCoachButton onClick={() => setCoachOpen(true)} />
      {coachOpen ? <AiCoachPanel onClose={() => setCoachOpen(false)} /> : null}
    </div>
  );
}

function PremiumDashboardHero({ greeting, displayName, message, progression, context, learningEvents, mindBlocks, playlists }) {
  const xpPercent = Math.min(100, Math.round((progression.xpInCurrentLevel / Math.max(1, progression.xpToNextLevel)) * 100));
  const remainingXp = Math.max(0, progression.xpToNextLevel - progression.xpInCurrentLevel);
  const neuralNodes = Math.max(8, mindBlocks.length + learningEvents.length + progression.currentLevel);
  const neuralConnections = Math.max(12, mindBlocks.length * 6 + learningEvents.length * 3 + playlists.length * 4);

  return (
    <motion.section
      className="fm-hero-evolution"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      <div className="fm-hero-evolution-copy">
        <p className="fm-chip inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
          Fluent brain training
        </p>
        <h1>{greeting}, {displayName} <span aria-hidden="true">👋</span></h1>
        <p className="fm-hero-message">{message}</p>

        <div className="fm-hero-xp-panel">
          <div>
            <span>Level</span>
            <strong>{progression.currentLevel}</strong>
          </div>
          <div>
            <span>Total XP</span>
            <strong>{progression.totalXp.toLocaleString("en-US")}</strong>
          </div>
          <div>
            <span>Next Level</span>
            <strong>{remainingXp} XP</strong>
          </div>
        </div>

        <div className="fm-hero-progress">
          <div className="flex items-center justify-between gap-3 text-xs font-semibold">
            <span>{progression.currentLevelName}</span>
            <span>{remainingXp} XP until Level {progression.currentLevel + 1}</span>
          </div>
          <div className="fm-hero-progress-track">
            <motion.div
              className="fm-hero-progress-fill"
              initial={{ width: 0 }}
              animate={{ width: `${xpPercent}%` }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          </div>
        </div>
      </div>

      <div className="fm-hero-neural-brain">
        <NeuralBrain
          level={progression.currentLevel}
          xp={progression.xpInCurrentLevel}
          nextLevelXp={progression.xpToNextLevel}
          nodes={neuralNodes}
          connections={neuralConnections}
          mastery={context.fluentmindScore}
          size="xl"
          mode="hero"
          mood={context.goalProgress >= 100 ? "celebrating" : context.pendingReviews > 0 ? "learning" : "focused"}
          animated
          interactive
          showStats={false}
        />
      </div>
    </motion.section>
  );
}

function DailyMissionCenter({ progression, dailyExpression }) {
  const missionProgress = Math.round(
    (progression.dailyMissions.filter((mission) => mission.completed).length / Math.max(1, progression.dailyMissions.length)) * 100,
  );
  const missions = [
    ...progression.dailyMissions.slice(0, 3),
    {
      id: "today-expression",
      title: "Aprender a expressão de hoje",
      description: dailyExpression.phrase,
      progress: dailyExpression.sourceMindBlockId ? 1 : 0,
      target: 1,
      completed: Boolean(dailyExpression.sourceMindBlockId),
      xpReward: 20,
    },
  ];

  return (
    <motion.section className="fm-mission-center" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
      <div className="fm-section-heading">
        <div>
          <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">Missão cerebral de hoje</p>
          <h2>Treine uma conexão mais forte hoje.</h2>
        </div>
        <div className="fm-mission-score">
          <span>Progresso da missão</span>
          <strong>{missionProgress}%</strong>
        </div>
      </div>

      <div className="fm-mission-progress-track">
        <motion.div className="fm-mission-progress-fill" initial={{ width: 0 }} animate={{ width: `${missionProgress}%` }} />
      </div>

      <div className="fm-mission-grid">
        {missions.map((mission, index) => (
          <motion.article
            key={mission.id}
            className={`fm-mission-card ${mission.completed ? "is-complete" : ""}`}
            whileHover={{ y: -4, scale: 1.01 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            <span className="fm-mission-check">{mission.completed ? <Check className="h-4 w-4" /> : index + 1}</span>
            <div>
              <h3>{mission.title}</h3>
              <p>{mission.description}</p>
              <small>{mission.progress}/{mission.target} · +{mission.xpReward} XP</small>
            </div>
          </motion.article>
        ))}
      </div>

      <Link to="/daily-workout" className="fm-primary-button mt-5 inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black">
        Iniciar treino do dia <ChevronRight className="h-4 w-4" />
      </Link>

      {missionProgress >= 100 ? (
        <motion.div className="fm-mission-complete" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}>
          <strong>Crescimento cerebral concluído</strong>
          <span>+150 XP</span>
        </motion.div>
      ) : null}
    </motion.section>
  );
}

function GrowthSection({ mindBlocks, playlists, progression, context, learningEvents }) {
  const weeklyEvents = learningEvents.filter((event) => Date.now() - new Date(event.createdAt).getTime() <= 1000 * 60 * 60 * 24 * 7);
  const neuralConnections = Math.max(0, mindBlocks.length * 6 + learningEvents.length * 3 + playlists.length * 4);
  const cards = [
    { label: "MindBlocks", value: mindBlocks.length, change: `+${weeklyEvents.filter((event) => event.type === "expression_saved").length} esta semana`, icon: Brain, tone: "violet" },
    { label: "Conexões neurais", value: neuralConnections, change: `+${weeklyEvents.length * 3} esta semana`, icon: Zap, tone: "cyan" },
    { label: "Sequência atual", value: context.streakDays, suffix: " dias", change: "mantenha o ritmo vivo", icon: Flame, tone: "orange" },
    { label: "Domínio", value: context.fluentmindScore, suffix: "%", change: `${progression.currentLevelName}`, icon: Target, tone: "green" },
  ];

  return (
    <section className="fm-growth-section">
      <div className="fm-section-heading">
        <div>
          <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">Sua evolução</p>
          <h2>Seu cérebro está ficando mais fluente.</h2>
        </div>
      </div>
      <div className="fm-growth-grid">
        {cards.map((card, index) => (
          <motion.article
            key={card.label}
            className={`fm-growth-card is-${card.tone}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            whileHover={{ y: -5 }}
          >
            <div className="fm-growth-icon">{React.createElement(card.icon, { className: "h-5 w-5" })}</div>
            <p>{card.label}</p>
            <strong><AnimatedNumber value={card.value} />{card.suffix || ""}</strong>
            <span>{card.change}</span>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

function AnimatedNumber({ value }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const animate = (time) => {
      const progress = Math.min(1, (time - start) / 850);
      setCurrent(Math.round(value * (1 - (1 - progress) ** 3)));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return current.toLocaleString("en-US");
}

function BrainInsights({ mindBlocks, context, learningEvents }) {
  const categoryCounts = mindBlocks.reduce((acc, item) => {
    const category = item.category || "Daily Fluency";
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {});
  const strongestCategory = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Daily Fluency";
  const reviewEvents = learningEvents.filter((event) => event.type === "review_completed" || event.type === "mistake_reviewed").length;
  const insights = [
    `Seu ponto mais forte é ${strongestCategory}.`,
    `${strongestCategory} está se tornando seu maior grupo de aprendizado.`,
    reviewEvents > 2 ? `Você revisou ${reviewEvents} caminhos neurais recentemente.` : "Seu próximo salto virá de revisões curtas.",
    context.pendingReviews > 0 ? `${context.pendingReviews} MindBlocks pedem reforço.` : "Sua fila de memória está tranquila hoje.",
  ];

  return (
    <article className="fm-brain-insights">
      <div className="fm-section-heading compact">
        <div>
          <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">Insights do cérebro</p>
          <h2>Neo identifica padrões na sua evolução.</h2>
        </div>
      </div>
      <div className="fm-insight-list">
        {insights.map((insight, index) => (
          <motion.div key={insight} className="fm-insight-item" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: index * 0.05 }}>
            <Sparkles className="h-4 w-4" />
            <span>{insight}</span>
          </motion.div>
        ))}
      </div>
    </article>
  );
}

function ActivityFeed({ learningEvents, progression, mindBlocks }) {
  const fallbackActivities = [
    { id: "fallback-expression", title: "Nova expressão salva", body: mindBlocks[0]?.expression || "I'm looking forward to it.", time: "10 minutos atrás", icon: Brain },
    { id: "fallback-streak", title: `Sequência chegou a ${progression.streak || 1} dias`, body: "Sua consistência está moldando a memória.", time: "Ontem", icon: Flame },
    { id: "fallback-universe", title: "Universo Neural expandido", body: `+${Math.max(1, learningEvents.length)} nós`, time: "Hoje", icon: Sparkles },
  ];
  const eventItems = learningEvents.slice(-6).reverse().map((event) => {
    const payload = event.payload || {};
    const map = {
      expression_saved: ["Nova expressão salva", payload.expression, Brain],
      correction_saved: ["Correção fortalecida", `${payload.wrongText} -> ${payload.correctText}`, Check],
      conversation_completed: ["Conversa concluída", `${payload.xpEarned || 15} XP ganhos`, MessageCircle],
      review_completed: ["Revisão concluída", payload.expression, RotateCcw],
      expression_mastered: ["MindBlock dominado", payload.expression, Target],
      favorite_added: ["Caminho neural favorito", payload.expression, Star],
      playlist_created: ["Novo grupo criado", payload.name, Library],
    };
    const [title, body, icon] = map[event.type] || ["Atividade cerebral", event.type, Sparkles];
    return {
      id: event.id,
      title,
      body: body || "Seu FluentMind evoluiu.",
      time: formatActivityTime(event.createdAt),
      icon,
    };
  });
  const activities = eventItems.length ? eventItems : fallbackActivities;

  return (
    <article className="fm-activity-feed">
      <div className="fm-section-heading compact">
        <div>
          <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">Atividade do cérebro</p>
          <h2>Um histórico vivo da sua fluência.</h2>
        </div>
      </div>
      <div className="fm-activity-list">
        {activities.map((item, index) => (
          <motion.div key={item.id} className="fm-activity-item" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.04 }}>
            <span>{React.createElement(item.icon, { className: "h-4 w-4" })}</span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
            <small>{item.time}</small>
          </motion.div>
        ))}
      </div>
    </article>
  );
}

function formatActivityTime(date) {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} min atrás`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h atrás`;
  return `${Math.round(hours / 24)} dias atrás`;
}

function ModernRecentExpressions({ expressions }) {
  return (
    <section className="fm-modern-expressions">
      <div className="fm-section-heading">
        <div>
          <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">Expressões recentes</p>
          <h2>Pequenos blocos. Grande fluência.</h2>
        </div>
        <Link to="/biblioteca" className="fm-secondary inline-flex items-center gap-1 text-xs font-semibold">
          Abrir biblioteca <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="fm-expression-strip">
        {(expressions.length ? expressions : dailyExpressions.slice(0, 3)).map((item, index) => {
          const phrase = item.phrase || item.expression;
          return (
            <motion.article key={phrase} className="fm-expression-modern-card" whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
              <span className="fm-chip rounded-full border px-2.5 py-1 text-[11px] font-semibold">{item.category || "Daily Fluency"}</span>
              <h3>{phrase}</h3>
              <p>{item.translation}</p>
              <div className="fm-expression-actions">
                <button type="button"><Play className="h-4 w-4 fill-current" /> Ouvir</button>
                <Link to="/chatbot"><MessageCircle className="h-4 w-4" /> Praticar</Link>
                <span>{item.mastery ?? 10 + index * 12}%</span>
              </div>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}

function PremiumQuickActions() {
  return (
    <article className="fm-card fm-quick-premium rounded-[30px] border p-6 shadow-md backdrop-blur-xl">
      <div className="fm-section-heading compact">
        <div>
          <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">Ações rápidas</p>
          <h2>Escolha o próximo treino neural.</h2>
        </div>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {quickActions.map((action) => (
          <motion.div key={action.label} whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 260, damping: 20 }}>
            <Link to={action.to} className="fm-inner group block rounded-2xl border p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="fm-chip flex h-11 w-11 items-center justify-center rounded-2xl border-0">
                  <action.icon className="h-5 w-5" />
                </span>
                <span className="fm-shortcut rounded-lg border px-2 py-1 text-[10px] font-semibold">{action.shortcut}</span>
              </div>
              <p className="mt-4 text-sm font-semibold">{action.label}</p>
              <p className="fm-subtle mt-1 text-xs">{action.description}</p>
            </Link>
          </motion.div>
        ))}
      </div>
    </article>
  );
}

function FirstLearningExperience({ displayName, onComplete }) {
  return (
    <article className="fm-first-experience fm-card relative overflow-hidden rounded-[30px] border p-6 shadow-lg backdrop-blur-xl">
      <div className="fm-card-glow absolute inset-y-0 right-0 w-1/2" />
      <div className="relative grid gap-6 lg:grid-cols-[1fr,auto] lg:items-center">
        <div>
          <p className="fm-chip inline-flex rounded-full border px-3 py-1 text-xs font-semibold">Sua jornada começa hoje</p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">👋 Welcome, {displayName}.</h2>
          <p className="fm-muted mt-2 text-sm">Antes de explorar os menus, crie seu primeiro MindBlock útil.</p>

          <div className="fm-inner mt-5 rounded-2xl border p-5">
            <p className="fm-subtle text-xs font-semibold uppercase tracking-[0.14em]">Primeira expressão de hoje</p>
            <p className="mt-3 text-xl font-semibold">🇺🇸 Nice to meet you.</p>
            <p className="fm-muted mt-1 text-sm">🇧🇷 Prazer em conhecer você.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <button type="button" className="fm-chip inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5">
            <Play className="h-4 w-4 fill-current" />
            Ouvir
          </button>
          <button type="button" className="fm-chip inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5" onClick={onComplete}>
            <Star className="h-4 w-4" />
            Salvar
          </button>
          <Link to="/chatbot" onClick={onComplete} className="fm-gradient inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-md transition hover:-translate-y-0.5">
            <MessageCircle className="h-4 w-4" />
            Praticar com Neo
          </Link>
        </div>
      </div>
    </article>
  );
}

function AnimatedBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="fm-neural-grid absolute inset-0 opacity-60" />
      <div className="fm-neural-line left-[8%] top-[18%] w-40 rotate-12" />
      <div className="fm-neural-line right-[14%] top-[32%] w-52 -rotate-12" />
      <div className="fm-neural-line bottom-[20%] left-[34%] w-48 rotate-6" />
      {Array.from({ length: 14 }).map((_, index) => (
        <span
          key={`particle-${index}`}
          className="fm-particle"
          style={{
            left: `${8 + ((index * 17) % 86)}%`,
            top: `${10 + ((index * 23) % 78)}%`,
            animationDelay: `${index * 0.38}s`,
          }}
        />
      ))}
    </div>
  );
}

function DashboardHeader({ greeting, displayName, adaptiveMessage }) {
  return (
    <header className="grid gap-5 lg:grid-cols-[1fr,420px] lg:items-center">
      <div>
        <div className="fm-chip inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
          <Sparkles className="h-3.5 w-3.5" />
          Método MindBlocks
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          {greeting}, {displayName}! <span className="inline-block">👋</span>
        </h1>
        <p className="fm-muted mt-2 text-sm sm:text-base">{adaptiveMessage.title}</p>
        <p className="fm-subtle mt-1 text-sm">{adaptiveMessage.subtitle}</p>
      </div>

      <form className="fm-input flex min-h-12 w-full items-center gap-3 rounded-2xl border px-4 shadow-sm backdrop-blur">
        <Search className="fm-subtle h-4 w-4" />
        <input
          type="search"
          placeholder="Buscar expressões, playlists..."
          className="min-w-0 flex-1 bg-transparent text-sm focus:outline-none"
        />
      </form>
    </header>
  );
}

function TodayExpression({ expression }) {
  const saveExpressionContext = (key) => {
    window.localStorage.setItem(
      key,
      JSON.stringify({
        ...expression,
        source: "dashboard_today_expression",
        savedAt: new Date().toISOString(),
      }),
    );
  };

  const primaryAction = expression.sourceMindBlockId ? "/insights" : "/chatbot";

  return (
    <article className="fm-card rounded-[30px] border p-5 shadow-md backdrop-blur-xl">
      <div className="grid gap-5 lg:grid-cols-[1fr,auto] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">Today&apos;s Expression</p>
            <span className="fm-chip rounded-full border px-2.5 py-1 text-[11px] font-semibold">{expression.category}</span>
          </div>
          <p className="mt-4 text-2xl font-semibold tracking-tight">🇺🇸 {expression.phrase}</p>
          <p className="fm-muted mt-2 text-sm">🇧🇷 {expression.translation}</p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
          <button type="button" className="fm-live-action" onClick={() => saveExpressionContext(REPEAT_CONTEXT_KEY)}>
            <Play className="h-4 w-4 fill-current" />
            Ouvir
          </button>
          <button type="button" className="fm-live-action" onClick={() => saveExpressionContext(SAVED_EXPRESSION_KEY)}>
            <Star className="h-4 w-4" />
            Salvar
          </button>
          <button type="button" className="fm-live-action" title="Prepared for future voice recognition" onClick={() => saveExpressionContext(REPEAT_CONTEXT_KEY)}>
            <Mic2 className="h-4 w-4" />
            Repetir
          </button>
          <Link to={primaryAction} className="fm-live-action fm-live-action-primary" onClick={() => saveExpressionContext(NEO_CONTEXT_KEY)}>
            <MessageCircle className="h-4 w-4" />
            {expression.sourceMindBlockId ? "Revisar" : "Neo"}
          </Link>
        </div>
      </div>
    </article>
  );
}

function StatCard({ label, value, change, icon, tone, index }) {
  return (
    <article
      className="fm-card group rounded-3xl border p-5 shadow-md backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:shadow-lg"
      style={{ animationDelay: `${index * 55}ms` }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="fm-muted text-sm font-medium">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight">{value}</p>
        </div>
        <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tone === "warning" ? "fm-warning-chip" : "fm-gradient"} shadow-md transition group-hover:scale-105`}>
          {React.createElement(icon, { className: "h-5 w-5" })}
        </span>
      </div>
      <p className="fm-subtle mt-4 text-xs font-medium">{change}</p>
    </article>
  );
}

function GoalCard({ message, brainState, context }) {
  return (
    <article className="fm-card relative overflow-hidden rounded-[30px] border p-6 shadow-lg backdrop-blur-xl">
      <div className="fm-card-glow absolute inset-y-0 right-0 w-1/2" />
      <div className="relative grid gap-8 lg:grid-cols-[1fr,230px] lg:items-center">
        <div>
          <div className="fm-accent flex items-center gap-2 text-sm font-semibold">
            <Target className="h-4 w-4" />
            Today&apos;s Goal
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight">{message}</h2>
          <p className="fm-muted mt-2 max-w-xl text-sm leading-6">
            Build mental blocks instead of translating word by word. Complete today&apos;s expression set and reinforce active recall.
          </p>

          <div className="mt-7">
            <div className="fm-muted flex items-center justify-between text-xs font-semibold">
              <span>Study {context.dailyGoal} expressions</span>
              <span className="fm-secondary">{context.goalDone} / {context.dailyGoal}</span>
            </div>
            <div className="fm-progress-track mt-3 h-3 overflow-hidden rounded-full">
              <div className="fm-progress-fill h-full rounded-full" style={{ width: `${context.goalProgress}%` }} />
            </div>
          </div>
        </div>

        <BrainCompanion state={brainState} level={context.brainLevel} streakDays={context.streakDays} size="md" showLabel />
      </div>
    </article>
  );
}

function StreakCard({ streakDays }) {
  return (
    <article className="fm-card rounded-[30px] border p-6 shadow-md backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
            <p className="fm-muted text-sm font-semibold">Sua sequência</p>
          <p className="mt-3 text-5xl font-semibold tracking-tight">{streakDays}</p>
          <p className="fm-warning mt-1 text-sm">dias pensando em inglês</p>
        </div>
        <span className="fm-warning-chip flex h-14 w-14 items-center justify-center rounded-3xl">
          <Zap className="h-7 w-7" />
        </span>
      </div>
      <div className="mt-7 grid grid-cols-7 gap-2">
        {weekDays.map((day, index) => (
          <div key={`${day}-${index}`} className="flex flex-col items-center gap-2">
            <span className="fm-subtle text-xs font-semibold">{day}</span>
            <span className={`${index >= Math.max(0, 7 - streakDays) ? "fm-check" : "fm-chip"} flex h-8 w-8 items-center justify-center rounded-full shadow-sm`}>
              <Check className="h-4 w-4" />
            </span>
          </div>
        ))}
      </div>
      <div className="fm-inner mt-5 rounded-2xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Próxima recompensa</span>
          <span className="fm-chip rounded-full border px-2.5 py-1 text-[11px] font-semibold">Nível 4</span>
        </div>
        <div className="fm-progress-track mt-3 h-2 rounded-full">
          <div className="fm-progress-fill h-full w-[72%] rounded-full" />
        </div>
      </div>
    </article>
  );
}

function SmartDailyPlan({ context }) {
  const plan = [
    { label: "Revisar expressões", value: String(Math.max(3, context.pendingReviews || 0)), icon: RotateCcw },
    { label: "Praticar escuta", value: `${Math.max(8, Math.round(context.studiedTodayMinutes / 2) || 8)} min`, icon: Headphones },
    { label: "Aquecimento de conversa", value: "5 min", icon: MessageCircle },
  ];

  return (
    <article className="fm-card rounded-[30px] border p-5 shadow-md backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="fm-muted text-sm font-semibold">Plano inteligente do dia</p>
          <h2 className="mt-2 text-xl font-semibold">Estimativa: {Math.max(15, context.studiedTodayMinutes + 12)} min</h2>
        </div>
        <CalendarCheck2 className="fm-secondary h-5 w-5" />
      </div>
      <div className="mt-5 space-y-3">
        {plan.map((item) => (
          <div key={item.label} className="fm-inner flex items-center justify-between gap-3 rounded-2xl border p-3">
            <div className="flex items-center gap-3">
              <span className="fm-chip flex h-9 w-9 items-center justify-center rounded-xl border-0">
                <item.icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-medium">{item.label}</span>
            </div>
            <span className="fm-muted text-sm font-semibold">{item.value}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function RecentExpressionList({ expressions }) {
  return (
    <article className="fm-card rounded-[30px] border p-6 shadow-md backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Expressões recentes</h2>
          <p className="fm-subtle mt-1 text-sm">Salvas de conversas e correções.</p>
        </div>
        <Link to="/biblioteca" className="fm-secondary inline-flex items-center gap-1 text-xs font-semibold hover:brightness-125">
          Ver tudo <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-5 space-y-3">
        {expressions.length ? expressions.map((item) => (
          <div
            key={item.phrase}
            className="fm-inner group grid gap-4 rounded-2xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-sm sm:grid-cols-[1fr,auto] sm:items-center"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold">{item.phrase}</p>
                <span className="fm-chip rounded-full border px-2 py-0.5 text-[10px] font-semibold">{item.difficulty}</span>
              </div>
              <p className="fm-muted mt-1 text-xs">{item.translation}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="fm-chip inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold">{item.category}</span>
                <span className="fm-subtle text-[11px] font-semibold">{item.mastery}% domínio</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className="fm-chip flex h-9 w-9 items-center justify-center rounded-full border-0 transition hover:brightness-110" aria-label={`Play ${item.phrase}`}>
                <Play className="h-4 w-4 fill-current" />
              </button>
              <button type="button" className="fm-ghost-button flex h-9 w-9 items-center justify-center rounded-full transition" aria-label={`Favorite ${item.phrase}`}>
                <Heart className="h-4 w-4" />
              </button>
              <button type="button" className="fm-ghost-button flex h-9 w-9 items-center justify-center rounded-full transition" aria-label={`Options for ${item.phrase}`}>
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>
          </div>
        )) : (
          <div className="fm-inner rounded-2xl border p-5">
            <p className="text-sm font-semibold">Nenhum MindBlock salvo ainda.</p>
            <p className="fm-muted mt-1 text-xs">Converse com Neo ou salve sua primeira expressão para alimentar sua biblioteca.</p>
            <Link to="/chatbot" className="fm-secondary mt-3 inline-flex items-center gap-1 text-xs font-semibold">
              Começar com Neo <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>
    </article>
  );
}

function ProgressionOverview({ progression }) {
  const xpPercent = Math.min(100, Math.round((progression.xpInCurrentLevel / progression.xpToNextLevel) * 100));
  const remainingXp = Math.max(0, progression.xpToNextLevel - progression.xpInCurrentLevel);
  const recentAchievements = progression.achievementsUnlocked.slice(-3).reverse();

  return (
    <section className="grid gap-5 xl:grid-cols-[0.95fr,1.05fr,0.8fr]">
      <article className="progression-panel">
        <EvolvingBrain
          level={progression.currentLevel}
          xp={progression.totalXp}
          stage={progression.brainEvolutionStage}
          size="md"
          mood={progression.xpInCurrentLevel > 0 ? "focused" : "idle"}
          showLabel={false}
        />
        <div>
          <p className="fm-accent text-xs font-semibold uppercase tracking-[0.16em]">Motor de progresso</p>
          <h2>Nível {progression.currentLevel} — {progression.currentLevelName}</h2>
          <p>Faltam {remainingXp} XP para o próximo caminho neural.</p>
          <div className="progression-xp-track">
            <div className="progression-xp-fill" style={{ width: `${xpPercent}%` }} />
          </div>
        </div>
      </article>

      <article className="progression-missions">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2>Missões diárias</h2>
            <p>Pequenas ações que fortalecem o cérebro hoje.</p>
          </div>
          <span className="fm-chip rounded-full border px-3 py-1 text-xs font-semibold">
            {progression.dailyMissions.filter((mission) => mission.completed).length}/{progression.dailyMissions.length}
          </span>
        </div>
        <div className="progression-mission-list">
          {progression.dailyMissions.slice(0, 4).map((mission) => (
            <div key={mission.id} className={`progression-mission-item ${mission.completed ? "is-complete" : ""}`}>
              <header>
                <span>{mission.title}</span>
                <strong>{mission.progress}/{mission.target}</strong>
              </header>
              <small>{mission.description}</small>
              <div className="progression-xp-track">
                <div className="progression-xp-fill" style={{ width: `${Math.round((mission.progress / mission.target) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="progression-achievements">
        <h2>Conquistas recentes</h2>
        <p>Provas desbloqueadas da sua evolução.</p>
        <div className="progression-achievement-list">
          {recentAchievements.length ? recentAchievements.map((achievement) => (
            <div key={achievement.id} className="progression-achievement-item">
              <header>
                <span>{achievement.title}</span>
                <strong>+{achievement.xpReward} XP</strong>
              </header>
              <small>{achievement.description}</small>
            </div>
          )) : (
            <div className="progression-achievement-item">
              <header><span>Nenhuma conquista ainda</span><strong>0 XP</strong></header>
              <small>Salve, revise ou pratique para desbloquear o primeiro selo.</small>
            </div>
          )}
        </div>
      </article>
    </section>
  );
}

function ProgressCard({ progressBars, context }) {
  return (
    <article className="fm-card rounded-[30px] border p-6 shadow-md backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Seu progresso</h2>
          <p className="fm-subtle mt-1 text-sm">Consistência semanal e pontuação FluentMind.</p>
        </div>
        <div className="fm-success-chip rounded-2xl border px-4 py-3 text-right">
          <p className="text-xs font-semibold">Pontuação</p>
          <p className="text-2xl font-semibold">{context.fluentmindScore}</p>
        </div>
      </div>

      <div className="mt-8 flex h-52 items-end gap-3">
        {progressBars.map((bar) => (
          <div key={bar.day} className="flex h-full flex-1 flex-col items-center justify-end gap-3">
            <div className="fm-inner flex h-full w-full max-w-10 items-end rounded-full p-1">
              <div className="fm-progress-fill w-full rounded-full" style={{ height: `${bar.value}%` }} />
            </div>
            <span className="fm-subtle text-xs font-semibold">{bar.day}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <ProgressPill icon={BookMarked} label="Revisadas" value={String(context.weeklyReviewed)} />
        <ProgressPill icon={Headphones} label="Min. estudo" value={String(context.weeklyStudyMinutes)} />
        <ProgressPill icon={MessageCircle} label="Meta hoje" value={`${context.goalProgress}%`} />
        <ProgressPill icon={Brain} label="Pendentes" value={String(context.pendingReviews)} />
      </div>
    </article>
  );
}

function ProgressPill({ icon, label, value }) {
  return (
    <div className="fm-inner rounded-2xl border p-4">
      {React.createElement(icon, { className: "fm-secondary h-4 w-4" })}
      <p className="mt-3 text-xl font-semibold">{value}</p>
      <p className="fm-subtle mt-1 text-xs">{label}</p>
    </div>
  );
}

function QuickActions() {
  return (
    <article className="fm-card rounded-[30px] border p-6 shadow-md backdrop-blur-xl">
      <h2 className="text-lg font-semibold">Ações rápidas</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {quickActions.map((action) => (
          <Link
            key={action.label}
            to={action.to}
            className="fm-inner group rounded-2xl border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="fm-chip flex h-11 w-11 items-center justify-center rounded-2xl border-0 transition group-hover:scale-105">
                <action.icon className="h-5 w-5" />
              </span>
              <span className="fm-shortcut rounded-lg border px-2 py-1 text-[10px] font-semibold">{action.shortcut}</span>
            </div>
            <p className="mt-4 text-sm font-semibold">{action.label}</p>
            <p className="fm-subtle mt-1 text-xs">{action.description}</p>
          </Link>
        ))}
      </div>
    </article>
  );
}

function QuoteCard() {
  return (
    <article className="fm-gradient-soft relative overflow-hidden rounded-[30px] border p-6 shadow-lg">
      <div className="fm-chip absolute right-5 top-5 flex h-12 w-12 items-center justify-center rounded-2xl border-0">
        <BarChart3 className="h-5 w-5" />
      </div>
      <p className="max-w-sm text-2xl font-semibold leading-snug">
        “The limits of my language mean the limits of my world.”
      </p>
      <p className="fm-muted mt-5 text-sm">Ludwig Wittgenstein</p>
      <div className="fm-inner mt-8 rounded-2xl border p-4">
        <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">Today focus</p>
        <p className="fm-muted mt-2 text-sm">Think in chunks, answer in meaning, review with intent.</p>
      </div>
    </article>
  );
}

function AiCoachButton({ onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="fm-coach-button fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 rounded-full border px-4 py-3 text-sm font-semibold shadow-lg transition hover:-translate-y-0.5"
    >
      <Sparkles className="h-4 w-4" />
      Ask Neo
    </button>
  );
}

function AiCoachPanel({ onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-end bg-black/35 p-4 backdrop-blur-sm sm:p-6" role="dialog" aria-modal="true">
      <div className="fm-popover w-full max-w-md rounded-[28px] border p-5 shadow-lg">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="fm-chip inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold">AI Coach</p>
            <h2 className="mt-3 text-xl font-semibold">Hi, I&apos;m Neo.</h2>
            <p className="fm-muted mt-1 text-sm">Choose a focused practice and I&apos;ll guide the next step.</p>
          </div>
          <button type="button" onClick={onClose} className="fm-ghost-button rounded-full px-3 py-1.5 text-sm font-semibold">
            Close
          </button>
        </div>
        <div className="mt-5 grid gap-3">
          {["Correct my last sentence", "Start a 5-minute conversation", "Quiz my saved expressions"].map((item) => (
            <button key={item} type="button" className="fm-inner flex items-center justify-between rounded-2xl border p-4 text-left text-sm font-semibold transition hover:-translate-y-0.5">
              {item}
              <Star className="fm-secondary h-4 w-4" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
