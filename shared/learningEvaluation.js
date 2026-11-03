// Avaliação pedagógica compartilhada entre a API (/api/chat, /api/review-check) e o app.
// Funções puras: validam o que o modelo devolveu e aplicam a política de aprovação.
// Regra geral: na dúvida ou na falha, o resultado é "inconclusive" e nada é aprovado.

export const TARGET_STATUSES = ["adequate", "partial", "inadequate", "unused", "inconclusive"];
export const ASSESSMENTS = ["correct", "almost", "wrong", "inconclusive"];
export const CRITERION_STATUSES = ["met", "partial", "not_met"];

// Parâmetros pedagógicos iniciais e configuráveis. NÃO são medidas científicas de proficiência:
// servem para calibrar a exigência por dificuldade do conteúdo e devem ser revistos com dados reais.
export const EVALUATION_CONFIG = {
  // Fração mínima dos critérios (met = 1, partial = 0,5), por dificuldade do conteúdo do capítulo.
  passThreshold: { Beginner: 0.6, Elementary: 0.65, Intermediate: 0.7, Advanced: 0.75 },
  // Pior status aceito num critério essencial ("partial" = erro leve, sentido preservado).
  essentialAccepts: ["met", "partial"],
  // Missão do Neo: quantas expressões precisam de uso adequado E autônomo.
  missionMinAutonomousAdequate: 1,
};
export const PASS_THRESHOLD = EVALUATION_CONFIG.passThreshold;

const text = (value, max = 400) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Aceita critérios como texto (contrato antigo) ou { text, essential }. */
export function normalizeCriteria(criteria = []) {
  return (Array.isArray(criteria) ? criteria : [])
    .map((item) => (typeof item === "string" ? { text: text(item, 160), essential: false } : { text: text(item?.text, 160), essential: Boolean(item?.essential) }))
    .filter((item) => item.text)
    .slice(0, 6);
}

// ---------- Neo: avaliação por expressão-alvo ----------

