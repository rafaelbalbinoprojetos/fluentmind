import { describe, expect, it } from "vitest";
import { learningJourneyChapters } from "../learningJourney.js";

describe("Learning Journey real examples", () => {
  it.each(learningJourneyChapters.map((chapter) => [chapter.id, chapter]))("%s uses each MindBlock inside a dialogue", (_id, chapter) => {
    expect(chapter.examples.length).toBeGreaterThanOrEqual(3);
    for (const example of chapter.examples) {
      expect(example.translation, example.expression).not.toBe("");
      const core = example.expression.replace(/[.!?]+$/, "").toLowerCase();
      const youLines = example.dialogue.filter((line) => line.speaker === "you").map((line) => line.en.toLowerCase());
      expect(youLines.some((line) => line.includes(core)), example.expression).toBe(true);
      expect(example.dialogue.length).toBeGreaterThanOrEqual(2);
      for (const line of example.dialogue) expect(line.pt).toBeTruthy();
    }
  });
});
