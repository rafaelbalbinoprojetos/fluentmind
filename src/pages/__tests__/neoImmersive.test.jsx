import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ onDone: null, transcribe: vi.fn(), start: vi.fn(), stop: vi.fn(), cancel: vi.fn(), play: vi.fn(), recorderState: "idle", recorderError: "" }));
vi.mock("../../context/AuthContext.jsx", () => ({ useAuth: () => ({
  user: { id: "immersive-student" }, session: { access_token: "test-token" },
  userPreferences: { assistantName: "Neo", assistantVoice: "mineirinha", targetLanguage: "en", currentLevel: "A2" },
}) }));
vi.mock("../../hooks/useRecorder.js", () => ({ default: (onDone) => {
  mocks.onDone = onDone;
  return { state: mocks.recorderState, recording: mocks.recorderState === "recording", elapsedMs: 2000,
    error: mocks.recorderError, start: mocks.start, stop: mocks.stop, cancel: mocks.cancel };
} }));
vi.mock("../../services/speech.js", () => ({ transcribeAudio: mocks.transcribe }));
vi.mock("../../services/correctedMistakes.js", () => ({ createCorrectedMistake: vi.fn().mockResolvedValue({}) }));
import NeoImmersivePage from "../NeoImmersive.jsx";
import SimpleConversationPage from "../SimpleConversation.jsx";

