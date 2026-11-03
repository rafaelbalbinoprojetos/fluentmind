import { useState } from "react";
import { BookmarkPlus, Check, ChevronLeft, ChevronRight, Lightbulb, Loader2, MessageCircle, Play, Volume2 } from "lucide-react";
import { Link } from "react-router-dom";
import AiCheckedAnswer from "./AiCheckedAnswer.jsx";
import { canSpeak, speakSequence, speakText } from "../../../services/speakText.js";
import { exampleSentencesFor } from "../../../services/journeyMindBlocks.js";
import { buildJourneyMission } from "../../../services/conversationMission.js";

function ListenButton({ text, label = "Ouvir", big = false }) {
  if (!canSpeak()) return null;
  return (
    <button type="button" className={`fm-jr-icon-button ${big ? "is-big" : ""}`} onClick={() => speakText(text)} aria-label={`${label}: ${text}`}>
      <Volume2 className={big ? "h-5 w-5" : "h-4 w-4"} aria-hidden="true" />
    </button>
  );
}

function highlight(text, expression) {
  const core = String(expression || "").replace(/[.!?]+$/, "");
  const index = core ? text.toLowerCase().indexOf(core.toLowerCase()) : -1;
  if (index < 0) return text;
  return (
    <>
      {text.slice(0, index)}
      <mark className="fm-jr-mark">{text.slice(index, index + core.length)}</mark>
      {text.slice(index + core.length)}
    </>
  );
}

const SPEAKER = { you: "Você", teacher: "Professor(a)", other: "Outra pessoa" };

// Fórmula do padrão em blocos: "I'm + origem / I work in + área" vira peças visuais.
function PatternFormula({ form }) {
  return (
    <div className="fm-jr-formula" lang="en">
      {form.split(" / ").map((part) => (
        <div key={part} className="fm-jr-formula-row">
          {part.split(" + ").map((piece, index) => (
            <span key={piece + index} className={index === 0 ? "fm-jr-piece is-fixed" : "fm-jr-piece is-slot"}>{piece}</span>
          ))}
        </div>
      ))}
    </div>
  );
}

export function LessonActivity({ chapter, curriculum }) {
  const mistake = chapter.commonMistakes?.[0];
  return (
    <div className="fm-jr-lesson">
      {curriculum?.pattern ? (
        <section className="fm-jr-panel-soft" aria-label="Padrão da língua">
          <p className="fm-jr-eyebrow">O padrão</p>
          <PatternFormula form={curriculum.pattern.form} />
          <p className="fm-jr-example" lang="en">
            <ListenButton text={curriculum.pattern.example} label="Ouvir exemplo" />
            {curriculum.pattern.example}
          </p>
        </section>
      ) : null}
      <ol className="fm-jr-tips">
        {(curriculum?.points || []).map((point, index) => (
          <li key={point}><span className="fm-jr-tip-num" aria-hidden="true">{index + 1}</span><span>{point}</span></li>
        ))}
      </ol>
      {mistake ? (
        <section className="fm-jr-compare" aria-label="Comparação">
          <div className="is-wrong"><span>Evite</span><p lang="en">{mistake.wrong}</p></div>
          <div className="is-right"><span>Use</span><p lang="en">{mistake.correct}</p></div>
          <p className="fm-jr-compare-why">{mistake.reason}</p>
        </section>
      ) : null}
    </div>
  );
}

