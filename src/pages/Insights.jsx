import React, { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Brain, Check, Eye, Headphones, RotateCcw, Sparkles, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { listMindBlocks, updateMindBlock } from "../services/mindblocks.js";
import { generateMindBlockAudio, getMindBlockAudio } from "../services/mindblockAudio.js";
import { createReviewEvent, listReviewEvents } from "../services/reviewEvents.js";
import { recordDailyActivity } from "../services/learningProgress.js";

const REVIEW_SCORES = {
  again: { masteryDelta: -8, nextDays: 0, correct: false, toast: "No problem. Send it to another round." },
  hard: { masteryDelta: 2, nextDays: 1, correct: false, toast: "Hard cards are where fluency grows." },
  good: { masteryDelta: 8, nextDays: 3, correct: true, toast: "Nice. MindBlock strengthened." },
  easy: { masteryDelta: 14, nextDays: 7, correct: true, toast: "Great. This one is becoming natural." },
};

function sortReviewDeck(expressions) {
  const dueCards = expressions.filter((item) => item.isReviewDue || item.status === "review_due");
  if (dueCards.length > 0) return dueCards;
  return expressions;
}

function buildProgress(events) {
  return events.reduce((acc, event) => {
    const id = event.mindblock_id;
    if (!id) return acc;
    const result = event.result;
    const isCorrect = result === "good" || result === "easy";
    const current = acc[id] ?? { reviewed: 0, correct: 0 };
    acc[id] = {
      reviewed: current.reviewed + 1,
      correct: current.correct + (isCorrect ? 1 : 0),
      lastReviewedAt: event.reviewed_at,
    };
    return acc;
  }, {});
}

export default function InsightsPage() {
  const { user, session } = useAuth();
  const [deck, setDeck] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [answerStartedAt, setAnswerStartedAt] = useState(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [savingResult, setSavingResult] = useState(false);
  const audioRef = useRef(null);
  const [audioByMindBlock, setAudioByMindBlock] = useState({});
  const [audioLoadingId, setAudioLoadingId] = useState(null);
  const [sessionStats, setSessionStats] = useState({ reviewed: 0, correct: 0, again: 0, hard: 0, good: 0, easy: 0 });

  useEffect(() => {
    let ignore = false;

    async function loadReviewData() {
      if (!user?.id) {
        setDeck([]);
        setEvents([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError(null);
      try {
        const [mindBlocks, reviewEvents] = await Promise.all([
          listMindBlocks(user.id),
          listReviewEvents(user.id),
        ]);
        if (ignore) return;
        setDeck(sortReviewDeck(mindBlocks));
        setEvents(reviewEvents);
        setCardIndex(0);
        setShowAnswer(false);
        setAnswerStartedAt(null);
        setTypedAnswer("");
        setSessionStats({ reviewed: 0, correct: 0, again: 0, hard: 0, good: 0, easy: 0 });
      } catch (error) {
        console.error("Erro ao carregar revisao:", error);
        if (!ignore) {
          setLoadError(error);
          setDeck([]);
          setEvents([]);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    loadReviewData();

    return () => {
      ignore = true;
    };
  }, [user?.id]);

  const currentCard = deck[cardIndex] ?? null;
  const progress = useMemo(() => buildProgress(events), [events]);
  const reviewedCount = sessionStats.reviewed;
  const accuracy = sessionStats.reviewed ? Math.round((sessionStats.correct / sessionStats.reviewed) * 100) : 0;

  const nextCard = () => {
    setShowAnswer(false);
    setAnswerStartedAt(null);
    setTypedAnswer("");
    setCardIndex((index) => (deck.length ? (index + 1) % deck.length : 0));
  };

  const updateDeckAfterAnswer = (updatedCard, result) => {
    setDeck((current) => {
      const withoutCurrent = current.filter((item) => item.id !== updatedCard.id);
      if (result === "again") return [...withoutCurrent, updatedCard];
      return withoutCurrent;
    });
    setCardIndex(0);
    setShowAnswer(false);
    setAnswerStartedAt(null);
    setTypedAnswer("");
  };

  const playCardAudio = async (card) => {
    if (!card?.id) return;
    if (!session?.access_token) {
      toast.error("Sessao expirada. Entre novamente para ouvir este MindBlock.");
      return;
    }

    const voice = user?.user_metadata?.assistant_voice || "mineirinha";

    try {
      setAudioLoadingId(card.id);
      let audioData = audioByMindBlock[card.id];

      if (!audioData?.signedUrl) {
        audioData = await getMindBlockAudio({
          mindblockId: card.id,
          voice,
          accessToken: session.access_token,
        });
      }

      if (!audioData?.signedUrl) {
        audioData = await generateMindBlockAudio({
          mindblockId: card.id,
          voice,
          accessToken: session.access_token,
        });
        toast.success("Audio gerado para revisao.");
      }

      setAudioByMindBlock((current) => ({ ...current, [card.id]: audioData }));

      if (audioRef.current) {
        audioRef.current.pause();
      }
      const nextAudio = new Audio(audioData.signedUrl);
      audioRef.current = nextAudio;
      await nextAudio.play();
    } catch (error) {
      console.error("Erro ao tocar audio da revisao:", error);
      toast.error(error.message || "Nao foi possivel tocar este audio.");
    } finally {
      setAudioLoadingId(null);
    }
  };

  const answerCard = async (result) => {
    if (!currentCard || !user?.id || savingResult) return;
    const score = REVIEW_SCORES[result];
    const responseTimeMs = answerStartedAt ? Date.now() - answerStartedAt : null;
    const nextMastery = Math.min(100, Math.max(0, (currentCard.mastery ?? 0) + score.masteryDelta));

    setSavingResult(true);
    try {
      const [event] = await Promise.all([
        createReviewEvent({
          userId: user.id,
          mindBlockId: currentCard.id,
          result,
          answerText: typedAnswer.trim() || null,
          expectedText: currentCard.expression,
          responseTimeMs,
        }),
        updateMindBlock(currentCard.id, {
          mastery: nextMastery,
          timesReviewed: (currentCard.timesReviewed ?? 0) + 1,
          lastReviewedAt: "Today",
          nextReviewAt: score.nextDays === 0 ? "Today" : `In ${score.nextDays} days`,
          isReviewDue: score.nextDays === 0,
          status: score.nextDays === 0 ? "review_due" : nextMastery >= 90 ? "mastered" : "learning",
        }),
        recordDailyActivity(user.id, {
          expressions_reviewed: 1,
          [`reviews_${result}`]: 1,
          study_minutes: 1,
        }),
      ]);

      setEvents((current) => [event, ...current]);
      const updatedCard = {
        ...currentCard,
        mastery: nextMastery,
        timesReviewed: (currentCard.timesReviewed ?? 0) + 1,
        lastReviewedAt: "Today",
        nextReviewAt: score.nextDays === 0 ? "Today" : `In ${score.nextDays} days`,
        isReviewDue: score.nextDays === 0,
        status: score.nextDays === 0 ? "review_due" : nextMastery >= 90 ? "mastered" : "learning",
      };
      setSessionStats((current) => ({
        ...current,
        reviewed: current.reviewed + 1,
        correct: current.correct + (score.correct ? 1 : 0),
        [result]: current[result] + 1,
      }));
      toast.success(score.toast);
      updateDeckAfterAnswer(updatedCard, result);
    } catch (error) {
      console.error("Erro ao registrar revisao:", error);
      toast.error("Nao foi possivel registrar esta revisao.");
    } finally {
      setSavingResult(false);
    }
  };

  const restart = () => {
    setCardIndex(0);
    setShowAnswer(false);
    setAnswerStartedAt(null);
    setTypedAnswer("");
    setSessionStats({ reviewed: 0, correct: 0, again: 0, hard: 0, good: 0, easy: 0 });
    toast("Review restarted.");
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-4xl">
        <section className="fm-card rounded-[30px] border p-8 text-center shadow-lg">
          <Brain className="fm-secondary mx-auto h-12 w-12 animate-pulse" />
          <h1 className="mt-4 text-3xl font-semibold">Revisão</h1>
          <p className="fm-muted mt-2">Carregando seus MindBlocks...</p>
        </section>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="mx-auto max-w-4xl">
        <section className="fm-card rounded-[30px] border p-8 text-center shadow-lg">
          <X className="mx-auto h-12 w-12 text-rose-300" />
          <h1 className="mt-4 text-3xl font-semibold">Revisão indisponível</h1>
          <p className="fm-muted mt-2">Nao foi possivel carregar `review_events` ou `mindblocks` agora.</p>
        </section>
      </main>
    );
  }

  if (!currentCard) {
    return (
      <main className="mx-auto max-w-4xl">
        <section className="fm-card rounded-[30px] border p-8 text-center shadow-lg">
          <Brain className="fm-secondary mx-auto h-12 w-12" />
          <h1 className="mt-4 text-3xl font-semibold">{sessionStats.reviewed ? "Sessão concluída" : "Revisão"}</h1>
          <p className="fm-muted mt-2">
            {sessionStats.reviewed
              ? "Você fortaleceu seus MindBlocks de hoje."
              : "Nenhuma expressão disponível para revisar agora."}
          </p>
          {sessionStats.reviewed ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-4">
              <ReviewMetric label="Feitos" value={sessionStats.reviewed} />
              <ReviewMetric label="Acerto" value={`${accuracy}%`} />
              <ReviewMetric label="Good/Easy" value={sessionStats.good + sessionStats.easy} />
              <ReviewMetric label="Again/Hard" value={sessionStats.again + sessionStats.hard} />
            </div>
          ) : null}
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6">
      <header className="fm-card overflow-hidden rounded-[32px] border p-6 shadow-lg">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">Simple Review</p>
            <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Revisão por flashcards</h1>
            <p className="fm-muted mt-2 max-w-2xl text-sm">
              Treine tradução ativa: veja a pergunta em português, tente responder em inglês e revele a resposta.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <ReviewMetric label="Cards" value={deck.length} />
            <ReviewMetric label="Feitos" value={reviewedCount} />
            <ReviewMetric label="Acerto" value={`${accuracy}%`} />
          </div>
        </div>
      </header>

      <section className="review-flashcard-wrap">
        <article className={`review-flashcard ${showAnswer ? "is-revealed" : ""}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <span className="library-badge accent">{currentCard.category}</span>
              <span className="library-badge">{currentCard.difficulty}</span>
              {currentCard.isReviewDue || currentCard.status === "review_due" ? (
                <span className="library-badge warning">Due today</span>
              ) : null}
            </div>
            <span className="fm-muted text-sm font-semibold">
              {cardIndex + 1} / {deck.length}
            </span>
          </div>

          <div className="review-card-center">
            <div className="review-brain-mark">
              <Sparkles className="h-7 w-7" />
            </div>
            <p className="fm-subtle text-xs font-semibold uppercase tracking-[0.16em]">Como dizer em inglês?</p>
            <h2>“{currentCard.translation.replace(/\.$/, "").toLowerCase()}”</h2>
            <p className="fm-muted text-sm">Digite, fale em voz alta ou responda mentalmente antes de revelar.</p>
            {!showAnswer ? (
              <label className="review-typed-answer">
                <span>Sua resposta</span>
                <textarea
                  value={typedAnswer}
                  onChange={(event) => setTypedAnswer(event.target.value)}
                  rows={2}
                  placeholder="Type your answer in English..."
                />
              </label>
            ) : null}
          </div>

          {showAnswer ? (
            <div className="review-answer-box">
              <p className="fm-subtle text-xs font-semibold uppercase tracking-[0.14em]">Resposta</p>
              <h3>{currentCard.expression}</h3>
              {typedAnswer.trim() ? (
                <div className="review-comparison">
                  <span>You answered</span>
                  <strong>{typedAnswer.trim()}</strong>
                </div>
              ) : null}
              <p>{currentCard.notes || "Use como um bloco mental completo, sem traduzir palavra por palavra."}</p>
              {progress[currentCard.id] ? (
                <p className="mt-2 text-xs">
                  Histórico: {progress[currentCard.id].reviewed} revisão(ões) · {progress[currentCard.id].correct} acerto(s)
                </p>
              ) : null}
              {currentCard.examples?.length ? (
                <div className="mt-3 grid gap-2">
                  {currentCard.examples.slice(0, 2).map((example) => (
                    <p key={example} className="mindblock-example">{example}</p>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="review-card-actions">
            {!showAnswer ? (
              <button
                type="button"
                onClick={() => {
                  setShowAnswer(true);
                  setAnswerStartedAt(Date.now());
                }}
                className="fm-gradient review-primary-button"
              >
                <Eye className="h-4 w-4" /> Mostrar resposta
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={audioLoadingId === currentCard.id}
                  onClick={() => playCardAudio(currentCard)}
                  className="review-answer-button"
                >
                  {audioLoadingId === currentCard.id ? <Sparkles className="h-4 w-4 animate-spin" /> : <Headphones className="h-4 w-4" />}
                  Listen
                </button>
                <button type="button" disabled={savingResult} onClick={() => answerCard("again")} className="review-answer-button wrong">
                  <X className="h-4 w-4" /> Again
                </button>
                <button type="button" disabled={savingResult} onClick={() => answerCard("hard")} className="review-answer-button wrong">
                  Hard
                </button>
                <button type="button" disabled={savingResult} onClick={() => answerCard("good")} className="review-answer-button right">
                  <Check className="h-4 w-4" /> Good
                </button>
                <button type="button" disabled={savingResult} onClick={() => answerCard("easy")} className="review-answer-button right">
                  Easy
                </button>
              </>
            )}
            <button type="button" onClick={nextCard} className="library-ghost-button">
              Próximo
            </button>
            <button type="button" onClick={restart} className="library-ghost-button">
              <RotateCcw className="h-4 w-4" /> Reiniciar
            </button>
          </div>
        </article>
      </section>
    </main>
  );
}

function ReviewMetric({ label, value }) {
  return (
    <div className="fm-inner rounded-2xl border px-4 py-3">
      <p className="fm-subtle text-[0.68rem] font-semibold uppercase tracking-[0.14em]">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </div>
  );
}
