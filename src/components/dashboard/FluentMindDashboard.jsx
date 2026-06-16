import React, { useMemo, useState } from "react";
import {
  BarChart3,
  BookMarked,
  BookOpen,
  Brain,
  CalendarCheck2,
  Check,
  ChevronRight,
  Clock3,
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
import { FIRST_DASHBOARD_EXPERIENCE_KEY } from "../onboarding/OnboardingPage.jsx";

const stats = [
  { label: "Expressions", value: "248", change: "+18 this week", icon: BookOpen },
  { label: "Playlists", value: "16", change: "4 active sets", icon: Library },
  { label: "Hours Studied", value: "42h", change: "+3.5h today", icon: Clock3 },
  { label: "Streak", value: "7", change: "days in a row", icon: Zap, tone: "warning" },
];

const recentExpressions = [
  {
    phrase: "I am getting used to it.",
    translation: "Estou me acostumando com isso.",
    category: "Daily fluency",
    difficulty: "B1",
    mastery: 82,
  },
  {
    phrase: "That makes sense.",
    translation: "Isso faz sentido.",
    category: "Natural response",
    difficulty: "A2",
    mastery: 91,
  },
  {
    phrase: "Let me think it through.",
    translation: "Deixe-me pensar melhor sobre isso.",
    category: "Conversation",
    difficulty: "B2",
    mastery: 64,
  },
];

const progressBars = [
  { day: "Mon", value: 54 },
  { day: "Tue", value: 72 },
  { day: "Wed", value: 48 },
  { day: "Thu", value: 84 },
  { day: "Fri", value: 66 },
  { day: "Sat", value: 92 },
  { day: "Sun", value: 78 },
];

const quickActions = [
  { label: "New Conversation", shortcut: "N", description: "Practice with AI", icon: MessageCircle, to: "/chatbot" },
  { label: "Save Expression", shortcut: "S", description: "Capture a useful phrase", icon: Plus, to: "/biblioteca" },
  { label: "Start Review", shortcut: "R", description: "Recall saved MindBlocks", icon: RotateCcw, to: "/insights" },
  { label: "Random Practice", shortcut: "P", description: "Fast surprise drill", icon: Shuffle, to: "/gestor" },
  { label: "Listening Drill", shortcut: "L", description: "Train rhythm and meaning", icon: Headphones, to: "/biblioteca" },
  { label: "Pronunciation", shortcut: "M", description: "Speak and compare", icon: Mic2, to: "/chatbot" },
];

const dailyPlan = [
  { label: "Review expressions", value: "12", icon: RotateCcw },
  { label: "Listening practice", value: "8 min", icon: Headphones },
  { label: "Conversation warmup", value: "5 min", icon: MessageCircle },
];

const weekDays = ["M", "T", "W", "T", "F", "S", "S"];

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

const mockUserContext = {
  streakDays: 7,
  goalProgress: 70,
  pendingReviews: 12,
  studiedTodayMinutes: 18,
  brainLevel: 10,
  daysInactive: 0,
};

const NEO_CONTEXT_KEY = "fluentmind_neo_expression_context";
const REPEAT_CONTEXT_KEY = "fluentmind_repeat_expression_context";
const SAVED_EXPRESSION_KEY = "fluentmind_mock_saved_expression";

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "Good morning";
  }
  if (hour < 18) {
    return "Good afternoon";
  }
  return "Good evening";
}

function getDayIndex(length, offset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day = Math.floor((now - start) / 86400000);
  return (day + offset) % length;
}

function getAdaptiveDashboardMessage(context) {
  if (context.goalProgress >= 100) {
    return { title: "🎉 Amazing!", subtitle: "Ready for one more challenge?", brainState: "goal-complete" };
  }
  if (context.streakDays >= 7) {
    return { title: "🔥 Don't break the chain.", subtitle: "One week stronger than before.", brainState: "streak" };
  }
  if (context.daysInactive >= 7) {
    return { title: "😴 Your brain misses today's practice.", subtitle: "Let's wake up your mind.", brainState: "sleeping" };
  }
  if (context.daysInactive >= 2) {
    return { title: "😴 Your future self is waiting.", subtitle: "A small MindBlock is enough to restart.", brainState: "inactive" };
  }
  if (context.pendingReviews >= 20) {
    return { title: "📚 Your memory needs reinforcement.", subtitle: "Reviewing today protects yesterday's progress.", brainState: "review-complete" };
  }
  if (context.studiedTodayMinutes >= 45) {
    return { title: "⚡ You're on fire today.", subtitle: "Your brain is building fluent reflexes.", brainState: "goal-complete" };
  }
  return { title: "☀️ Let's make today count.", subtitle: motivationalMessages[getDayIndex(motivationalMessages.length)], brainState: "idle" };
}

