import { describe, expect, it } from "vitest";
import { buildJourneyMission, findUsedTargets, targetPattern } from "../conversationMission.js";

describe("conversation mission", () => {
  it("keeps the reusable core of an expression", () => {
    expect(targetPattern("I'm from Brazil.")).toBe("i'm from");
    expect(targetPattern("I work in technology.")).toBe("i work in");
    expect(targetPattern("Nice to meet you.")).toBe("nice to meet");
  });

  it("builds a three-target mission with a guiding scenario", () => {
    const mission = buildJourneyMission("about-me");
    expect(mission.targets).toHaveLength(3);
    expect(mission.scenario).toContain(mission.targets[0].expression);
    expect(buildJourneyMission("missing-chapter")).toBeNull();
  });

  it("detects targets used with the student's own details", () => {
    const targets = [{ pattern: "i'm from" }, { pattern: "i work in" }, { pattern: "nice to meet" }];
    expect(findUsedTargets(targets, ["Hi! I’m from Minas.", "Actually I work in a hospital"])).toEqual([0, 1]);
    expect(findUsedTargets(targets, ["I'm fromage lover"])).toEqual([]);
  });
});
