import { getInitialJourneyProgress, learningJourneyChapters } from "../data/learningJourney.js";
import { journeyCurriculum } from "../data/journeyCurriculum.js";

// Jornada 2.0: cada capítulo tem 5 fases e 10 atividades, feitas uma por vez.
// "flag" liga a atividade às marcações antigas de chapterProgress (Home, Neo e histórico continuam lendo).

export const JOURNEY_PHASES = [
  { id: "discover", label: "Descobrir", description: "Situações reais, significado e exemplos." },
  { id: "understand", label: "Compreender", description: "Leitura e escuta com perguntas." },
  { id: "recall", label: "Recuperar", description: "Produzir sem ver a resposta antes." },
  { id: "converse", label: "Conversar", description: "Usar as expressões com o Neo." },
  { id: "demonstrate", label: "Demonstrar", description: "Desafio final do capítulo." },
];

export const JOURNEY_ACTIVITIES = [
  { id: "lesson", phase: "discover", kind: "lesson", flag: "lesson", title: "O que você vai aprender", competence: "Compreensão do objetivo", criterion: "Ler a aula." },
  { id: "expressions", phase: "discover", kind: "expressions", flag: "vocabulary", title: "Expressões do capítulo", competence: "Vocabulário em blocos", criterion: "Conhecer as expressões. Salvar na revisão é opcional." },
  { id: "dialogues", phase: "discover", kind: "dialogues", flag: "examples", title: "Em situações reais", competence: "Uso em contexto", criterion: "Ler os diálogos." },
  { id: "comprehension", phase: "understand", kind: "quiz", flag: null, title: "Entendi o diálogo?", competence: "Compreensão leitora", criterion: "Responder a todas as perguntas." },
  { id: "listening", phase: "understand", kind: "quiz", flag: "listening", title: "Ouça e reconheça", competence: "Compreensão auditiva", criterion: "Reconhecer as frases ouvidas." },
  { id: "choose", phase: "understand", kind: "quiz", flag: "mistakes", title: "Escolha a frase certa", competence: "Precisão e adequação", criterion: "Responder a todas as perguntas." },
  { id: "recall", phase: "recall", kind: "recall", flag: "review", title: "Lembre em inglês", competence: "Recuperação ativa", criterion: "Tentar todas as frases sem ver a resposta." },
  { id: "cloze", phase: "recall", kind: "cloze", flag: null, title: "Complete a conversa", competence: "Recuperação em contexto", criterion: "Completar todas as falas." },
  { id: "produce", phase: "recall", kind: "produce", flag: "practice", title: "Sua resposta", competence: "Produção escrita", criterion: "Enviar uma resposta e receber a correção." },
  { id: "conversation", phase: "converse", kind: "conversation", flag: "conversation", title: "Conversa com o Neo", competence: "Produção oral e interação", criterion: "Usar as 3 expressões da missão sem erro apontado." },
  { id: "challenge", phase: "demonstrate", kind: "challenge", flag: "challenge", title: "Desafio final", competence: "Competência do capítulo", criterion: "Receber avaliação \"correto\" ou \"quase\" da correção por IA." },
];

export const ACTIVITY_XP = 2;

// Dificuldade do conteúdo do capítulo (não é o nível do aluno).
export const DIFFICULTY_LABEL = {
  Beginner: "Conteúdo inicial",
  Elementary: "Conteúdo básico",
  Intermediate: "Conteúdo intermediário",
  Advanced: "Conteúdo avançado",
};

export const STATUS_LABELS = {
  viewed: "Visto",
  attempted: "Feito",
  correct: "Correto",
  demonstrated: "Demonstrado",
  legacy: "Marcado antes",
};

export function getChapter(chapterId) {
  return learningJourneyChapters.find((chapter) => chapter.id === chapterId) || null;
}

export function getCurriculum(chapterId) {
  return journeyCurriculum[chapterId] || null;
}

