import { describe, expect, it } from "vitest";
import { getNextStep, getJourneySnapshot } from "../nextStep.js";
import { learningJourneyChapters } from "../../data/learningJourney.js";

const allChapters = learningJourneyChapters.map((chapter) => chapter.id);

describe("getNextStep", () => {
  it("sends due reviews first and explains why", () => {
    const step = getNextStep({ dueReviews: 4, dueCorrections: 2, reviewedToday: false });
    expect(step.id).toBe("review");
    expect(step.to).toBe("/daily-workout");
    expect(step.reason).toMatch(/4 expressões/);
    expect(step.evidence.length).toBeGreaterThan(0);
  });

  it("does not let due reviews block the Journey after a review today", () => {
    const step = getNextStep({ dueReviews: 30, dueCorrections: 5, reviewedToday: true });
    expect(step.id).toBe("journey");
    expect(step.evidence).toContain("30 revisões ficam para depois");
  });

  it("uses corrections before the Journey when nothing was reviewed today", () => {
    expect(getNextStep({ dueReviews: 0, dueCorrections: 2 }).id).toBe("corrections");
  });

  it("skips review rules when the data is unknown (load failure)", () => {
    expect(getNextStep({ dueReviews: null, dueCorrections: null }).id).toBe("journey");
  });

  it("points to the first pending step of the active chapter", () => {
    const journeyProgress = { activeChapterId: "about-me", chapterProgress: { "about-me": { lesson: true, vocabulary: true } } };
    const step = getNextStep({ dueReviews: 0, journeyProgress });
    expect(step.title).toMatch(/^Continuar/);
    expect(step.reason).toMatch(/ver as expressões em situações reais/);
    expect(step.to).toBe("/learning-journey?chapter=about-me&activity=dialogues");
  });

  it("opens the Neo mission when the pending step is the conversation", () => {
    const done = {
      lesson: true, vocabulary: true, examples: true, mistakes: true, review: true, listening: true, practice: true,
      activities: { comprehension: { status: "correct" }, cloze: { status: "attempted" } },
    };
    const step = getNextStep({ journeyProgress: { activeChapterId: "about-me", chapterProgress: { "about-me": done } } });
    expect(step.to).toBe("/neo?journey=about-me");
  });

  it("recommends a conversation when the Journey is finished", () => {
    const step = getNextStep({ dueReviews: 0, dueCorrections: 0, journeyProgress: { completedChapterIds: allChapters } });
    expect(step.id).toBe("conversation");
    expect(getJourneySnapshot({ completedChapterIds: allChapters }).finished).toBe(true);
  });

  it("is deterministic", () => {
    const input = { dueReviews: 1, dueCorrections: 0, reviewedToday: false };
    expect(getNextStep(input)).toEqual(getNextStep(input));
  });
});

describe("getNextStep for a brand-new student", () => {
  it("starts the Journey instead of looping on conversation", () => {
    const step = getNextStep({ dueReviews: 0, dueCorrections: 0, reviewedToday: false, journeyProgress: null });
    expect(step.id).toBe("journey");
    expect(step.title).toMatch(/^Começar a Jornada/);
    expect(step.to).toBe("/learning-journey?chapter=about-me&activity=lesson");
  });

  it("only reaches the conversation fallback when every chapter is complete", () => {
    for (const chapterId of allChapters.slice(0, -1)) {
      const completed = allChapters.filter((id) => id !== chapterId);
      expect(getNextStep({ journeyProgress: { completedChapterIds: completed } }).id).toBe("journey");
    }
  });

  it("keeps the Journey after a review even with due corrections and many reviews", () => {
    const step = getNextStep({ dueReviews: 12, dueCorrections: 7, reviewedToday: true, journeyProgress: { activeChapterId: "about-me" } });
    expect(step.id).toBe("journey");
  });
});
