import React from "react";
import toast from "react-hot-toast";
import { ACHIEVEMENTS } from "../data/achievementsMock.js";
import { recordLearningEvent } from "./learningEventEngine.js";
import { supabase, supabaseConfigured } from "../lib/supabase.js";

export const PROGRESSION_STATE_KEY = "fluentmind_progression_state";
export const ACHIEVEMENTS_KEY = "fluentmind_achievements";
export const DAILY_MISSIONS_KEY = "fluentmind_daily_missions";
export const PROGRESSION_EVENT = "fluentmind:progression-updated";

const PROGRESSION_TABLE = "user_progression_state";

let activeProgressionUserId = null;

const LEVEL_TITLES = [
  { level: 1, name: "New Thinker" },
  { level: 5, name: "Daily Learner" },
  { level: 10, name: "Conversation Builder" },
  { level: 20, name: "Fluency Explorer" },
  { level: 30, name: "Mind Architect" },
  { level: 50, name: "Neural Builder" },
  { level: 75, name: "Thought Shaper" },
  { level: 100, name: "Neural Master" },
];

const XP_BY_ACTION = {
  neoMessage: 1,
  saveMindBlock: 5,
  saveCorrection: 3,
  generateAudio: 2,
  practicePronunciation: 5,
  completeReviewCard: 10,
  completeReviewSession: 25,
  completeDailyMission: 15,
  completeAllDailyMissions: 50,
  conversationCompleted: 15,
  openNeuralUniverse: 2,
  addFavorite: 2,
  markMastered: 20,
};

const DAILY_MISSION_TEMPLATES = [
  {
    id: "save-3-expressions",
    title: "Save 3 expressions",
    description: "Create new MindBlocks from useful phrases.",
    target: 3,
    xpReward: 15,
    type: "saveMindBlock",
  },
  {
    id: "practice-with-neo",
    title: "Practice with Neo",
    description: "Send 5 messages or practice prompts.",
    target: 5,
    xpReward: 15,
    type: "neoMessage",
  },
  {
    id: "complete-1-review",
    title: "Complete 1 review",
    description: "Finish at least one review card.",
    target: 1,
    xpReward: 15,
    type: "completeReviewCard",
  },
  {
    id: "save-1-correction",
    title: "Save 1 correction",
    description: "Turn one mistake into a stronger pathway.",
    target: 1,
    xpReward: 15,
    type: "saveCorrection",
  },
  {
    id: "open-neural-universe",
    title: "Open Neural Universe",
    description: "Visit your mental map once today.",
    target: 1,
    xpReward: 15,
    type: "openNeuralUniverse",
  },
  {
    id: "listen-3-expressions",
    title: "Listen to 3 expressions",
    description: "Strengthen pronunciation and rhythm.",
    target: 3,
    xpReward: 15,
    type: "generateAudio",
  },
  {
    id: "master-1-expression",
    title: "Master 1 expression",
    description: "Mark one MindBlock as mastered.",
    target: 1,
    xpReward: 15,
    type: "markMastered",
  },
];

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getLevelName(level) {
  return [...LEVEL_TITLES].reverse().find((item) => level >= item.level)?.name || "New Thinker";
}

export function getXpToNextLevel(level) {
  return 100 + level * 25;
}

export function getBrainStage(level) {
  if (level >= 100) return 100;
  if (level >= 75) return 75;
  if (level >= 50) return 50;
  if (level >= 30) return 30;
  if (level >= 20) return 20;
  if (level >= 10) return 10;
  if (level >= 5) return 5;
  return 1;
}

function createDailyMissions(dateKey = todayKey()) {
  return DAILY_MISSION_TEMPLATES.map((mission) => ({
    ...mission,
    progress: 0,
    completed: false,
    completedAt: null,
    date: dateKey,
  }));
}

function defaultState() {
  const currentLevel = 1;
  return {
    totalXp: 0,
    currentLevel,
    currentLevelName: getLevelName(currentLevel),
    xpInCurrentLevel: 0,
    xpToNextLevel: getXpToNextLevel(currentLevel),
    streak: 0,
    achievementsUnlocked: [],
    dailyMissions: createDailyMissions(),
    brainEvolutionStage: getBrainStage(currentLevel),
    lastActivityAt: null,
    lastActivityDate: null,
    lastNeuralUniverseOpenDate: null,
    allDailyRewardDate: null,
    stats: {
      mindBlocksSaved: 0,
      correctionsSaved: 0,
      neoMessagesSent: 0,
      audioGenerated: 0,
      pronunciationPractices: 0,
      reviewCardsCompleted: 0,
      reviewSessionsCompleted: 0,
      conversationsCompleted: 0,
      favoritesAdded: 0,
      masteredMarked: 0,
      workExpressionsSaved: 0,
      programmingExpressionsSaved: 0,
      allDailyMissionsCompleted: 0,
    },
  };
}