export function ExpressionsActivity({ chapter, saved, onSave }) {
  const [saving, setSaving] = useState(false);
  const [focus, setFocus] = useState(0);
  const blocks = chapter.mindBlocks;
  const [expression, translation] = blocks[focus];
  // Só mostra "Em uso" quando a frase do diálogo contém mesmo a expressão.
  const core = expression.replace(/[.!?]+$/, "").toLowerCase();
  const usage = exampleSentencesFor(chapter, expression).find((line) => line !== expression && line.toLowerCase().includes(core));
  const save = async () => {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fm-jr-expr">
      <section className="fm-jr-spotlight" aria-live="polite" aria-label="Expressão em foco">
        <p className="fm-jr-eyebrow">{focus + 1} de {blocks.length}</p>
        <div className="fm-jr-spotlight-main">
          <p className="fm-jr-spotlight-en" lang="en">{expression}</p>
          <ListenButton text={expression} big />
        </div>
        <p className="fm-jr-spotlight-pt">{translation}</p>
        {usage ? <p className="fm-jr-spotlight-usage"><span>Em uso:</span> <span lang="en">{highlight(usage, expression)}</span></p> : null}
        <div className="fm-jr-spotlight-nav">
          <button type="button" className="fm-jr-secondary" onClick={() => setFocus((value) => Math.max(0, value - 1))} disabled={focus === 0}>
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Anterior
          </button>
          <button type="button" className="fm-jr-secondary" onClick={() => setFocus((value) => Math.min(blocks.length - 1, value + 1))} disabled={focus === blocks.length - 1}>
            Próxima <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      <div className="fm-jr-library" role="list" aria-label="Todas as expressões do capítulo">
        {blocks.map(([item], index) => (
          <button
            key={item}
            type="button"
            role="listitem"
            className={`fm-jr-library-item ${index === focus ? "is-active" : ""}`}
            onClick={() => setFocus(index)}
            aria-current={index === focus ? "true" : undefined}
            lang="en"
          >
            {item}
          </button>
        ))}
      </div>

      <div className="fm-jr-inline-action">
        <p className="text-sm">
          {saved ? "Estas expressões já estão na sua revisão espaçada." : "Opcional: leve estas expressões para a revisão espaçada (sem duplicar)."}
        </p>
        {saved ? (
          <span className="fm-jr-badge is-approved"><Check className="h-4 w-4" aria-hidden="true" /> Na revisão</span>
        ) : (
          <button type="button" className="fm-jr-secondary" onClick={save} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <BookmarkPlus className="h-4 w-4" aria-hidden="true" />}
            {saving ? "Salvando…" : "Salvar na revisão"}
          </button>
        )}
      </div>
    </div>
  );
}

export function DialoguesActivity({ chapter }) {
  const examples = chapter.examples || [];
  const [scene, setScene] = useState(0);
  const example = examples[scene];
  if (!example) return <p className="fm-muted">Sem diálogos neste capítulo.</p>;
  return (
    <div className="fm-jr-scenes">
      <div className="fm-jr-scene-tabs" role="tablist" aria-label="Cenas">
        {examples.map((item, index) => (
          <button
            key={item.expression}
            type="button"
            role="tab"
            aria-selected={index === scene}
            className={`fm-jr-scene-tab ${index === scene ? "is-active" : ""}`}
            onClick={() => setScene(index)}
          >
            Cena {index + 1}
          </button>
        ))}
      </div>
      <section className="fm-jr-scene" role="tabpanel" aria-label={`Cena ${scene + 1}: ${example.situation}`}>
        <div className="fm-jr-scene-head">
          <p className="fm-jr-context">{example.situation}</p>
          {canSpeak() ? (
            <button type="button" className="fm-jr-secondary" onClick={() => speakSequence(example.dialogue.map((line) => line.en))}>
              <Play className="h-4 w-4" aria-hidden="true" /> Ouvir cena
            </button>
          ) : null}
        </div>
        <div className="fm-jr-chat">
          {example.dialogue.map((line) => {
            const you = line.speaker === "you";
            return (
              <div key={line.en} className={`fm-jr-bubble ${you ? "is-you" : "is-other"}`}>
                <span className="fm-jr-avatar" aria-hidden="true">{you ? "EU" : (SPEAKER[line.speaker] || "?").slice(0, 1)}</span>
                <div className="fm-jr-bubble-body">
                  <span className="fm-jr-speaker">{SPEAKER[line.speaker] || "Outra pessoa"}</span>
                  <p lang="en">{you ? highlight(line.en, example.expression) : line.en}</p>
                  <p className="fm-jr-pt">{line.pt}</p>
                </div>
                <ListenButton text={line.en} />
              </div>
            );
          })}
        </div>
        {example.note ? <p className="fm-jr-note"><Lightbulb className="h-4 w-4 shrink-0" aria-hidden="true" /> {example.note}</p> : null}
      </section>
    </div>
  );
}

// Salvar a própria frase pede o significado: é ele que aparece como pergunta na revisão.
function SaveSentence({ sentence, onSave }) {
  const [meaning, setMeaning] = useState("");
  const [saved, setSaved] = useState(false);
  if (saved) return <p className="mt-2 font-semibold">Salva na sua revisão.</p>;
  return (
    <div className="fm-jr-save mt-3">
      <label className="block text-sm">
        Para revisar depois: o que “<span lang="en">{sentence}</span>” significa em português?
        <input className="fm-jr-input mt-1" value={meaning} onChange={(event) => setMeaning(event.target.value)} placeholder="Ex.: Eu trabalho com tecnologia." />
      </label>
      <button
        type="button"
        className="fm-jr-link mt-2"
        disabled={!meaning.trim()}
        onClick={async () => { if (await onSave(sentence, meaning.trim())) setSaved(true); }}
      >
        <BookmarkPlus className="h-4 w-4" aria-hidden="true" /> Salvar esta frase na revisão
      </button>
    </div>
  );
}

