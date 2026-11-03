import { createMindBlock, listMindBlocks } from "./mindblocks.js";
import { normalizeAnswer } from "./answerCheck.js";

// Frases reais dos diálogos: primeiro as do próprio MindBlock, depois as dos outros exemplos do capítulo.
export function exampleSentencesFor(chapter, expression) {
  const examples = chapter.examples || [];
  const ownLines = (example) => (example.dialogue || []).filter((line) => line.speaker === "you").map((line) => line.en);
  const own = examples.filter((example) => example.expression === expression).flatMap(ownLines);
  const others = examples.filter((example) => example.expression !== expression).flatMap(ownLines);
  const sentences = [...own, ...others].slice(0, 2);
  return sentences.length ? sentences : [expression];
}

export function createChapterMindBlockPayload(chapter, [expression, translation]) {
  return {
    expression,
    translation,
    category: `Journey: ${chapter.title}`,
    source: "Learning Journey",
    context: chapter.objective,
    notes: `Saved from Learning Journey chapter ${chapter.order}: ${chapter.title}.`,
    meta: {
      usage: chapter.objective,
      examples: exampleSentencesFor(chapter, expression),
      pattern: `${expression.split(" ").slice(0, 3).join(" ")} + context`,
      patternExplanation: chapter.intro,
      commonMistake: chapter.commonMistakes?.[0] ? {
        wrong: chapter.commonMistakes[0].wrong,
        correct: chapter.commonMistakes[0].correct,
        explanation: chapter.commonMistakes[0].reason,
      } : null,
      relatedExpressions: chapter.mindBlocks.slice(0, 3).map(([itemExpression, itemTranslation]) => ({
        expression: itemExpression,
        translation: itemTranslation,
      })),
      practice: chapter.finalChallenge,
    },
  };
}

/**
 * Salva expressões na revisão espaçada sem duplicar: pula as que o aluno já tem.
 * Devolve { created, skipped }.
 */
export async function saveExpressionsToReview(userId, payloads) {
  const existing = await listMindBlocks(userId);
  const known = new Set((existing || []).map((item) => normalizeAnswer(item.expression)));
  const created = [];
  let skipped = 0;
  for (const payload of payloads) {
    const key = normalizeAnswer(payload.expression);
    if (known.has(key)) {
      skipped += 1;
      continue;
    }
    created.push(await createMindBlock(payload, { userId, mode: "review" }));
    known.add(key);
  }
  return { created, skipped };
}