function normalizeState(state) {
  const base = defaultState();
  const next = {
    ...base,
    ...state,
    stats: { ...base.stats, ...(state?.stats || {}) },
  };
  next.dailyMissions = Array.isArray(next.dailyMissions) && next.dailyMissions.length
    ? next.dailyMissions.map((mission) => ({ ...mission }))
    : createDailyMissions();
  next.achievementsUnlocked = Array.isArray(next.achievementsUnlocked) ? next.achievementsUnlocked : [];
  next.currentLevelName = getLevelName(next.currentLevel);
  next.xpToNextLevel = getXpToNextLevel(next.currentLevel);
  next.brainEvolutionStage = getBrainStage(next.currentLevel);
  return next;
}

function saveState(state) {
  if (!canUseStorage()) return state;
  window.localStorage.setItem(PROGRESSION_STATE_KEY, JSON.stringify(state));
  window.localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(state.achievementsUnlocked));
  window.localStorage.setItem(DAILY_MISSIONS_KEY, JSON.stringify(state.dailyMissions));
  window.dispatchEvent(new CustomEvent(PROGRESSION_EVENT, { detail: state }));
  persistProgressionState(state);
  return state;
}

export function getProgressionState() {
  if (!canUseStorage()) return defaultState();
  return normalizeState(safeParse(window.localStorage.getItem(PROGRESSION_STATE_KEY), defaultState()));
}

function toProgressionRow(state, userId = activeProgressionUserId) {
  if (!userId) return null;
  return {
    user_id: userId,
    state,
    total_xp: Number(state.totalXp) || 0,
    current_level: Number(state.currentLevel) || 1,
    streak: Number(state.streak) || 0,
    last_activity_at: state.lastActivityAt || null,
    updated_at: new Date().toISOString(),
  };
}

async function persistProgressionState(state) {
  if (!activeProgressionUserId || !supabaseConfigured || !supabase) return;
  const row = toProgressionRow(state);
  if (!row) return;
  const { error } = await supabase
    .from(PROGRESSION_TABLE)
    .upsert(row, { onConflict: "user_id" });
  if (error) {
    console.warn("[progression] Supabase persistence skipped:", error.message);
  }
}

export function configureProgressionPersistence(userId) {
  activeProgressionUserId = userId || null;
}

export async function hydrateProgressionState(userId = activeProgressionUserId) {
  configureProgressionPersistence(userId);
  const localState = getProgressionState();
  if (!userId || !supabaseConfigured || !supabase) return localState;

  const { data, error } = await supabase
    .from(PROGRESSION_TABLE)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.warn("[progression] Hydration skipped:", error.message);
    persistProgressionState(localState);
    return localState;
  }

  if (!data?.state) {
    await persistProgressionState(localState);
    return localState;
  }

  const remoteState = normalizeState(data.state);
  const localTime = localState.lastActivityAt ? new Date(localState.lastActivityAt).getTime() : 0;
  const remoteTime = data.updated_at ? new Date(data.updated_at).getTime() : 0;
  const shouldKeepLocal = (localState.totalXp || 0) > (remoteState.totalXp || 0)
    && localTime >= remoteTime;
  const selectedState = shouldKeepLocal ? localState : remoteState;
  saveState(selectedState);
  if (shouldKeepLocal) persistProgressionState(selectedState);
  return selectedState;
}

function showProgressToast(title, subtitle) {
  toast.custom(
    (t) => React.createElement(
      "div",
      { className: `progression-toast ${t.visible ? "is-visible" : ""}` },
      React.createElement("strong", null, title),
      React.createElement("span", null, subtitle),
    ),
    { duration: 3200 },
  );
}

