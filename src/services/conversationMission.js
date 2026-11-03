import { learningJourneyChapters } from "../data/learningJourney.js";
import { aggregateTargetEvidence } from "../../shared/learningEvaluation.js";

const MISSION_SIZE = 3;

function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/[^a-z0-9'\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Núcleo reutilizável da expressão: até 3 palavras, sem o detalhe final ("I'm from Brazil" -> "i'm from"). */
export function targetPattern(expression) {
  const words = normalize(expression).split(" ").filter(Boolean);
  if (words.length <= 2) return words.join(" ");
  return words.slice(0, Math.min(3, words.length - 1)).join(" ");
}

/** Missão de conversa de um capítulo: 3 expressões espalhadas pelo capítulo, para não repetir sempre as primeiras. */
export function buildJourneyMission(chapterId) {
  const chapter = learningJourneyChapters.find((item) => item.id === chapterId);
  if (!chapter?.mindBlocks?.length) return null;
  const step = Math.max(1, Math.floor(chapter.mindBlocks.length / MISSION_SIZE));
  const picked = [];
  for (let index = 0; index < chapter.mindBlocks.length && picked.length < MISSION_SIZE; index += step) {
    picked.push(chapter.mindBlocks[index]);
  }
  const targets = picked.map(([expression, translation]) => ({ expression, translation, pattern: targetPattern(expression) }));
  return {
    chapterId: chapter.id,
    title: chapter.title,
    objective: chapter.objective,
    targets,
    scenario: `${chapter.neoPrompt} Lesson goal: ${chapter.objective} Difficulty: ${chapter.difficulty}. Guide the conversation so the student naturally needs these expressions: ${targets
      .map((target) => `"${target.expression}"`)
      .join(", ")}. Never list them or ask the student to repeat them; create situations where they fit.`,
  };
}

/** Índices das expressões-alvo que já apareceram nas mensagens do usuário. */
export function findUsedTargets(targets = [], userTexts = []) {
  const text = ` ${normalize(userTexts.join(" "))} `;
  return targets.reduce((used, target, index) => (target.pattern && text.includes(` ${target.pattern} `) ? [...used, index] : used), []);
}

/**
 * Evidência por expressão-alvo ao longo da conversa, a partir da avaliação que a API devolve
 * em cada mensagem (message.targetEvaluation). Mensagem sem avaliação não aprova nada:
 * se a expressão aparece nela, conta como "inconclusive".
 * Status: adequate | partial | inadequate | unused | inconclusive.
 */
export function evaluateMissionTargets(targets = [], userMessages = []) {
  const expressions = targets.map((target) => target.expression);
  const perMessage = userMessages.map((message) => {
    if (Array.isArray(message.targetEvaluation)) return message.targetEvaluation;
    const content = ` ${normalize(message.content)} `;
    return targets
      .filter((target) => target.pattern && content.includes(` ${target.pattern} `))
      .map((target) => ({ expression: target.expression, status: "inconclusive", feedback: "", suggestion: "" }));
  });
  return aggregateTargetEvidence(expressions, perMessage);
}
