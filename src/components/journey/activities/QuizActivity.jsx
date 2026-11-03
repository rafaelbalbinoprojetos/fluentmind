import { useState } from "react";
import { Check, Volume2, X } from "lucide-react";
import { canSpeak, speakText } from "../../../services/speakText.js";

// Perguntas fechadas, uma por vez. A correção é local e exata (alternativa certa), por isso é confiável.
export default function QuizActivity({ questions, onFinish, finished }) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState(null);
  const [firstTryCorrect, setFirstTryCorrect] = useState(0);
  const [done, setDone] = useState(false);
  const speechAvailable = canSpeak();

  if (!questions.length) return <p className="fm-muted">Este capítulo ainda não tem perguntas para esta atividade.</p>;

  if (done) {
    return (
      <div className="fm-jr-result" role="status">
        <p className="fm-jr-result-score">{firstTryCorrect} de {questions.length}</p>
        <p>acertos na primeira tentativa.</p>
        {firstTryCorrect < questions.length ? <p className="fm-muted text-sm">As que você errou valem uma segunda leitura antes de seguir.</p> : null}
        <button type="button" className="fm-jr-secondary mt-3" onClick={() => { setIndex(0); setPicked(null); setFirstTryCorrect(0); setDone(false); }}>
          Refazer
        </button>
      </div>
    );
  }

  const question = questions[index];
  const answered = picked !== null;
  const correct = answered && picked === question.answer;
  const last = index === questions.length - 1;

  const choose = (optionIndex) => {
    if (answered) return;
    setPicked(optionIndex);
    if (optionIndex === question.answer) setFirstTryCorrect((value) => value + 1);
  };

  const next = () => {
    if (!last) {
      setIndex((value) => value + 1);
      setPicked(null);
      return;
    }
    const score = firstTryCorrect;
    setDone(true);
    onFinish({ status: score === questions.length ? "correct" : "attempted", score, total: questions.length });
  };

  return (
    <div>
      <p className="fm-jr-counter">Pergunta {index + 1} de {questions.length}{finished ? " · já concluída antes" : ""}</p>
      {question.context ? <p className="fm-jr-context">{question.context}</p> : null}
      {question.dialogue ? (
        <div className="fm-jr-dialogue">
          {question.dialogue.map((line) => (
            <p key={line.en} className={`fm-jr-line is-${line.speaker === "you" ? "you" : "other"}`} lang="en">
              <span className="fm-jr-speaker">{line.speaker === "you" ? "Você" : line.speaker === "teacher" ? "Professor(a)" : "Outra pessoa"}</span>
              {line.en}
            </p>
          ))}
        </div>
      ) : null}
      {question.audio ? (
        speechAvailable ? (
          <button type="button" className="fm-jr-secondary" onClick={() => speakText(question.audio)}>
            <Volume2 className="h-4 w-4" aria-hidden="true" /> Ouvir a frase
          </button>
        ) : (
          <p className="fm-jr-context">Seu navegador não lê frases em voz alta. Leia em voz alta: <span lang="en">“{question.audio}”</span></p>
        )
      ) : null}

      <fieldset className="mt-4">
        <legend className="fm-jr-question">{question.prompt}</legend>
        <div className="mt-3 grid gap-2">
          {question.options.map((option, optionIndex) => {
            const state = !answered ? "" : optionIndex === question.answer ? "is-correct" : optionIndex === picked ? "is-wrong" : "is-dim";
            return (
              <button
                key={option}
                type="button"
                className={`fm-jr-option ${state}`}
                onClick={() => choose(optionIndex)}
                aria-pressed={picked === optionIndex}
                disabled={answered && optionIndex !== picked && optionIndex !== question.answer}
                lang={/[a-z]/i.test(option) && !/[ãõçéêáíóú]/i.test(option) ? "en" : undefined}
              >
                {state === "is-correct" ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : state === "is-wrong" ? <X className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
                <span>{option}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {answered ? (
        <div className={`fm-jr-feedback ${correct ? "is-correct" : "is-wrong"}`} role="status">
          <p className="font-bold">{correct ? "Isso!" : "Não é essa."}</p>
          {question.explanation ? <p>{question.explanation}</p> : null}
          <button type="button" className="fm-jr-secondary mt-3" onClick={next}>{last ? "Ver resultado" : "Próxima pergunta"}</button>
        </div>
      ) : null}
    </div>
  );
}
