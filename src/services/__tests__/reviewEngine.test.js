import { describe, expect, it } from "vitest";
import { fsrsStep, intervalFromStability, replayFsrs, retrievability, scheduleWithFsrs } from "../fsrs.js";
import { calculateSmartReview } from "../smartReview.js";
import { localSimilarity, normalizeAnswer } from "../answerCheck.js";

const DAY = 24 * 60 * 60 * 1000;

describe("FSRS", () => {
  it("primeira revisão: intervalos crescem de Hard para Easy", () => {
    const days = ["hard", "good", "easy"].map((result) => scheduleWithFsrs(null, result).intervalDays);
    expect(days[0]).toBeLessThan(days[1]);
    expect(days[1]).toBeLessThan(days[2]);
    expect(scheduleWithFsrs(null, "again").intervalDays).toBe(0);
  });

  it("lembrar no dia certo aumenta a estabilidade; esquecer derruba", () => {
    const first = fsrsStep(null, "good", 0);
    const recalled = fsrsStep(first, "good", first.stability);
    const forgot = fsrsStep(first, "again", first.stability);
    expect(recalled.stability).toBeGreaterThan(first.stability * 2);
    expect(forgot.stability).toBeLessThan(first.stability);
    expect(forgot.difficulty).toBeGreaterThan(first.difficulty);
  });

  it("com retenção de 90% o intervalo é a própria estabilidade", () => {
    expect(retrievability(10, 10)).toBeCloseTo(0.9, 2);
    expect(intervalFromStability(10)).toBe(10);
  });

  it("reconstrói o estado pelo histórico em ordem cronológica", () => {
    const now = Date.now();
    const events = [
      { result: "good", reviewed_at: new Date(now - 4 * DAY).toISOString() },
      { result: "good", reviewed_at: new Date(now - 10 * DAY).toISOString() },
    ];
    const state = replayFsrs(events);
    expect(state.stability).toBeGreaterThan(fsrsStep(null, "good", 0).stability);
  });

  it("calculateSmartReview usa o histórico do card e devolve data ISO", () => {
    const now = Date.now();
    const card = { id: "m1", reviewType: "mindblock", mastery: 40, timesReviewed: 2 };
    const reviewEvents = [
      { mindblock_id: "m1", result: "good", reviewed_at: new Date(now - 20 * DAY).toISOString() },
      { mindblock_id: "m1", result: "good", reviewed_at: new Date(now - 8 * DAY).toISOString() },
      { mindblock_id: "outro", result: "again", reviewed_at: new Date(now - DAY).toISOString() },
    ];
    const withHistory = calculateSmartReview(card, "good", { reviewEvents });
    const fresh = calculateSmartReview({ ...card, timesReviewed: 0 }, "good");
    expect(withHistory.intervalDays).toBeGreaterThan(fresh.intervalDays);
    expect(Number.isNaN(Date.parse(withHistory.nextReviewAtIso))).toBe(false);
  });
});

describe("comparação local de respostas", () => {
  it("contrações contam como iguais", () => {
    expect(normalizeAnswer("I'm from Brazil.")).toBe(normalizeAnswer("I am from Brazil"));
    expect(localSimilarity("I am from Brazil", "I'm from Brazil.")).toBe(100);
    expect(localSimilarity("I don't know", "I do not know")).toBe(100);
  });

  it("ordem errada pontua menos que ordem certa", () => {
    const right = localSimilarity("I work the night shift", "I work the night shift.");
    const scrambled = localSimilarity("shift night the work I", "I work the night shift.");
    expect(right).toBe(100);
    expect(scrambled).toBeLessThan(50);
  });

  it("palavras sobrando também penalizam", () => {
    expect(localSimilarity("I wake up very very early every single day", "I wake up early")).toBeLessThan(80);
  });
});

describe("shadowing", () => {
  it("marca as palavras que não foram ditas", async () => {
    const { wordDiff } = await import("../answerCheck.js");
    const diff = wordDiff("I work the shift", "I work the night shift.");
    expect(diff.map((item) => item.ok)).toEqual([true, true, true, false, true]);
  });

  it("contração falada por extenso conta como dita", async () => {
    const { wordDiff } = await import("../answerCheck.js");
    expect(wordDiff("I am from Brazil", "I'm from Brazil.").every((item) => item.ok)).toBe(true);
  });

  it("palavras por minuto", async () => {
    const { wordsPerMinute } = await import("../speech.js");
    expect(wordsPerMinute("one two three four five six", 3000)).toBe(120);
  });
});
