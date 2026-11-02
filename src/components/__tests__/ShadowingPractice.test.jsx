import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ onDone: null, start: vi.fn(), play: vi.fn().mockResolvedValue(undefined), transcribe: vi.fn() }));
vi.mock("../../hooks/useRecorder.js", () => ({ default: (onDone) => {
  mocks.onDone = onDone;
  return { state: "idle", recording: false, elapsedMs: 0, error: "", start: mocks.start, stop: vi.fn(), cancel: vi.fn() };
} }));
vi.mock("../../services/speech.js", () => ({ transcribeAudio: mocks.transcribe }));
vi.mock("../../services/shadowing.js", async (importOriginal) => ({ ...(await importOriginal()), playCardModel: mocks.play }));
import ShadowingPractice from "../ShadowingPractice.jsx";

describe("ShadowingPractice", () => {
  it("plays the model, records right after and highlights missed words", async () => {
    const onResult = vi.fn();
    mocks.transcribe.mockResolvedValue("I'm looking forward");
    render(<ShadowingPractice card={{ id: "a", expression: "I'm looking forward to it." }} accessToken="t" voice="v" onResult={onResult} />);

    fireEvent.click(screen.getByRole("button", { name: /Ouvir e repetir/ }));
    await waitFor(() => expect(mocks.start).toHaveBeenCalledWith({ maxMs: 12000 }));
    expect(mocks.play).toHaveBeenCalledOnce();

    await act(async () => { await mocks.onDone({ blob: new Blob(["x"]) }); });
    expect(onResult).toHaveBeenCalledWith(expect.objectContaining({ transcript: "I'm looking forward", attempts: 1 }));
    expect(screen.getByText(/Entendemos/)).toBeInTheDocument();
    expect(document.querySelector(".speaking-diff .miss")).not.toBeNull();
    expect(screen.getByRole("button", { name: /Tentar de novo/ })).toBeInTheDocument();
  });
});
