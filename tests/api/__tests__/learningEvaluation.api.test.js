// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { answerCases, challengeCriteria } from "../../fixtures/evaluationCases.js";

const mocks = vi.hoisted(() => ({ completion: vi.fn(), reserve: vi.fn() }));
vi.mock("../../../api/_utils/auth.js", () => ({ requireUser: async () => ({ id: "student" }) }));
vi.mock("../../../api/_utils/aiUsage.js", () => ({ reserveAiUsage: mocks.reserve }));
vi.mock("openai", () => ({ OpenAI: class {
  chat = { completions: { create: mocks.completion } };
} }));

const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), setHeader: vi.fn() });
const content = (payload) => ({ choices: [{ message: { content: typeof payload === "string" ? payload : JSON.stringify(payload) } }], usage: { prompt_tokens: 300, completion_tokens: 80 } });
const isMission = (options) => options.messages[0].content.includes("lesson conversation");
const isCorrection = (options) => options.messages[0].content.startsWith("Analyze only the user's latest message");

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "info").mockImplementation(() => {});
  (await import("../../../api/_utils/evaluationCache.js")).clearEvaluationCache();
});

describe("/api/review-check structured evaluation", () => {
  const call = async (body = {}) => {
    const { default: handler } = await import("../../../api/review-check.js");
    const res = response();
    await handler({ method: "POST", body: { mode: "challenge", prompt: "Apresente-se", answer: "My name is Ana. I'm from Brazil.", criteria: challengeCriteria, difficulty: "Beginner", ...body } }, res);
    return { res, payload: res.json.mock.calls[0][0] };
  };

  it.each(answerCases.map((item) => [item.category, item]))("applies the policy end to end: %s", async (_category, item) => {
    mocks.completion.mockResolvedValue(content(item.model));
    const { res, payload } = await call({ answer: item.answer });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(payload).toMatchObject(item.expect);
  });

  it("sends essential flags to the model and reports latency and tokens", async () => {
    mocks.completion.mockResolvedValue(content(answerCases[0].model));
    const { payload } = await call();
    const sent = JSON.parse(mocks.completion.mock.calls[0][0].messages[1].content);
    expect(sent.criteria[0]).toEqual({ criterion: challengeCriteria[0].text, essential: true });
    expect(payload.evaluationMeta).toMatchObject({ cached: false, promptTokens: 300, completionTokens: 80 });
  });

  it("does not pay twice for the same attempt, but re-evaluates a different answer", async () => {
    mocks.completion.mockResolvedValue(content(answerCases[0].model));
    await call();
    const repeated = await call();
    expect(mocks.completion).toHaveBeenCalledTimes(1);
    expect(mocks.reserve).toHaveBeenCalledTimes(1);
    expect(repeated.payload.evaluationMeta).toEqual({ cached: true });
    await call({ answer: "My name is Bia. I'm from Peru." });
    expect(mocks.completion).toHaveBeenCalledTimes(2);
  });

  it("never caches an inconclusive result and handles invalid JSON", async () => {
    mocks.completion.mockResolvedValue(content("not json"));
    expect((await call()).payload).toMatchObject({ assessment: "inconclusive", passed: false });
    await call();
    expect(mocks.completion).toHaveBeenCalledTimes(2);
  });

  it("keeps the old contract when criteria are plain strings", async () => {
    mocks.completion.mockResolvedValue(content({ score: 70, verdict: "almost", feedback: "Quase." }));
    const { payload } = await call({ mode: "translate", criteria: undefined });
    expect(payload).toMatchObject({ verdict: "almost", suggestedResult: "hard", feedback: "Quase." });
  });
});

