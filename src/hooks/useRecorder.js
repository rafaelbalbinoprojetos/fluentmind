import { useCallback, useEffect, useRef, useState } from "react";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg", "audio/mp4", ""];

function supportedMimeType() {
  if (typeof window === "undefined" || !window.MediaRecorder?.isTypeSupported) return "";
  return MIME_CANDIDATES.find((type) => window.MediaRecorder.isTypeSupported(type)) || "";
}

/**
 * Gravação do microfone com parada automática.
 * start({ maxMs }) começa a gravar; stop() encerra. Ao encerrar, onDone({ blob, durationMs }) é chamado.
 */
export default function useRecorder(onDone) {
  const [state, setState] = useState("idle"); // idle | recording | error
  const [error, setError] = useState("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const recorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const startedRef = useRef(0);
  const timersRef = useRef([]);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const cleanup = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearInterval(timer));
    timersRef.current = [];
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    try {
      recorder.requestData?.();
    } catch {
      /* alguns navegadores não suportam requestData */
    }
    recorder.stop();
  }, []);

  const start = useCallback(async ({ maxMs = 30000 } = {}) => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === "undefined") {
      setState("error");
      setError("Seu navegador não suporta gravação de áudio.");
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = supportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const durationMs = Date.now() - startedRef.current;
        cleanup();
        setState("idle");
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
        onDoneRef.current?.({ blob, durationMs });
      };
      recorder.start(250);
      recorderRef.current = recorder;
      startedRef.current = Date.now();
      setElapsedMs(0);
      setState("recording");
      timersRef.current.push(
        window.setInterval(() => {
          const elapsed = Date.now() - startedRef.current;
          setElapsedMs(elapsed);
          if (elapsed >= maxMs) stop();
        }, 200),
      );
      return true;
    } catch (err) {
      cleanup();
      setState("error");
      setError(
        err?.name === "NotAllowedError" || err?.name === "SecurityError"
          ? "Permissão de microfone negada. Libere o acesso e tente novamente."
          : "Não foi possível iniciar a gravação.",
      );
      return false;
    }
  }, [cleanup, stop]);

  return { state, error, elapsedMs, start, stop, recording: state === "recording" };
}
