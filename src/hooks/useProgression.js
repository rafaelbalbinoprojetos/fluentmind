import { useEffect, useState } from "react";
import {
  getProgressionState,
  PROGRESSION_EVENT,
  resetDailyMissionsIfNewDay,
} from "../services/progressionEngine.js";

export default function useProgression() {
  const [progression, setProgression] = useState(() => resetDailyMissionsIfNewDay(getProgressionState()));

  useEffect(() => {
    const sync = (event) => {
      setProgression(event?.detail ?? getProgressionState());
    };

    window.addEventListener(PROGRESSION_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PROGRESSION_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return progression;
}
