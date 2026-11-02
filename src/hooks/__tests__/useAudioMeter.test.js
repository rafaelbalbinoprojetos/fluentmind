import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import useAudioMeter, { rmsAmplitude } from "../useAudioMeter.js";

let contexts;
let frames;
let resumeBlocked;
beforeEach(() => {
  contexts = [];
  frames = new Map();
  resumeBlocked = false;
  let nextFrame = 0;
  vi.stubGlobal("requestAnimationFrame", vi.fn((callback) => { frames.set(++nextFrame, callback); return nextFrame; }));
  vi.stubGlobal("cancelAnimationFrame", vi.fn((id) => frames.delete(id)));
  vi.stubGlobal("AudioContext", class {
    state = "running";
    destination = {};
    source = { connect: vi.fn(), disconnect: vi.fn() };
    analyser = { fftSize: 256, connect: vi.fn(), disconnect: vi.fn(), getByteTimeDomainData: vi.fn((samples) => samples.fill(128)) };
    constructor() { contexts.push(this); }
    resume = vi.fn(() => resumeBlocked ? new Promise(() => {}) : Promise.resolve());
    close = vi.fn(async () => { this.state = "closed"; });
    createAnalyser = () => this.analyser;
    createMediaStreamSource = vi.fn(() => this.source);
    createMediaElementSource = vi.fn(() => this.source);
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("real local audio metering", () => {
  it("does not block speech playback if an audio context cannot resume", async () => {
    vi.useFakeTimers();
    resumeBlocked = true;
    const { result } = renderHook(() => useAudioMeter(true));
    let pending;
    act(() => { pending = result.current.observeElement({}); });
    await act(async () => { await vi.advanceTimersByTimeAsync(500); await pending; });
    expect(result.current.available).toBe(false);
    expect(contexts[0].createMediaElementSource).not.toHaveBeenCalled();
    expect(contexts[0].close).toHaveBeenCalledOnce();
  });
  it("measures silence and actual sample amplitude, without fabricated movement", () => {
    expect(rmsAmplitude(new Uint8Array([128, 128]))).toBe(0);
    expect(rmsAmplitude(new Uint8Array([120, 136]))).toBeCloseTo(0.25);
    expect(rmsAmplitude(new Uint8Array())).toBe(0);
  });

  it("observes microphone samples without connecting the microphone to speakers", async () => {
    const { result, unmount } = renderHook(() => useAudioMeter(true));
    const stream = {};
    await act(async () => { result.current.observeStream(stream); });
    expect(result.current.available).toBe(true);
    expect(contexts[0].createMediaStreamSource).toHaveBeenCalledWith(stream);
    expect(contexts[0].analyser.connect).not.toHaveBeenCalled();
    expect(result.current.levelRef.current).toBe(0);
    contexts[0].analyser.getByteTimeDomainData.mockImplementation((samples) => samples.fill(144));
    act(() => { const [id, callback] = [...frames][0]; frames.delete(id); callback(64); });
    expect(result.current.levelRef.current).toBeGreaterThan(0);
    unmount();
    expect(contexts[0].source.disconnect).toHaveBeenCalled();
    expect(contexts[0].close).toHaveBeenCalledOnce();
  });

  it("keeps output connected to speakers and cleans up its context", async () => {
    const { result } = renderHook(() => useAudioMeter(true));
    const audio = {};
    await act(async () => result.current.observeElement(audio));
    expect(contexts[0].createMediaElementSource).toHaveBeenCalledWith(audio);
    expect(contexts[0].analyser.connect).toHaveBeenCalledWith(contexts[0].destination);
    act(() => result.current.stop());
    expect(result.current.available).toBe(false);
    expect(result.current.levelRef.current).toBe(0);
    expect(frames.size).toBe(0);
  });

  it("does not create an audio context for the existing simple presentation", async () => {
    const { result } = renderHook(() => useAudioMeter(false));
    await act(async () => result.current.observeElement({}));
    expect(contexts).toHaveLength(0);
    expect(result.current.available).toBe(false);
  });
});