export default function FluentMindDashboard() {
  const [coachOpen, setCoachOpen] = useState(false);
  const [showFirstExperience, setShowFirstExperience] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(FIRST_DASHBOARD_EXPERIENCE_KEY) === "true";
  });
  const greeting = useMemo(() => getGreeting(), []);
  const dailyExpression = useMemo(() => dailyExpressions[getDayIndex(dailyExpressions.length)], []);
  const adaptiveMessage = useMemo(() => getAdaptiveDashboardMessage(mockUserContext), []);

  const completeFirstExperience = () => {
    window.localStorage.removeItem(FIRST_DASHBOARD_EXPERIENCE_KEY);
    setShowFirstExperience(false);
  };

  return (
    <div className="fm-dashboard fm-gradient-soft relative min-h-full overflow-hidden rounded-[28px] border px-4 py-5 shadow-lg sm:px-6 lg:px-8">
      <AnimatedBackground />

      <div className="relative z-10 space-y-6">
        <DashboardHeader greeting={greeting} adaptiveMessage={adaptiveMessage} />

        {showFirstExperience ? <FirstLearningExperience onComplete={completeFirstExperience} /> : null}

        <TodayExpression expression={dailyExpression} />

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((item, index) => (
            <StatCard key={item.label} index={index} {...item} />
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.25fr,0.75fr]">
          <GoalCard message={motivationalMessages[getDayIndex(motivationalMessages.length, 3)]} brainState={adaptiveMessage.brainState} />
          <div className="grid gap-5">
            <StreakCard />
            <SmartDailyPlan />
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.05fr,0.95fr]">
          <RecentExpressionList />
          <ProgressCard />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr,0.72fr]">
          <QuickActions />
          <QuoteCard />
        </section>
      </div>

      <AiCoachButton onClick={() => setCoachOpen(true)} />
      {coachOpen ? <AiCoachPanel onClose={() => setCoachOpen(false)} /> : null}
    </div>
  );
}

function FirstLearningExperience({ onComplete }) {
  return (
    <article className="fm-first-experience fm-card relative overflow-hidden rounded-[30px] border p-6 shadow-lg backdrop-blur-xl">
      <div className="fm-card-glow absolute inset-y-0 right-0 w-1/2" />
      <div className="relative grid gap-6 lg:grid-cols-[1fr,auto] lg:items-center">
        <div>
          <p className="fm-chip inline-flex rounded-full border px-3 py-1 text-xs font-semibold">Your journey starts today</p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">👋 Welcome, Rafael.</h2>
          <p className="fm-muted mt-2 text-sm">Before exploring menus, build your first useful MindBlock.</p>

          <div className="fm-inner mt-5 rounded-2xl border p-5">
            <p className="fm-subtle text-xs font-semibold uppercase tracking-[0.14em]">Today&apos;s first expression</p>
            <p className="mt-3 text-xl font-semibold">🇺🇸 Nice to meet you.</p>
            <p className="fm-muted mt-1 text-sm">🇧🇷 Prazer em conhecer você.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
          <button type="button" className="fm-chip inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5">
            <Play className="h-4 w-4 fill-current" />
            Listen
          </button>
          <button type="button" className="fm-chip inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5" onClick={onComplete}>
            <Star className="h-4 w-4" />
            Save
          </button>
          <Link to="/chatbot" onClick={onComplete} className="fm-gradient inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold shadow-md transition hover:-translate-y-0.5">
            <MessageCircle className="h-4 w-4" />
            Practice with Neo
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
          // eslint-disable-next-line react/no-array-index-key
          key={index}
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

function DashboardHeader({ greeting, adaptiveMessage }) {
  return (
    <header className="grid gap-5 lg:grid-cols-[1fr,420px] lg:items-center">
      <div>
        <div className="fm-chip inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
          <Sparkles className="h-3.5 w-3.5" />
          MindBlocks Method
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          {greeting}, Rafael! <span className="inline-block">👋</span>
        </h1>
        <p className="fm-muted mt-2 text-sm sm:text-base">{adaptiveMessage.title}</p>
        <p className="fm-subtle mt-1 text-sm">{adaptiveMessage.subtitle}</p>
      </div>

      <form className="fm-input flex min-h-12 w-full items-center gap-3 rounded-2xl border px-4 shadow-sm backdrop-blur">
        <Search className="fm-subtle h-4 w-4" />
        <input
          type="search"
          placeholder="Search expressions, playlists..."
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
          <button type="button" className="fm-live-action">
            <Play className="h-4 w-4 fill-current" />
            Listen
          </button>
          <button type="button" className="fm-live-action" onClick={() => saveExpressionContext(SAVED_EXPRESSION_KEY)}>
            <Star className="h-4 w-4" />
            Save
          </button>
          <button type="button" className="fm-live-action" title="Prepared for future voice recognition" onClick={() => saveExpressionContext(REPEAT_CONTEXT_KEY)}>
            <Mic2 className="h-4 w-4" />
            Repeat
          </button>
          <Link to="/chatbot" className="fm-live-action fm-live-action-primary" onClick={() => saveExpressionContext(NEO_CONTEXT_KEY)}>
            <MessageCircle className="h-4 w-4" />
            Neo
          </Link>
        </div>
      </div>
    </article>
  );
}

function StatCard({ label, value, change, icon: Icon, tone, index }) {
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
          <Icon className="h-5 w-5" />
        </span>
      </div>
      <p className="fm-subtle mt-4 text-xs font-medium">{change}</p>
    </article>
  );
}

function GoalCard({ message, brainState }) {
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
              <span>Study 30 expressions</span>
              <span className="fm-secondary">21 / 30</span>
            </div>
            <div className="fm-progress-track mt-3 h-3 overflow-hidden rounded-full">
              <div className="fm-progress-fill h-full w-[70%] rounded-full" />
            </div>
          </div>
        </div>

        <BrainCompanion state={brainState} level={mockUserContext.brainLevel} streakDays={mockUserContext.streakDays} size="md" showLabel />
      </div>
    </article>
  );
}

