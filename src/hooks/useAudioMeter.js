import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export function rmsAmplitude(samples) {
  if (!samples.length) return 0;
  let sum = 0;
  for (const value of samples) sum += ((value - 128) / 128) ** 2;
  return Math.min(1, Math.sqrt(sum / samples.length) * 4);
}

// Samples stay in this browser. The ref avoids rendering React at audio-frame rates.
export default function useAudioMeter(enabled = true) {
  const levelRef = useRef(0);
  const graphRef = useRef(null);
  const frameRef = useRef(null);
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const [available, setAvailable] = useState(false);

  const stop = useCallback(() => {
    generationRef.current += 1;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    const graph = graphRef.current;
    graphRef.current = null;
    graph?.source.disconnect();
    graph?.analyser.disconnect();
    if (graph?.context.state !== "closed") void graph?.context.close().catch(() => {});
    levelRef.current = 0;
    if (mountedRef.current) setAvailable(false);
  }, []);

  const sample = useCallback(function tick(timestamp = 0) {
    const graph = graphRef.current;
    if (!graph || document.hidden) { frameRef.current = null; return; }
    if (timestamp - graph.lastSample >= 32) {
      graph.analyser.getByteTimeDomainData(graph.samples);
      levelRef.current = levelRef.current * 0.72 + rmsAmplitude(graph.samples) * 0.28;
      graph.lastSample = timestamp;
    }
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  const connect = useCallback(async (kind, input) => {
    stop();
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!enabled || !AudioContextClass || !input) return;
    const generation = generationRef.current;
    let context;
    let source;
    let resumeTimer;
    try {
      context = new AudioContextClass();
      const resumed = await Promise.race([
        context.resume().then(() => true),
        new Promise((resolve) => { resumeTimer = window.setTimeout(() => resolve(false), 400); }),
      ]);
      window.clearTimeout(resumeTimer);
      // Do not reroute a media element through a context that cannot play audio.
      if (!resumed || !mountedRef.current || generation !== generationRef.current || context.state !== "running") {
        void context.close().catch(() => {});
        return;
      }
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      source = kind === "stream" ? context.createMediaStreamSource(input) : context.createMediaElementSource(input);
      source.connect(analyser);
      if (kind === "element") analyser.connect(context.destination);
      graphRef.current = { context, analyser, source, samples: new Uint8Array(analyser.fftSize), lastSample: -100 };
      setAvailable(true);
      sample();
    } catch {
      // If routing failed after connecting an element, keep its audio audible.
      if (source && kind === "element" && context?.state === "running") {
        try { source.disconnect(); source.connect(context.destination); } catch { /* unavailable graph */ }
        graphRef.current = { context, source, analyser: { disconnect() {} } };
      } else if (context?.state !== "closed") {
        void context?.close().catch(() => {});
      }
      if (mountedRef.current && generation === generationRef.current) setAvailable(false);
    } finally {
      window.clearTimeout(resumeTimer);
    }
  }, [enabled, sample, stop]);

  useEffect(() => {
    mountedRef.current = true;
    const onVisibility = () => {
      if (document.hidden) {
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        levelRef.current = 0;
      } else if (graphRef.current?.samples && frameRef.current === null) sample();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      mountedRef.current = false;
      document.removeEventListener("visibilitychange", onVisibility);
      stop();
    };
  }, [sample, stop]);

  const observeStream = useCallback((stream) => { void connect("stream", stream); }, [connect]);
  const observeElement = useCallback((element) => connect("element", element), [connect]);
  return useMemo(() => ({ levelRef, available, observeStream, observeElement, stop }), [available, observeStream, observeElement, stop]);
}
