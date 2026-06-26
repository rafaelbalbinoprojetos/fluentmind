const DAY_MS = 24 * 60 * 60 * 1000;

const RESULT_BASE = {
  again: {
    correct: false,
    mindblockDelta: -14,
    mistakeDelta: -10,
    toast: "Sem problema. Este bloco voltou para reforco imediato.",
  },
  hard: {
    correct: false,
    mindblockDelta: 2,
    mistakeDelta: 3,
    toast: "Boa. Cards dificeis constroem fluencia de verdade.",
  },
  good: {
    correct: true,
    mindblockDelta: 10,
    mistakeDelta: 8,
    toast: "Nice. Conexao neural fortalecida.",
  },
  easy: {
    correct: true,
    mindblockDelta: 18,
    mistakeDelta: 14,
    toast: "Excelente. Este bloco esta ficando natural.",
  },
};

function clamp(value, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function toValidDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfToday() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

function daysFromToday(value) {
  const date = toValidDate(value);
  if (!date) return 0;
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - startOfToday().getTime()) / DAY_MS);
}

function formatInterval(days) {
  if (days <= 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

function formatDueLabel(days) {
  if (days < 0) return `${Math.abs(days)} dia${Math.abs(days) === 1 ? "" : "s"} atrasado`;
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Amanha";
  return `Em ${days} dias`;
}

function priorityLabel(score) {
  if (score >= 150) return "Alta prioridade";
  if (score >= 105) return "Revisar hoje";
  if (score >= 70) return "Reforco";
  return "Manutencao";
}

function priorityTone(score) {
  if (score >= 150) return "urgent";
  if (score >= 105) return "warning";
  if (score >= 70) return "accent";
  return "calm";
}

export function getSmartDueInfo(card) {
  const daysUntilDue = daysFromToday(card?.nextReviewAtRaw);
  const isDue = !card?.nextReviewAtRaw || card?.isReviewDue || card?.status === "review_due" || daysUntilDue <= 0;

  return {
    daysUntilDue,
    isDue,
    label: isDue ? formatDueLabel(daysUntilDue) : formatDueLabel(daysUntilDue),
  };
}

export function buildReviewHistory(events = []) {
  return events.reduce((acc, event) => {
    const mindBlockId = event.mindblock_id;
    if (!mindBlockId) return acc;

    const current = acc.get(mindBlockId) ?? {
      reviewed: 0,
      correct: 0,
      again: 0,
      hard: 0,
      good: 0,
      easy: 0,
      lastReviewedAt: null,
    };
    const result = event.result;
    const correct = result === "good" || result === "easy";

    acc.set(mindBlockId, {
      ...current,
      reviewed: current.reviewed + 1,
      correct: current.correct + (correct ? 1 : 0),
      again: current.again + (result === "again" ? 1 : 0),
      hard: current.hard + (result === "hard" ? 1 : 0),
      good: current.good + (result === "good" ? 1 : 0),
      easy: current.easy + (result === "easy" ? 1 : 0),
      lastReviewedAt: current.lastReviewedAt || event.reviewed_at,
    });

    return acc;
  }, new Map());
}

export function scoreReviewPriority(card, history = {}) {
  const due = getSmartDueInfo(card);
  const mastery = Number(card?.mastery ?? 0);
  const timesReviewed = Number(card?.timesReviewed ?? 0);
  const lapseScore = (history.again ?? 0) * 12 + (history.hard ?? 0) * 6;
  const overdueScore = due.daysUntilDue < 0 ? Math.min(80, Math.abs(due.daysUntilDue) * 10) : 0;
  const dueScore = due.isDue ? 100 : Math.max(0, 28 - due.daysUntilDue * 4);
  const weaknessScore = Math.max(0, 78 - mastery);
  const typeScore = card?.reviewType === "mistake" ? 22 : 0;
  const newCardScore = timesReviewed === 0 ? 12 : 0;
  const masteredPenalty = card?.status === "mastered" || mastery >= 90 ? 40 : 0;

  return Math.round(dueScore + overdueScore + weaknessScore + lapseScore + typeScore + newCardScore - masteredPenalty);
}

export function enrichReviewCard(card, reviewHistory = new Map()) {
  const history = card?.reviewType === "mindblock" ? reviewHistory.get(card.id) ?? {} : {};
  const priority = scoreReviewPriority(card, history);
  const due = getSmartDueInfo(card);
  const correctRate = history.reviewed ? Math.round((history.correct / history.reviewed) * 100) : null;

  return {
    ...card,
    smartPriority: priority,
    smartPriorityLabel: priorityLabel(priority),
    smartPriorityTone: priorityTone(priority),
    smartDueDays: due.daysUntilDue,
    smartDueLabel: due.label,
    smartIsDue: due.isDue,
    smartLapses: (history.again ?? 0) + (history.hard ?? 0),
    smartCorrectRate: correctRate,
  };
}

export function prioritizeReviewDeck(cards, events = []) {
  const history = buildReviewHistory(events);
  return [...cards]
    .map((card) => enrichReviewCard(card, history))
    .sort((a, b) => {
      if (a.smartPriority !== b.smartPriority) return b.smartPriority - a.smartPriority;
      if (a.smartDueDays !== b.smartDueDays) return a.smartDueDays - b.smartDueDays;
      if ((a.mastery ?? 0) !== (b.mastery ?? 0)) return (a.mastery ?? 0) - (b.mastery ?? 0);
      return (a.timesReviewed ?? 0) - (b.timesReviewed ?? 0);
    });
}

export function buildReviewSessionPlan(cards, events = []) {
  const deck = prioritizeReviewDeck(cards, events);
  const dueNow = deck.filter((card) => card.smartIsDue).length;
  const mistakes = deck.filter((card) => card.reviewType === "mistake").length;
  const weakCards = deck.filter((card) => Number(card.mastery ?? 0) < 55).length;
  const mastered = deck.filter((card) => card.status === "mastered" || Number(card.mastery ?? 0) >= 90).length;
  const estimatedMinutes = Math.max(1, Math.ceil(Math.min(deck.length, 20) * 0.75));
  const focusLabel = mistakes
    ? "Correcoes primeiro"
    : weakCards
      ? "Fortalecer bases"
      : dueNow
        ? "Manter consistencia"
        : "Manutencao leve";

  return {
    dueNow,
    mistakes,
    weakCards,
    mastered,
    estimatedMinutes,
    focusLabel,
  };
}

export function getRecommendedReviewResult(typedSimilarity) {
  if (typedSimilarity === null || typedSimilarity === undefined) return null;
  if (typedSimilarity < 50) return "again";
  if (typedSimilarity < 75) return "hard";
  if (typedSimilarity < 92) return "good";
  return "easy";
}

export function calculateSmartReview(card, result, { typedSimilarity = null, responseTimeMs = null } = {}) {
  const base = RESULT_BASE[result] ?? RESULT_BASE.good;
  const currentMastery = Number(card?.mastery ?? 0);
  const timesReviewed = Number(card?.timesReviewed ?? 0);
  const typeDelta = card?.reviewType === "mistake" ? base.mistakeDelta : base.mindblockDelta;
  const similarityDelta =
    typedSimilarity === null
      ? 0
      : typedSimilarity >= 92
        ? 2
        : typedSimilarity >= 75
          ? 1
          : typedSimilarity < 50
            ? -4
            : -1;
  const speedDelta =
    !responseTimeMs
      ? 0
      : responseTimeMs < 8000
        ? 1
        : responseTimeMs > 45000
          ? -1
          : 0;
  const nextMastery = clamp(currentMastery + typeDelta + similarityDelta + speedDelta);

  let intervalDays = 1;
  if (result === "again") intervalDays = 0;
  if (result === "hard") intervalDays = Math.max(1, Math.min(3, Math.ceil((timesReviewed + 1) / 2)));
  if (result === "good") {
    intervalDays = nextMastery >= 85 ? 14 : nextMastery >= 65 ? 7 : nextMastery >= 40 ? 3 : 2;
  }
  if (result === "easy") {
    intervalDays = nextMastery >= 90 ? 30 : nextMastery >= 75 ? 21 : nextMastery >= 55 ? 14 : 7;
  }
  if (typedSimilarity !== null && typedSimilarity < 60 && result !== "again") {
    intervalDays = Math.min(intervalDays, 1);
  }

  const nextReviewAtIso = new Date(Date.now() + intervalDays * DAY_MS).toISOString();
  const confidenceLabel =
    nextMastery >= 90 ? "Natural" : nextMastery >= 70 ? "Forte" : nextMastery >= 45 ? "Em construcao" : "Novo";

  return {
    correct: base.correct,
    toast: base.toast,
    nextMastery,
    intervalDays,
    nextReviewAtIso,
    nextReviewLabel: formatInterval(intervalDays),
    confidenceLabel,
    reason: `Mastery ${currentMastery}% -> ${nextMastery}% · proxima revisao: ${formatInterval(intervalDays)}`,
  };
}