describe("/api/chat mission evaluation", () => {
  const targets = ["I'm from Brazil.", "I work in technology.", "Nice to meet you."];
  const call = async (latest, body = {}) => {
    const { default: handler } = await import("../../../api/chat.js");
    const res = response();
    await handler({ method: "POST", body: { mode: "simple", messages: [{ role: "assistant", content: "Where are you from?" }, { role: "user", content: latest }], targets, objective: "Introduce yourself.", ...body } }, res);
    return { res, payload: res.json.mock.calls[0][0] };
  };
  const reply = content("Nice! What do you build?");

  it("replaces the correction call with one combined evaluation (2 calls, not 3)", async () => {
    mocks.completion.mockImplementation(async (options) => {
      if (isMission(options)) {
        const sent = JSON.parse(options.messages[1].content);
        expect(sent.targets).toEqual([targets[0], targets[1]]);
        return content({
          correction: { hasMistake: true, wrong: "in the technology", correct: "in technology", explanation: "Sem artigo.", category: "Articles" },
          targets: [
            { expression: targets[0], status: "adequate", impact: "none", autonomous: true, confidence: "high", feedback: "Boa." },
            { expression: targets[1], status: "adequate", impact: "minor", autonomous: true, confidence: "high", feedback: "Sem artigo." },
          ],
        });
      }
      if (isCorrection(options)) throw new Error("should not run");
      return reply;
    });
    const { payload } = await call("I'm from Brazil and I work in the technology area.");
    expect(mocks.completion).toHaveBeenCalledTimes(2);
    expect(payload.targetEvaluation.map((item) => item.status)).toEqual(["adequate", "partial", "unused"]);
    expect(payload.correction).toMatchObject({ correct: "in technology" });
    expect(payload.evaluationMeta).toMatchObject({ calls: 1, evaluated: 2, promptTokens: 300 });
  });

  it("skips the evaluation when no target is relevant and keeps the normal correction", async () => {
    mocks.completion.mockImplementation(async (options) => (isCorrection(options) ? content({ hasMistake: false }) : reply));
    const { payload } = await call("Yes, sure.");
    expect(mocks.completion.mock.calls.some(([options]) => isMission(options))).toBe(false);
    expect(payload.targetEvaluation.every((item) => item.status === "unused")).toBe(true);
    expect(payload.evaluationMeta).toMatchObject({ skipped: true, calls: 0 });
  });

  it("falls back to the normal correction and marks targets inconclusive when the evaluation fails", async () => {
    mocks.completion.mockImplementation(async (options) => {
      if (isMission(options)) throw new Error("timeout");
      if (isCorrection(options)) return content({ hasMistake: true, wrong: "I from", correct: "I'm from", explanation: "Falta o verbo." });
      return reply;
    });
    const { res, payload } = await call("I from Brazil and I work in tech.");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(payload.targetEvaluation[0].status).toBe("inconclusive");
    expect(payload.correction).toMatchObject({ correct: "I'm from" });
  });

  it("reuses the evaluation only for the exact same attempt in the same context", async () => {
    mocks.completion.mockImplementation(async (options) => (isMission(options)
      ? content({ correction: { hasMistake: false }, targets: [{ expression: targets[0], status: "adequate", impact: "none", autonomous: true, confidence: "high" }] })
      : reply));
    await call("I'm from Brazil.");
    const retry = await call("I'm from Brazil.");
    expect(mocks.completion.mock.calls.filter(([options]) => isMission(options))).toHaveLength(1);
    expect(retry.payload.evaluationMeta).toMatchObject({ cached: true });
    await call("I'm from Brazil.", { objective: "Another lesson." });
    expect(mocks.completion.mock.calls.filter(([options]) => isMission(options))).toHaveLength(2);
  });

  it("keeps the plain conversation contract when no targets are sent", async () => {
    mocks.completion.mockImplementation(async (options) => (isCorrection(options) ? content({ hasMistake: false }) : reply));
    const { payload } = await call("Hello! I work in tech and I like it.", { targets: undefined });
    expect(mocks.completion).toHaveBeenCalledTimes(2);
    expect(payload).not.toHaveProperty("targetEvaluation");
  });
});
