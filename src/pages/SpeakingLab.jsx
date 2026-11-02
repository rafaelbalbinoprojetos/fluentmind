import useLearningActions from "../hooks/useLearningActions.js";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ArrowRight, Gauge, Headphones, RotateCcw, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { RecordButton } from "../components/ShadowingPractice.jsx";
import { SHADOW_MAX_MS, shadowVerdict } from "../services/shadowing.js";
import useRecorder from "../hooks/useRecorder.js";
import { listMindBlocks } from "../services/mindblocks.js";
import { checkAnswerWithAi, localSimilarity, wordDiff } from "../services/answerCheck.js";
import { mindBlockAudioUrl, transcribeAudio, wordsPerMinute } from "../services/speech.js";


import { recordDailyActivity } from "../services/learningProgress.js";

// Método da sessão, por MindBlock:
//   1. Listen    — ouvir o bloco (velocidade normal ou mais lenta);
//   2. Shadowing — repetir junto/logo depois, imitando ritmo e entonação; a fala é transcrita e comparada;
//   3. Speak     — resposta livre com tempo limite usando o bloco: produção oral sob pressão, que gera automatismo.
const SESSION_SIZE = 5;
const SPEAK_MAX_MS = 25000;
const SPEEDS = [1, 0.8];

function pickDeck(blocks) {
  const now = Date.now();
  return [...blocks]
    .filter((block) => block.expression && block.expression.split(/\s+/).length <= 14)
    .sort((a, b) => {
      const dueA = a.nextReviewAtRaw ? new Date(a.nextReviewAtRaw).getTime() <= now : true;
      const dueB = b.nextReviewAtRaw ? new Date(b.nextReviewAtRaw).getTime() <= now : true;
      if (dueA !== dueB) return dueA ? -1 : 1;
      return (a.mastery ?? 0) - (b.mastery ?? 0);
    })
    .slice(0, SESSION_SIZE);
}

