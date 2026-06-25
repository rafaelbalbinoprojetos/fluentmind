import React, { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Brain, Check, Eye, Headphones, RotateCcw, Sparkles, X } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { listMindBlocks, updateMindBlock } from "../services/mindblocks.js";
import { generateMindBlockAudio, getMindBlockAudio } from "../services/mindblockAudio.js";
import { createReviewEvent, listReviewEvents } from "../services/reviewEvents.js";
import { recordDailyActivity } from "../services/learningProgress.js";
import { listCorrectedMistakes, updateCorrectedMistake } from "../services/correctedMistakes.js";
import { trackProgressionAction } from "../services/progressionEngine.js";
import { recordLearningEvent } from "../services/learningEventEngine.js";

const REVIEW_SCORES = {
  again: { masteryDelta: -10, correct: false, toast: "No problem. Send it to another round." },
  hard: { masteryDelta: 3, correct: false, toast: "Hard cards are where fluency grows." },
  good: { masteryDelta: 9, correct: true, toast: "Nice. MindBlock strengthened." },
  easy: { masteryDelta: 16, correct: true, toast: "Great. This one is becoming natural." },
};

function sortReviewDeck(expressions) {
  const now = Date.now();
  return [...expressions].sort((a, b) => {
    const aDue = a.nextReviewAtRaw ? new Date(a.nextReviewAtRaw).getTime() : now;
    const bDue = b.nextReviewAtRaw ? new Date(b.nextReviewAtRaw).getTime() : now;
    const aIsDue = a.isReviewDue || a.status === "review_due" || aDue <= now;
    const bIsDue = b.isReviewDue || b.status === "review_due" || bDue <= now;
    if (aIsDue !== bIsDue) return aIsDue ? -1 : 1;
    if (aDue !== bDue) return aDue - bDue;
    if ((a.mastery ?? 0) !== (b.mastery ?? 0)) return (a.mastery ?? 0) - (b.mastery ?? 0);
    return (a.timesReviewed ?? 0) - (b.timesReviewed ?? 0);
  });
}

function toReviewCard(item, type) {
  if (type === "mistake") {
    return {
      ...item,
      reviewType: "mistake",
      expectedText: item.correctedText,
      promptText: item.originalText,
      promptLabel: "Corrija esta frase",
      answerLabel: "Correção",
      helperText: "Reescreva a frase corrigida antes de revelar.",
      difficulty: item.level,
      notes: item.explanation || "Compare a estrutura correta com o erro original e tente repetir em voz alta.",
      examples: [],
    };
  }

  return {
    ...item,
    reviewType: "mindblock",
    expectedText: item.expression,
    promptText: item.translation?.replace(/\.$/, "").toLowerCase(),
    promptLabel: "Como dizer em inglês?",
    answerLabel: "Resposta",
    helperText: "Digite, fale em voz alta ou responda mentalmente antes de revelar.",
  };
}

function calculateNextReview({ result, mastery, timesReviewed }) {
  if (result === "again") return 0;
  if (result === "hard") return Math.max(1, Math.min(3, Math.ceil((timesReviewed + 1) / 2)));
  if (result === "good") {
    if (mastery >= 80) return 10;
    if (mastery >= 55) return 5;
    return 2;
  }
  if (mastery >= 85) return 21;
  if (mastery >= 65) return 14;
  return 7;
}

