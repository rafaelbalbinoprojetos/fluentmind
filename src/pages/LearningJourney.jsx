import { useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Lock } from "lucide-react";
import { MotionConfig } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import useLearningActions from "../hooks/useLearningActions.js";
import useJourneyProgress from "../hooks/useJourneyProgress.js";
import { learningJourneyChapters } from "../data/learningJourney.js";
import {
  DIFFICULTY_LABEL,
  JOURNEY_ACTIVITIES,
  getActivity,
  getChapter,
  getChapterActivities,
  getCurriculum,
  getNextActivity,
  isChapterUnlocked,
} from "../services/journeyEngine.js";
import { createChapterMindBlockPayload, saveExpressionsToReview } from "../services/journeyMindBlocks.js";
import { ChapterMap, JourneyOverview } from "../components/journey/JourneyOverview.jsx";
import ActivityPlayer from "../components/journey/ActivityPlayer.jsx";
import ChapterComplete from "../components/journey/ChapterComplete.jsx";
import "../components/journey/journey.css";

function resumeActivity(progress, chapterId) {
  const last = progress.chapterProgress?.[chapterId]?.lastActivityId;
  if (getActivity(last)) return last;
  return getNextActivity(progress, chapterId)?.id || JOURNEY_ACTIVITIES[0].id;
}

export default function LearningJourneyPage() {
  const { user, session } = useAuth();
  const { recordLearningEvent, trackProgressionAction } = useLearningActions();
  const { progress, recordActivity, setFlag, rememberActivity, completeChapter, totalXp } = useJourneyProgress();
  const [params, setParams] = useSearchParams();

  const [chapterId, setChapterId] = useState(() => {
    const requested = params.get("chapter");
    return requested && getChapter(requested) && isChapterUnlocked(progress, requested) ? requested : progress.activeChapterId || learningJourneyChapters[0].id;
  });
  const [activityId, setActivityId] = useState(() => {
    const requested = params.get("activity");
    return getActivity(requested) ? requested : resumeActivity(progress, chapterId);
  });
  const completed = useMemo(() => new Set(progress.completedChapterIds || []), [progress.completedChapterIds]);
  const [view, setView] = useState(() => (completed.has(chapterId) && !params.get("activity") ? "complete" : "player"));

  const chapter = getChapter(chapterId) || learningJourneyChapters[0];
  const curriculum = getCurriculum(chapter.id);
  const unlocked = isChapterUnlocked(progress, chapter.id);
  const activities = getChapterActivities(progress, chapter.id);
  const nextActivity = activities.find((item) => !item.done) || null;
  const nextChapter = learningJourneyChapters[learningJourneyChapters.indexOf(chapter) + 1] || null;

  const syncUrl = (nextChapterId, nextActivityId) => {
    setParams({ chapter: nextChapterId, activity: nextActivityId }, { replace: true });
  };

  const navigate = (nextActivityId) => {
    setActivityId(nextActivityId);
    rememberActivity(chapter.id, nextActivityId);
    syncUrl(chapter.id, nextActivityId);
  };

  const selectChapter = (id) => {
    const resumeId = resumeActivity(progress, id);
    setChapterId(id);
    setActivityId(resumeId);
    setView(completed.has(id) ? "complete" : "player");
    syncUrl(id, resumeId);
  };

  const saveExpressions = async () => {
    if (!user?.id) {
      toast.error("Entre na sua conta para salvar na revisão.");
      return;
    }
    try {
      const payloads = chapter.mindBlocks.map((block) => createChapterMindBlockPayload(chapter, block));
      const { created, skipped } = await saveExpressionsToReview(user.id, payloads);
      created.forEach((item) => recordLearningEvent("expression_saved", {
        expressionId: item.id,
        expression: item.expression,
        translation: item.translation,
        category: item.category,
        mastery: item.mastery,
      }, "learning_journey"));
      setFlag(chapter.id, "mindblocks");
      if (created.length) trackProgressionAction("saveMindBlock", { reason: "Learning Journey MindBlocks", category: chapter.title });
      toast.success(created.length
        ? `${created.length} ${created.length === 1 ? "expressão adicionada" : "expressões adicionadas"} à revisão${skipped ? ` (${skipped} já estavam lá)` : ""}.`
        : "Todas estas expressões já estavam na sua revisão.");
    } catch (error) {
      console.error("[journey] Falha ao salvar expressões:", error);
      toast.error("Não foi possível salvar agora. Tente de novo.");
    }
  };

  const saveSentence = async (sentence, translation) => {
    if (!user?.id) {
      toast.error("Entre na sua conta para salvar na revisão.");
      return false;
    }
    try {
      const { created } = await saveExpressionsToReview(user.id, [{
        ...createChapterMindBlockPayload(chapter, [sentence, translation]),
        category: `Journey: ${chapter.title} · minhas frases`,
        notes: `Frase pessoal escrita na Jornada, capítulo ${chapter.order}.`,
      }]);
      toast.success(created.length ? "Frase salva na sua revisão." : "Essa frase já estava na sua revisão.");
      return true;
    } catch (error) {
      console.error("[journey] Falha ao salvar frase:", error);
      toast.error("Não foi possível salvar agora. Tente de novo.");
      return false;
    }
  };

  const finishChapter = () => {
    const result = completeChapter(chapter);
    if (result.ok) {
      setView("complete");
      toast.success(result.nextChapter ? `Capítulo ${result.nextChapter.order} liberado.` : "Jornada concluída!");
    } else if (result.reason === "incomplete") {
      toast.error("Ainda faltam atividades neste capítulo.");
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="fm-jr">
        <ChapterMap
          chapters={learningJourneyChapters}
          selectedId={chapter.id}
          activeId={progress.activeChapterId}
          completed={completed}
          isUnlocked={(id) => isChapterUnlocked(progress, id)}
          onSelect={selectChapter}
        />

        <JourneyOverview
          chapter={chapter}
          goal={curriculum?.goal || chapter.objective}
          difficultyLabel={DIFFICULTY_LABEL[chapter.difficulty] || chapter.difficulty}
          chaptersDone={completed.size}
          totalChapters={learningJourneyChapters.length}
          activitiesDone={activities.filter((item) => item.done).length}
          totalActivities={activities.length}
          totalXp={totalXp}
          nextAction={unlocked && nextActivity ? nextActivity.title : null}
          onNextAction={() => { setView("player"); if (nextActivity) navigate(nextActivity.id); }}
          isCompleted={completed.has(chapter.id) && !nextActivity}
        />

        {!unlocked ? (
          <section className="fm-jr-card fm-jr-locked" role="status">
            <Lock className="h-6 w-6" aria-hidden="true" />
            <h2 className="fm-jr-card-title">Capítulo bloqueado</h2>
            <p className="fm-muted">Conclua o capítulo atual para liberar “{chapter.title}”.</p>
          </section>
        ) : view === "complete" ? (
          <ChapterComplete
            chapter={chapter}
            nextChapter={nextChapter}
            progress={progress}
            onReview={() => { setView("player"); navigate(JOURNEY_ACTIVITIES[0].id); }}
            onNext={() => nextChapter && selectChapter(nextChapter.id)}
          />
        ) : (
          <ActivityPlayer
            chapter={chapter}
            curriculum={curriculum}
            progress={progress}
            activityId={activityId}
            onNavigate={navigate}
            recordActivity={recordActivity}
            onSaveExpressions={saveExpressions}
            onSaveSentence={saveSentence}
            onCompleteChapter={finishChapter}
            accessToken={session?.access_token}
            isCompleted={completed.has(chapter.id)}
          />
        )}
      </div>
    </MotionConfig>
  );
}