const ok = (reply = "What do you enjoy about travelling?") => ({ ok: true, json: async () => ({ reply }) });
const openPage = () => render(<MemoryRouter initialEntries={["/neo"]}><Routes>
  <Route path="/neo" element={<NeoImmersivePage />} />
  <Route path="/conversar" element={<p>Conversa simples preservada</p>} />
  <Route path="/configuracoes" element={<p>Configurações existentes</p>} />
</Routes></MemoryRouter>);
const root = () => screen.getByRole("main", { name: "Neo, modo imersivo" });

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  mocks.recorderState = "idle";
  mocks.recorderError = "";
  mocks.play.mockResolvedValue(undefined);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(ok()));
  vi.stubGlobal("Audio", class { play = mocks.play; pause = vi.fn(); });
  URL.createObjectURL = vi.fn(() => "blob:immersive-fixture");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Neo immersive presentation", () => {
  it("keeps an unsent draft when switching from the existing text presentation", () => {
    render(<MemoryRouter initialEntries={["/conversar"]}><Routes>
      <Route path="/conversar" element={<SimpleConversationPage />} />
      <Route path="/neo" element={<NeoImmersivePage />} />
    </Routes></MemoryRouter>);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Keep my draft between modes" } });
    fireEvent.click(screen.getByRole("link", { name: "Abrir modo imersivo" }));
    expect(screen.getByRole("textbox", { name: "Mensagem para Neo" })).toHaveValue("Keep my draft between modes");
  });
  it("opens with one core, greeting, themes and a single-line composer", () => {
    openPage();
    expect(root()).toHaveAttribute("data-state", "idle");
    expect(screen.getByRole("heading", { name: "Olá, eu sou o Neo." })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Viagens" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Mensagem para Neo" }).tagName).toBe("INPUT");
    expect(screen.getByRole("textbox")).toHaveAttribute("placeholder", "Escreva sua mensagem em inglês...");
    expect(screen.queryByRole("log")).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows processing while sending, preserves the API contract, then displays the reply as a caption", async () => {
    let resolveRequest;
    fetch.mockImplementationOnce(() => new Promise((resolve) => { resolveRequest = resolve; }));
    openPage();
    fireEvent.click(screen.getByRole("button", { name: "Desativar áudio" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hello Neo" } });
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(root()).toHaveAttribute("data-state", "processing");
    expect(screen.queryByRole("button", { name: "Viagens" })).not.toBeInTheDocument();
    await act(async () => resolveRequest(ok()));
    expect(await screen.findByText("What do you enjoy about travelling?")).toBeInTheDocument();
    expect(root()).toHaveAttribute("data-state", "muted");
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ mode: "simple", messages: [{ role: "user", content: "Hello Neo" }] });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it("displays the real recording state, cancellation and stop controls", () => {
    mocks.recorderState = "recording";
    openPage();
    expect(root()).toHaveAttribute("data-state", "listening");
    expect(screen.getByText("Seu microfone está ativo. Encerre ou cancele a gravação.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar gravação" }));
    expect(mocks.cancel).toHaveBeenCalledOnce();
    fireEvent.click(screen.getAllByRole("button", { name: "Encerrar gravação e enviar" })[0]);
    expect(mocks.stop).toHaveBeenCalledOnce();
  });

  it("transcribes and plays a spoken response, labeling ambient motion when measurement is unavailable", async () => {
    mocks.transcribe.mockResolvedValue("I would love to visit Japan.");
    fetch.mockResolvedValueOnce(ok()).mockResolvedValueOnce({ ok: true, json: async () => ({ audio: "YXVkaW8=", mimeType: "audio/mpeg" }) });
    openPage();
    fireEvent.click(screen.getByRole("button", { name: "Iniciar gravação" }));
    expect(mocks.start).toHaveBeenCalledWith({ maxMs: 60000 });
    await act(async () => mocks.onDone({ blob: new Blob(["audio"]) }));
    await waitFor(() => expect(root()).toHaveAttribute("data-state", "speaking"));
    expect(mocks.play).toHaveBeenCalledOnce();
    expect(screen.getByRole("textbox")).not.toHaveFocus();
    expect(screen.getByText("Movimento ambiente")).toBeInTheDocument();
  });

  it("restores drafts and retries the same utterance after a network failure", async () => {
    fetch.mockRejectedValueOnce(new Error("Conexão interrompida."));
    openPage();
    fireEvent.click(screen.getByRole("button", { name: "Desativar áudio" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "My preserved draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Conexão interrompida.");
    expect(root()).toHaveAttribute("data-state", "error");
    expect(screen.getByRole("textbox")).toHaveValue("My preserved draft");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await screen.findByText("What do you enjoy about travelling?");
    expect(JSON.parse(fetch.mock.calls[1][1].body).messages[0].content).toBe("My preserved draft");
  });

  it("retries failed speech without sending the conversation again", async () => {
    fetch.mockResolvedValueOnce(ok())
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Voz indisponível." }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ audio: "YXVkaW8=", mimeType: "audio/mpeg" }) });
    openPage();
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Hello" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar mensagem" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Voz indisponível.");
    expect(screen.getByText("What do you enjoy about travelling?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    await waitFor(() => expect(mocks.play).toHaveBeenCalledOnce());
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(["/api/chat", "/api/transcribe", "/api/transcribe"]);
  });

  it("preserves long captions for reading and allows them to be recalled", () => {
    vi.useFakeTimers();
    sessionStorage.setItem("fluentmind_simple_conversation:immersive-student", JSON.stringify([{ id: "last-reply", role: "assistant", content: "A longer reply. ".repeat(80) }]));
    openPage();
    const caption = screen.getByRole("region", { name: "Última fala" });
    act(() => vi.advanceTimersByTime(14000));
    expect(caption).toHaveAttribute("aria-hidden", "false");
    act(() => vi.advanceTimersByTime(120000));
    expect(caption).toHaveAttribute("aria-hidden", "true");
    fireEvent.click(screen.getByRole("button", { name: "Ver última fala" }));
    expect(caption).toHaveAttribute("aria-hidden", "false");
  });

  it("reports permission errors with a retry and keeps the composer available", () => {
    mocks.recorderError = "Permissão de microfone negada.";
    mocks.recorderState = "error";
    openPage();
    expect(root()).toHaveAttribute("data-state", "error");
    expect(screen.getByRole("alert")).toHaveTextContent("Permissão de microfone negada.");
    expect(screen.getByRole("textbox")).not.toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(mocks.start).toHaveBeenCalledOnce();
  });

  it("returns to the text mode and retains its existing cached history", () => {
    sessionStorage.setItem("fluentmind_simple_conversation:immersive-student", JSON.stringify([{ id: "last-reply", role: "assistant", content: "An existing conversation." }]));
    openPage();
    expect(screen.getByText("An existing conversation.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Voltar à tela anterior" }));
    expect(screen.getByText("Conversa simples preservada")).toBeInTheDocument();
    expect(JSON.parse(sessionStorage.getItem("fluentmind_simple_conversation:immersive-student"))[0].content).toBe("An existing conversation.");
  });
  it("shows the correction tip and reviews it before starting a new conversation", async () => {
    const { createCorrectedMistake } = await import("../../services/correctedMistakes.js");
    fetch.mockResolvedValue({ ok: true, json: async () => ({ reply: "Nice! What did you do there?",
      correction: { wrong: "I go to work yesterday", correct: "I went to work yesterday", explanation: "Passado." } }) });
    openPage();
    const input = screen.getByRole("textbox", { name: "Mensagem para Neo" });
    fireEvent.change(input, { target: { value: "I go to work yesterday" } });
    fireEvent.submit(input.closest("form"));
    expect(await screen.findByText("I went to work yesterday")).toBeInTheDocument();
    expect(createCorrectedMistake).toHaveBeenCalledWith(expect.objectContaining({ correctedText: "I went to work yesterday" }), { userId: "immersive-student" });
    expect(screen.getByRole("link", { name: /1 correção salva/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Nova conversa" }));
    const recapInput = screen.getByRole("textbox", { name: "Frase corrigida" });
    fireEvent.change(recapInput, { target: { value: "I went to work yesterday." } });
    fireEvent.click(screen.getByRole("button", { name: "Conferir" }));
    expect(screen.getByText(/Perfeito!/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Concluir" }));
    expect(screen.getByRole("heading", { name: "Olá, eu sou o Neo." })).toBeInTheDocument();
  });
});
