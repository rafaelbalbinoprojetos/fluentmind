import { useMemo } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { recordLearningEvent } from "../services/learningEventEngine.js";
import { addXp, trackProgressionAction } from "../services/progressionEngine.js";

// Async handlers keep the identity that started them, even after their page unmounts.
export default function useLearningActions() {
  const { user } = useAuth();
  const userId = user?.id || null;
  return useMemo(() => ({
    recordLearningEvent: (type, payload, source) => recordLearningEvent(type, payload, source, userId),
    trackProgressionAction: (action, meta) => trackProgressionAction(action, { ...meta, userId }),
    addXp: (amount, reason, options) => addXp(amount, reason, { ...options, userId }),
  }), [userId]);
}