function updateStreak(state, dateKey) {
  if (state.lastActivityDate === dateKey) return state;

  const yesterday = new Date(`${dateKey}T00:00:00.000Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayKey = todayKey(yesterday);

  state.streak = state.lastActivityDate === yesterdayKey ? state.streak + 1 : 1;
  state.lastActivityDate = dateKey;
  return state;
}

export function resetDailyMissionsIfNewDay(state = getProgressionState()) {
  const dateKey = todayKey();
  const hasTodayMissions = state.dailyMissions?.every((mission) => mission.date === dateKey);
  if (hasTodayMissions) return state;
  return saveState({
    ...state,
    dailyMissions: createDailyMissions(dateKey),
    allDailyRewardDate: null,
  });
}

function checkLevelUp(state) {
  const levelUps = [];
  while (state.xpInCurrentLevel >= getXpToNextLevel(state.currentLevel)) {
    state.xpInCurrentLevel -= getXpToNextLevel(state.currentLevel);
    state.currentLevel += 1;
    state.currentLevelName = getLevelName(state.currentLevel);
    state.xpToNextLevel = getXpToNextLevel(state.currentLevel);
    state.brainEvolutionStage = getBrainStage(state.currentLevel);
    levelUps.push(state.currentLevelName);
  }
  return levelUps;
}

function checkAchievements(state) {
  const unlocked = [];
  const unlockedSet = new Set(state.achievementsUnlocked.map((item) => item.id));

  ACHIEVEMENTS.forEach((achievement) => {
    if (unlockedSet.has(achievement.id)) return;
    if (!achievement.condition(state.stats, state)) return;
    const record = {
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
      icon: achievement.icon,
      xpReward: achievement.xpReward,
      unlockedAt: new Date().toISOString(),
    };
    state.achievementsUnlocked.push(record);
    state.totalXp += achievement.xpReward;
    state.xpInCurrentLevel += achievement.xpReward;
    unlocked.push(record);
  });

  return unlocked;
}

function incrementStats(state, action, meta = {}) {
  if (action === "saveMindBlock") {
    state.stats.mindBlocksSaved += 1;
    const category = String(meta.category || "").toLowerCase();
    if (category.includes("work")) state.stats.workExpressionsSaved += 1;
    if (category.includes("program")) state.stats.programmingExpressionsSaved += 1;
  }
  if (action === "saveCorrection") state.stats.correctionsSaved += 1;
  if (action === "neoMessage") state.stats.neoMessagesSent += 1;
  if (action === "generateAudio") state.stats.audioGenerated += 1;
  if (action === "practicePronunciation") state.stats.pronunciationPractices += 1;
  if (action === "completeReviewCard") state.stats.reviewCardsCompleted += 1;
  if (action === "completeReviewSession") state.stats.reviewSessionsCompleted += 1;
  if (action === "conversationCompleted") state.stats.conversationsCompleted += 1;
  if (action === "addFavorite") state.stats.favoritesAdded += 1;
  if (action === "markMastered") state.stats.masteredMarked += 1;
}

export function updateDailyMission(action, state = getProgressionState()) {
  const next = resetDailyMissionsIfNewDay(state);
  let completedMission = null;

  next.dailyMissions = next.dailyMissions.map((mission) => {
    if (mission.completed || mission.type !== action) return mission;
    const progress = Math.min(mission.target, mission.progress + 1);
    const completed = progress >= mission.target;
    if (completed) completedMission = { ...mission, progress, completed: true };
    return {
      ...mission,
      progress,
      completed,
      completedAt: completed ? new Date().toISOString() : mission.completedAt,
    };
  });

  if (completedMission) {
    next.totalXp += completedMission.xpReward;
    next.xpInCurrentLevel += completedMission.xpReward;
    recordLearningEvent("daily_mission_completed", {
      missionId: completedMission.id,
      title: completedMission.title,
      xpReward: completedMission.xpReward,
      action,
    }, "progression_engine");
    showProgressToast("Daily Mission Complete", `+${completedMission.xpReward} XP · ${completedMission.title}`);
  }

  const allDone = next.dailyMissions.every((mission) => mission.completed);
  const dateKey = todayKey();
  if (allDone && next.allDailyRewardDate !== dateKey) {
    next.allDailyRewardDate = dateKey;
    next.stats.allDailyMissionsCompleted += 1;
    next.totalXp += XP_BY_ACTION.completeAllDailyMissions;
    next.xpInCurrentLevel += XP_BY_ACTION.completeAllDailyMissions;
    showProgressToast("Daily Brain Complete", "+50 XP · Your brain is stronger today.");
  }

  return next;
}

export function addXp(amount, reason = "Progress", options = {}) {
  let state = resetDailyMissionsIfNewDay(getProgressionState());
  const dateKey = todayKey();
  state = updateStreak(state, dateKey);
  state.totalXp += amount;
  state.xpInCurrentLevel += amount;
  state.lastActivityAt = new Date().toISOString();

  const levelUps = checkLevelUp(state);
  const achievements = checkAchievements(state);
  levelUps.push(...checkLevelUp(state));
  saveState(state);

  if (!options.silent) {
    showProgressToast(`+${amount} XP`, reason);
  }
  levelUps.forEach((levelName) => showProgressToast("Level Up!", `Your brain unlocked ${levelName}.`));
  achievements.forEach((achievement) => {
    showProgressToast("Achievement unlocked", `${achievement.title} · +${achievement.xpReward} XP`);
  });

  return { state, levelUps, achievements };
}

export function trackProgressionAction(action, meta = {}) {
  let state = resetDailyMissionsIfNewDay(getProgressionState());
  const dateKey = todayKey();

  if (action === "openNeuralUniverse" && state.lastNeuralUniverseOpenDate === dateKey) {
    return { state, levelUps: [], achievements: [] };
  }
  if (action === "openNeuralUniverse") {
    state.lastNeuralUniverseOpenDate = dateKey;
  }

  if (action === "practicePronunciation") {
    recordLearningEvent("practice_completed", {
      category: meta.category,
      reason: meta.reason,
    }, meta.source || "progression_engine");
  }
  if (action === "generateAudio") {
    recordLearningEvent("audio_generated_mock", {
      category: meta.category,
      reason: meta.reason,
    }, meta.source || "progression_engine");
  }

  incrementStats(state, action, meta);
  state = updateDailyMission(action, state);
  saveState(state);

  const amount = XP_BY_ACTION[action] ?? 0;
  if (amount <= 0) return { state, levelUps: [], achievements: [] };

  return addXp(amount, meta.reason || action, { silent: meta.silent });
}

export function getRecentAchievements(limit = 4) {
  return [...getProgressionState().achievementsUnlocked]
    .sort((a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime())
    .slice(0, limit);
}

export function resetProgression() {
  const state = defaultState();
  return saveState(state);
}