function StreakCard() {
  return (
    <article className="fm-card rounded-[30px] border p-6 shadow-md backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="fm-muted text-sm font-semibold">Your Streak</p>
          <p className="mt-3 text-5xl font-semibold tracking-tight">7</p>
          <p className="fm-warning mt-1 text-sm">days thinking in English</p>
        </div>
        <span className="fm-warning-chip flex h-14 w-14 items-center justify-center rounded-3xl">
          <Zap className="h-7 w-7" />
        </span>
      </div>
      <div className="mt-7 grid grid-cols-7 gap-2">
        {weekDays.map((day, index) => (
          <div key={`${day}-${index}`} className="flex flex-col items-center gap-2">
            <span className="fm-subtle text-xs font-semibold">{day}</span>
            <span className="fm-check flex h-8 w-8 items-center justify-center rounded-full shadow-sm">
              <Check className="h-4 w-4" />
            </span>
          </div>
        ))}
      </div>
      <div className="fm-inner mt-5 rounded-2xl border p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-semibold">Next reward</span>
          <span className="fm-chip rounded-full border px-2.5 py-1 text-[11px] font-semibold">Level 4</span>
        </div>
        <div className="fm-progress-track mt-3 h-2 rounded-full">
          <div className="fm-progress-fill h-full w-[72%] rounded-full" />
        </div>
      </div>
    </article>
  );
}

function SmartDailyPlan() {
  return (
    <article className="fm-card rounded-[30px] border p-5 shadow-md backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="fm-muted text-sm font-semibold">Smart Daily Plan</p>
          <h2 className="mt-2 text-xl font-semibold">Estimated 24 min</h2>
        </div>
        <CalendarCheck2 className="fm-secondary h-5 w-5" />
      </div>
      <div className="mt-5 space-y-3">
        {dailyPlan.map((item) => (
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

function RecentExpressionList() {
  return (
    <article className="fm-card rounded-[30px] border p-6 shadow-md backdrop-blur-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Recent Expressions</h2>
          <p className="fm-subtle mt-1 text-sm">Saved from conversations and corrections.</p>
        </div>
        <Link to="/biblioteca" className="fm-secondary inline-flex items-center gap-1 text-xs font-semibold hover:brightness-125">
          View all <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="mt-5 space-y-3">
        {recentExpressions.map((item) => (
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
                <span className="fm-subtle text-[11px] font-semibold">{item.mastery}% mastery</span>
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
        ))}
      </div>
    </article>
  );
}

function ProgressCard() {
  return (
    <article className="fm-card rounded-[30px] border p-6 shadow-md backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Your Progress</h2>
          <p className="fm-subtle mt-1 text-sm">Weekly consistency and FluentMind Score.</p>
        </div>
        <div className="fm-success-chip rounded-2xl border px-4 py-3 text-right">
          <p className="text-xs font-semibold">Score</p>
          <p className="text-2xl font-semibold">86</p>
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
        <ProgressPill icon={BookMarked} label="Words learned" value="312" />
        <ProgressPill icon={Headphones} label="Listening min" value="148" />
        <ProgressPill icon={MessageCircle} label="Talk min" value="96" />
        <ProgressPill icon={Brain} label="Mastered" value="64" />
      </div>
    </article>
  );
}

function ProgressPill({ icon: Icon, label, value }) {
  return (
    <div className="fm-inner rounded-2xl border p-4">
      <Icon className="fm-secondary h-4 w-4" />
      <p className="mt-3 text-xl font-semibold">{value}</p>
      <p className="fm-subtle mt-1 text-xs">{label}</p>
    </div>
  );
}

function QuickActions() {
  return (
    <article className="fm-card rounded-[30px] border p-6 shadow-md backdrop-blur-xl">
      <h2 className="text-lg font-semibold">Quick Actions</h2>
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
