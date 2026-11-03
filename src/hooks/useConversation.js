import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import useRecorder from "./useRecorder.js";
import { transcribeAudio } from "../services/speech.js";
import { userStorageKey } from "../utils/userStorage.js";
import useAudioMeter from "./useAudioMeter.js";
import { createCorrectedMistake } from "../services/correctedMistakes.js";
import useLearningActions from "./useLearningActions.js";

const API_BASE = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");

function restoreConversation(key) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(key) || "[]");
    return Array.isArray(saved) ? saved.filter((item) => ["user", "assistant"].includes(item?.role)
      && typeof item.content === "string" && item.content.length <= 6000).slice(-100) : [];
  } catch { return []; }
}

export default function useConversation({ defaultVoiceReplies = false, audioReactive = false, focusAfterVoice = true, scenario = "", targets = null, objective = "" } = {}) {
  const { user, session, userPreferences } = useAuth();
  const { trackProgressionAction } = useLearningActions();
  const cacheKey = userStorageKey("fluentmind_simple_conversation", user?.id);
  const [messages, setMessages] = useState(() => restoreConversation(cacheKey));
  const [input, setInput] = useState(() => {
    try { return (sessionStorage.getItem(`${cacheKey}:draft`) || "").slice(0, 6000); }
    catch { return ""; }
  });
  const [phase, setPhase] = useState("idle");
  const [error, setError] = useState("");
  const [voiceReplies, setVoiceReplies] = useState(defaultVoiceReplies);
  const [speakingId, setSpeakingId] = useState(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [failure, setFailure] = useState(null);
  const mutedRef = useRef(false);
  const inputMeter = useAudioMeter(audioReactive);
  const outputMeter = useAudioMeter(audioReactive);
  const stopMeter = outputMeter.stop;
  const observeOutput = outputMeter.observeElement;
  const inputRef = useRef(null);
  const mountedRef = useRef(true);
  const generationRef = useRef(0);
  const busyRef = useRef(false);
  const requestRef = useRef(null);
  const speechRequestRef = useRef(null);
  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const playbackRef = useRef(0);
  const mentorName = userPreferences?.assistantName || "Neo";

  const stopAudio = useCallback(() => {
    playbackRef.current += 1;
    speechRequestRef.current?.abort();
    if (audioRef.current) {
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current.onplaying = null;
      audioRef.current.onpause = null;
      audioRef.current.onwaiting = null;
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
    stopMeter();
    if (mountedRef.current) {
      setSpeakingId(null);
      setAudioLoading(false);
      setAudioPlaying(false);
    }
  }, [stopMeter]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      requestRef.current?.abort();
      stopAudio();
    };
  }, [stopAudio]);

  useEffect(() => {
    try { sessionStorage.setItem(cacheKey, JSON.stringify(messages)); } catch { /* private mode or full storage */ }
  }, [cacheKey, messages]);
  useEffect(() => {
    try { sessionStorage.setItem(`${cacheKey}:draft`, input); } catch { /* private mode or full storage */ }
  }, [cacheKey, input]);

  const speak = useCallback(async (message) => {
    if (mutedRef.current) return;
    stopAudio();
    setError("");
    setFailure(null);
    const playback = playbackRef.current;
    const controller = new AbortController();
    speechRequestRef.current = controller;
    setSpeakingId(message.id);
    setAudioLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/transcribe`, {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ action: "speak", text: message.content, voice: userPreferences?.assistantVoice || "mineirinha" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Não foi possível gerar a voz.");
      if (!mountedRef.current || playback !== playbackRef.current) return;
      if (!data.audio) throw new Error("O áudio não foi recebido. Tente ouvir novamente.");
      const bytes = Uint8Array.from(atob(data.audio), (character) => character.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: data.mimeType || "audio/mpeg" }));
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplaying = () => { if (mountedRef.current) { setAudioPlaying(true); setAudioLoading(false); } };
      audio.onpause = () => { if (mountedRef.current) setAudioPlaying(false); };
      audio.onwaiting = () => { if (mountedRef.current) { setAudioPlaying(false); setAudioLoading(true); } };
      audio.onended = stopAudio;
      audio.onerror = () => {
        if (mountedRef.current) {
          setError("Não foi possível reproduzir a voz. O texto está disponível na conversa.");
          setFailure({ kind: "speech", message });
        }
        stopAudio();
      };
      if (audioReactive) await observeOutput(audio);
      if (!mountedRef.current || playback !== playbackRef.current || mutedRef.current) return;
      await audio.play();
      if (mountedRef.current && playback === playbackRef.current) {
        setAudioLoading(false);
        setAudioPlaying(true);
      }
    } catch (cause) {
      if (!mountedRef.current || playback !== playbackRef.current || cause.name === "AbortError") return;
      setError(cause.name === "NotAllowedError"
        ? "Toque em Ouvir resposta para liberar a reprodução de áudio."
        : `${cause.message} A resposta em texto continua disponível.`);
      setFailure({ kind: "speech", message });
      stopAudio();
    }
  }, [session?.access_token, stopAudio, userPreferences?.assistantVoice, audioReactive, observeOutput]);

  const sendMessage = useCallback(async (text, spoken = false) => {
    const content = text.trim();
    if (!content || busyRef.current || !session?.access_token) return;
    if (content.length > 6000) {
      setInput(content);
      setError("A mensagem deve ter até 6000 caracteres. Edite o texto antes de enviar.");
      return;
    }
    busyRef.current = true;
    const generation = generationRef.current;
    stopAudio();
    setError("");
    setFailure(null);
    setPhase("sending");
    setInput("");
    const message = { id: crypto.randomUUID(), role: "user", content };
    const history = [...messages, message];
    setMessages(history);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await fetch(`${API_BASE}/api/chat`, {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          mode: "simple", messages: history.slice(-12).map(({ role, content: value }) => ({ role, content: value })),
          assistantName: mentorName, userName: userPreferences?.displayName || null,
          currentLevel: userPreferences?.currentLevel || "A2", targetLanguage: userPreferences?.targetLanguage || "en",
          scenario: scenario || undefined,
          // Missão da Jornada: a API avalia cada expressão-alvo na última mensagem.
          targets: targets?.length ? targets : undefined,
          objective: targets?.length ? objective : undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível enviar. Tente novamente.");
      if (!mountedRef.current || generation !== generationRef.current) return;
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("A resposta não foi recebida. Tente novamente.");
      const reply = { id: crypto.randomUUID(), role: "assistant", content: data.reply };
      // A correção fica presa à mensagem do usuário e vira card em Meus Erros automaticamente.
      const correction = data.correction?.correct ? data.correction : null;
      const targetEvaluation = Array.isArray(data.targetEvaluation) ? data.targetEvaluation : null;
      const corrected = correction || targetEvaluation
        ? history.map((item) => (item.id === message.id ? { ...item, ...(correction ? { correction } : {}), ...(targetEvaluation ? { targetEvaluation } : {}) } : item))
        : history;
      setMessages([...corrected, reply].slice(-100));
      // Mesmas ações do chatbot: alimentam as missões "Praticar com o Neo" e "Salvar 1 correção".
      trackProgressionAction("neoMessage", { reason: "Message sent", silent: true });
      if (correction && user?.id) {
        createCorrectedMistake({
          originalText: correction.wrong || content,
          correctedText: correction.correct,
          explanation: correction.explanation,
          category: correction.category,
          level: correction.level,
        }, { userId: user.id })
          .then(() => trackProgressionAction("saveCorrection", { reason: "Correction saved", category: correction.category || "Conversation", silent: true }))
          .catch((cause) => console.warn("[conversation] Falha ao salvar correção:", cause.message));
      }
      if (!mutedRef.current && (spoken || voiceReplies)) void speak(reply);
    } catch (cause) {
      if (!mountedRef.current || generation !== generationRef.current) return;
      setMessages(messages);
      setInput(content);
      if (cause.name !== "AbortError") setError(cause.message);
      if (cause.name !== "AbortError") setFailure({ kind: "message", text: content, spoken });
    } finally {
      if (mountedRef.current && generation === generationRef.current) {
        busyRef.current = false;
        setPhase("idle");
        if (!spoken || focusAfterVoice) inputRef.current?.focus();
      }
    }
  }, [messages, mentorName, scenario, targets, objective, session?.access_token, speak, stopAudio, trackProgressionAction, user?.id, userPreferences, voiceReplies, focusAfterVoice]);

  const processRecording = useCallback(async ({ blob }) => {
    const generation = generationRef.current;
    setPhase("transcribing");
    busyRef.current = true;
    setError("");
    setFailure(null);
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const text = await transcribeAudio(blob, session?.access_token, { signal: controller.signal });
      if (!mountedRef.current || generation !== generationRef.current) return;
      if (!text.trim()) throw new Error("Não consegui ouvir a frase. Tente gravar novamente.");
      busyRef.current = false;
      await sendMessage(input.trim() ? `${input.trim()}\n${text}` : text, true);
    } catch (cause) {
      if (mountedRef.current && generation === generationRef.current && cause.name !== "AbortError") {
        setError(cause.message);
        setFailure({ kind: "transcription", blob });
      }
    } finally {
      if (mountedRef.current && generation === generationRef.current) {
        busyRef.current = false;
        setPhase("idle");
      }
    }
  }, [input, sendMessage, session?.access_token]);
  const recorder = useRecorder(processRecording, {
    onStream: audioReactive ? inputMeter.observeStream : undefined,
    onStop: audioReactive ? inputMeter.stop : undefined,
  });

  const busy = phase !== "idle" || recorder.state === "requesting";
  const newConversation = () => {
    generationRef.current += 1;
    requestRef.current?.abort();
    recorder.cancel();
    stopAudio();
    busyRef.current = false;
    setMessages([]);
    setInput("");
    setError("");
    setFailure(null);
    setPhase("idle");
    inputRef.current?.focus();
  };

  const toggleRecording = () => {
    if (recorder.recording) { recorder.stop(); return; }
    stopAudio();
    setError("");
    setFailure(null);
    void recorder.start({ maxMs: 60000 });
  };

  const toggleMuted = () => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    if (mutedRef.current) stopAudio();
  };
  const retry = () => {
    setError("");
    if (failure?.kind === "speech") void speak(failure.message);
    else if (failure?.kind === "message") void sendMessage(failure.text, failure.spoken);
    else if (failure?.kind === "transcription") void processRecording({ blob: failure.blob });
    else toggleRecording();
  };

  const corrections = messages.filter((item) => item.correction).map((item) => item.correction);

  return {
    messages, corrections, input, setInput, phase, error, voiceReplies, setVoiceReplies,
    speakingId, audioLoading, inputRef, mentorName, speak, sendMessage,
    recorder, busy, newConversation, toggleRecording, stopAudio,
    muted, toggleMuted, audioPlaying, inputMeter, outputMeter, retry,
  };
}
