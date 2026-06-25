import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowRight,
  Brain,
  Check,
  Clock3,
  Headphones,
  MessageCircle,
  RotateCcw,
  Send,
  Trophy,
  Volume2,
  Zap,
} from "lucide-react";
import { Link } from "react-router-dom";
import NeuralBrain from "../components/NeuralBrain.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import useProgression from "../hooks/useProgression.js";
import { generateMindBlockAudio } from "../services/mindblockAudio.js";
import { listMindBlocks, updateMindBlock } from "../services/mindblocks.js";
import { createReviewEvent } from "../services/reviewEvents.js";
import { recordLearningEvent } from "../services/learningEventEngine.js";
import { trackProgressionAction } from "../services/progressionEngine.js";

const FALLBACK_DECK = [
  {
    id: "fallback-looking-forward",
    expression: "I'm looking forward to it.",
    translation: "Estou ansioso por isso.",
    category: "Daily Fluency",
    mastery: 20,
    timesReviewed: 0,
    examples: ["I'm looking forward to the meeting.", "I'm looking forward to learning more English."],
    isFallback: true,
  },
  {
    id: "fallback-used-to",
    expression: "I'm getting used to it.",
    translation: "Estou me acostumando com isso.",
    category: "Daily Fluency",
    mastery: 25,
    timesReviewed: 0,
    examples: ["I'm getting used to speaking English every day."],
    isFallback: true,
  },
  {
    id: "fallback-let-me-think",
    expression: "Let me think it through.",
    translation: "Deixa eu pensar melhor sobre isso.",
    category: "Conversation",
    mastery: 10,
    timesReviewed: 0,
    examples: ["Let me think it through before I answer."],
    isFallback: true,
  },
];

const WORKOUT_STEPS = [
  { id: "warmup", label: "Warmup", icon: Brain },
  { id: "review", label: "Review", icon: RotateCcw },
  { id: "listen", label: "Listen", icon: Headphones },
  { id: "challenge", label: "Challenge", icon: MessageCircle },
  { id: "complete", label: "Complete", icon: Trophy },
];

function selectDeck(items) {
  const now = Date.now();
  const sorted = [...items].sort((a, b) => {
    const aDue = a.nextReviewAtRaw ? new Date(a.nextReviewAtRaw).getTime() : now;
    const bDue = b.nextReviewAtRaw ? new Date(b.nextReviewAtRaw).getTime() : now;
    const aIsDue = a.isReviewDue || a.status === "review_due" || aDue <= now;
    const bIsDue = b.isReviewDue || b.status === "review_due" || bDue <= now;
    if (aIsDue !== bIsDue) return aIsDue ? -1 : 1;
    return (a.mastery ?? 0) - (b.mastery ?? 0);
  });

  const deck = sorted.slice(0, 3);
  return deck.length ? deck : FALLBACK_DECK;
}

