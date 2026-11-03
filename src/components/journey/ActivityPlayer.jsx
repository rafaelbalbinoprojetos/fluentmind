import { useEffect, useMemo, useRef } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Target, Trophy } from "lucide-react";
import {
  JOURNEY_ACTIVITIES,
  JOURNEY_PHASES,
  buildChoose,
  buildClozeItems,
  buildComprehension,
  buildListening,
  buildRecallItems,
  canCompleteChapter,
  getChapterActivities,
} from "../../services/journeyEngine.js";
import JourneyNav from "./JourneyNav.jsx";
import { activityState } from "./journeyState.js";
import QuizActivity from "./activities/QuizActivity.jsx";
import RecallActivity from "./activities/RecallActivity.jsx";
import ClozeActivity from "./activities/ClozeActivity.jsx";
import {
  ChallengeActivity,
  ConversationActivity,
  DialoguesActivity,
  ExpressionsActivity,
  LessonActivity,
  ProduceActivity,
} from "./activities/ContentActivities.jsx";

// Atividades só de leitura ficam "vistas" quando o aluno avança, não quando a tela abre.
const VIEW_ONLY = new Set(["lesson", "expressions", "dialogues"]);

export default function ActivityPlayer({
  chapter,
  curriculum,
  progress,
  activityId,
  onNavigate,
  recordActivity,
  onSaveExpressions,
  onSaveSentence,
  onCompleteChapter,
  accessToken,
  isCompleted,
}) {
  const titleRef = useRef(null);
  const activities = getChapterActivities(progress, chapter.id);
  const index = Math.max(0, JOURNEY_ACTIVITIES.findIndex((activity) => activity.id === activityId));
  const activity = activities[index];
  const phase = JOURNEY_PHASES.find((item) => item.id === activity.phase);
  const ready = canCompleteChapter(progress, chapter.id);
  const previous = activities[index - 1];
  const next = activities[index + 1];

  const content = useMemo(() => ({
    comprehension: buildComprehension(chapter),
    listening: buildListening(chapter),
    choose: buildChoose(chapter),
    recall: buildRecallItems(chapter),
    cloze: buildClozeItems(chapter),
  }), [chapter]);

  // A cada nova atividade, o foco vai para o título (teclado e leitor de tela acompanham).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    titleRef.current?.focus();
  }, [activityId, chapter.id]);

  const goNext = () => {
    if (VIEW_ONLY.has(activity.id)) recordActivity(chapter, activity.id, { status: "viewed" });
    if (next) onNavigate(next.id);
  };

  const finishWith = (result) => recordActivity(chapter, activity.id, result);
  const chapterSaved = Boolean(progress.chapterProgress?.[chapter.id]?.mindblocks);

  const body = {
    lesson: <LessonActivity chapter={chapter} curriculum={curriculum} />,
    expressions: <ExpressionsActivity chapter={chapter} saved={chapterSaved} onSave={onSaveExpressions} />,
    dialogues: <DialoguesActivity chapter={chapter} />,
    comprehension: <QuizActivity key={`${chapter.id}-c`} questions={content.comprehension} onFinish={finishWith} finished={activity.done} />,
    listening: <QuizActivity key={`${chapter.id}-l`} questions={content.listening} onFinish={finishWith} finished={activity.done} />,
    choose: <QuizActivity key={`${chapter.id}-ch`} questions={content.choose} onFinish={finishWith} finished={activity.done} />,
    recall: <RecallActivity key={chapter.id} items={content.recall} accessToken={accessToken} onFinish={finishWith} />,
    cloze: <ClozeActivity key={chapter.id} items={content.cloze} onFinish={finishWith} />,
    produce: (
      <ProduceActivity
        key={chapter.id}
        chapter={chapter}
        curriculum={curriculum}
        accessToken={accessToken}
        onSaveSentence={onSaveSentence}
        onChecked={(data) => finishWith({ status: data.passed ? "correct" : "attempted", lastVerdict: data.assessment || data.verdict })}
      />
    ),
    conversation: <ConversationActivity chapter={chapter} record={activity.record} />,
    challenge: (
      <ChallengeActivity
        key={chapter.id}
        chapter={chapter}
        curriculum={curriculum}
        accessToken={accessToken}
        record={activity.record}
        onChecked={(data) => finishWith({
          status: data.passed ? "demonstrated" : "attempted",
          lastVerdict: data.assessment || data.verdict,
          criteriaRatio: data.criteriaRatio ?? null,
          criteria: data.criteria || [],
        })}
      />
    ),
  }[activity.id];

  const state = activityState(activity, null);
  const statusText = activity.record
    ? `${state.label}${activity.record.total ? ` · ${activity.record.score}/${activity.record.total}` : ""}`
    : null;

  return (
    <section className="fm-jr-player" aria-labelledby="activity-title">
      <JourneyNav activities={activities} currentId={activity.id} onGo={onNavigate} />

      <article className="fm-jr-card">
        <header className="fm-jr-card-head">
          <div className="min-w-0">
            <p className="fm-jr-eyebrow">{phase.label} · {index + 1} de {activities.length}</p>
            <h2 id="activity-title" ref={titleRef} tabIndex={-1} className="fm-jr-card-title">{activity.title}</h2>
            <p className="fm-jr-card-goal"><Target className="h-4 w-4 shrink-0" aria-hidden="true" /> {activity.criterion}</p>
          </div>
          <div className="fm-jr-card-side">
            {statusText ? <span className={`fm-jr-badge is-${state.key}`}>{statusText}</span> : null}
            <span className="fm-jr-chip">{activity.competence}</span>
          </div>
        </header>
        <div className="fm-jr-card-body">{body}</div>
      </article>

      <div className="fm-jr-nav">
        <button type="button" className="fm-jr-ghost" onClick={() => previous && onNavigate(previous.id)} disabled={!previous}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Anterior
        </button>
        <button type="button" className="fm-jr-ghost fm-jr-nav-review" onClick={() => onNavigate("expressions")}>
          <BookOpen className="h-4 w-4" aria-hidden="true" /> Revisar expressões
        </button>
        {next ? (
          <button type="button" className="fm-cta-primary" onClick={goNext}>
            Continuar: {next.title} <ArrowRight className="fm-cta-arrow h-5 w-5" aria-hidden="true" />
          </button>
        ) : isCompleted ? (
          <span className="fm-jr-badge is-approved"><Trophy className="h-4 w-4" aria-hidden="true" /> Capítulo concluído</span>
        ) : (
          <button type="button" className="fm-cta-primary" onClick={onCompleteChapter} disabled={!ready} aria-describedby={ready ? undefined : "complete-hint"}>
            Concluir capítulo <Trophy className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
      {!next && !isCompleted && !ready ? (
        <p id="complete-hint" className="fm-jr-hint">
          Faltam: {activities.filter((item) => !item.done).map((item) => item.title).join(", ")}.
        </p>
      ) : null}
    </section>
  );
}
