import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowUp, Check, ChevronDown, Eye, Headphones, Mic, RotateCcw, Settings2, Square, Volume2, VolumeX, X } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import NeoCore from "../components/NeoCore.jsx";
import { buildJourneyMission, findUsedTargets } from "../services/conversationMission.js";
import { updateProgressionState } from "../services/progressionEngine.js";
import useConversation from "../hooks/useConversation.js";
import useImmersiveEnvironment from "../hooks/useImmersiveEnvironment.js";
import "./neo-immersive.css";

const TOPICS = [
  ["Viagens", "Let's talk about travel. Ask me about a place I would love to visit."],
  ["Entrevista de emprego", "Let's practice a job interview in English. Start with one interview question."],
  ["Conversa livre", "Let's have a casual conversation in English. Ask me about my day."],
  ["Filmes e séries", "Let's talk about movies and TV shows. Ask me what I enjoy watching."],
  ["Surpreenda-me", "Surprise me with an interesting topic for a friendly English conversation."],
];

function MissionTargets({ targets, used, compact = false }) {
  return (
    <ul className={`neo-mission-targets${compact ? " is-compact" : ""}`} aria-label="Expressões da missão">
      {targets.map((target, index) => {
        const done = used.includes(index);
        return (
          <li key={target.expression} className={done ? "is-done" : ""}>
            {done ? <Check size={12} aria-label="usada" /> : <span aria-hidden="true">○</span>}
            <strong>{target.expression}</strong>
            {!compact && <small>{target.translation}</small>}
          </li>
        );
      })}
    </ul>
  );
}

function normalizeSentence(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9'\s]/g, " ").replace(/\s+/g, " ").trim();
}

function CorrectionRecap({ corrections, onDone }) {
  const [index, setIndex] = useState(0);
  const [attempt, setAttempt] = useState("");
  const [checked, setChecked] = useState(false);
  const item = corrections[index];
  const isLast = index >= corrections.length - 1;
  const correct = checked && normalizeSentence(attempt) === normalizeSentence(item.correct);
  const next = () => {
    if (isLast) return onDone();
    setIndex(index + 1);
    setAttempt("");
    setChecked(false);
  };

  return (
    <section className="neo-recap" aria-label="Revisão das correções">
      <span className="neo-caption-speaker">REVISÃO RÁPIDA · {index + 1}/{corrections.length}</span>
      <p className="neo-recap-wrong">Você disse: <s>{item.wrong}</s></p>
      <p className="neo-recap-hint">Escreva a versão correta:</p>
      <form className="neo-recap-form" onSubmit={(event) => { event.preventDefault(); if (checked) next(); else setChecked(true); }}>
        <input value={attempt} autoFocus disabled={checked} onChange={(event) => setAttempt(event.target.value)} aria-label="Frase corrigida" placeholder="Type the corrected sentence..." />
        <button type="submit">{checked ? (isLast ? "Concluir" : "Próxima") : "Conferir"}</button>
      </form>
      {checked && (
        <p className={`neo-recap-result${correct ? " is-correct" : ""}`} role="status">
          {correct ? "Perfeito! " : "Correto: "}<strong>{item.correct}</strong>
          {item.explanation ? <small>{item.explanation}</small> : null}
        </p>
      )}
      <button type="button" className="neo-recap-skip" onClick={onDone}>Pular revisão</button>
    </section>
  );
}

function neoVisualState({ error, recorder, phase, audioLoading, audioPlaying, muted }) {
  if (error || recorder.error) return "error";
  if (recorder.recording) return "listening";
  if (phase !== "idle" || audioLoading || recorder.state === "requesting") return "processing";
  if (audioPlaying) return "speaking";
  return muted ? "muted" : "idle";
}