function normalizeAnswer(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildChallenge(deck) {
  const source = deck.find((item) => !item.isFallback) || deck[0] || FALLBACK_DECK[0];
  const expression = source.expression || FALLBACK_DECK[0].expression;
  const firstTwoWords = expression.split(/\s+/).slice(0, 2).join(" ");

  return {
    source,
    prompt: `Create one sentence using "${firstTwoWords}".`,
    helper: "Use a real detail from your day. Short and natural is enough.",
    expectedPattern: firstTwoWords,
  };
}

export default function DailyWorkoutPage() {
  const { user, session } = useAuth();
  const progression = useProgression();
  const [deck, setDeck] = useState(FALLBACK_DECK);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [audioLoadingId, setAudioLoadingId] = useState(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [reviewedIds, setReviewedIds] = useState([]);
  const [listenedIds, setListenedIds] = useState([]);
  const [challengeAnswer, setChallengeAnswer] = useState("");
  const [challengeResult, setChallengeResult] = useState(null);
  const [sessionComplete, setSessionComplete] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadDeck() {
      if (!user?.id) {
        setDeck(FALLBACK_DECK);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const mindBlocks = await listMindBlocks(user.id);
        if (!cancelled) {
          setDeck(selectDeck(mindBlocks));
        }
      } catch (error) {
        console.error("Erro ao carregar Daily Brain Workout:", error);
        if (!cancelled) {
          setDeck(FALLBACK_DECK);
          toast.error("Nao foi possivel carregar seus MindBlocks. Usando treino demonstrativo.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadDeck();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const currentStep = WORKOUT_STEPS[stepIndex] ?? WORKOUT_STEPS[0];
  const challenge = useMemo(() => buildChallenge(deck), [deck]);
  const reviewedCount = reviewedIds.length;
  const listenedCount = listenedIds.length;
  const progress = Math.round(
    ((Math.min(reviewedCount, 3) + Math.min(listenedCount, 1) + (challengeResult?.passed ? 1 : 0) + (sessionComplete ? 1 : 0)) / 6) * 100,
  );
  const activeCard = deck.find((item) => !reviewedIds.includes(item.id)) || deck[0] || FALLBACK_DECK[0];
  const listenCard = deck.find((item) => !listenedIds.includes(item.id)) || deck[0] || FALLBACK_DECK[0];

  const goToStep = (id) => {
    const index = WORKOUT_STEPS.findIndex((step) => step.id === id);
    if (index >= 0) setStepIndex(index);
  };

  const handleReview = async (card, result = "good") => {
    if (!card) return;
    setSaving(true);
    try {
      if (!card.isFallback) {
        const nextDays = result === "easy" ? 5 : result === "hard" ? 1 : 2;
        const nextReviewAt = new Date(Date.now() + nextDays * 24 * 60 * 60 * 1000).toISOString();
        await Promise.all([
          updateMindBlock(card.id, {
            mastery: Math.min(100, (card.mastery ?? 0) + (result === "easy" ? 16 : result === "hard" ? 6 : 10)),
            timesReviewed: (card.timesReviewed ?? 0) + 1,
            lastReviewedAt: new Date().toISOString(),
            nextReviewAt,
          }),
          createReviewEvent({
            userId: user.id,
            mindBlockId: card.id,
            result,
            expectedText: card.expression,
          }),
        ]);
      }

      setReviewedIds((current) => [...new Set([...current, card.id])]);
      trackProgressionAction("completeReviewCard", { reason: "Daily Brain Workout review", category: card.category });
      recordLearningEvent("review_completed", {
        expression: card.expression,
        translation: card.translation,
        category: card.category,
        result,
        source: "daily_workout",
      }, "daily_workout");
      toast.success("+10 XP - Review strengthened");

      if (reviewedIds.length + 1 >= Math.min(3, deck.length)) {
        goToStep("listen");
      }
    } catch (error) {
      console.error("Erro ao revisar no Daily Workout:", error);
      toast.error("Nao foi possivel registrar a revisao.");
    } finally {
      setSaving(false);
    }
  };

  const handleListen = async (card) => {
    if (!card) return;
    setAudioLoadingId(card.id);
    try {
      if (!card.isFallback && session?.access_token) {
        const result = await generateMindBlockAudio({
          mindblockId: card.id,
          voice: user?.user_metadata?.preferred_voice || "mineirinha",
          accessToken: session.access_token,
        });
        if (result?.audioUrl) {
          const audio = new Audio(result.audioUrl);
          await audio.play();
        }
      } else if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(card.expression));
      }

      setListenedIds((current) => [...new Set([...current, card.id])]);
      trackProgressionAction("generateAudio", { reason: "Daily Brain Workout listening", category: card.category });
      recordLearningEvent("audio_generated", {
        expression: card.expression,
        category: card.category,
        source: "daily_workout",
      }, "daily_workout");
      toast.success("+2 XP - Listening path reinforced");
      goToStep("challenge");
    } catch (error) {
      console.error("Erro ao tocar audio do Daily Workout:", error);
      toast.error("Nao foi possivel tocar o audio agora.");
    } finally {
      setAudioLoadingId(null);
    }
  };

  const handleCheckChallenge = () => {
    const normalized = normalizeAnswer(challengeAnswer);
    const expected = normalizeAnswer(challenge.expectedPattern);
    const passed = normalized.length >= 12 && expected.split(" ").every((part) => normalized.includes(part));

    setChallengeResult({
      passed,
      message: passed
        ? "Great. You used the structure in a natural sentence."
        : `Try again using "${challenge.expectedPattern}" inside a complete sentence.`,
    });

    if (passed) {
      trackProgressionAction("practicePronunciation", { reason: "Daily Brain Workout challenge", category: challenge.source.category });
      recordLearningEvent("practice_completed", {
        prompt: challenge.prompt,
        answer: challengeAnswer,
        expression: challenge.source.expression,
        category: challenge.source.category,
        source: "daily_workout",
      }, "daily_workout");
      toast.success("+5 XP - Practice completed");
    }
  };

  const handleCompleteSession = () => {
    trackProgressionAction("completeReviewSession", { reason: "Daily Brain Workout completed" });
    recordLearningEvent("daily_workout_completed", {
      reviewed: reviewedCount,
      listened: listenedCount,
      challengePassed: Boolean(challengeResult?.passed),
      xp: 25,
    }, "daily_workout");
    setSessionComplete(true);
    goToStep("complete");
    toast.success("Daily Brain Workout complete");
  };

  return (
    <div className="min-h-screen bg-[var(--bg-main)] px-3 py-4 text-[var(--text-primary)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <section className="fm-card overflow-hidden rounded-[32px] border p-5 shadow-2xl sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">Daily Brain Workout</p>
              <h1 className="mt-3 text-3xl font-black leading-tight sm:text-5xl">Train one fluent path today.</h1>
              <p className="fm-muted mt-4 max-w-2xl text-base leading-7 sm:text-lg">
                A short guided session with review, listening, practice and XP. Your dashboard shows progress. This page turns it into action.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <WorkoutMetric label="Level" value={progression.currentLevel} />
                <WorkoutMetric label="XP" value={progression.totalXp} />
                <WorkoutMetric label="Streak" value={`${progression.streak} days`} />
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="fm-muted font-semibold">Workout Progress</span>
                  <span className="font-black">{progress}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-black/20 dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 via-cyan-400 to-emerald-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <NeuralBrain
                level={progression.currentLevel}
                xp={progression.totalXp}
                nextLevelXp={progression.xpToNextLevel}
                nodes={Math.max(12, deck.length * 8)}
                connections={Math.max(24, deck.length * 18 + progress)}
                mastery={progress}
                size={300}
                mood={sessionComplete ? "celebrating" : progress >= 60 ? "focused" : "calm"}
                mode="hero"
                showStats={false}
              />
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[280px_1fr_320px]">
          <aside className="fm-card rounded-[28px] border p-4">
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-[var(--text-muted)]">Session Path</h2>
            <div className="mt-4 space-y-2">
              {WORKOUT_STEPS.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => setStepIndex(index)}
                  className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                    index === stepIndex ? "border-cyan-400/60 bg-cyan-400/10" : "border-[var(--border-soft)] bg-transparent hover:bg-white/5"
                  }`}
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-500/15 text-cyan-300">
                    <step.icon className="h-4 w-4" />
                  </span>
                  <span>
                    <strong className="block text-sm">{step.label}</strong>
                    <small className="fm-muted">Step {index + 1}</small>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          <main className="fm-card min-h-[520px] rounded-[32px] border p-5 sm:p-7">
            {loading ? (
              <WorkoutEmpty title="Preparing your workout..." description="Loading the strongest MindBlocks for today." />
            ) : currentStep.id === "warmup" ? (
              <WarmupStep deck={deck} onStart={() => goToStep("review")} />
            ) : currentStep.id === "review" ? (
              <ReviewStep
                card={activeCard}
                reviewedCount={reviewedCount}
                total={Math.min(3, deck.length)}
                saving={saving}
                onReview={handleReview}
              />
            ) : currentStep.id === "listen" ? (
              <ListenStep card={listenCard} loading={audioLoadingId === listenCard?.id} onListen={handleListen} />
            ) : currentStep.id === "challenge" ? (
              <ChallengeStep
                challenge={challenge}
                answer={challengeAnswer}
                result={challengeResult}
                onAnswer={setChallengeAnswer}
                onCheck={handleCheckChallenge}
                onComplete={handleCompleteSession}
              />
            ) : (
              <CompleteStep reviewed={reviewedCount} listened={listenedCount} challengePassed={challengeResult?.passed} />
            )}
          </main>

          <aside className="space-y-5">
            <section className="fm-card rounded-[28px] border p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="fm-muted text-xs font-bold uppercase tracking-[0.16em]">Today's reward</p>
                  <h2 className="mt-2 text-2xl font-black">Up to 42 XP</h2>
                </div>
                <Zap className="h-8 w-8 text-cyan-300" />
              </div>
              <div className="mt-5 space-y-3 text-sm">
                <RewardLine label="Review 3 cards" value="+30 XP" done={reviewedCount >= Math.min(3, deck.length)} />
                <RewardLine label="Listen once" value="+2 XP" done={listenedCount > 0} />
                <RewardLine label="Practice challenge" value="+5 XP" done={Boolean(challengeResult?.passed)} />
                <RewardLine label="Finish session" value="+25 XP" done={sessionComplete} />
              </div>
            </section>

            <section className="fm-card rounded-[28px] border p-5">
              <h2 className="text-lg font-black">Workout Deck</h2>
              <div className="mt-4 space-y-3">
                {deck.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-[var(--border-soft)] bg-white/[0.03] p-3">
                    <strong className="block text-sm">{item.expression}</strong>
                    <span className="fm-muted mt-1 block text-xs">{item.translation}</span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </section>
      </div>
    </div>
  );
}

function WorkoutMetric({ label, value }) {
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-white/[0.04] p-4">
      <span className="fm-muted text-xs font-bold uppercase tracking-[0.14em]">{label}</span>
      <strong className="mt-2 block text-2xl font-black">{value}</strong>
    </div>
  );
}

function WorkoutEmpty({ title, description }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
      <Brain className="h-12 w-12 text-cyan-300" />
      <h2 className="mt-5 text-2xl font-black">{title}</h2>
      <p className="fm-muted mt-2 max-w-md">{description}</p>
    </div>
  );
}

function WarmupStep({ deck, onStart }) {
  return (
    <div>
      <StepHeader eyebrow="Warmup" title="Your brain will train these expressions today." description="One short loop: review, listen, answer and complete." />
      <div className="mt-7 grid gap-4 md:grid-cols-3">
        {deck.map((item) => (
          <article
            key={item.id}
            className="rounded-[26px] border border-[var(--border-soft)] bg-white/[0.04] p-5"
          >
            <span className="fm-chip inline-flex rounded-full px-3 py-1 text-xs font-bold">{item.category}</span>
            <h3 className="mt-5 text-xl font-black">{item.expression}</h3>
            <p className="fm-muted mt-2 text-sm">{item.translation}</p>
          </article>
        ))}
      </div>
      <button type="button" onClick={onStart} className="fm-primary-button mt-8 inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-black">
        Start workout <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function ReviewStep({ card, reviewedCount, total, saving, onReview }) {
  return (
    <div>
      <StepHeader eyebrow="Smart Review" title={`How do you say this in English?`} description={card.translation || "Review the expression before moving forward."} />
      <div className="mt-7 rounded-[30px] border border-cyan-400/20 bg-cyan-400/[0.06] p-6">
        <p className="fm-muted text-sm font-bold uppercase tracking-[0.16em]">Answer</p>
        <h3 className="mt-4 text-3xl font-black">{card.expression}</h3>
        {card.examples?.length ? (
          <div className="mt-5 space-y-2">
            {card.examples.slice(0, 2).map((example) => (
              <p key={example} className="rounded-2xl border border-[var(--border-soft)] bg-black/10 p-3 text-sm dark:bg-white/[0.03]">{example}</p>
            ))}
          </div>
        ) : null}
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <button type="button" disabled={saving} onClick={() => onReview(card, "hard")} className="fm-ghost-button rounded-2xl px-5 py-3 font-black">Hard</button>
        <button type="button" disabled={saving} onClick={() => onReview(card, "good")} className="fm-primary-button rounded-2xl px-5 py-3 font-black">Good</button>
        <button type="button" disabled={saving} onClick={() => onReview(card, "easy")} className="fm-ghost-button rounded-2xl px-5 py-3 font-black">Easy</button>
      </div>
      <p className="fm-muted mt-5 text-sm">{reviewedCount}/{total} cards reviewed in this workout.</p>
    </div>
  );
}

function ListenStep({ card, loading, onListen }) {
  return (
    <div>
      <StepHeader eyebrow="Listening Path" title="Hear one expression before practicing." description="Your pronunciation improves when the sound becomes familiar." />
      <div className="mt-7 rounded-[30px] border border-violet-400/25 bg-violet-500/[0.08] p-7">
        <Volume2 className="h-10 w-10 text-cyan-300" />
        <h3 className="mt-5 text-4xl font-black">{card.expression}</h3>
        <p className="fm-muted mt-3 text-lg">{card.translation}</p>
      </div>
      <button type="button" disabled={loading} onClick={() => onListen(card)} className="fm-primary-button mt-7 inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-black">
        <Headphones className="h-4 w-4" /> {loading ? "Generating audio..." : "Listen and continue"}
      </button>
    </div>
  );
}

function ChallengeStep({ challenge, answer, result, onAnswer, onCheck, onComplete }) {
  return (
    <div>
      <StepHeader eyebrow="Practice Challenge" title={challenge.prompt} description={challenge.helper} />
      <div className="mt-7 rounded-[30px] border border-[var(--border-soft)] bg-white/[0.04] p-5">
        <textarea
          value={answer}
          onChange={(event) => onAnswer(event.target.value)}
          rows={5}
          className="w-full resize-none rounded-3xl border border-[var(--border-soft)] bg-[var(--input-bg)] p-4 text-base font-semibold text-[var(--text-primary)] outline-none focus:border-cyan-300"
          placeholder="Example: I'm looking forward to practicing English today."
        />
        <div className="mt-4 flex flex-wrap gap-3">
          <button type="button" onClick={onCheck} className="fm-primary-button inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-black">
            <Send className="h-4 w-4" /> Check
          </button>
          <Link to="/chatbot" className="fm-ghost-button inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-black">
            Practice with Neo
          </Link>
        </div>
      </div>
      {result ? (
        <div className={`mt-5 rounded-3xl border p-5 ${result.passed ? "border-emerald-400/40 bg-emerald-400/10" : "border-amber-400/40 bg-amber-400/10"}`}>
          <strong>{result.passed ? "Challenge passed" : "Almost there"}</strong>
          <p className="mt-2 text-sm">{result.message}</p>
          {result.passed ? (
            <button type="button" onClick={onComplete} className="fm-primary-button mt-4 inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-black">
              Complete workout <Trophy className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CompleteStep({ reviewed, listened, challengePassed }) {
  return (
    <div className="flex min-h-[420px] flex-col items-center justify-center text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-gradient-to-br from-violet-500 to-cyan-400 text-white shadow-2xl shadow-cyan-500/20">
        <Trophy className="h-9 w-9" />
      </div>
      <h2 className="mt-6 text-4xl font-black">Session complete</h2>
      <p className="fm-muted mt-3 max-w-xl text-lg">Your brain has one stronger path today. Keep this loop small, consistent and repeatable.</p>
      <div className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-3">
        <WorkoutMetric label="Reviewed" value={reviewed} />
        <WorkoutMetric label="Listened" value={listened} />
        <WorkoutMetric label="Challenge" value={challengePassed ? "Done" : "Open"} />
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/insights" className="fm-primary-button rounded-2xl px-5 py-3 font-black">Review more</Link>
        <Link to="/neural-universe" className="fm-ghost-button rounded-2xl px-5 py-3 font-black">Open Neural Universe</Link>
      </div>
    </div>
  );
}

function StepHeader({ eyebrow, title, description }) {
  return (
    <header>
      <p className="fm-accent text-xs font-bold uppercase tracking-[0.18em]">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">{title}</h2>
      <p className="fm-muted mt-3 max-w-2xl text-base leading-7">{description}</p>
    </header>
  );
}

function RewardLine({ label, value, done }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-soft)] bg-white/[0.03] px-3 py-3">
      <span className="flex items-center gap-2">
        {done ? <Check className="h-4 w-4 text-emerald-300" /> : <Clock3 className="h-4 w-4 text-[var(--text-muted)]" />}
        {label}
      </span>
      <strong className={done ? "text-emerald-300" : "text-cyan-300"}>{value}</strong>
    </div>
  );
}