function addDaysIso(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function formatReviewInterval(days) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function normalizeForCompare(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function answerSimilarity(answer, expected) {
  const normalizedAnswer = normalizeForCompare(answer);
  const normalizedExpected = normalizeForCompare(expected);
  if (!normalizedAnswer || !normalizedExpected) return null;
  if (normalizedAnswer === normalizedExpected) return 100;

  const answerWords = new Set(normalizedAnswer.split(" ").filter(Boolean));
  const expectedWords = new Set(normalizedExpected.split(" ").filter(Boolean));
  const overlap = [...answerWords].filter((word) => expectedWords.has(word)).length;
  return Math.round((overlap / Math.max(1, expectedWords.size)) * 100);
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
  const { user, session, userPreferences } = useAuth();
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
        const [mindBlocks, reviewEvents, correctedMistakes] = await Promise.all([
          listMindBlocks(user.id),
          listReviewEvents(user.id),
          listCorrectedMistakes(user.id),
        ]);
        if (ignore) return;
        setDeck(sortReviewDeck([
          ...mindBlocks.map((item) => toReviewCard(item, "mindblock")),
          ...correctedMistakes
            .filter((item) => item.status !== "archived")
            .map((item) => toReviewCard(item, "mistake")),
        ]));
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
  const currentCardKey = currentCard ? `${currentCard.reviewType}:${currentCard.id}` : null;
  const dueCount = useMemo(() => {
    const now = Date.now();
    return deck.filter((item) => {
      const dueTime = item.nextReviewAtRaw ? new Date(item.nextReviewAtRaw).getTime() : now;
      return item.isReviewDue || item.status === "review_due" || dueTime <= now;
    }).length;
  }, [deck]);
  const typedSimilarity = currentCard ? answerSimilarity(typedAnswer, currentCard.expectedText) : null;

  useEffect(() => {
    if (!currentCardKey) return;
    setAnswerStartedAt(Date.now());
  }, [currentCardKey]);

  const nextCard = () => {
    setShowAnswer(false);
    setAnswerStartedAt(null);
    setTypedAnswer("");
    setCardIndex((index) => (deck.length ? (index + 1) % deck.length : 0));
  };

  const updateDeckAfterAnswer = (updatedCard, result) => {
    setDeck((current) => {
      const withoutCurrent = current.filter((item) => item.id !== updatedCard.id || item.reviewType !== updatedCard.reviewType);
      if (result === "again") return [...withoutCurrent, updatedCard];
      return withoutCurrent;
    });
    setCardIndex(0);
    setShowAnswer(false);
    setAnswerStartedAt(null);
    setTypedAnswer("");
  };

  const playCardAudio = async (card) => {
    if (!card?.id || card.reviewType !== "mindblock") return;
    if (!session?.access_token) {
      toast.error("Sessao expirada. Entre novamente para ouvir este MindBlock.");
      return;
    }

    const voice = userPreferences?.assistantVoice || user?.user_metadata?.assistant_voice || "mineirinha";

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
      trackProgressionAction("generateAudio", { reason: "Review audio listened", category: card.category });
      recordLearningEvent("audio_generated_mock", {
        expressionId: card.id,
        expression: card.expression,
        category: card.category,
      }, "review");

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
    const nextDays = calculateNextReview({
      result,
      mastery: nextMastery,
      timesReviewed: currentCard.timesReviewed ?? 0,
    });
    const nextReviewAt = formatReviewInterval(nextDays);
    const nextReviewAtIso = addDaysIso(nextDays);

    setSavingResult(true);
    try {
      let persistedCard;

      if (currentCard.reviewType === "mistake") {
        persistedCard = await updateCorrectedMistake(currentCard.id, {
          mastery: nextMastery,
          timesReviewed: (currentCard.timesReviewed ?? 0) + 1,
          lastReviewedAt: new Date().toISOString(),
          nextReviewAt: nextReviewAtIso,
          status: nextDays === 0 ? "review_due" : nextMastery >= 90 ? "mastered" : "reviewed",
        });
        await recordDailyActivity(user.id, {
          expressions_reviewed: 1,
          [`reviews_${result}`]: 1,
          study_minutes: 1,
        });
      } else {
        const [event, updatedMindBlock] = await Promise.all([
          createReviewEvent({
            userId: user.id,
            mindBlockId: currentCard.id,
            result,
            answerText: typedAnswer.trim() || null,
            expectedText: currentCard.expectedText,
            responseTimeMs,
          }),
          updateMindBlock(currentCard.id, {
            mastery: nextMastery,
            timesReviewed: (currentCard.timesReviewed ?? 0) + 1,
            lastReviewedAt: "Today",
            nextReviewAt,
            isReviewDue: nextDays === 0,
            status: nextDays === 0 ? "review_due" : nextMastery >= 90 ? "mastered" : "learning",
          }),
          recordDailyActivity(user.id, {
            expressions_reviewed: 1,
            [`reviews_${result}`]: 1,
            study_minutes: 1,
          }),
        ]);
        setEvents((current) => [event, ...current]);
        persistedCard = updatedMindBlock;
      }

      const updatedCard = {
        ...toReviewCard(persistedCard, currentCard.reviewType),
        ...currentCard,
        mastery: nextMastery,
        timesReviewed: (currentCard.timesReviewed ?? 0) + 1,
        lastReviewedAt: "Today",
        nextReviewAt: currentCard.reviewType === "mistake" ? formatReviewInterval(nextDays) : nextReviewAt,
        nextReviewAtRaw: currentCard.reviewType === "mistake" ? nextReviewAtIso : persistedCard?.nextReviewAtRaw,
        isReviewDue: nextDays === 0,
        status: nextDays === 0 ? "review_due" : nextMastery >= 90 ? "mastered" : currentCard.reviewType === "mistake" ? "reviewed" : "learning",
      };
      setSessionStats((current) => ({
        ...current,
        reviewed: current.reviewed + 1,
        correct: current.correct + (score.correct ? 1 : 0),
        [result]: current[result] + 1,
      }));
      toast.success(score.toast);
      recordLearningEvent(currentCard.reviewType === "mistake" ? "mistake_reviewed" : "review_completed", {
        expressionId: currentCard.id,
        expression: currentCard.expression,
        correct: score.correct,
        result,
        masteryBefore: currentCard.mastery ?? 0,
        masteryAfter: nextMastery,
        category: currentCard.category,
      }, "review");
      trackProgressionAction("completeReviewCard", { reason: "Review card completed", category: currentCard.category });
      if (result !== "again" && deck.length <= 1) {
        trackProgressionAction("completeReviewSession", { reason: "Review session completed" });
      }
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
          <p className="fm-muted mt-2">Carregando MindBlocks e erros corrigidos...</p>
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
          <p className="fm-muted mt-2">Nao foi possivel carregar MindBlocks, eventos ou erros corrigidos agora.</p>
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
              ? "Você fortaleceu seus MindBlocks e correções de hoje."
              : "Nenhum MindBlock ou erro corrigido disponível para revisar agora."}
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
            <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">Smart Review</p>
            <h1 className="mt-2 text-3xl font-semibold md:text-4xl">Revisão inteligente</h1>
            <p className="fm-muted mt-2 max-w-2xl text-sm">
              Cards vencidos aparecem primeiro. Sua resposta, áudio e nota atualizam mastery e próxima revisão.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            <ReviewMetric label="Cards" value={deck.length} />
            <ReviewMetric label="Vencidos" value={dueCount} />
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
              <span className="library-badge">{currentCard.reviewType === "mistake" ? "Erro corrigido" : "MindBlock"}</span>
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
            <p className="fm-subtle text-xs font-semibold uppercase tracking-[0.16em]">{currentCard.promptLabel}</p>
            <h2>“{currentCard.promptText}”</h2>
            <p className="fm-muted text-sm">{currentCard.helperText}</p>
            {!showAnswer ? (
              <label className="review-typed-answer">
                <span>Sua resposta</span>
                <textarea
                  value={typedAnswer}
                  onChange={(event) => setTypedAnswer(event.target.value)}
                  rows={2}
                  placeholder={currentCard.reviewType === "mistake" ? "Type the corrected sentence..." : "Type your answer in English..."}
                />
              </label>
            ) : null}
            {!showAnswer && currentCard.reviewType === "mindblock" ? (
              <button
                type="button"
                disabled={audioLoadingId === currentCard.id}
                onClick={() => playCardAudio(currentCard)}
                className="review-listen-before"
              >
                {audioLoadingId === currentCard.id ? <Sparkles className="h-4 w-4 animate-spin" /> : <Headphones className="h-4 w-4" />}
                Ouvir antes de revelar
              </button>
            ) : null}
          </div>

          {showAnswer ? (
            <div className="review-answer-box">
              <p className="fm-subtle text-xs font-semibold uppercase tracking-[0.14em]">{currentCard.answerLabel}</p>
              <h3>{currentCard.expectedText}</h3>
              {typedAnswer.trim() ? (
                <div className="review-comparison">
                  <span>You answered {typedSimilarity !== null ? `· ${typedSimilarity}% match` : ""}</span>
                  <strong>{typedAnswer.trim()}</strong>
                </div>
              ) : null}
              <p>{currentCard.notes || "Use como um bloco mental completo, sem traduzir palavra por palavra."}</p>
              {currentCard.reviewType === "mistake" ? (
                <div className="review-comparison mt-3">
                  <span>Original</span>
                  <strong>{currentCard.originalText}</strong>
                </div>
              ) : null}
              {currentCard.reviewType === "mindblock" && progress[currentCard.id] ? (
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
                {currentCard.reviewType === "mindblock" ? (
                  <button
                    type="button"
                    disabled={audioLoadingId === currentCard.id}
                    onClick={() => playCardAudio(currentCard)}
                    className="review-answer-button"
                  >
                    {audioLoadingId === currentCard.id ? <Sparkles className="h-4 w-4 animate-spin" /> : <Headphones className="h-4 w-4" />}
                    Listen
                  </button>
                ) : null}
                <button type="button" disabled={savingResult} onClick={() => answerCard("again")} className="review-answer-button wrong">
                  <X className="h-4 w-4" /> Again
                </button>
                <button type="button" disabled={savingResult} onClick={() => answerCard("hard")} className="review-answer-button hard">
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