const STOPWORDS = new Set("i i'm im a an the to of in on at is am are be my me you your it this that and or for with do does can please".split(" "));
const words = (value) => String(value || "").toLowerCase().replace(/[’`]/g, "'").replace(/[^a-z0-9'\s]/g, " ").split(/\s+/).filter(Boolean);
const stem = (word) => word.replace(/'s$/, "").replace(/(ing|ed|es|s)$/, "");

/**
 * Pré-filtro barato antes de chamar a IA: uma expressão só é avaliada se a mensagem tiver
 * alguma palavra de conteúdo dela (com variações simples: works/working → work).
 * Sem nenhuma palavra em comum, ela não foi usada nesta mensagem.
 */
export function relevantTargets(targets = [], message = "") {
  const said = new Set(words(message).map(stem));
  return targets.filter((expression) => {
    const content = words(expression).filter((word) => !STOPWORDS.has(word));
    const keys = (content.length ? content : words(expression)).map(stem);
    return keys.some((key) => said.has(key));
  });
}

function blankTarget(expression, status) {
  return { expression, status, feedback: "", suggestion: "", impact: null, autonomous: null };
}

/** Normaliza a avaliação de UMA mensagem para cada expressão-alvo. Qualquer item inválido vira "inconclusive". */
export function normalizeTargetEvaluation(parsed, targets = []) {
  const items = Array.isArray(parsed?.targets) ? parsed.targets : [];
  return targets.map((expression) => {
    const found = items.find((item) => text(item?.expression).toLowerCase() === text(expression).toLowerCase());
    if (!found || !TARGET_STATUSES.includes(found.status)) return blankTarget(expression, "inconclusive");
    let status = found.status;
    const impact = ["none", "minor", "blocks"].includes(found.impact) ? found.impact : null;
    const autonomous = typeof found.autonomous === "boolean" ? found.autonomous : null;
    // Coerência: erro que compromete o sentido nunca é aprovado; cópia do tutor não é uso independente.
    if (impact === "blocks" && (status === "adequate" || status === "partial")) status = "inadequate";
    if (impact === "minor" && status === "adequate") status = "partial";
    if (autonomous === false && status === "adequate") status = "partial";
    if ((status === "adequate" || status === "partial") && impact === null) status = "inconclusive";
    if (found.confidence === "low" && status !== "unused") status = "inconclusive";
    return { expression, status, feedback: text(found.feedback, 300), suggestion: text(found.suggestion, 200), impact, autonomous };
  });
}

export function inconclusiveTargets(targets = []) {
  return targets.map((expression) => blankTarget(expression, "inconclusive"));
}

export function unusedTargets(targets = []) {
  return targets.map((expression) => blankTarget(expression, "unused"));
}

const TARGET_RANK = { adequate: 4, partial: 3, inadequate: 2, inconclusive: 1, unused: 0 };
const isAutonomousAdequate = (item) => item.status === "adequate" && item.autonomous === true;

/** Melhor resultado de cada expressão ao longo da conversa. Nenhuma tentativa é apagada: todas contam em attempts. */
export function aggregateTargetEvidence(targets = [], evaluationsPerMessage = []) {
  return targets.map((expression) => {
    const results = evaluationsPerMessage
      .flatMap((evaluation) => evaluation || [])
      .filter((item) => item.expression === expression && item.status !== "unused");
    if (!results.length) return { expression, status: "unused", attempts: 0, autonomous: null, feedback: "", suggestion: "" };
    const best = results.reduce((top, item) => {
      if (TARGET_RANK[item.status] !== TARGET_RANK[top.status]) return TARGET_RANK[item.status] > TARGET_RANK[top.status] ? item : top;
      return isAutonomousAdequate(item) && !isAutonomousAdequate(top) ? item : top;
    });
    const latestWithFeedback = [...results].reverse().find((item) => item.feedback);
    return {
      expression,
      status: best.status,
      autonomous: best.autonomous ?? null,
      impact: best.impact ?? null,
      attempts: results.length,
      feedback: (best.status === "adequate" ? best.feedback : latestWithFeedback?.feedback) || "",
      suggestion: latestWithFeedback?.suggestion || "",
    };
  });
}

/**
 * Missão cumprida quando:
 *  - nenhuma expressão está inadequada, inconclusiva ou sem uso;
 *  - pelo menos N (config) foram usadas de forma adequada e autônoma;
 *  - as demais podem ser parciais (erro leve, sentido preservado).
 */
export function isMissionAccomplished(evidence = [], config = EVALUATION_CONFIG) {
  if (!evidence.length) return false;
  const allUsable = evidence.every((item) => item.status === "adequate" || item.status === "partial");
  const autonomous = evidence.filter(isAutonomousAdequate).length;
  return allUsable && autonomous >= config.missionMinAutonomousAdequate;
}

/** O que falta para cumprir a missão, em português, para orientar a próxima tentativa. */
export function missionGap(evidence = [], config = EVALUATION_CONFIG) {
  const pending = evidence.filter((item) => item.status !== "adequate" && item.status !== "partial");
  if (pending.length) {
    const item = pending.find((entry) => entry.status !== "unused") || pending[0];
    const reason = {
      unused: "ainda não apareceu na conversa",
      inadequate: "foi usada com um erro que muda o sentido",
      inconclusive: "não pôde ser avaliada com segurança",
    }[item.status];
    return { expression: item.expression, reason, feedback: item.feedback, suggestion: item.suggestion };
  }
  if (evidence.filter(isAutonomousAdequate).length < config.missionMinAutonomousAdequate) {
    return {
      expression: null,
      reason: "Falta usar uma das expressões sozinho, sem erro, numa frase sua (não vale repetir a fala do Neo).",
      feedback: "",
      suggestion: "",
    };
  }
  return null;
}

/** Correção geral da mensagem (mesmo formato de antes), quando vem dentro da avaliação combinada. */
export function normalizeCorrection(parsed, level = "A2") {
  if (!parsed?.hasMistake || !parsed?.wrong || !parsed?.correct) return null;
  return {
    wrong: text(parsed.wrong, 300),
    correct: text(parsed.correct, 300),
    explanation: text(parsed.explanation || "Correção detectada na sua mensagem.", 400),
    category: text(parsed.category || "Conversation", 60),
    level: text(parsed.level || level, 10),
    source: "user_message",
  };
}

// ---------- Respostas abertas e desafios ----------

/** Normaliza a correção de uma resposta aberta e decide se ela aprova a atividade. */
export function normalizeAnswerEvaluation(parsed, { criteria = [], difficulty = "Beginner", config = EVALUATION_CONFIG } = {}) {
  const list = normalizeCriteria(criteria);
  const score = Math.max(0, Math.min(100, Math.round(Number(parsed?.score) || 0)));
  const modelVerdict = ["correct", "almost", "wrong"].includes(parsed?.verdict) ? parsed.verdict : null;
  const onTopic = parsed?.onTopic !== false;
  const confident = parsed?.confidence !== "low";

  const rawCriteria = Array.isArray(parsed?.criteria) ? parsed.criteria : [];
  const criteriaResults = list.map((criterion, index) => {
    const found = rawCriteria.find((item) => text(item?.criterion).toLowerCase() === criterion.text.toLowerCase()) || rawCriteria[index];
    const status = CRITERION_STATUSES.includes(found?.status) ? found.status : null;
    return { criterion: criterion.text, essential: criterion.essential, status, comment: text(found?.comment, 200) };
  });
  const criteriaValid = criteriaResults.every((item) => item.status);
  const criteriaRatio = list.length
    ? criteriaResults.reduce((sum, item) => sum + (item.status === "met" ? 1 : item.status === "partial" ? 0.5 : 0), 0) / list.length
    : null;
  const essentialsMet = criteriaResults.filter((item) => item.essential).every((item) => config.essentialAccepts.includes(item.status));

  let assessment = modelVerdict || "inconclusive";
  if (!confident || (list.length && !criteriaValid)) assessment = "inconclusive";
  if (!onTopic) assessment = "wrong";
  // Coerência: o modelo não pode dizer "correto" com um critério essencial não atendido.
  if (assessment === "correct" && !essentialsMet) assessment = "almost";

  const threshold = config.passThreshold[difficulty] ?? config.passThreshold.Beginner;
  const passed = (assessment === "correct" || assessment === "almost")
    && essentialsMet
    && (criteriaRatio === null || criteriaRatio >= threshold);

  return {
    score,
    // "verdict" mantém o contrato antigo (correct | almost | wrong) para as telas de revisão.
    verdict: modelVerdict || (score >= 80 ? "correct" : score >= 50 ? "almost" : "wrong"),
    assessment,
    passed,
    onTopic,
    confidence: confident ? "high" : "low",
    criteria: criteriaResults,
    criteriaRatio,
    essentialsMet: list.length ? essentialsMet : null,
    threshold: list.length ? threshold : null,
    feedback: text(parsed?.feedback, 500),
    improvement: text(parsed?.improvement, 300),
    corrected: text(parsed?.corrected, 600),
    alternative: text(parsed?.alternative, 300),
  };
}