export default function SpeakingLabPage() {
  const { recordLearningEvent, trackProgressionAction } = useLearningActions();
  const { user, session, userPreferences } = useAuth();
  const [deck, setDeck] = useState([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState("listen"); // listen | shadow | speak
  const [speed, setSpeed] = useState(1);
  const [audioBusy, setAudioBusy] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [shadowArmed, setShadowArmed] = useState(false);
  const [shadow, setShadow] = useState(null); // { transcript, score, diff, attempts }
  const [speak, setSpeak] = useState(null); // { transcript, wpm, check }
  const [results, setResults] = useState([]);
  const audioRef = useRef(null);
  const audioUrls = useRef({});
  const level = userPreferences?.currentLevel || "A2";
  const voice = userPreferences?.assistantVoice || user?.user_metadata?.assistant_voice || "mineirinha";
  const card = deck[index] ?? null;
  const finished = !loading && deck.length > 0 && index >= deck.length;

  useEffect(() => {
    let ignore = false;
    async function load() {
      if (!user?.id) return;
      setLoading(true);
      try {
        const blocks = await listMindBlocks(user.id);
        if (!ignore) setDeck(pickDeck(blocks));
      } catch (error) {
        console.error("Erro ao carregar MindBlocks:", error);
        if (!ignore) toast.error("Não foi possível carregar seus MindBlocks.");
      } finally {
        if (!ignore) setLoading(false);
      }
    }
    load();
    return () => {
      ignore = true;
      audioRef.current?.pause();
    };
  }, [user?.id]);

  const shadowRecorder = useRecorder(async ({ blob }) => {
    setProcessing(true);
    try {
      const transcript = await transcribeAudio(blob, session?.access_token);
      const score = localSimilarity(transcript, card.expression) ?? 0;
      setShadow((current) => ({ transcript, score, diff: wordDiff(transcript, card.expression), attempts: (current?.attempts ?? 0) + 1 }));
    } catch (error) {
      toast.error(error.message || "Não foi possível transcrever.");
    } finally {
      setProcessing(false);
    }
  });

  const speakRecorder = useRecorder(async ({ blob, durationMs }) => {
    setProcessing(true);
    try {
      const transcript = await transcribeAudio(blob, session?.access_token);
      if (!transcript.trim()) throw new Error("Não entendi o áudio. Tente falar mais perto do microfone.");
      const check = await checkAnswerWithAi({
        mode: "sentence",
        prompt: `Say your own sentence using "${card.expression}"`,
        expected: card.expression,
        answer: transcript,
        level,
        accessToken: session?.access_token,
      }).catch(() => null);
      setSpeak({ transcript, wpm: wordsPerMinute(transcript, durationMs), check });
    } catch (error) {
      toast.error(error.message || "Não foi possível avaliar sua fala.");
    } finally {
      setProcessing(false);
    }
  });

  const recording = shadowRecorder.recording || speakRecorder.recording;

  // Resolve quando o áudio termina (o shadowing só grava depois, para o microfone não captar o modelo).
  async function playModel(rate = speed) {
    if (!card) return;
    setAudioBusy(true);
    try {
      let url = audioUrls.current[card.id];
      if (!url && session?.access_token) {
        url = await mindBlockAudioUrl({ mindblockId: card.id, voice, accessToken: session.access_token });
        audioUrls.current[card.id] = url;
      }
      audioRef.current?.pause();
      if (url) {
        const audio = new Audio(url);
        audio.playbackRate = rate;
        audioRef.current = audio;
        const ended = new Promise((resolve) => {
          audio.onended = resolve;
          audio.onerror = resolve;
        });
        await audio.play();
        setAudioBusy(false);
        await ended;
      } else if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(card.expression);
        utterance.lang = "en-US";
        utterance.rate = rate;
        const ended = new Promise((resolve) => {
          utterance.onend = resolve;
          utterance.onerror = resolve;
        });
        window.speechSynthesis.speak(utterance);
        setAudioBusy(false);
        await ended;
      }
    } catch (error) {
      toast.error(error.message || "Não foi possível tocar o áudio.");
    } finally {
      setAudioBusy(false);
    }
  }

  async function startShadow() {
    // ouve o modelo e repete logo em seguida, enquanto o som ainda está "no ouvido"
    setShadowArmed(true);
    await playModel();
    setShadowArmed(false);
    await shadowRecorder.start({ maxMs: SHADOW_MAX_MS });
  }

  function nextCard() {
    const shadowScore = shadow?.score ?? null;
    const verdict = speak?.check?.verdict ?? null;
    setResults((current) => [...current, { id: card.id, expression: card.expression, shadowScore, verdict, wpm: speak?.wpm ?? 0 }]);
    trackProgressionAction("practicePronunciation", { reason: "Speaking Lab", category: card.category });
    recordLearningEvent("practice_completed", {
      expressionId: card.id,
      expression: card.expression,
      category: card.category,
      shadowScore,
      speakVerdict: verdict,
      wpm: speak?.wpm ?? 0,
      source: "speaking_lab",
    }, "speaking_lab");
    if (user?.id) recordDailyActivity(user.id, { study_minutes: 1 }).catch(() => {});
    setShadow(null);
    setSpeak(null);
    setStep("listen");
    setIndex((value) => value + 1);
  }

  const summary = useMemo(() => {
    if (!results.length) return null;
    const scored = results.filter((item) => item.shadowScore !== null);
    const spoken = results.filter((item) => item.wpm > 0);
    return {
      clarity: scored.length ? Math.round(scored.reduce((sum, item) => sum + item.shadowScore, 0) / scored.length) : null,
      correct: results.filter((item) => item.verdict === "correct").length,
      wpm: spoken.length ? Math.round(spoken.reduce((sum, item) => sum + item.wpm, 0) / spoken.length) : null,
    };
  }, [results]);

  return (
    <div className="min-h-screen bg-[var(--bg-main)] px-3 py-4 text-[var(--text-primary)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-5">
        <section className="fm-card rounded-[32px] border p-5 shadow-2xl sm:p-7">
          <p className="fm-accent text-xs font-semibold uppercase tracking-[0.18em]">Speaking Lab</p>
          <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">Hear it. Shadow it. Own it.</h1>
          <p className="fm-muted mt-3 text-base leading-7">
            Para cada MindBlock: ouça, repita imitando o ritmo (shadowing) e depois fale uma frase sua com tempo limite.
            Falar em voz alta é o que transforma o bloco em fala automática.
          </p>
          {deck.length > 0 && !finished ? (
            <div className="speaking-progress mt-5">
              {deck.map((item, position) => (
                <span key={item.id} className={position < index ? "done" : position === index ? "current" : ""} />
              ))}
            </div>
          ) : null}
        </section>

        {loading ? (
          <section className="fm-card rounded-[28px] border p-6"><Loader2 className="h-5 w-5 animate-spin" /></section>
        ) : !deck.length ? (
          <section className="fm-card rounded-[28px] border p-6">
            <h2 className="text-xl font-black">Nenhum MindBlock para treinar ainda</h2>
            <p className="fm-muted mt-2">Salve expressões conversando com o Neo ou na Biblioteca e volte aqui.</p>
            <Link to="/chatbot" className="fm-primary-button mt-4 inline-flex rounded-2xl px-5 py-3 font-black">Conversar com Neo</Link>
          </section>
        ) : finished ? (
          <section className="fm-card rounded-[28px] border p-6 text-center">
            <Trophy className="mx-auto h-10 w-10" />
            <h2 className="mt-3 text-3xl font-black">Session complete</h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Metric label="Clareza no shadowing" value={summary?.clarity !== null && summary?.clarity !== undefined ? `${summary.clarity}%` : "—"} />
              <Metric label="Frases corretas" value={`${summary?.correct ?? 0}/${results.length}`} />
              <Metric label="Ritmo médio" value={summary?.wpm ? `${summary.wpm} wpm` : "—"} />
            </div>
            <p className="fm-muted mt-4 text-sm">
              Referência: conversa natural em inglês fica entre 120 e 150 palavras por minuto. Abaixo de 80, priorize repetir os blocos até sair sem pausa.
            </p>
            <button type="button" onClick={() => window.location.reload()} className="fm-primary-button mt-6 inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-black">
              <RotateCcw className="h-4 w-4" /> Nova sessão
            </button>
          </section>
        ) : (
          <section className="fm-card rounded-[28px] border p-5 sm:p-7">
            <div className="speaking-steps">
              {[["listen", "1. Listen"], ["shadow", "2. Shadowing"], ["speak", "3. Speak"]].map(([id, label]) => (
                <span key={id} className={step === id ? "active" : ""}>{label}</span>
              ))}
            </div>

            <div className="mt-6 text-center">
              <p className="fm-subtle text-xs font-semibold uppercase tracking-[0.16em]">{card.category || "MindBlock"}</p>
              <h2 className="mt-2 text-3xl font-black sm:text-4xl">{card.expression}</h2>
              {card.translation ? <p className="fm-muted mt-2">{card.translation}</p> : null}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
              <button type="button" disabled={audioBusy || recording} onClick={() => playModel()} className="fm-ghost-button inline-flex items-center gap-2 rounded-2xl px-4 py-2 font-bold">
                {audioBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Headphones className="h-4 w-4" />} Ouvir
              </button>
              {SPEEDS.map((value) => (
                <button key={value} type="button" onClick={() => setSpeed(value)} className={`speaking-chip ${speed === value ? "active" : ""}`}>
                  {value === 1 ? "Normal" : "Devagar"}
                </button>
              ))}
            </div>

            {step === "listen" ? (
              <div className="mt-6 text-center">
                <p className="fm-muted">Ouça duas ou três vezes. Preste atenção em como as palavras se ligam umas às outras.</p>
                <button type="button" onClick={() => setStep("shadow")} className="fm-primary-button mt-4 inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-black">
                  Ir para o shadowing <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            {step === "shadow" ? (
              <div className="mt-6 text-center">
                <p className="fm-muted">O áudio toca e, assim que termina, a gravação começa: repita na hora, imitando ritmo e entonação.</p>
                {shadowArmed ? (
                  <p className="mt-4 inline-flex items-center gap-2 font-bold"><Headphones className="h-4 w-4" /> Ouça… a gravação começa ao final</p>
                ) : (
                  <RecordButton recorder={shadowRecorder} processing={processing} maxMs={SHADOW_MAX_MS} onStart={startShadow} label={shadow ? "Tentar de novo" : "Ouvir e repetir"} />
                )}
                {shadow ? (
                  <div className={`speaking-feedback ${shadowVerdict(shadow.score).tone}`}>
                    <strong>{shadowVerdict(shadow.score).label} · {shadow.score}%</strong>
                    <p className="speaking-diff">
                      {shadow.diff.map((item, position) => (
                        <span key={`${item.word}-${position}`} className={item.ok ? "ok" : "miss"}>{item.word} </span>
                      ))}
                    </p>
                    <p className="text-xs">Entendemos: “{shadow.transcript || "…"}”. Palavras em vermelho não foram reconhecidas: ouça de novo e repita só elas.</p>
                  </div>
                ) : null}
                {shadow ? (
                  <button type="button" onClick={() => setStep("speak")} className="fm-primary-button mt-4 inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-black">
                    Agora fale com suas palavras <ArrowRight className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ) : null}

            {step === "speak" ? (
              <div className="mt-6 text-center">
                <p className="fm-muted">
                  Você tem {SPEAK_MAX_MS / 1000} segundos: fale 1 ou 2 frases sobre a sua vida usando o bloco. Sem escrever antes, só fale.
                </p>
                <RecordButton recorder={speakRecorder} processing={processing} maxMs={SPEAK_MAX_MS} onStart={() => speakRecorder.start({ maxMs: SPEAK_MAX_MS })} label="Começar a falar" />
                {speak ? (
                  <div className={`speaking-feedback ${speak.check?.verdict === "correct" ? "good" : speak.check?.verdict === "almost" ? "almost" : speak.check ? "wrong" : ""}`}>
                    <strong>
                      {speak.check ? (speak.check.verdict === "correct" ? "Correto" : speak.check.verdict === "almost" ? "Quase lá" : "Ainda não") : "Fala registrada"}
                      {" · "}<Gauge className="inline h-4 w-4" /> {speak.wpm} wpm
                    </strong>
                    <p>Você disse: “{speak.transcript}”</p>
                    {speak.check?.feedback ? <p>{speak.check.feedback}</p> : null}
                    {speak.check?.corrected && speak.check.verdict !== "correct" ? <p>Versão corrigida: <em>{speak.check.corrected}</em></p> : null}
                    {speak.check?.alternative ? <p>Outra forma natural: <em>{speak.check.alternative}</em></p> : null}
                  </div>
                ) : null}
                {speak ? (
                  <button type="button" onClick={nextCard} className="fm-primary-button mt-4 inline-flex items-center gap-2 rounded-2xl px-5 py-3 font-black">
                    {index + 1 < deck.length ? "Próximo bloco" : "Ver resultado"} <ArrowRight className="h-4 w-4" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }) {
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-white/[0.03] p-4">
      <p className="fm-muted text-xs font-semibold uppercase tracking-[0.14em]">{label}</p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
