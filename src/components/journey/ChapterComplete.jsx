import { ArrowRight, Award, History, MessageCircle, RotateCcw, Target, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { STATUS_LABELS, getChapterActivities, getCurriculum } from "../../services/journeyEngine.js";

const EVIDENCE_LABEL = {
  adequate: "uso adequado",
  partial: "uso com erro leve",
  used: "usada sem erro apontado",
};

// Capítulo concluído na Jornada antiga: só marcações, sem avaliações registradas.
function isLegacyCompletion(activities) {
  return !activities.some((activity) => activity.record && activity.record.status !== "legacy");
}

function NextObjective({ nextChapter, onNext }) {
  return nextChapter ? (
    <div className="fm-jr-next-card">
      <div className="min-w-0">
        <p className="fm-jr-eyebrow">Próximo objetivo</p>
        <p className="fm-jr-next-card-title">Capítulo {nextChapter.order}: {nextChapter.title}</p>
        <p className="fm-jr-next-card-goal">{getCurriculum(nextChapter.id)?.goal || nextChapter.objective}</p>
      </div>
      <button type="button" className="fm-cta-primary" onClick={onNext}>
        Começar o capítulo {nextChapter.order} <ArrowRight className="fm-cta-arrow h-5 w-5" aria-hidden="true" />
      </button>
    </div>
  ) : (
    <div className="fm-jr-next-card">
      <div className="min-w-0">
        <p className="fm-jr-eyebrow">Jornada concluída</p>
        <p className="fm-jr-next-card-title">Agora é usar o inglês em conversas reais.</p>
      </div>
      <Link to="/neo" className="fm-cta-primary">Conversar com o Neo <ArrowRight className="fm-cta-arrow h-5 w-5" aria-hidden="true" /></Link>
    </div>
  );
}

export default function ChapterComplete({ chapter, nextChapter, progress, onReview, onNext }) {
  const activities = getChapterActivities(progress, chapter.id);
  const legacy = isLegacyCompletion(activities);

  if (legacy) {
    return (
      <section className="fm-jr-complete is-legacy" aria-labelledby="chapter-complete-title">
        <div className="fm-jr-complete-seal is-legacy" aria-hidden="true"><History className="h-7 w-7" /></div>
        <p className="fm-jr-eyebrow">Capítulo {chapter.order} · concluído na versão anterior</p>
        <h2 id="chapter-complete-title" className="fm-jr-complete-title">{chapter.title}</h2>
        <p className="fm-jr-complete-lead">
          Você concluiu este capítulo antes da nova Jornada. Seu progresso e seu XP continuam valendo.
          Para ter evidências do que aprendeu (correções, conversa avaliada e desafio), pratique pela nova sequência.
        </p>
        <div className="fm-jr-complete-actions">
          <button type="button" className="fm-jr-secondary" onClick={onReview}>
            <Target className="h-4 w-4" aria-hidden="true" /> Praticar com a nova Jornada
          </button>
        </div>
        <NextObjective nextChapter={nextChapter} onNext={onNext} />
      </section>
    );
  }

  const graded = activities.filter((activity) => activity.record?.total);
  const correctFirstTry = graded.reduce((sum, activity) => sum + (activity.record.score || 0), 0);
  const totalQuestions = graded.reduce((sum, activity) => sum + (activity.record.total || 0), 0);
  const conversation = activities.find((activity) => activity.id === "conversation")?.record;
  const challenge = activities.find((activity) => activity.id === "challenge")?.record;
  const evidence = conversation?.evidence || [];
  const criteria = challenge?.criteria || [];

  return (
    <section className="fm-jr-complete" aria-labelledby="chapter-complete-title">
      <div className="fm-jr-complete-burst" aria-hidden="true" />
      <div className="fm-jr-complete-seal" aria-hidden="true"><Trophy className="h-8 w-8" /></div>
      <p className="fm-jr-eyebrow">Capítulo {chapter.order} concluído</p>
      <h2 id="chapter-complete-title" className="fm-jr-complete-title">{chapter.title}: missão cumprida</h2>
      <p className="fm-jr-complete-lead">Você demonstrou: {(getCurriculum(chapter.id)?.goal || chapter.objective).replace(/.$/, "").toLowerCase()}.</p>

      <div className="fm-jr-complete-grid">
        <article className="fm-jr-proof">
          <Award className="h-5 w-5" aria-hidden="true" />
          <p className="fm-jr-proof-label">Desafio final</p>
          <p className="fm-jr-proof-value">{challenge ? STATUS_LABELS[challenge.status] : "—"}</p>
          {criteria.length ? (
            <p className="fm-jr-proof-detail">{criteria.filter((item) => item.status === "met").length} de {criteria.length} critérios atendidos</p>
          ) : null}
        </article>
        <article className="fm-jr-proof">
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          <p className="fm-jr-proof-label">Conversa com o Neo</p>
          <p className="fm-jr-proof-value">{conversation ? STATUS_LABELS[conversation.status] : "—"}</p>
          {evidence.length ? (
            <ul className="fm-jr-proof-list">
              {evidence.map((item) => (
                <li key={item.expression}><span lang="en">{item.expression}</span> · {EVIDENCE_LABEL[item.status] || item.status}</li>
              ))}
            </ul>
          ) : null}
        </article>
        <article className="fm-jr-proof">
          <Target className="h-5 w-5" aria-hidden="true" />
          <p className="fm-jr-proof-label">Exercícios corrigidos</p>
          <p className="fm-jr-proof-value">{totalQuestions ? `${correctFirstTry}/${totalQuestions}` : "—"}</p>
          <p className="fm-jr-proof-detail">acertos na primeira tentativa</p>
        </article>
      </div>

      <p className="fm-jr-secondary-info">+{chapter.xp} XP de prática · o XP mede prática, não o seu nível de inglês</p>

      <div className="fm-jr-complete-actions">
        <button type="button" className="fm-jr-ghost" onClick={onReview}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Rever este capítulo
        </button>
      </div>
      <NextObjective nextChapter={nextChapter} onNext={onNext} />
    </section>
  );
}