export default function NeoImmersivePage() {
  const [searchParams] = useSearchParams();
  const journeyId = searchParams.get("journey");
  const mission = useMemo(() => buildJourneyMission(journeyId), [journeyId]);
  const conversation = useConversation({ defaultVoiceReplies: true, audioReactive: true, focusAfterVoice: false, scenario: mission?.scenario });
  const { messages, corrections, input, setInput, phase, error, muted, toggleMuted,
    audioLoading, inputRef, mentorName, sendMessage, recorder, busy, newConversation,
    toggleRecording, stopAudio, speak, speakingId, inputMeter, outputMeter, retry } = conversation;
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const { hidden, reducedMotion, modestDevice } = useImmersiveEnvironment(rootRef);
  const [hasInteracted, setHasInteracted] = useState(messages.length > 0);
  const [captionsVisible, setCaptionsVisible] = useState(true);
  const [captionEpoch, setCaptionEpoch] = useState(0);
  const [captionHovered, setCaptionHovered] = useState(false);
  const [captionFocused, setCaptionFocused] = useState(false);
  const lastMessage = messages.at(-1);
  const lastReply = [...messages].reverse().find((message) => message.role === "assistant");
  const lastUserMessage = [...messages].reverse().find((message) => message.role === "user");
  const latestCorrection = lastUserMessage?.correction;
  const usedTargets = useMemo(
    () => (mission ? findUsedTargets(mission.targets, messages.filter((message) => message.role === "user").map((message) => message.content)) : []),
    [mission, messages],
  );
  const missionComplete = Boolean(mission) && usedTargets.length === mission.targets.length;
  const state = neoVisualState(conversation);
  const meter = state === "listening" ? inputMeter : outputMeter;
  const genericMotion = ["listening", "speaking"].includes(state) && !meter.available;
  const captionText = lastMessage?.content || "";
  const pinned = captionFocused || captionHovered;
  const stateLabel = {
    idle: "Pronto para conversar", listening: "Estou ouvindo você", processing: phase === "transcribing"
      ? "Transformando sua voz em palavras…" : recorder.state === "requesting" ? "Aguardando acesso ao microfone…"
        : audioLoading ? "Preparando a voz…" : `${mentorName} está pensando…`,
    speaking: `${mentorName} está falando`, error: "Vamos tentar de novo", muted: "Áudio desativado",
  }[state];

  useEffect(() => { setCaptionsVisible(true); }, [lastMessage?.id]);
  // Uma missão da Jornada sempre começa numa conversa limpa, sem misturar com o papo anterior.
  const missionStartedRef = useRef(false);
  useEffect(() => {
    if (!mission || missionStartedRef.current) return;
    missionStartedRef.current = true;
    if (messages.length) { newConversation(); setHasInteracted(false); }
  }, [mission, messages.length, newConversation]);
  useEffect(() => {
    if (!missionComplete) return;
    updateProgressionState((progress) => {
      const journey = progress.learningJourney || {};
      return {
        ...progress,
        learningJourney: {
          ...journey,
          chapterProgress: {
            ...journey.chapterProgress,
            [mission.chapterId]: { ...(journey.chapterProgress?.[mission.chapterId] || {}), conversation: true },
          },
          lastUpdatedAt: new Date().toISOString(),
        },
      };
    });
  }, [missionComplete, mission]);
  useEffect(() => {
    if (!captionText || state === "processing" || state === "listening" || state === "speaking" || state === "error" || pinned || hidden) return;
    const readingTime = Math.max(14000, captionText.split(/\s+/).length * 420);
    const timer = window.setTimeout(() => setCaptionsVisible(false), readingTime);
    return () => window.clearTimeout(timer);
  }, [captionText, state, pinned, hidden, captionEpoch]);

  const submit = (text) => {
    if (!text.trim() || busy || recorder.recording) return;
    if (recorder.error) recorder.cancel();
    setHasInteracted(true);
    void sendMessage(text);
  };
  const [recap, setRecap] = useState(null);
  const startFresh = () => { newConversation(); setHasInteracted(false); setCaptionsVisible(true); setRecap(null); };
  // Antes de limpar, oferece reescrever as frases corrigidas: é a última chance de fixá-las ainda frescas.
  const reset = () => (corrections.length && !recap ? setRecap(corrections.slice(-5)) : startFresh());
  const goBack = () => {
    if (window.history.state?.idx > 0) navigate(-1);
    else navigate("/conversar", { replace: true });
  };

  return (
    <main ref={rootRef} className="neo-immersive" data-state={state} data-recap={Boolean(recap)} data-paused={hidden} data-reduced-motion={reducedMotion} data-modest={modestDevice} aria-label="Neo, modo imersivo">
      <div className="neo-environment" aria-hidden="true"><div className="neo-ambient-violet" /><div className="neo-ambient-blue" /><div className="neo-star-field" /><div className="neo-vignette" /></div>
      <header className="neo-header">
        <button type="button" className="neo-icon-button" aria-label="Voltar à tela anterior" onClick={goBack}><ArrowLeft size={19} /></button>
        <div className="neo-brand"><span>FLUENTMIND</span><strong>{mentorName}<i aria-hidden="true" /></strong></div>
        <div className="neo-header-actions">
          <button type="button" className="neo-icon-button" aria-label={muted ? "Ativar áudio" : "Desativar áudio"} aria-pressed={muted} title={muted ? "Ativar áudio" : "Desativar áudio"} onClick={toggleMuted}>{muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
          <button type="button" className="neo-icon-button neo-reset" aria-label="Nova conversa" title="Nova conversa" onClick={reset}><RotateCcw size={17} /></button>
          <Link to="/configuracoes" className="neo-icon-button" aria-label="Configurações" title="Configurações"><Settings2 size={18} /></Link>
        </div>
      </header>

      <section className="neo-stage" aria-label="Núcleo do Neo">
        <div className="neo-core-position"><NeoCore state={state} meter={meter} paused={hidden} reducedMotion={reducedMotion} modestDevice={modestDevice} /></div>
        <div className="neo-state"><span className="neo-state-dot" aria-hidden="true" /><span role="status" aria-live="polite">{stateLabel}</span>{genericMotion && <small>Movimento ambiente</small>}</div>
      </section>

      <footer className="neo-footer">
        {recap ? (
          <CorrectionRecap corrections={recap} onDone={startFresh} />
        ) : mission && !hasInteracted && messages.length === 0 ? (
          <div className="neo-introduction">
            <h1>Missão: {mission.title}</h1>
            <p>{mission.objective} Use estas expressões durante a conversa — com os seus próprios detalhes:</p>
            <MissionTargets targets={mission.targets} used={usedTargets} />
            <div className="neo-topics"><button type="button" disabled={busy} onClick={() => submit(`Let's practice "${mission.title}". Start the conversation with a simple question for me.`)}>Começar conversa</button></div>
          </div>
        ) : !hasInteracted && messages.length === 0 ? (
          <div className="neo-introduction">
            <h1>Olá, eu sou o {mentorName}.</h1>
            <p>Vamos praticar inglês? Sobre o que você gostaria de conversar?</p>
            <div className="neo-topics" aria-label="Escolha um tema para começar">{TOPICS.map(([label, prompt]) => <button key={label} type="button" onClick={() => submit(prompt)} disabled={busy}>{label}</button>)}</div>
          </div>
        ) : (
          <div className="neo-caption-space">
            {mission && (
              <div className="neo-mission-bar">
                <MissionTargets targets={mission.targets} used={usedTargets} compact />
                {missionComplete && <p role="status" className="neo-mission-done">Missão cumprida! <Link to="/learning-journey">Voltar à Jornada</Link></p>}
              </div>
            )}
            <section className={`neo-caption${captionsVisible && captionText ? " is-visible" : ""}`} aria-label="Última fala" aria-live="polite" aria-atomic="true" aria-hidden={!captionsVisible || !captionText} tabIndex={captionsVisible && captionText ? 0 : -1} onMouseEnter={() => setCaptionHovered(true)} onMouseLeave={() => setCaptionHovered(false)} onFocus={() => setCaptionFocused(true)} onBlur={() => setCaptionFocused(false)}>
              <span className="neo-caption-speaker">{lastMessage?.role === "user" ? "VOCÊ" : mentorName.toUpperCase()}</span>
              <p>{captionText}</p>
            </section>
            {latestCorrection && (
              <p className="neo-correction-tip" aria-live="polite">
                Dica: <s>{latestCorrection.wrong}</s> → <strong>{latestCorrection.correct}</strong>
                {latestCorrection.explanation ? <small>{latestCorrection.explanation}</small> : null}
              </p>
            )}
            <div className="neo-caption-actions">
              {captionText && <button type="button" onClick={() => { setCaptionsVisible(!captionsVisible); setCaptionEpoch((value) => value + 1); }}>{captionsVisible ? <ChevronDown size={14} /> : <Eye size={14} />}{captionsVisible ? "Recolher legenda" : "Ver última fala"}</button>}
              {lastReply && <button type="button" disabled={muted || recorder.recording || busy} onClick={() => speakingId ? stopAudio() : void speak(lastReply)}>{speakingId ? <Square size={12} /> : <Headphones size={14} />}{speakingId ? "Parar áudio" : "Ouvir novamente"}</button>}
            </div>
          </div>
        )}

        {(error || recorder.error) && <div className="neo-error" role="alert"><span>{error || recorder.error}</span><button type="button" disabled={busy} onClick={retry}><RotateCcw size={14} />Tentar novamente</button></div>}

        {recorder.recording && <div className="neo-recording" aria-label="Gravação ativa"><span className="neo-live-dot" />Gravando <span>{Math.floor(recorder.elapsedMs / 1000)}s / 60s</span><button type="button" onClick={recorder.cancel} aria-label="Cancelar gravação"><X size={15} />Cancelar</button><button type="button" onClick={recorder.stop} aria-label="Encerrar gravação e enviar"><Check size={15} />Enviar voz</button></div>}
        <form className="neo-composer" onSubmit={(event) => { event.preventDefault(); submit(input); }}>
          <button type="button" className={`neo-mic${recorder.recording ? " is-recording" : ""}`} aria-label={recorder.recording ? "Encerrar gravação e enviar" : "Iniciar gravação"} title={recorder.recording ? "Encerrar gravação e enviar" : "Iniciar gravação"} disabled={busy} onClick={() => { setHasInteracted(true); toggleRecording(); }}>{recorder.recording ? <Square size={17} /> : <Mic size={20} />}</button>
          <label className="neo-sr-only" htmlFor="neo-message">Mensagem para {mentorName}</label>
          <input id="neo-message" ref={inputRef} type="text" value={input} maxLength={6000} disabled={busy || recorder.recording} autoComplete="off" placeholder="Escreva sua mensagem em inglês..." onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); if (!event.nativeEvent.isComposing) submit(input); } }} />
          <button type="submit" className="neo-send" aria-label="Enviar mensagem" disabled={busy || recorder.recording || !input.trim()}><ArrowUp size={20} /></button>
        </form>
        <div className="neo-footer-note"><span>{recorder.recording ? "Seu microfone está ativo. Encerre ou cancele a gravação." : muted ? "Respostas em texto · áudio desativado" : "Texto e voz, no seu ritmo"}</span>{corrections.length > 0 && <Link to="/meus-erros">{corrections.length} {corrections.length === 1 ? "correção salva" : "correções salvas"} · revisar</Link>}<Link to="/conversar">Modo texto</Link></div>
      </footer>
    </main>
  );
}