export function getActivity(activityId) {
  return JOURNEY_ACTIVITIES.find((activity) => activity.id === activityId) || null;
}

export function normalizeProgress(progress) {
  return { ...getInitialJourneyProgress(), ...(progress || {}) };
}

/** Estado de uma atividade. Marcações antigas sem registro novo contam como "legacy". */
export function getActivityRecord(progress, chapterId, activityId) {
  const chapterState = normalizeProgress(progress).chapterProgress?.[chapterId] || {};
  const record = chapterState.activities?.[activityId];
  if (record?.status) return record;
  const activity = getActivity(activityId);
  if (activity?.flag && chapterState[activity.flag]) return { status: "legacy" };
  return null;
}

export function isActivityDone(record, activityId) {
  if (!record) return false;
  if (activityId === "challenge") return ["demonstrated", "legacy"].includes(record.status);
  if (activityId === "conversation") return ["correct", "legacy"].includes(record.status);
  return ["viewed", "attempted", "correct", "demonstrated", "legacy"].includes(record.status);
}

export function getChapterActivities(progress, chapterId) {
  return JOURNEY_ACTIVITIES.map((activity) => {
    const record = getActivityRecord(progress, chapterId, activity.id);
    return { ...activity, record, done: isActivityDone(record, activity.id) };
  });
}

export function getNextActivity(progress, chapterId) {
  return getChapterActivities(progress, chapterId).find((activity) => !activity.done) || null;
}

export function canCompleteChapter(progress, chapterId) {
  return getChapterActivities(progress, chapterId).every((activity) => activity.done);
}

export function isChapterUnlocked(progress, chapterId) {
  const state = normalizeProgress(progress);
  const completed = new Set(state.completedChapterIds || []);
  const index = learningJourneyChapters.findIndex((chapter) => chapter.id === chapterId);
  const activeIndex = Math.max(0, learningJourneyChapters.findIndex((chapter) => chapter.id === state.activeChapterId));
  return completed.has(chapterId) || index <= activeIndex;
}

/** Novo estado da Jornada com o resultado de uma atividade. Nunca rebaixa um status já alcançado. */
const STATUS_RANK = { legacy: 0, viewed: 1, attempted: 2, correct: 3, demonstrated: 4 };

export function applyActivityResult(progress, chapterId, activityId, result) {
  const state = normalizeProgress(progress);
  const chapterState = state.chapterProgress?.[chapterId] || {};
  const previous = chapterState.activities?.[activityId] || null;
  const now = new Date().toISOString();
  const keepPrevious = previous && (STATUS_RANK[previous.status] ?? 0) > (STATUS_RANK[result.status] ?? 0);
  const record = {
    ...(previous || {}),
    ...result,
    status: keepPrevious ? previous.status : result.status,
    attempts: (previous?.attempts || 0) + (result.status === "viewed" ? 0 : 1),
    updatedAt: now,
  };
  const activity = getActivity(activityId);
  const flagValue = activity?.flag && isActivityDone(record, activityId) ? { [activity.flag]: true } : {};
  return {
    ...state,
    chapterProgress: {
      ...state.chapterProgress,
      [chapterId]: {
        ...chapterState,
        ...flagValue,
        lastActivityId: activityId,
        activities: { ...(chapterState.activities || {}), [activityId]: record },
      },
    },
    lastUpdatedAt: now,
  };
}

/** XP só na primeira vez que a atividade fica concluída. */
export function earnsActivityXp(previousRecord, nextRecord, activityId) {
  return !isActivityDone(previousRecord, activityId) && isActivityDone(nextRecord, activityId);
}

// ---------- montagem dos exercícios (determinística, a partir do conteúdo do capítulo) ----------

function hash(text) {
  let value = 0;
  for (const char of String(text)) value = (value * 31 + char.charCodeAt(0)) >>> 0;
  return value;
}

