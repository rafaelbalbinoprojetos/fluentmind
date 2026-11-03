import { getInitialJourneyProgress, learningJourneyChapters } from "../data/learningJourney.js";
import { getChapterActivities } from "./journeyEngine.js";

// Regras fixas, em ordem de prioridade. Não há motor adaptativo: cada recomendação
// vem de dados reais e devolve o motivo e as evidências usadas.
//  1. Revisões vencidas, se ainda não houve revisão hoje (depois disso a Jornada segue).
//  2. Correções vencidas, com a mesma regra.
//  3. Próxima etapa do capítulo ativo da Jornada.
//  4. Conversa com o Neo.

const STEP_LABELS = {
  lesson: "ler o que você vai aprender",
  expressions: "conhecer as expressões",
  dialogues: "ver as expressões em situações reais",
  comprehension: "responder às perguntas do diálogo",
  listening: "ouvir e reconhecer as frases",
  choose: "escolher a frase certa",
  recall: "lembrar as frases em inglês",
  cloze: "completar a conversa",
  produce: "escrever a sua resposta",
  conversation: "conversar com o Neo sobre o capítulo",
  challenge: "fazer o desafio final",
};

export function getJourneySnapshot(journeyProgress) {
  const progress = { ...getInitialJourneyProgress(), ...(journeyProgress || {}) };
  const completed = new Set(progress.completedChapterIds || []);
  const chapter = learningJourneyChapters.find((item) => item.id === progress.activeChapterId && !completed.has(item.id))
    || learningJourneyChapters.find((item) => !completed.has(item.id))
    || null;
  if (!chapter) return { finished: true, chapter: null, pendingStep: null, doneSteps: 0, totalSteps: 0, started: true };
  const checklist = getChapterActivities(progress, chapter.id);
  const pending = checklist.find((item) => !item.done) || null;
  return {
    finished: false,
    chapter,
    chapterNumber: learningJourneyChapters.indexOf(chapter) + 1,
    pendingStep: pending ? { id: pending.id, label: STEP_LABELS[pending.id] || pending.title } : null,
    doneSteps: checklist.filter((item) => item.done).length,
    totalSteps: checklist.length,
    started: completed.size > 0 || Object.keys(progress.chapterProgress || {}).length > 0,
    // Etapas do capítulo vêm do motor da Jornada 2.0 (journeyEngine).
  };
}

/**
 * @param {object} input
 * @param {number|null} input.dueReviews  MindBlocks vencidos (null = desconhecido, ex.: falha ao carregar)
 * @param {number|null} input.dueCorrections  correções vencidas (null = desconhecido)
 * @param {boolean} input.reviewedToday  já concluiu ao menos uma revisão hoje
 * @param {object} input.journeyProgress  estado salvo da Jornada
 */
export function getNextStep({ dueReviews = null, dueCorrections = null, reviewedToday = false, journeyProgress = null } = {}) {
  const journey = getJourneySnapshot(journeyProgress);
  const journeyEvidence = journey.chapter ? `Capítulo ${journey.chapterNumber}: ${journey.doneSteps}/${journey.totalSteps} etapas` : null;

  if (dueReviews > 0 && !reviewedToday) {
    return {
      id: "review",
      title: "Recuperar o que está vencido",
      reason: `${dueReviews} ${dueReviews === 1 ? "expressão chegou" : "expressões chegaram"} à data de revisão. Lembrar antes de ver a resposta fortalece a memória.`,
      to: "/daily-workout",
      evidence: [`${dueReviews} na revisão espaçada`, "Nenhuma revisão hoje"],
    };
  }

  if (dueCorrections > 0 && !reviewedToday) {
    return {
      id: "corrections",
      title: "Revisar suas correções",
      reason: `${dueCorrections} ${dueCorrections === 1 ? "erro corrigido está pronto" : "erros corrigidos estão prontos"} para revisão. Revisar o próprio erro evita que ele volte.`,
      to: "/insights",
      evidence: [`${dueCorrections} correções vencidas`, "Nenhuma revisão hoje"],
    };
  }

  if (journey.chapter) {
    const step = journey.pendingStep;
    const conversation = step?.id === "conversation";
    return {
      id: "journey",
      title: journey.started ? `Continuar: ${journey.chapter.title}` : `Começar a Jornada: ${journey.chapter.title}`,
      reason: step
        ? `Próxima etapa do capítulo ${journey.chapterNumber}: ${step.label}.`
        : `Todas as etapas do capítulo ${journey.chapterNumber} estão feitas. Conclua o capítulo para liberar o próximo.`,
      to: conversation
        ? `/neo?journey=${journey.chapter.id}`
        : `/learning-journey?chapter=${journey.chapter.id}${step ? `&activity=${step.id}` : ""}`,
      evidence: [journeyEvidence, reviewedToday && dueReviews > 0 ? `${dueReviews} revisões ficam para depois` : null].filter(Boolean),
    };
  }

  return {
    id: "conversation",
    title: "Usar o que você aprendeu numa conversa",
    reason: "A Jornada está concluída e não há revisões pendentes. Conversar é o melhor jeito de usar as expressões em contexto.",
    to: "/neo",
    evidence: ["Jornada concluída"],
  };
}
