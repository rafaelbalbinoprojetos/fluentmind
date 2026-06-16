import React, { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Clock3,
  Code2,
  Film,
  Gamepad2,
  GraduationCap,
  MessageCircle,
  Plane,
  Rocket,
  Sparkles,
  Target,
  UserRound,
  Volume2,
} from "lucide-react";
import BrainCompanion from "../BrainCompanion.jsx";

export const ONBOARDING_COMPLETED_KEY = "fluentmind_onboarding_completed";
export const ONBOARDING_PROFILE_KEY = "fluentmind_onboarding_profile";
export const FIRST_DASHBOARD_EXPERIENCE_KEY = "fluentmind_first_dashboard_experience";

const goals = [
  { value: "Work", icon: BriefcaseBusiness, detail: "Meetings. Emails. Interviews. Professional conversations." },
  { value: "Travel", icon: Plane, detail: "Order food. Ask directions. Travel confidently." },
  { value: "Programming", icon: Code2, detail: "Learn documentation. Talk with international developers. Work remotely." },
  { value: "Games", icon: Gamepad2, detail: "Understand dialogues. Play without subtitles. Chat with players." },
  { value: "Movies & Series", icon: Film, detail: "Watch without translation. Understand jokes. Think naturally." },
  { value: "Conversations", icon: MessageCircle, detail: "Answer faster. Stop freezing. Build natural responses." },
  { value: "Study", icon: GraduationCap, detail: "Read material. Follow classes. Prepare for opportunities." },
  { value: "Personal growth", icon: UserRound, detail: "Expand your world. Think with more freedom." },
];

const dailyTimes = [
  { value: "10 min", detail: "Slow but consistent", estimate: "≈ 2 years" },
  { value: "20 min", detail: "Balanced learning", estimate: "≈ 1 year" },
  { value: "30 min", detail: "Accelerated progress", estimate: "≈ 8 months" },
  { value: "1 hour", detail: "Fast Track", estimate: "Best option", featured: true },
];

const difficulties = [
  { value: "Speaking", icon: MessageCircle },
  { value: "Listening", icon: Volume2 },
  { value: "Grammar", icon: GraduationCap },
  { value: "Vocabulary", icon: Sparkles },
  { value: "Pronunciation", icon: UserRound },
  { value: "I don't know where to start", icon: Sparkles },
];

const totalSteps = 5;

const initialProfile = {
  goals: [],
  dailyTime: "",
  difficulties: [],
};

