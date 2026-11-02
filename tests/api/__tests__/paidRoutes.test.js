// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ reserve: vi.fn(), completion: vi.fn(), transcription: vi.fn(), speech: vi.fn(), fetch: vi.fn() }));
vi.mock("../../../api/_utils/auth.js", () => ({ requireUser: async () => ({ id: "student" }) }));
vi.mock("../../../api/_utils/aiUsage.js", () => ({ reserveAiUsage: mocks.reserve }));
vi.mock("openai", () => ({ OpenAI: class {
  chat = { completions: { create: mocks.completion } };
  audio = { transcriptions: { create: mocks.transcription }, speech: { create: mocks.speech } };
  static toFile = async () => ({});
} }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({
  from: () => {
    const query = {};
    for (const method of ["select", "eq"]) query[method] = () => query;
    query.maybeSingle = async () => ({ data: null, error: null });
    query.single = async () => ({ data: { expression_en: "Hello there" }, error: null });
    return query;
  },
}) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_KEY", "test-service-key");
  vi.stubGlobal("fetch", mocks.fetch);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("paid API authorization order", () => {
  it("uses the upgraded model for simple conversation and analyzes the correction in parallel", async () => {
    mocks.reserve.mockResolvedValue(undefined);
    mocks.completion.mockImplementation(async (options) => ({
      choices: [{ message: { content: options.response_format
        ? JSON.stringify({ hasMistake: true, wrong: "I go to work yesterday", correct: "I went to work yesterday", explanation: "Passado." })
        : "That sounds interesting. Tell me more!" } }],
    }));
    const { default: handler } = await import("../../../api/chat.js");
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    await handler({ method: "POST", body: { mode: "simple", messages: [{ role: "user", content: "I go to work yesterday" }] } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mocks.completion).toHaveBeenCalledTimes(2);
    expect(mocks.completion.mock.calls[0][0]).toMatchObject({ model: "gpt-6-luna", reasoning_effort: "low" });
    expect(mocks.completion.mock.calls[0][0]).not.toHaveProperty("temperature");
    expect(mocks.reserve).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      reply: "That sounds interesting. Tell me more!",
      correction: expect.objectContaining({ correct: "I went to work yesterday" }),
      suggestedMindBlocks: [],
    }));
  });
  it.each([
    ["chat", { messages: [{ role: "user", content: "Hello" }] }],
    ["review-check", { answer: "Hello" }],
    ["transcribe", { action: "speak", text: "Hello" }],
    ["transcribe", { audio: Buffer.alloc(1200).toString("base64"), mimeType: "audio/webm" }],
    ["mindblock-audio", { mindblockId: "card-a" }],
  ])("blocks %s before any paid provider call", async (route, body) => {
    mocks.reserve.mockRejectedValue(Object.assign(new Error("Budget exhausted"), { statusCode: 429 }));
    const { default: handler } = await import(`../../../api/${route}.js`);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), setHeader: vi.fn() };
    await handler({ method: "POST", body, headers: { host: "localhost" } }, res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(mocks.reserve).toHaveBeenCalledOnce();
    for (const provider of [mocks.completion, mocks.transcription, mocks.speech, mocks.fetch]) {
      expect(provider).not.toHaveBeenCalled();
    }
  });
});
