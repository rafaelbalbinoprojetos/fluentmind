import { useState } from "react";
import { normalizeAnswer } from "../../../services/answerCheck.js";

const MAX_TRIES = 2;

// Completar a fala do diálogo. A resposta é fechada (a expressão do capítulo), então a checagem local é exata.
export default function ClozeActivity({ items, onFinish }) {
  const [index, setIndex] = useState(0);
  const [value, setValue] = useState("");
  const [tries, setTries] = useState(0);
  const [state, setState] = useState("idle"); // idle | wrong | correct | revealed
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const item = items[index];
  const last = index === items.length - 1;

  if (!items.length) return <p className="fm-muted">Sem falas para completar neste capítulo.</p>;

  if (done) {
    return (
      <div className="fm-jr-result" role="status">
        <p className="fm-jr-result-score">{score} de {items.length}</p>
        <p>falas completadas sem ver a resposta.</p>
      </div>
    );
  }

  const check = (event) => {
    event.preventDefault();
    if (!value.trim() || state === "correct" || state === "revealed") return;
    if (normalizeAnswer(value) === normalizeAnswer(item.answer)) {
      setState("correct");
      setScore((current) => current + 1);
      return;
    }
    const nextTries = tries + 1;
    setTries(nextTries);
    setState(nextTries >= MAX_TRIES ? "revealed" : "wrong");
  };

  const next = () => {
    if (last) {
      setDone(true);
      onFinish({ status: score === items.length ? "correct" : "attempted", score, total: items.length });
      return;
    }
    setIndex((current) => current + 1);
    setValue("");
    setTries(0);
    setState("idle");
  };

  const resolved = state === "correct" || state === "revealed";

  return (
    <form onSubmit={check}>
      <p className="fm-jr-counter">Fala {index + 1} de {items.length}</p>
      <p className="fm-jr-context">{item.context}</p>
      <div className="fm-jr-dialogue">
        {item.before.map((line) => (
          <p key={line.en} className="fm-jr-line is-other" lang="en"><span className="fm-jr-speaker">Outra pessoa</span>{line.en}</p>
        ))}
        <p className="fm-jr-line is-you" lang="en">
          <span className="fm-jr-speaker">Você</span>
          {item.prefix}
          <label className="sr-only" htmlFor={`cloze-${item.id}`}>Complete a fala</label>
          <input
            id={`cloze-${item.id}`}
            className="fm-jr-blank"
            value={resolved && state === "revealed" ? item.answer : value}
            onChange={(event) => { setValue(event.target.value); if (state === "wrong") setState("idle"); }}
            readOnly={resolved}
            autoComplete="off"
            size={Math.max(8, item.answer.length)}
          />
          {item.suffix}
        </p>
      </div>
      {!resolved ? <button type="submit" className="fm-jr-secondary mt-3" disabled={!value.trim()}>Conferir</button> : null}
      {state === "wrong" ? <p className="fm-jr-feedback is-wrong mt-3" role="status">Ainda não. Dica do sentido: “{item.hint}”. Mais uma tentativa.</p> : null}
      {state === "correct" ? <p className="fm-jr-feedback is-correct mt-3" role="status">Isso! A fala ficou natural.</p> : null}
      {state === "revealed" ? <p className="fm-jr-feedback is-wrong mt-3" role="status">A expressão era <strong lang="en">{item.answer}</strong>. Leia a fala inteira em voz alta uma vez.</p> : null}
      {resolved ? <button type="button" className="fm-jr-secondary mt-3" onClick={next}>{last ? "Ver resultado" : "Próxima fala"}</button> : null}
    </form>
  );
}
