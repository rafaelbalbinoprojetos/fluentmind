import { useEffect, useRef } from "react";
import { ArrowLeft, ArrowUp, Loader2, Mic, Orbit, Plus, Square, Volume2, VolumeX, X } from "lucide-react";
import { Link } from "react-router-dom";
import useConversation from "../hooks/useConversation.js";
import "./simple-conversation.css";

export default function SimpleConversationPage() {
  const {
    messages, input, setInput, phase, error, voiceReplies, setVoiceReplies,
    speakingId, audioLoading, inputRef, mentorName, speak, sendMessage,
    recorder, busy, newConversation, toggleRecording, stopAudio,
  } = useConversation();
  const scrollRef = useRef(null);
  useEffect(() => {
    scrollRef.current?.scrollTo?.({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, phase]);

  return (
    <main className="simple-conversation">
      <header className="sc-header">
        <Link to="/dashboard" className="sc-icon-button" aria-label="Voltar ao início"><ArrowLeft size={20} /></Link>
        <div className="sc-mentor"><span className="sc-avatar" aria-hidden="true">{mentorName.slice(0, 1)}</span><div><strong>{mentorName}</strong><span>Conversa por texto e voz</span></div></div>
        <Link to="/neo" className="sc-icon-button" aria-label="Abrir modo imersivo" title="Modo imersivo" onClick={(event) => { if (busy || recorder.recording) event.preventDefault(); }}><Orbit size={20} /></Link>
        <button type="button" className="sc-icon-button sc-voice-toggle" aria-label="Respostas em voz" aria-pressed={voiceReplies} title={voiceReplies ? "Desativar respostas em voz" : "Ativar respostas em voz"} onClick={() => { setVoiceReplies(!voiceReplies); stopAudio(); }}>{voiceReplies ? <Volume2 size={20} /> : <VolumeX size={20} />}</button>
        <button type="button" className="sc-icon-button" aria-label="Nova conversa" title="Nova conversa" onClick={newConversation}><Plus size={21} /></button>
      </header>

      <div className="sc-scroll" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="sc-empty"><span className="sc-empty-avatar" aria-hidden="true">{mentorName.slice(0, 1)}</span><h1>Vamos conversar?</h1><p>Escreva uma mensagem ou use o microfone para praticar.</p></div>
        ) : (
          <div className="sc-messages" role="log" aria-label="Conversa" aria-live="polite" aria-relevant="additions text">
            {messages.map((message) => (
              <article key={message.id} className={`sc-message sc-message-${message.role}`} aria-label={message.role === "user" ? "Você" : mentorName}>
                {message.role === "assistant" && <span className="sc-avatar" aria-hidden="true">{mentorName.slice(0, 1)}</span>}
                <div className="sc-message-body"><p>{message.content}</p>{message.role === "assistant" && <button type="button" className="sc-listen" disabled={recorder.recording || recorder.state === "requesting"} aria-label={speakingId === message.id ? "Parar áudio" : "Ouvir resposta"} onClick={() => speakingId === message.id ? stopAudio() : void speak(message)}>{speakingId === message.id ? audioLoading ? <Loader2 className="sc-spin" size={15} /> : <Square size={14} /> : <Volume2 size={15} />}<span>{speakingId === message.id ? audioLoading ? "Preparando áudio…" : "Parar" : "Ouvir"}</span></button>}</div>
              </article>
            ))}
          </div>
        )}
        {phase !== "idle" && <p className="sc-status" role="status"><Loader2 size={15} className="sc-spin" />{phase === "transcribing" ? "Transcrevendo sua voz…" : `${mentorName} está respondendo…`}</p>}
      </div>

      <div className="sc-bottom">
        {(error || recorder.error) && <div className="sc-error" role="alert">{error || recorder.error}</div>}
        <form className={`sc-composer${recorder.recording ? " sc-recording" : ""}`} onSubmit={(event) => { event.preventDefault(); void sendMessage(input); }}>
          {recorder.recording ? <div className="sc-recording-status" role="status"><span className="sc-recording-dot" />Gravando <span>{Math.floor(recorder.elapsedMs / 1000)}s</span><button type="button" aria-label="Cancelar gravação" className="sc-icon-button" onClick={recorder.cancel}><X size={18} /></button></div> : <textarea ref={inputRef} rows={1} value={input} maxLength={6000} disabled={busy} aria-label="Mensagem" placeholder={`Converse com ${mentorName}…`} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!busy) void sendMessage(input); } }} />}
          <button type="button" className={`sc-icon-button sc-mic${recorder.recording ? " is-recording" : ""}`} aria-label={recorder.recording ? "Parar gravação e enviar" : "Gravar mensagem de voz"} disabled={busy} onClick={toggleRecording}>{recorder.state === "requesting" ? <Loader2 size={20} className="sc-spin" /> : recorder.recording ? <Square size={18} /> : <Mic size={21} />}</button>
          <button type="submit" className="sc-send" aria-label="Enviar mensagem" disabled={busy || recorder.recording || !input.trim()}>{phase === "sending" ? <Loader2 size={20} className="sc-spin" /> : <ArrowUp size={22} />}</button>
        </form>
        <p className="sc-hint">{recorder.recording ? "Toque no quadrado para enviar sua voz. Limite de 60 segundos." : "Enter para enviar · Shift + Enter para nova linha"}</p>
      </div>
    </main>
  );
}
