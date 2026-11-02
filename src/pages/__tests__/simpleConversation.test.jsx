import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ onDone: null, transcribe: vi.fn(), start: vi.fn(), stop: vi.fn(), cancel: vi.fn(), play: vi.fn(), userId: "student-a" }));
vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => ({
  user: { id: mocks.userId }, session: { access_token: "test-token" },
  userPreferences: { assistantName: "Neo", assistantVoice: "mineirinha", targetLanguage: "en", currentLevel: "A2" },
}) }));
vi.mock("../../hooks/useRecorder.js", () => ({ default: (onDone) => {
  mocks.onDone = onDone;
  return { state: "idle", recording: false, elapsedMs: 0, error: "", start: mocks.start, stop: mocks.stop, cancel: mocks.cancel };
} }));
vi.mock("../../services/speech.js", () => ({ transcribeAudio: mocks.transcribe }));
import SimpleConversationPage from "../SimpleConversation.jsx";

const ok = (reply = "How was your day?") => ({ ok: true, json: async () => ({ reply }) });
const openPage = () => render(<MemoryRouter><SimpleConversationPage /></MemoryRouter>);

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.userId = "student-a";
  mocks.play.mockResolvedValue(undefined);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok()));
  vi.stubGlobal("Audio", class {
    play = mocks.play;
    pause = vi.fn();
  });
  URL.createObjectURL = vi.fn(() => "blob:mock-audio");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.unstubAllGlobals());

describe("simple text and voice conversation", () => {
  it("sends through Enter and shows the reply in a clean conversation", async () => {
    openPage();
    const input = screen.getByRole("textbox", { name: "Mensagem" });
    fireEvent.change(input, { target: { value: "Hello Neo" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await screen.findByText("How was your day?");
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe("/api/chat");
    expect(JSON.parse(options.body)).toMatchObject({ mode: "simple", messages: [{ role: "user", content: "Hello Neo" }] });
    expect(options.headers.Authorization).toBe("Bearer test-token");
    expect(input).toHaveValue("");
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("keeps Shift+Enter and IME Enter from submitting", () => {
    openPage();
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Hello" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: true });
    fireEvent.keyDown(input, { key: "Enter", isComposing: true });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("restores a failed draft and lets the user retry", async () => {
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Limite mensal atingido." }) });
    openPage();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "My draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Limite mensal atingido.");
    expect(screen.getByRole("textbox")).toHaveValue("My draft");
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    await screen.findByText("How was your day?");
  });

  it("transcribes the microphone, sends the utterance and plays the spoken reply", async () => {
    mocks.transcribe.mockResolvedValue("I like learning English");
    fetch.mockResolvedValueOnce(ok()).mockResolvedValueOnce({ ok: true, json: async () => ({ audio: "YXVkaW8=", mimeType: "audio/mpeg" }) });
    openPage();
    fireEvent.click(screen.getByRole("button", { name: "Gravar mensagem de voz" }));
    expect(mocks.start).toHaveBeenCalledWith({ maxMs: 60000 });
    await act(async () => mocks.onDone({ blob: new Blob(["audio"]) }));
    expect(screen.getByText("I like learning English")).toBeInTheDocument();
    await waitFor(() => expect(mocks.play).toHaveBeenCalledOnce());
    expect(JSON.parse(fetch.mock.calls[1][1].body)).toMatchObject({ action: "speak", voice: "mineirinha" });
  });

  it("keeps text available when speech generation fails", async () => {
    fetch.mockResolvedValueOnce(ok()).mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Voz indisponível." }) });
    openPage();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    await screen.findByText("How was your day?");
    fireEvent.click(screen.getByRole("button", { name: "Ouvir resposta" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Voz indisponível.");
    expect(screen.getByText("How was your day?")).toBeInTheDocument();
  });

  it("ignores late replies after starting a new conversation", async () => {
    let resolveRequest;
    fetch.mockImplementationOnce(() => new Promise((resolve) => { resolveRequest = resolve; }));
    openPage();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Old message" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    const signal = fetch.mock.calls[0][1].signal;
    fireEvent.click(screen.getByRole("button", { name: "Nova conversa" }));
    expect(signal.aborted).toBe(true);
    await act(async () => resolveRequest(ok("Old reply")));
    expect(screen.queryByText("Old reply")).not.toBeInTheDocument();
    expect(screen.getByText("Vamos conversar?")).toBeInTheDocument();
  });

  it("does not restore another account's cached conversation", () => {
    sessionStorage.setItem("fluentmind_simple_conversation:student-b", JSON.stringify([{ id: "secret", role: "user", content: "Private message" }]));
    openPage();
    expect(screen.queryByText("Private message")).not.toBeInTheDocument();
  });
});