export default function OnboardingPage({ onComplete }) {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState(initialProfile);
  const [isTransitioningStep, setIsTransitioningStep] = useState(false);
  const [isBuildingPath, setIsBuildingPath] = useState(false);

  const selectedGoalLabel = profile.goals[0] ?? "Build natural English confidence";
  const selectedDifficultyLabel = profile.difficulties[0] ?? "Start with guided practice";
  const selectedTimeLabel = profile.dailyTime || "20 min";

  const canContinue = useMemo(() => {
    if (step === 1) return true;
    if (step === 2) return profile.goals.length > 0;
    if (step === 3) return Boolean(profile.dailyTime);
    if (step === 4) return profile.difficulties.length > 0;
    return true;
  }, [profile, step]);

  const toggleGoal = (value) => {
    setProfile((current) => {
      const exists = current.goals.includes(value);
      return {
        ...current,
        goals: exists ? current.goals.filter((item) => item !== value) : [...current.goals, value],
      };
    });
  };

  const toggleDifficulty = (value) => {
    setProfile((current) => {
      const exists = current.difficulties.includes(value);
      return {
        ...current,
        difficulties: exists
          ? current.difficulties.filter((item) => item !== value)
          : [...current.difficulties, value],
      };
    });
  };

  const finishOnboarding = () => {
    const completedProfile = {
      ...profile,
      suggestedPlan: [
        "Review 8 expressions",
        "Practice listening for 5 minutes",
        "Have one short conversation with Neo",
        "Save 3 useful expressions",
      ],
      completedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(ONBOARDING_COMPLETED_KEY, "true");
    window.localStorage.setItem(ONBOARDING_PROFILE_KEY, JSON.stringify(completedProfile));
    window.localStorage.setItem(FIRST_DASHBOARD_EXPERIENCE_KEY, "true");
    setIsBuildingPath(true);

    window.setTimeout(() => {
      onComplete?.(completedProfile);
    }, 2100);
  };

  const goNext = () => {
    if (!canContinue) return;
    if (step === totalSteps) {
      finishOnboarding();
      return;
    }

    setIsTransitioningStep(true);
    window.setTimeout(() => {
      setStep((current) => Math.min(totalSteps, current + 1));
      setIsTransitioningStep(false);
    }, 650);
  };

  if (isBuildingPath) {
    return <PathBuildingTransition />;
  }

  return (
    <main className="fm-gradient-soft relative min-h-[calc(100vh-11rem)] overflow-hidden rounded-[28px] border px-4 py-6 shadow-lg sm:px-6 lg:px-8">
      <OnboardingAtmosphere />

      <div className={`relative z-10 mx-auto flex min-h-[calc(100vh-14rem)] max-w-6xl flex-col transition duration-700 ${isTransitioningStep ? "scale-[0.985] opacity-0" : "scale-100 opacity-100"}`}>
        <OnboardingProgress step={step} totalSteps={totalSteps} />

        <section className="flex flex-1 items-center justify-center py-8">
          {step === 1 ? <WelcomeStep /> : null}
          {step === 2 ? (
            <OnboardingStep
              eyebrow="Your motivation"
              title="Why do you want to learn English?"
              subtitle="Your learning path should fit your real life. Not someone else's."
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {goals.map((goal) => (
                  <OptionCard
                    key={goal.value}
                    icon={goal.icon}
                    label={goal.value}
                    description={goal.detail}
                    selected={profile.goals.includes(goal.value)}
                    onClick={() => toggleGoal(goal.value)}
                  />
                ))}
              </div>
            </OnboardingStep>
          ) : null}
          {step === 3 ? (
            <OnboardingStep
              eyebrow="Your rhythm"
              title="How much time do you have every day?"
              subtitle="No random lessons. Only what matters to you."
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {dailyTimes.map((time) => (
                  <OptionCard
                    key={time.value}
                    icon={time.featured ? Rocket : Clock3}
                    label={time.value}
                    description={time.detail}
                    meta={time.estimate}
                    selected={profile.dailyTime === time.value}
                    onClick={() => setProfile((current) => ({ ...current, dailyTime: time.value }))}
                  />
                ))}
              </div>
              <p className="fm-muted mt-6 text-center text-sm font-medium">Consistency matters more than intensity.</p>
            </OnboardingStep>
          ) : null}
          {step === 4 ? (
            <OnboardingStep
              eyebrow="Your challenge"
              title="What's your biggest challenge?"
              subtitle="We'll adapt your journey to overcome it."
            >
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {difficulties.map((difficulty) => (
                  <OptionCard
                    key={difficulty.value}
                    icon={difficulty.icon}
                    label={difficulty.value}
                    selected={profile.difficulties.includes(difficulty.value)}
                    onClick={() => toggleDifficulty(difficulty.value)}
                  />
                ))}
              </div>
            </OnboardingStep>
          ) : null}
          {step === 5 ? (
            <OnboardingSummary
              mainGoal={selectedGoalLabel}
              dailyTime={selectedTimeLabel}
              difficulty={selectedDifficultyLabel}
            />
          ) : null}
        </section>

        <footer className="flex flex-col-reverse gap-3 border-t border-[var(--border-soft)] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            disabled={step === 1}
            className="fm-ghost-button inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-30"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <button
            type="button"
            onClick={goNext}
            disabled={!canContinue}
            className="fm-gradient inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-md transition hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-50"
          >
            {step === 1 ? "Start my journey" : step === totalSteps ? "Build my first MindBlock" : "Continue"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </footer>
      </div>
    </main>
  );
}

function OnboardingAtmosphere() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="fm-neural-grid absolute inset-0 opacity-70" />
      <div className="fm-neural-line left-[10%] top-[18%] w-48 rotate-12" />
      <div className="fm-neural-line right-[10%] top-[40%] w-56 -rotate-12" />
      <div className="fm-neural-line bottom-[20%] left-[28%] w-52 rotate-6" />
      {Array.from({ length: 16 }).map((_, index) => (
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className="fm-particle"
          style={{
            left: `${6 + ((index * 19) % 88)}%`,
            top: `${8 + ((index * 29) % 80)}%`,
            animationDelay: `${index * 0.32}s`,
          }}
        />
      ))}
    </div>
  );
}

function OnboardingProgress({ step, totalSteps }) {
  const percentage = (step / totalSteps) * 100;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="fm-muted flex items-center justify-between text-xs font-semibold">
        <span>Welcome to FluentMind</span>
        <span>
          Step {step} of {totalSteps}
        </span>
      </div>
      <div className="fm-progress-track mt-3 h-2 overflow-hidden rounded-full">
        <div className="fm-progress-fill h-full rounded-full transition-all duration-300" style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}

function WelcomeStep() {
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-8 lg:grid-cols-[1fr,320px] lg:items-center">
      <div>
        <div className="fm-chip inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
          <Sparkles className="h-3.5 w-3.5" />
          Personalized AI path
        </div>
        <h1 className="mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
          <span className="inline-block">🧠</span> Welcome to FluentMind
        </h1>
        <p className="fm-secondary mt-4 max-w-xl text-2xl font-semibold leading-tight">
          Stop translating.
          <br />
          Start thinking.
        </p>
        <p className="fm-muted mt-5 max-w-2xl text-base leading-7">
          You&apos;re about to build a language learning experience created exclusively for you.
        </p>
        <p className="fm-muted mt-4 max-w-2xl text-sm leading-7">
          No random lessons. No endless grammar. Only real conversations and mental blocks that become natural over time.
        </p>
      </div>

      <BrainCompanion state="returning" level={10} streakDays={7} size="lg" showLabel />
    </div>
  );
}

