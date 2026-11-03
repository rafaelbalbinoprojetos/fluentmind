import { useState } from "react";
import { Eye } from "lucide-react";
import AiCheckedAnswer from "./AiCheckedAnswer.jsx";

const GOOD = ["correct", "almost"];
// Só conta o que a correção aprovou. Inconclusivo nunca aprova.
const outcomeOf = (data) => {
  const assessment = data.assessment || data.verdict;
  if (assessment === "inconclusive") return "inconclusive";
  return (data.passed ?? GOOD.includes(assessment)) ? assessment : "wrong";
};

// Recuperação ativa: o aluno vê só o sentido em português e escreve em inglês antes de ver qualquer resposta.
export default function RecallActivity({ items, accessToken, onFinish }) {
  const [index, setIndex] = useState(0);
  const [results, setResults] = useState({});
  const [revealed, setRevealed] = useState({});
  const [done, setDone] = useState(false);
  const item = items[index];
  const last = index === items.length - 1;
  const current = results[item?.id];

  if (done) {
    const good = items.filter((entry) => GOOD.includes(results[entry.id])).length;
    return (
      <div className="fm-jr-result" role="status">
        <p className="fm-jr-result-score">{good} de {items.length}</p>
        <p>frases lembradas corretamente ou quase.</p>
        <p className="fm-muted text-sm">Salve as expressões na revisão para o FluentMind trazê-las de volta no momento certo.</p>
      </div>
    );
  }

  const finish = () => {
    const good = items.filter((entry) => GOOD.includes(results[entry.id])).length;
    setDone(true);
    onFinish({ status: good === items.length ? "correct" : "attempted", score: good, total: items.length });
  };

  return (
    <div>
      <p className="fm-jr-counter">Frase {index + 1} de {items.length}</p>
      <p className="fm-jr-prompt">{item.prompt}</p>
      <AiCheckedAnswer
        key={item.id}
        label="Como você diz isso em inglês?"
        mode="translate"
        prompt={item.prompt}
        expected={item.expected}
        accessToken={accessToken}
        rows={2}
        onChecked={(data) => setResults((value) => ({ ...value, [item.id]: GOOD.includes(value[item.id]) ? value[item.id] : outcomeOf(data) }))}
      >
        {(result) => ((result.assessment || result.verdict) !== "correct" ? <p className="mt-1">Uma forma do capítulo: <strong lang="en">{item.expected}</strong></p> : null)}
      </AiCheckedAnswer>

      {!current && !revealed[item.id] ? (
        <button
          type="button"
          className="fm-jr-link mt-3"
          onClick={() => {
            setRevealed((value) => ({ ...value, [item.id]: true }));
            setResults((value) => ({ ...value, [item.id]: "wrong" }));
          }}
        >
          <Eye className="h-4 w-4" aria-hidden="true" /> Não lembro, mostrar a resposta
        </button>
      ) : null}
      {revealed[item.id] ? <p className="fm-jr-feedback is-wrong mt-3">Resposta: <strong lang="en">{item.expected}</strong>. Ela volta na revisão.</p> : null}

      {current ? (
        <button type="button" className="fm-jr-secondary mt-4" onClick={() => (last ? finish() : setIndex((value) => value + 1))}>
          {last ? "Ver resultado" : "Próxima frase"}
        </button>
      ) : null}
    </div>
  );
}
