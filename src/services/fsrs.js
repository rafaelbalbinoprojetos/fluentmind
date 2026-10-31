// FSRS-5 (Free Spaced Repetition Scheduler), o algoritmo do Anki moderno.
// Cada card guarda duas grandezas:
//   stability  (S): dias até a chance de lembrar cair para 90%;
//   difficulty (D): 1 (fácil) a 10 (difícil), ajustada a cada resposta.
// Sem colunas novas no banco: o estado é reconstruído a partir do histórico de review_events.

const W = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192,
  1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
];
const DECAY = -0.5;
const FACTOR = 19 / 81;
const DAY_MS = 24 * 60 * 60 * 1000;

export const DESIRED_RETENTION = 0.9;
export const MAX_INTERVAL_DAYS = 365;
export const RATINGS = { again: 1, hard: 2, good: 3, easy: 4 };

const clampDifficulty = (d) => Math.min(10, Math.max(1, d));

export function retrievability(elapsedDays, stability) {
  if (!stability) return 0;
  return (1 + (FACTOR * Math.max(0, elapsedDays)) / stability) ** DECAY;
}

export function intervalFromStability(stability, retention = DESIRED_RETENTION) {
  const days = (stability / FACTOR) * (retention ** (1 / DECAY) - 1);
  return Math.min(MAX_INTERVAL_DAYS, Math.max(1, Math.round(days)));
}

function initialDifficulty(rating) {
  return clampDifficulty(W[4] - Math.exp(W[5] * (rating - 1)) + 1);
}

function nextDifficulty(d, rating) {
  const delta = -W[6] * (rating - 3);
  const damped = d + (delta * (10 - d)) / 9;
  // reversão à média: impede que a dificuldade "grude" em 10 depois de vários erros
  return clampDifficulty(W[7] * initialDifficulty(4) + (1 - W[7]) * damped);
}

function recallStability(d, s, r, rating) {
  const hardPenalty = rating === 2 ? W[15] : 1;
  const easyBonus = rating === 4 ? W[16] : 1;
  return s * (Math.exp(W[8]) * (11 - d) * s ** -W[9] * (Math.exp(W[10] * (1 - r)) - 1) * hardPenalty * easyBonus + 1);
}

function forgetStability(d, s, r) {
  const next = W[11] * d ** -W[12] * ((s + 1) ** W[13] - 1) * Math.exp(W[14] * (1 - r));
  return Math.min(next, s);
}

function sameDayStability(s, rating) {
  return s * Math.exp(W[17] * (rating - 3 + W[18]));
}

/** Aplica uma resposta ao estado do card. state null = primeira revisão. */
export function fsrsStep(state, result, elapsedDays) {
  const rating = RATINGS[result] ?? RATINGS.good;
  if (!state?.stability) {
    return { stability: W[rating - 1], difficulty: initialDifficulty(rating) };
  }
  const { stability: s, difficulty: d } = state;
  let stability;
  if (elapsedDays < 1) {
    stability = sameDayStability(s, rating);
  } else {
    const r = retrievability(elapsedDays, s);
    stability = rating === 1 ? forgetStability(d, s, r) : recallStability(d, s, r, rating);
  }
  return { stability: Math.max(0.1, stability), difficulty: nextDifficulty(d, rating) };
}

/** Reconstrói o estado FSRS a partir do histórico (review_events com result e reviewed_at). */
export function replayFsrs(events = []) {
  const ordered = events
    .filter((event) => RATINGS[event?.result] && event?.reviewed_at)
    .sort((a, b) => new Date(a.reviewed_at) - new Date(b.reviewed_at));
  let state = null;
  let last = null;
  for (const event of ordered) {
    const at = new Date(event.reviewed_at).getTime();
    state = fsrsStep(state, event.result, last === null ? 0 : (at - last) / DAY_MS);
    last = at;
  }
  return state ? { ...state, lastReviewedAt: last } : null;
}

/** Card sem histórico de eventos (ex.: erros corrigidos): estima o estado pelo último intervalo agendado. */
export function estimateFsrsState(card) {
  if (!card?.timesReviewed) return null;
  const last = card.lastReviewedAtRaw ? new Date(card.lastReviewedAtRaw).getTime() : null;
  const next = card.nextReviewAtRaw ? new Date(card.nextReviewAtRaw).getTime() : null;
  if (!last || Number.isNaN(last)) return null;
  const previousInterval = next && !Number.isNaN(next) ? Math.max(0.5, (next - last) / DAY_MS) : 1;
  const mastery = Number(card.mastery ?? 0);
  return { stability: previousInterval, difficulty: clampDifficulty(10 - mastery / 12), lastReviewedAt: last };
}

/** Agenda a próxima revisão. Again volta na mesma sessão (0 dias). */
export function scheduleWithFsrs(state, result, now = Date.now()) {
  const elapsedDays = state?.lastReviewedAt ? (now - state.lastReviewedAt) / DAY_MS : 0;
  const next = fsrsStep(state, result, elapsedDays);
  const intervalDays = result === "again" ? 0 : intervalFromStability(next.stability);
  return { ...next, intervalDays, retrievabilityBefore: state ? retrievability(elapsedDays, state.stability) : null };
}
