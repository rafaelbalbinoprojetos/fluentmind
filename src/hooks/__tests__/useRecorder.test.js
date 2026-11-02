import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useRecorder from "../useRecorder.js";

let stopTrack;
let recorder;
beforeEach(() => {
  stopTrack = vi.fn();
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [{ stop: stopTrack }] }) } });
  vi.stubGlobal("MediaRecorder", class {
    state = "inactive";
    mimeType = "audio/webm";
    static isTypeSupported = () => true;
    constructor() { recorder = this; }
    start() { this.state = "recording"; }
    stop() { this.state = "inactive"; this.onstop?.(); }
    requestData() {}
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("microphone resource lifecycle", () => {
  it("cancels recording and releases the microphone without submitting audio", async () => {
    const onDone = vi.fn();
    const { result } = renderHook(() => useRecorder(onDone));
    await act(async () => result.current.start());
    expect(result.current.recording).toBe(true);
    act(() => result.current.cancel());
    expect(stopTrack).toHaveBeenCalled();
    expect(result.current.recording).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
    expect(recorder.state).toBe("inactive");
  });

  it("releases a late microphone permission result after unmount", async () => {
    let resolvePermission;
    navigator.mediaDevices.getUserMedia.mockImplementationOnce(() => new Promise((resolve) => { resolvePermission = resolve; }));
    const onDone = vi.fn();
    const { result, unmount } = renderHook(() => useRecorder(onDone));
    let pending;
    act(() => { pending = result.current.start(); });
    unmount();
    await act(async () => {
      resolvePermission({ getTracks: () => [{ stop: stopTrack }] });
      await pending;
    });
    expect(stopTrack).toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });
});
