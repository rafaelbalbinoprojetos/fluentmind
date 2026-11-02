import { useRef, useState } from "react";
import toast from "react-hot-toast";
import { Headphones, Loader2, Mic, Square } from "lucide-react";
import useRecorder from "../hooks/useRecorder.js";
import { localSimilarity, wordDiff } from "../services/answerCheck.js";
import { transcribeAudio } from "../services/speech.js";
import { playCardModel, SHADOW_MAX_MS, shadowVerdict } from "../services/shadowing.js";

export function RecordButton({ recorder, processing, maxMs, onStart, label }) {
  if (processing) {
    return (
      <p className="mt-4 inline-flex items-center gap-2 font-bold">
        <Loader2 className="h-4 w-4 animate-spin" /> Ouvindo sua gravação…
      </p>
    );
  }
  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      {recorder.recording ? (
        <button type="button" onClick={recorder.stop} className="speaking-record recording">
          <Square className="h-5 w-5" /> Parar · {Math.max(0, Math.ceil((maxMs - recorder.elapsedMs) / 1000))}s
        </button>
      ) : (
        <button type="button" onClick={onStart} className="speaking-record">
          <Mic className="h-5 w-5" /> {label}
        </button>
      )}
      {recorder.error ? <p className="text-sm text-red-400">{recorder.error}</p> : null}
    </div>
  );
}

/** Ouvir e repetir: toca o modelo, grava logo em seguida e marca as palavras não reconhecidas. */
export default function ShadowingPractice({ card, accessToken, voice, onResult }) {
  const [armed, setArmed] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const audioCache = useRef({});

  const recorder = useRecorder(async ({ blob }) => {
    setProcessing(true);
    try {
      const transcript = await transcribeAudio(blob, accessToken);
      const score = localSimilarity(transcript, card.expression) ?? 0;
      const next = { transcript, score, diff: wordDiff(transcript, card.expression), attempts: (result?.attempts ?? 0) + 1 };
      setResult(next);
      onResult?.(next);
    } catch (error) {
      toast.error(error.message || "Não foi possível transcrever.");
    } finally {
      setProcessing(false);
    }
  });

  const start = async () => {
    setArmed(true);
    try {
      await playCardModel(card, { accessToken, voice, cache: audioCache.current });
    } catch (error) {
      toast.error(error.message || "Não foi possível tocar o áudio.");
    } finally {
      setArmed(false);
    }
    await recorder.start({ maxMs: SHADOW_MAX_MS });
  };

  return (
    <div className="text-center">
      {armed ? (
        <p className="mt-4 inline-flex items-center gap-2 font-bold"><Headphones className="h-4 w-4" /> Ouça… a gravação começa ao final</p>
      ) : (
        <RecordButton recorder={recorder} processing={processing} maxMs={SHADOW_MAX_MS} onStart={start} label={result ? "Tentar de novo" : "Ouvir e repetir"} />
      )}
      {result ? (
        <div className={`speaking-feedback ${shadowVerdict(result.score).tone}`}>
          <strong>{shadowVerdict(result.score).label} · {result.score}%</strong>
          <p className="speaking-diff">
            {result.diff.map((item, position) => (
              <span key={`${item.word}-${position}`} className={item.ok ? "ok" : "miss"}>{item.word} </span>
            ))}
          </p>
          <p className="text-xs">Entendemos: “{result.transcript || "…"}”. Palavras em vermelho não foram reconhecidas: ouça de novo e repita só elas.</p>
        </div>
      ) : null}
    </div>
  );
}
