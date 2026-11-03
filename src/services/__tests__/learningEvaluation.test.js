import { describe, expect, it } from "vitest";
import {
  EVALUATION_CONFIG,
  aggregateTargetEvidence,
  isMissionAccomplished,
  missionGap,
  normalizeAnswerEvaluation,
  normalizeCriteria,
  normalizeTargetEvaluation,
  relevantTargets,
} from "../../../shared/learningEvaluation.js";
import { answerCases, challengeCriteria, missionTargets, targetCases } from "../../../tests/fixtures/evaluationCases.js";
import { journeyCurriculum } from "../../data/journeyCurriculum.js";

describe("evaluation battery: open answers and challenges", () => {
  it.each(answerCases.map((item) => [item.category, item.name, item]))("%s — %s", (_category, _name, item) => {
    const result = normalizeAnswerEvaluation(item.model, { criteria: challengeCriteria, difficulty: "Beginner" });
    expect(result).toMatchObject(item.expect);
  });

  it("is stricter for advanced content with the same answer", () => {
    const model = { score: 70, verdict: "almost", onTopic: true, confidence: "high", criteria: challengeCriteria.map((item, index) => ({ criterion: item.text, status: index === 0 ? "met" : "partial" })) };
    expect(normalizeAnswerEvaluation(model, { criteria: challengeCriteria, difficulty: "Beginner" }).passed).toBe(true);
    expect(normalizeAnswerEvaluation(model, { criteria: challengeCriteria, difficulty: "Advanced" }).passed).toBe(false);
  });

  it("uses configurable parameters, not hard-coded numbers", () => {
    const model = { score: 70, verdict: "almost", onTopic: true, confidence: "high", criteria: challengeCriteria.map((item) => ({ criterion: item.text, status: "partial" })) };
    const strict = { ...EVALUATION_CONFIG, essentialAccepts: ["met"] };
    expect(normalizeAnswerEvaluation(model, { criteria: challengeCriteria }).passed).toBe(false); // 50% < 60%
    const lenient = { ...EVALUATION_CONFIG, passThreshold: { Beginner: 0.5 } };
    expect(normalizeAnswerEvaluation(model, { criteria: challengeCriteria, config: lenient }).passed).toBe(true);
    expect(normalizeAnswerEvaluation(model, { criteria: challengeCriteria, config: { ...lenient, essentialAccepts: strict.essentialAccepts } }).passed).toBe(false);
  });

  it("keeps the old contract: plain-text criteria and the verdict field", () => {
    expect(normalizeCriteria(["Diz o nome"])).toEqual([{ text: "Diz o nome", essential: false }]);
    const result = normalizeAnswerEvaluation({ score: 55, verdict: "almost", feedback: "x" });
    expect(result).toMatchObject({ verdict: "almost", passed: true, essentialsMet: null });
  });

  it("every chapter challenge has 1-3 essential criteria and grammar is complementary", () => {
    for (const [id, curriculum] of Object.entries(journeyCurriculum)) {
      const essentials = curriculum.challenge.criteria.filter((item) => item.essential);
      expect(essentials.length, id).toBeGreaterThanOrEqual(1);
      expect(essentials.length, id).toBeLessThanOrEqual(3);
      const grammar = curriculum.challenge.criteria.find((item) => /gramatica/i.test(item.text.normalize("NFD").replace(/[̀-ͯ]/g, "")));
      expect(grammar?.essential, id).toBe(false);
    }
  });
});

describe("evaluation battery: Neo target expressions", () => {
  it.each(targetCases.map((item) => [item.category, item.name, item]))("%s — %s", (_category, _name, item) => {
    const expression = item.model.targets[0].expression;
    const result = normalizeTargetEvaluation(item.model, [expression]);
    expect(result.map((entry) => entry.status)).toEqual(item.expect);
  });

  it("only sends targets whose content words appear in the message", () => {
    expect(relevantTargets(missionTargets, "I'm working in tech")).toEqual([missionTargets[1]]);
    expect(relevantTargets(missionTargets, "Brazil is far from here. Nice!")).toEqual([missionTargets[0], missionTargets[2]]);
    expect(relevantTargets(missionTargets, "Yes, sure.")).toEqual([]);
  });
});

describe("mission completion rule", () => {
  const entry = (expression, status, autonomous = true) => ({ expression, status, autonomous, impact: status === "adequate" ? "none" : "minor" });

  it("needs at least one adequate and autonomous use; the others may be partial", () => {
    const evidence = aggregateTargetEvidence(missionTargets, [[
      entry(missionTargets[0], "adequate"), entry(missionTargets[1], "partial"), entry(missionTargets[2], "partial"),
    ]]);
    expect(isMissionAccomplished(evidence)).toBe(true);
  });

  it("does not count copied adequate uses as independent demonstration", () => {
    const evidence = aggregateTargetEvidence(missionTargets, [[
      entry(missionTargets[0], "partial", false), entry(missionTargets[1], "partial"), entry(missionTargets[2], "partial"),
    ]]);
    expect(isMissionAccomplished(evidence)).toBe(false);
    expect(missionGap(evidence).reason).toMatch(/sozinho/);
  });

  it("never completes with an inadequate or inconclusive expression and explains the gap", () => {
    const evidence = aggregateTargetEvidence(missionTargets, [[
      entry(missionTargets[0], "adequate"), entry(missionTargets[1], "inadequate"), entry(missionTargets[2], "partial"),
    ]]);
    expect(isMissionAccomplished(evidence)).toBe(false);
    expect(missionGap(evidence)).toMatchObject({ expression: missionTargets[1], reason: expect.stringMatching(/muda o sentido/) });
  });

  it("allows retries and keeps every attempt (best result wins)", () => {
    const evidence = aggregateTargetEvidence(missionTargets, [
      [entry(missionTargets[0], "inadequate")],
      [entry(missionTargets[0], "adequate")],
      [entry(missionTargets[1], "partial"), entry(missionTargets[2], "partial")],
    ]);
    expect(evidence[0]).toMatchObject({ status: "adequate", attempts: 2 });
    expect(isMissionAccomplished(evidence)).toBe(true);
  });
});