function OnboardingStep({ eyebrow, title, subtitle, children }) {
  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mx-auto max-w-2xl text-center">
        <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        <p className="fm-muted mt-3 text-sm sm:text-base">{subtitle}</p>
      </div>
      <div className="mt-8">{children}</div>
    </div>
  );
}

function OptionCard({ icon: Icon, label, description, meta, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative min-h-32 overflow-hidden rounded-3xl border p-5 text-left shadow-sm backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:scale-[1.01] hover:shadow-md ${
        selected ? "fm-option-selected" : "fm-card"
      }`}
    >
      {selected ? <span className="fm-selection-spark" /> : null}
      <div className="flex items-start justify-between gap-4">
        <span className="fm-chip flex h-12 w-12 items-center justify-center rounded-2xl border-0 transition group-hover:scale-105">
          <Icon className="h-5 w-5" />
        </span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-full border ${selected ? "fm-check" : "fm-inner"}`}>
          {selected ? <Check className="h-4 w-4" /> : null}
        </span>
      </div>
      <p className="mt-5 text-base font-semibold">{label}</p>
      {description ? <p className={`fm-muted mt-2 text-xs leading-5 transition ${selected ? "opacity-100" : "opacity-70"}`}>{description}</p> : null}
      {meta ? <p className="fm-secondary mt-3 text-xs font-semibold">{meta}</p> : null}
    </button>
  );
}

function OnboardingSummary({ mainGoal, dailyTime, difficulty }) {
  const plan = [
    "Review 8 expressions",
    "Practice listening for 5 minutes",
    "Have one short conversation with Neo",
    "Save 3 useful expressions",
  ];

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[0.9fr,1.1fr] lg:items-stretch">
      <article className="fm-card rounded-[30px] border p-6 shadow-lg backdrop-blur-xl">
        <div className="fm-chip inline-flex h-12 w-12 items-center justify-center rounded-2xl border-0">
          <Target className="h-5 w-5" />
        </div>
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">🧠 Neo analyzed your answers.</h1>
        <p className="fm-muted mt-3 text-sm leading-6">
          Based on your goals, FluentMind created a personalized learning journey designed just for you.
        </p>
        <p className="fm-secondary mt-6 text-sm font-semibold leading-6">
          Remember: You don&apos;t become fluent by memorizing. You become fluent by thinking.
        </p>
      </article>

      <article className="fm-card rounded-[30px] border p-6 shadow-lg backdrop-blur-xl">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryItem label="Main goal" value={mainGoal} />
          <SummaryItem label="Daily time" value={dailyTime} />
          <SummaryItem label="Main challenge" value={difficulty} />
          <SummaryItem label="Estimated journey" value={getJourneyEstimate(dailyTime)} />
          <SummaryItem label="Confidence score" value="86%" />
        </div>

        <div className="fm-inner mt-5 rounded-2xl border p-5">
          <p className="text-sm font-semibold">Suggested daily plan</p>
          <div className="mt-4 space-y-3">
            {plan.map((item) => (
              <div key={item} className="flex items-center gap-3">
                <span className="fm-check flex h-6 w-6 shrink-0 items-center justify-center rounded-full">
                  <Check className="h-3.5 w-3.5" />
                </span>
                <span className="fm-muted text-sm">{item}</span>
              </div>
            ))}
          </div>
          <p className="fm-secondary mt-5 text-sm font-semibold">Estimated time: {dailyTime}</p>
        </div>
      </article>
    </div>
  );
}

function getJourneyEstimate(dailyTime) {
  const match = dailyTimes.find((item) => item.value === dailyTime);
  return match?.estimate ?? "≈ 1 year";
}

function PathBuildingTransition() {
  const checklist = [
    "Understanding your goals",
    "Creating your first playlists",
    "Preparing your AI coach",
    "Organizing your review system",
    "Activating MindBlocks™",
  ];

  return (
    <main className="fm-gradient-soft relative flex min-h-[calc(100vh-11rem)] items-center justify-center overflow-hidden rounded-[28px] border px-4 py-10 shadow-lg">
      <OnboardingAtmosphere />
      <section className="relative z-10 mx-auto w-full max-w-xl text-center">
        <BrainCompanion state="goal-complete" level={10} streakDays={7} size="sm" />
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">Building your personalized learning path...</h1>
        <div className="mt-7 space-y-3 text-left">
          {checklist.map((item, index) => (
            <div key={item} className="fm-inner fm-checklist-item flex items-center gap-3 rounded-2xl border p-3" style={{ animationDelay: `${index * 220}ms` }}>
              <span className="fm-check flex h-7 w-7 shrink-0 items-center justify-center rounded-full">
                <Check className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold">{item}</span>
            </div>
          ))}
        </div>
        <div className="fm-progress-track mt-7 h-2 overflow-hidden rounded-full">
          <div className="fm-loading-fill h-full rounded-full" />
        </div>
      </section>
    </main>
  );
}

function SummaryItem({ label, value }) {
  return (
    <div className="fm-inner rounded-2xl border p-4">
      <p className="fm-subtle text-xs font-semibold uppercase tracking-[0.14em]">{label}</p>
      <p className="mt-2 text-sm font-semibold">{value}</p>
    </div>
  );
}
