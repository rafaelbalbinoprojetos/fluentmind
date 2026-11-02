// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chatModelOptions } from "../../../api/_utils/chatModel.js";
import { generateElevenLabsAudio, resolveVoiceId, speechChunks, speechRequest } from "../../../api/_utils/elevenLabs.js";

beforeEach(() => {
  for (const name of ["OPENAI_MODEL", "OPENAI_CORRECTION_MODEL", "ELEVENLABS_MODEL", "ELEVENLABS_VOICE_ID", "ELEVENLABS_VOICE_MINEIRINHA"]) vi.stubEnv(name, "");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("chat model upgrade", () => {
  it("uses GPT-6 Luna without unsupported sampling parameters", () => {
    expect(chatModelOptions()).toEqual({ model: "gpt-6-luna", reasoning_effort: "low", max_completion_tokens: 4096 });
  });
  it("preserves explicit GPT-5 configuration and the separate correction model", () => {
    vi.stubEnv("OPENAI_MODEL", "gpt-5.4-mini");
    vi.stubEnv("OPENAI_CORRECTION_MODEL", "gpt-5-mini");
    expect(chatModelOptions().model).toBe("gpt-5.4-mini");
    expect(chatModelOptions({ correction: true }).model).toBe("gpt-5-mini");
    expect(chatModelOptions()).not.toHaveProperty("temperature");
  });
  it("keeps older configured models compatible", () => {
    vi.stubEnv("OPENAI_MODEL", "gpt-4o-mini");
    expect(chatModelOptions({ temperature: 0 })).toMatchObject({ model: "gpt-4o-mini", temperature: 0 });
    expect(chatModelOptions()).not.toHaveProperty("reasoning_effort");
  });
});

describe("ElevenLabs model upgrade", () => {
  it("routes Eleven v4 through dialogue with a single selected voice", () => {
    vi.stubEnv("ELEVENLABS_VOICE_MINEIRINHA", "my-voice");
    const request = speechRequest("Hello", "mineirinha");
    expect(request.url).toContain("/v1/text-to-dialogue?");
    expect(request.body).toEqual({ model_id: "eleven_v4", inputs: [{ text: "Hello", voice_id: "my-voice" }] });
    expect(request.body).not.toHaveProperty("voice_settings");
  });
  it("honors existing voice configuration and optional v3 override", () => {
    vi.stubEnv("ELEVENLABS_MODEL", "eleven_v3");
    vi.stubEnv("ELEVENLABS_VOICE_MALE", "male-voice");
    const request = speechRequest("Hello", "male");
    expect(request.url).toContain("text-to-speech/male-voice");
    expect(request.body.model_id).toBe("eleven_v3");
    expect(resolveVoiceId("male")).toBe("male-voice");
  });
  it("splits long speech without losing words or exceeding the dialogue limit", () => {
    const text = "This is a complete sentence. ".repeat(180).trim();
    const chunks = speechChunks(text);
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.length <= 1800)).toBe(true);
    expect(chunks.join(" ")).toBe(text);
  });
  it("preserves every chunk of generated audio in order", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "fake-key");
    const fetchMock = vi.fn().mockImplementation(async () => ({ ok: true, arrayBuffer: async () => new Uint8Array([1, 2]).buffer }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await generateElevenLabsAudio({ text: "Hello there. ".repeat(180), voice: "female" });
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    expect(result.length).toBe(fetchMock.mock.calls.length * 2);
  });
  it("reports credential errors without silently switching models or providers", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "invalid-key");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));
    vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(generateElevenLabsAudio({ text: "Hello", voice: "female" })).rejects.toMatchObject({ statusCode: 502 });
    expect(fetch).toHaveBeenCalledOnce();
  });
});
