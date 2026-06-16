import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

// ─── Tipos de mime suportados (mesma lógica do Chatbot) ───────────────────
const RECORDER_CANDIDATE_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/ogg",
  "audio/mp4",
  "",
];

function resolveSupportedMimeType() {
  if (typeof window === "undefined" || !window.MediaRecorder?.isTypeSupported) return "";
  return (
    RECORDER_CANDIDATE_MIME_TYPES.find((t) => window.MediaRecorder.isTypeSupported(t)) || ""
  );
}

async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ─── Componente ───────────────────────────────────────────────────────────

/**
 * VoiceRecordingModal
 *
 * Props:
 *   open          boolean  — controla visibilidade
 *   onClose       () => void
 *   onTranscribed (text: string) => void  — chamado com texto transcrito
 *   apiBase       string   — base URL da API
 *   accessToken   string   — Bearer token do Supabase
 */
export default function VoiceRecordingModal({ open, onClose, onTranscribed, apiBase = "", accessToken }) {
  const [phase, setPhase] = useState("idle"); // idle | recording | processing | error
  const [errorMsg, setErrorMsg] = useState("");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const streamRef        = useRef(null);
  const startedAtRef     = useRef(0);

  // ── Inicia gravação assim que o modal abre ──────────────────────────────
  useEffect(() => {
    if (!open) return;
    setPhase("idle");
    setErrorMsg("");
    startRecording();

    return () => {
      // Limpeza se o modal fechar antes da gravação terminar
      stopStream();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder === "undefined") {
      setPhase("error");
      setErrorMsg("Seu navegador não suporta gravação de áudio.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = resolveSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stopStream();
        const detectedType =
          recorder.mimeType ||
          mimeType ||
          audioChunksRef.current[0]?.type ||
          "audio/webm";

        const blob = new Blob(audioChunksRef.current, { type: detectedType });

        if (!blob.size || blob.size < 1200) {
          setPhase("error");
          setErrorMsg("Áudio muito curto. Tente novamente.");
          return;
        }

        setPhase("processing");
        await transcribe(blob);
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setPhase("recording");
    } catch (err) {
      stopStream();
      if (err?.name === "NotAllowedError" || err?.name === "SecurityError") {
        setPhase("error");
        setErrorMsg("Permissão de microfone negada. Libere o acesso e tente novamente.");
      } else {
        setPhase("error");
        setErrorMsg("Não foi possível iniciar a gravação.");
      }
    }
  }

  const stopRecording = useCallback(() => {
    const elapsed = Date.now() - startedAtRef.current;
    if (elapsed < 900) return; // evita parar antes de 1s
    try { mediaRecorderRef.current?.requestData?.(); } catch { /* ignore */ }
    mediaRecorderRef.current?.stop();
  }, []);

  async function transcribe(blob) {
    try {
      const base64 = await blobToBase64(blob);
      const res = await fetch(`${apiBase}/api/transcribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ audio: base64, mimeType: blob.type || "audio/webm" }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || `Erro ${res.status}`);
      }

      if (data?.text) {
        onTranscribed(data.text);
        handleClose();
      } else {
        setPhase("error");
        setErrorMsg("Não consegui entender o áudio. Tente novamente.");
      }
    } catch (err) {
      setPhase("error");
      setErrorMsg(err.message || "Falha ao transcrever. Tente novamente.");
    }
  }

  function handleClose() {
    mediaRecorderRef.current?.stop?.();
    stopStream();
    setPhase("idle");
    onClose();
  }

  if (!open) return null;

  return createPortal(
    /* Overlay */
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      {/* Card */}
      <div className="relative w-full max-w-xs rounded-3xl bg-white dark:bg-gray-900 shadow-2xl px-6 pt-8 pb-8 flex flex-col items-center gap-6 animate-fade-in-up">

        {/* Fechar */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Ícone animado */}
        <div className="relative flex items-center justify-center">

          {/* Anéis de pulso — só aparecem durante gravação */}
          {phase === "recording" && (
            <>
              <span className="absolute inline-flex h-24 w-24 rounded-full bg-red-400/20 animate-ping" />
              <span className="absolute inline-flex h-16 w-16 rounded-full bg-red-400/30 animate-ping" style={{ animationDelay: "0.15s" }} />
            </>
          )}

          {/* Círculo central */}
          <button
            onClick={phase === "recording" ? stopRecording : undefined}
            disabled={phase !== "recording"}
            className={`
              relative z-10 w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all duration-300
              ${phase === "recording"
                ? "bg-red-500 hover:bg-red-600 cursor-pointer scale-100"
                : phase === "processing"
                  ? "bg-gray-200 dark:bg-gray-700 cursor-default"
                  : "bg-gray-100 dark:bg-gray-800 cursor-default"
              }
            `}
            aria-label="Parar gravação"
          >
            {phase === "processing" ? (
              /* Spinner */
              <svg className="w-8 h-8 animate-spin text-gray-500 dark:text-gray-300" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
              </svg>
            ) : (
              /* Microfone */
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
                className={`w-9 h-9 ${phase === "recording" ? "text-white" : "text-gray-400 dark:text-gray-500"}`}
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M12 16a3 3 0 003-3V7a3 3 0 00-6 0v6a3 3 0 003 3z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M19 11a7 7 0 01-14 0M12 19v3" />
              </svg>
            )}
          </button>
        </div>

        {/* Texto de status */}
        <div className="text-center space-y-1">
          {phase === "recording" && (
            <>
              <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Ouvindo...
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Toque no microfone para parar
              </p>
            </>
          )}
          {phase === "processing" && (
            <>
              <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Processando...
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Transcrevendo seu áudio
              </p>
            </>
          )}
          {phase === "error" && (
            <>
              <p className="text-base font-semibold text-red-500">
                Ops, algo deu errado
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {errorMsg}
              </p>
              <button
                onClick={startRecording}
                className="mt-2 text-sm font-medium text-blue-500 hover:underline"
              >
                Tentar novamente
              </button>
            </>
          )}
          {phase === "idle" && (
            <p className="text-sm text-gray-400">Iniciando microfone...</p>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
}
