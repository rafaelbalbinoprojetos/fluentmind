import React, { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Brain, Check, Eye, RotateCcw, Sparkles, X } from "lucide-react";
import {
  LIBRARY_STORAGE_KEY,
  libraryExpressions,
} from "../data/libraryMock.js";

const REVIEW_PROGRESS_KEY = "fluentmind_simple_review_progress";

function loadLibraryExpressions() {
  if (typeof window === "undefined") return libraryExpressions;
  const stored = window.localStorage.getItem(LIBRARY_STORAGE_KEY);
  if (!stored) return libraryExpressions;

  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) && parsed.length ? parsed : libraryExpressions;
  } catch {
    return libraryExpressions;
  }
}

function loadProgress() {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(REVIEW_PROGRESS_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  window.localStorage.setItem(REVIEW_PROGRESS_KEY, JSON.stringify(progress));
}

function sortReviewDeck(expressions) {
  const tiredCard = expressions.find((item) => item.id === "expr-tired");
  const dueCards = expressions.filter((item) => item.id !== "expr-tired" && (item.isReviewDue || item.status === "review_due"));
  const otherCards = expressions.filter((item) => item.id !== "expr-tired" && !item.isReviewDue && item.status !== "review_due");
  return [tiredCard, ...dueCards, ...otherCards].filter(Boolean);
}

export default function InsightsPage() {
  const deck = useMemo(() => sortReviewDeck(loadLibraryExpressions()), []);
  const [cardIndex, setCardIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [progress, setProgress] = useState(loadProgress);

  const currentCard = deck[cardIndex] ?? null;
  const reviewedCount = Object.values(progress).reduce((sum, item) => sum + (item.reviewed || 0), 0);
  const correctCount = Object.values(progress).reduce((sum, item) => sum + (item.correct || 0), 0);
  const accuracy = reviewedCount ? Math.round((correctCount / reviewedCount) * 100) : 0;

  const answerCard = (wasCorrect) => {
    if (!currentCard) return;

    const nextProgress = {
      ...progress,
      [currentCard.id]: {
        reviewed: (progress[currentCard.id]?.reviewed || 0) + 1,
        correct: (progress[currentCard.id]?.correct || 0) + (wasCorrect ? 1 : 0),
        lastReviewedAt: new Date().toISOString(),
      },
    };

    setProgress(nextProgress);
    saveProgress(nextProgress);
    toast.success(wasCorrect ? "Nice. MindBlock strengthened." : "No problem. Send it to another round.");
    nextCard();
  };

  const nextCard = () => {
    setShowAnswer(false);
    setCardIndex((index) => (deck.length ? (index + 1) % deck.length : 0));
  };

  const restart = () => {
    setCardIndex(0);
    setShowAnswer(false);
    toast("Review restarted.");
  };

  if (!currentCard) {
    return (
      <main className="mx-auto max-w-4xl">
        <section className="fm-card rounded-[30px] border p-8 text-center shadow-lg">
          <Brain className="fm-secondary mx-auto h-12 w-12" />
          <h1 className="mt-4 text-3xl font-semibold">Revisão</h1>
          <p className="fm-muted mt-2">Nenhuma expressão disponível para revisar agora.</p>
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
            <p className="fm-muted text-sm">Responda em voz alta ou mentalmente antes de revelar.</p>
          </div>

          {showAnswer ? (
            <div className="review-answer-box">
              <p className="fm-subtle text-xs font-semibold uppercase tracking-[0.14em]">Resposta</p>
              <h3>{currentCard.expression}</h3>
              <p>{currentCard.notes || "Use como um bloco mental completo, sem traduzir palavra por palavra."}</p>
            </div>
          ) : null}

          <div className="review-card-actions">
            {!showAnswer ? (
              <button type="button" onClick={() => setShowAnswer(true)} className="fm-gradient review-primary-button">
                <Eye className="h-4 w-4" /> Mostrar resposta
              </button>
            ) : (
              <>
                <button type="button" onClick={() => answerCard(false)} className="review-answer-button wrong">
                  <X className="h-4 w-4" /> Errei
                </button>
                <button type="button" onClick={() => answerCard(true)} className="review-answer-button right">
                  <Check className="h-4 w-4" /> Acertei
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