/** Embaralha de forma estável: o mesmo capítulo mostra sempre a mesma ordem. */
export function stableShuffle(items, seed) {
  return items
    .map((item, index) => ({ item, key: hash(`${seed}:${index}:${JSON.stringify(item)}`) }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item);
}

function otherChapters(chapterId) {
  const index = learningJourneyChapters.findIndex((chapter) => chapter.id === chapterId);
  return [...learningJourneyChapters.slice(index + 1), ...learningJourneyChapters.slice(0, index)];
}

const youLine = (example) => (example.dialogue || []).find((line) => line.speaker === "you");

function makeQuestion(id, seed, prompt, correct, distractors, explanation, extra = {}) {
  const options = stableShuffle([correct, ...distractors.filter((item) => item && item !== correct).slice(0, 2)], `${seed}:${id}`);
  return { id, prompt, options, answer: options.indexOf(correct), explanation, ...extra };
}

export function buildComprehension(chapter) {
  const foreign = otherChapters(chapter.id).flatMap((item) => (item.examples || []).map((example) => youLine(example)?.pt)).filter(Boolean);
  return (chapter.examples || []).map((example, index) => {
    const line = youLine(example);
    return makeQuestion(
      `comprehension-${index}`,
      chapter.id,
      "O que a sua fala quer dizer?",
      line.pt,
      [foreign[index * 2], foreign[index * 2 + 1]],
      `"${example.expression}" — ${example.note || ""}`.trim(),
      { context: example.situation, dialogue: example.dialogue.map(({ speaker, en }) => ({ speaker, en })) },
    );
  });
}

export function buildListening(chapter) {
  const lines = (chapter.examples || []).map((example) => youLine(example)?.en).filter(Boolean);
  return lines.slice(0, 2).map((line, index) => makeQuestion(
    `listening-${index}`,
    chapter.id,
    "Ouça a frase e escolha a que você ouviu.",
    line,
    lines.filter((item) => item !== line),
    "Ouça de novo prestando atenção no começo e no fim da frase.",
    { audio: line },
  ));
}

export function buildChoose(chapter) {
  const mistakes = (chapter.commonMistakes || []).slice(0, 2).map((mistake, index) => makeQuestion(
    `mistake-${index}`,
    chapter.id,
    "Qual frase está correta?",
    mistake.correct,
    [mistake.wrong],
    mistake.reason,
  ));
  const foreignExpressions = otherChapters(chapter.id).flatMap((item) => (item.examples || []).map((example) => example.expression));
  const situations = (chapter.examples || []).slice(0, 2).map((example, index) => makeQuestion(
    `situation-${index}`,
    chapter.id,
    `Situação: ${example.situation}. Qual frase combina?`,
    example.expression,
    [foreignExpressions[index * 3], foreignExpressions[index * 3 + 1]],
    example.note || "",
  ));
  return [...mistakes, ...situations];
}

export function buildRecallItems(chapter) {
  const blocks = chapter.mindBlocks || [];
  const picks = [0, Math.floor(blocks.length / 2), blocks.length - 1].filter((value, index, list) => list.indexOf(value) === index);
  return picks.map((index) => ({ id: `recall-${index}`, prompt: blocks[index][1], expected: blocks[index][0] }));
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function buildClozeItems(chapter) {
  return (chapter.examples || []).map((example, index) => {
    const line = youLine(example);
    const core = example.expression.replace(/[.!?]+$/, "");
    const match = line.en.match(new RegExp(escapeRegExp(core), "i"));
    if (!match) return null;
    return {
      id: `cloze-${index}`,
      context: example.situation,
      before: example.dialogue.filter((item) => item !== line).map(({ speaker, en }) => ({ speaker, en })),
      prefix: line.en.slice(0, match.index),
      suffix: line.en.slice(match.index + match[0].length),
      answer: match[0],
      hint: example.translation || "",
    };
  }).filter(Boolean);
}

export const PHASE_OF = Object.fromEntries(JOURNEY_ACTIVITIES.map((activity) => [activity.id, activity.phase]));