export function ProduceActivity({ chapter, curriculum, accessToken, onChecked, onSaveSentence }) {
  const produce = curriculum?.produce;
  const expressions = chapter.mindBlocks.map(([expression]) => expression).join(" | ");
  return (
    <div>
      <p className="fm-jr-context">{produce?.situation}</p>
      <AiCheckedAnswer
        label={produce?.instruction || "Escreva a sua resposta em inglês."}
        mode="sentence"
        context={produce?.situation}
        difficulty={chapter.difficulty}
        prompt={`${produce?.situation || ""} ${produce?.instruction || ""}`.trim()}
        expected={`A natural, personal answer that fits the situation, ideally using chapter expressions such as: ${expressions}`}
        accessToken={accessToken}
        rows={4}
        onChecked={onChecked}
      >
        {(result, answer) => {
          if ((result.assessment || result.verdict) === "inconclusive") return null;
          const sentence = (result.assessment || result.verdict) === "correct" ? answer : result.corrected || answer;
          return <SaveSentence key={sentence} sentence={sentence} onSave={onSaveSentence} />;
        }}
      </AiCheckedAnswer>
    </div>
  );
}

const EVIDENCE_LABEL = {
  adequate: "uso adequado",
  partial: "uso parcialmente adequado (erro leve)",
  inadequate: "uso inadequado, precisa de prática",
  inconclusive: "avaliação inconclusiva",
  unused: "ainda não usada",
  // registros da versão anterior
  used: "usada sem erro apontado",
  "needs-help": "usada com erro",
};

export function ConversationActivity({ chapter, record }) {
  const mission = buildJourneyMission(chapter.id);
  const evidence = record?.evidence || [];
  return (
    <div>
      <p className="fm-muted text-sm">
        O Neo vai criar situações do tema “{chapter.title}”. Responda com detalhes seus e use estas expressões quando fizer sentido.
        Cada uso é avaliado no contexto da conversa. A missão conta quando as 3 tiverem uso adequado ou parcialmente adequado (erros leves não travam). Só mencionar a expressão não vale.
      </p>
      <ul className="fm-jr-targets mt-4">
        {mission?.targets.map((target) => {
          const status = evidence.find((item) => item.expression === target.expression)?.status || (record?.status === "legacy" ? "legacy" : "unused");
          return (
            <li key={target.expression} className={`is-${status}`}>
              <span className="fm-jr-en" lang="en">{target.expression}</span>
              <span className="fm-jr-pt">{target.translation}</span>
              <small>{status === "legacy" ? "marcada antes" : EVIDENCE_LABEL[status]}</small>
            </li>
          );
        })}
      </ul>
      <Link to={`/neo?journey=${encodeURIComponent(chapter.id)}`} className="fm-jr-secondary mt-4">
        <MessageCircle className="h-4 w-4" aria-hidden="true" /> {record ? "Conversar de novo" : "Começar a conversa com o Neo"}
      </Link>
      <p className="fm-muted mt-2 text-xs">Ao cumprir a missão, o Neo mostra um link para voltar exatamente para cá.</p>
    </div>
  );
}

export function ChallengeActivity({ chapter, curriculum, accessToken, record, onChecked }) {
  const challenge = curriculum?.challenge;
  return (
    <div>
      <p className="fm-jr-lead">{challenge?.task || chapter.finalChallenge}</p>
      <div className="fm-jr-pattern mt-3">
        <p className="fm-jr-eyebrow">Como será avaliado</p>
        <p className="mt-1 text-sm">Os critérios essenciais precisam ser atendidos (um erro leve é aceito). Os demais ajudam a pontuação.</p>
        <ul className="fm-jr-points mt-1">
          {(challenge?.criteria || []).map((criterion) => (
            <li key={criterion.text}>
              {criterion.text}
              {criterion.essential ? <strong className="fm-jr-essential"> · essencial</strong> : null}
            </li>
          ))}
        </ul>
      </div>
      {record?.status === "demonstrated" ? (
        <p className="fm-jr-feedback is-correct mt-3" role="status">Competência demonstrada neste capítulo. Você pode tentar de novo para praticar.</p>
      ) : null}
      <div className="mt-4">
        <AiCheckedAnswer
          label="Sua resposta em inglês"
          mode="challenge"
          prompt={challenge?.task || chapter.finalChallenge}
          expected={chapter.mindBlocks.slice(0, 4).map(([expression]) => expression).join(" | ")}
          criteria={challenge?.criteria || []}
          difficulty={chapter.difficulty}
          context={chapter.objective}
          accessToken={accessToken}
          rows={6}
          onChecked={onChecked}
        />
      </div>
    </div>
  );
}
