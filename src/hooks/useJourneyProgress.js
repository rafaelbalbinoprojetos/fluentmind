import { useCallback, useEffect, useState } from "react";
import useLearningActions from "./useLearningActions.js";
import useProgression from "./useProgression.js";
import { learningJourneyChapters } from "../data/learningJourney.js";
import { getProgressionState, updateProgressionState } from "../services/progressionEngine.js";
import {
  ACTIVITY_XP,
  applyActivityResult,
  canCompleteChapter,
  earnsActivityXp,
  getActivityRecord,
  normalizeProgress,
} from "../services/journeyEngine.js";

function loadJourneyProgress() {
  return normalizeProgress(getProgressionState()?.learningJourney);
}

function saveJourneyProgress(progress) {
  updateProgressionState((state) => ({ ...state, learningJourney: progress }));
  return progress;
}

// Fonte única: cada alteração parte do estado salvo e grava na hora. Assim outras gravações
// (XP, eventos, missão do Neo) não carregam uma Jornada antiga nem desfazem a marcação recém-feita.
export default function useJourneyProgress() {
  const { recordLearningEvent, addXp } = useLearningActions();
  const progression = useProgression();
  const [progress, setProgress] = useState(loadJourneyProgress);

  const update = useCallback((updater) => {
    const next = updater(loadJourneyProgress());
    saveJourneyProgress(next);
    setProgress(next);
    return next;
  }, []);

  // Só adota progresso vindo de fora (outra aba, Supabase, Neo) quando for mais novo.
  useEffect(() => {
    const remote = progression.learningJourney;
    if (!remote?.lastUpdatedAt) return;
    setProgress((current) => {
      if (current.lastUpdatedAt && new Date(remote.lastUpdatedAt) <= new Date(current.lastUpdatedAt)) return current;
      return normalizeProgress(remote);
    });
  }, [progression.learningJourney]);

  const recordActivity = useCallback((chapter, activityId, result) => {
    const before = getActivityRecord(loadJourneyProgress(), chapter.id, activityId);
    const next = update((current) => applyActivityResult(current, chapter.id, activityId, result));
    const after = getActivityRecord(next, chapter.id, activityId);
    if (earnsActivityXp(before, after, activityId)) {
      addXp(ACTIVITY_XP, `Atividade concluída: ${chapter.title}`, { silent: true });
      recordLearningEvent("learning_journey_step_completed", {
        chapterId: chapter.id,
        title: chapter.title,
        stepId: activityId,
        status: after.status,
        score: after.score ?? null,
        total: after.total ?? null,
        xp: ACTIVITY_XP,
      }, "learning_journey");
    }
    return after;
  }, [addXp, recordLearningEvent, update]);

  const setFlag = useCallback((chapterId, flag) => {
    update((current) => ({
      ...current,
      chapterProgress: {
        ...current.chapterProgress,
        [chapterId]: { ...(current.chapterProgress?.[chapterId] || {}), [flag]: true },
      },
      lastUpdatedAt: new Date().toISOString(),
    }));
  }, [update]);

  // Lembra onde o aluno parou (sem mudar status de nada).
  const rememberActivity = useCallback((chapterId, activityId) => {
    const current = loadJourneyProgress();
    if (current.chapterProgress?.[chapterId]?.lastActivityId === activityId) return;
    update((state) => ({
      ...state,
      chapterProgress: {
        ...state.chapterProgress,
        [chapterId]: { ...(state.chapterProgress?.[chapterId] || {}), lastActivityId: activityId },
      },
    }));
  }, [update]);

  /** Conclui o capítulo uma única vez, só com todas as atividades feitas. Devolve o próximo capítulo ou null. */
  const completeChapter = useCallback((chapter) => {
    const current = loadJourneyProgress();
    if ((current.completedChapterIds || []).includes(chapter.id)) return { ok: false, reason: "already" };
    if (!canCompleteChapter(current, chapter.id)) return { ok: false, reason: "incomplete" };
    const index = learningJourneyChapters.findIndex((item) => item.id === chapter.id);
    const nextChapter = learningJourneyChapters[index + 1] || null;
    update((state) => ({
      ...state,
      completedChapterIds: [...new Set([...(state.completedChapterIds || []), chapter.id])],
      activeChapterId: nextChapter?.id || chapter.id,
      lastUpdatedAt: new Date().toISOString(),
    }));
    addXp(chapter.xp, `Capítulo concluído: ${chapter.title}`);
    recordLearningEvent("learning_chapter_completed", {
      chapterId: chapter.id,
      title: chapter.title,
      xp: chapter.xp,
      mindBlocks: chapter.mindBlocks.length,
      nextChapterId: nextChapter?.id || null,
    }, "learning_journey");
    return { ok: true, nextChapter };
  }, [addXp, recordLearningEvent, update]);

  return { progress, recordActivity, setFlag, rememberActivity, completeChapter, totalXp: progression.totalXp };
}
