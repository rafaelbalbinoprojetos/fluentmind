import { useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { checkAnswerWithAi } from "../../../services/answerCheck.js";

const ASSESSMENT_LABEL = { correct: "Correto", almost: "Quase", wrong: "Ainda não", inconclusive: "Avaliação inconclusiva" };
const CRITERION_LABEL = { met: "atendido", partial: "parcial", not_met: "não atendido" };
// Respostas antigas da API não têm "assessment": cai no veredito.
const assessmentOf = (result) => result?.assessment || result?.verdict;

/**
 * Resposta aberta corrigida pelo sentido (IA em /api/review-check). Sem correção disponível,
 * mostra o erro e não aprova nada.
 */
export default function AiCheckedAnswer({ label, mode, prompt, expected, accessToken, rows = 3, placeholder, onChecked, criteria, difficulty, context, children }) {
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    if (!answer.trim() || checking) return;
    setChecking(true);
    setError("");
    try {
      const data = await checkAnswerWithAi({ mode, prompt, expected, answer: answer.trim(), accessToken, criteria, difficulty, context });
      setResult(data);
      onChecked?.(data, answer.trim());
    } catch (cause) {
      setError(`Não foi possível corrigir agora (${cause.message}). Sua resposta continua aqui; tente de novo.`);
    } finally {
      setChecking(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <label className="fm-jr-question block">
        {label}
        <textarea
          className="fm-jr-input mt-2"
          rows={rows}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          placeholder={placeholder}
          lang="en"
          disabled={checking}
        />
      </label>
      {!result ? (
        <button type="submit" className="fm-jr-secondary mt-3" disabled={!answer.trim() || checking}>
          {checking ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : null}
          {checking ? "Corrigindo…" : "Corrigir"}
        </button>
      ) : null}
      {error ? <p className="fm-jr-feedback is-wrong mt-3" role="alert">{error}</p> : null}
      {result ? (
        <div className={`fm-jr-feedback mt-3 ${assessmentOf(result) === "correct" ? "is-correct" : assessmentOf(result) === "almost" ? "is-almost" : "is-wrong"}`} role="status">
          <p className="font-bold">{ASSESSMENT_LABEL[assessmentOf(result)] || "Corrigido"}</p>
          {assessmentOf(result) === "inconclusive" ? (
            <p>Não deu para avaliar com segurança. Nada foi aprovado: reescreva com frases completas em inglês e envie de novo.</p>
          ) : null}
          {result.onTopic === false ? <p>A resposta não atende à situação proposta. Releia a tarefa.</p> : null}
          {result.feedback ? <p>{result.feedback}</p> : null}
          {result.criteria?.length ? (
            <ul className="fm-jr-criteria mt-2" aria-label="Critérios">
              {result.criteria.map((item) => (
                <li key={item.criterion} className={`is-${item.status || "unknown"}`}>
                  <span>{item.criterion}{item.essential ? <em className="fm-jr-essential"> · essencial</em> : null}</span>
                  <strong>{CRITERION_LABEL[item.status] || "sem avaliação"}</strong>
                  {item.comment ? <small>{item.comment}</small> : null}
                </li>
              ))}
            </ul>
          ) : null}
          {result.improvement ? <p className="mt-2">Próximo passo: {result.improvement}</p> : null}
          {result.essentialsMet === false && assessmentOf(result) !== "inconclusive" ? (
            <p className="mt-2 font-semibold">Ainda não aprovado: falta atender um critério essencial.</p>
          ) : result.passed === false && result.threshold && assessmentOf(result) !== "inconclusive" && assessmentOf(result) !== "wrong" ? (
            <p className="mt-2 font-semibold">Ainda não aprovado: atenda mais alguns critérios para chegar ao mínimo deste capítulo.</p>
          ) : null}
          {result.corrected && result.verdict !== "correct" ? <p className="mt-2">Versão corrigida: <strong lang="en">{result.corrected}</strong></p> : null}
          {result.alternative ? <p className="mt-1">Outra forma natural: <span lang="en">{result.alternative}</span></p> : null}
          {children?.(result, answer.trim())}
          <button type="button" className="fm-jr-secondary mt-3" onClick={() => { setResult(null); setAnswer(""); }}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Tentar de novo
          </button>
        </div>
      ) : null}
    </form>
  );
}
