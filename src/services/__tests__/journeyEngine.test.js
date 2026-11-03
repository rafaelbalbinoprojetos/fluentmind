import { describe, expect, it } from "vitest";
import { learningJourneyChapters } from "../../data/learningJourney.js";
import { journeyCurriculum } from "../../data/journeyCurriculum.js";
import {
  JOURNEY_ACTIVITIES,
  applyActivityResult,
  buildChoose,
  buildClozeItems,
  buildComprehension,
  buildListening,
  buildRecallItems,
  canCompleteChapter,
  earnsActivityXp,
  getActivityRecord,
  getNextActivity,
} from "../journeyEngine.js";
import { evaluateMissionTargets } from "../conversationMission.js";

describe.each(learningJourneyChapters.map((chapter) => [chapter.id, chapter]))("chapter %s content", (_id, chapter) => {
  it("has handwritten curriculum with goal, pattern, produce and challenge criteria", () => {
    const curriculum = journeyCurriculum[chapter.id];
    expect(curriculum.goal).toBeTruthy();
    expect(curriculum.pattern.form).toBeTruthy();
    expect(curriculum.points.length).toBeGreaterThanOrEqual(2);
    expect(curriculum.produce.situation).toBeTruthy();
    expect(curriculum.challenge.criteria.length).toBeGreaterThanOrEqual(3);
  });

  it("builds unambiguous closed questions with exactly one right answer", () => {
    for (const question of [...buildComprehension(chapter), ...buildListening(chapter), ...buildChoose(chapter)]) {
      expect(new Set(question.options).size).toBe(question.options.length);
      expect(question.options.length).toBeGreaterThanOrEqual(2);
      expect(question.answer).toBeGreaterThanOrEqual(0);
    }
    expect(buildComprehension(chapter).length).toBeGreaterThanOrEqual(3);
    expect(buildListening(chapter).length).toBe(2);
  });

  it("builds cloze items from every real dialogue and recall prompts in Portuguese", () => {
    expect(buildClozeItems(chapter).length).toBe(chapter.examples.length);
    for (const item of buildRecallItems(chapter)) expect(item.prompt).not.toBe(item.expected);
  });

  it("has accented, non-empty Portuguese translations", () => {
    for (const [expression, translation] of chapter.mindBlocks) {
      expect(translation, expression).toBeTruthy();
      expect(translation, expression).not.toMatch(/\b(voce|nao|ingles|familia|reuniao)\b/i);
    }
  });
});

describe("activity state", () => {
  it("never downgrades a status and counts attempts", () => {
    let progress = applyActivityResult({}, "about-me", "choose", { status: "correct", score: 4, total: 4 });
    progress = applyActivityResult(progress, "about-me", "choose", { status: "attempted", score: 2, total: 4 });
    const record = getActivityRecord(progress, "about-me", "choose");
    expect(record.status).toBe("correct");
    expect(record.attempts).toBe(2);
    expect(progress.chapterProgress["about-me"].mistakes).toBe(true);
  });

  it("gives XP only on the first completion", () => {
    const first = getActivityRecord(applyActivityResult({}, "about-me", "lesson", { status: "viewed" }), "about-me", "lesson");
    expect(earnsActivityXp(null, first, "lesson")).toBe(true);
    expect(earnsActivityXp(first, first, "lesson")).toBe(false);
  });

  it("does not count a failed challenge or an unverified conversation as done", () => {
    let progress = {};
    for (const activity of JOURNEY_ACTIVITIES) progress = applyActivityResult(progress, "about-me", activity.id, { status: "attempted" });
    expect(canCompleteChapter(progress, "about-me")).toBe(false);
    expect(getNextActivity(progress, "about-me").id).toBe("conversation");
    progress = applyActivityResult(progress, "about-me", "conversation", { status: "correct" });
    progress = applyActivityResult(progress, "about-me", "challenge", { status: "demonstrated" });
    expect(canCompleteChapter(progress, "about-me")).toBe(true);
  });

  it("reads old checklist flags as legacy progress", () => {
    const progress = { chapterProgress: { "about-me": { lesson: true, conversation: true } } };
    expect(getActivityRecord(progress, "about-me", "lesson").status).toBe("legacy");
    expect(getActivityRecord(progress, "about-me", "comprehension")).toBeNull();
  });
});

describe("Neo mission evidence", () => {
  const targets = [{ expression: "I'm from Brazil.", pattern: "i'm from" }, { expression: "I work in technology.", pattern: "i work in" }];

  it("keeps the best evaluated status of each target across messages", () => {
    const evidence = evaluateMissionTargets(targets, [
      { content: "I from Brazil", targetEvaluation: [{ expression: targets[0].expression, status: "inadequate", feedback: "Falta o verbo." }, { expression: targets[1].expression, status: "unused" }] },
      { content: "I'm from Brazil", targetEvaluation: [{ expression: targets[0].expression, status: "partial" }, { expression: targets[1].expression, status: "unused" }] },
    ]);
    expect(evidence.map((item) => item.status)).toEqual(["partial", "unused"]);
    expect(evidence[0].attempts).toBe(2);
  });

  it("never approves a message without evaluation, even if the words appear", () => {
    const evidence = evaluateMissionTargets(targets, [{ content: "I'm from Brazil. I work in technology.", correction: null }]);
    expect(evidence.map((item) => item.status)).toEqual(["inconclusive", "inconclusive"]);
  });
});
