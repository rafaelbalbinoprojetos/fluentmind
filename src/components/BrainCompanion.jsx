import React from "react";
import { Brain, Smile } from "lucide-react";

const levelLabels = {
  1: "Level 1",
  10: "Level 10",
  25: "Level 25",
  50: "Level 50",
  100: "Level 100",
};

function getLevelTier(level) {
  if (level >= 100) return 100;
  if (level >= 50) return 50;
  if (level >= 25) return 25;
  if (level >= 10) return 10;
  return 1;
}

function getStreakTier(streakDays) {
  if (streakDays >= 365) return "aura";
  if (streakDays >= 100) return "electric";
  if (streakDays >= 30) return "connected";
  if (streakDays >= 7) return "ring";
  return "base";
}

export default function BrainCompanion({
  state = "idle",
  level = 10,
  streakDays = 7,
  size = "md",
  showLabel = false,
  message,
  className = "",
}) {
  const levelTier = getLevelTier(level);
  const streakTier = getStreakTier(streakDays);
  const particleCount = levelTier >= 100 ? 18 : levelTier >= 50 ? 14 : levelTier >= 25 ? 10 : 7;
  const connectionCount = state === "review-complete" || levelTier >= 25 ? 7 : levelTier >= 10 ? 4 : 2;

  return (
    <div className={`fm-brain-companion fm-brain-${size} fm-brain-state-${state} fm-brain-tier-${levelTier} fm-streak-${streakTier} ${className}`}>
      <div className="fm-brain-companion-stage">
        <span className="fm-brain-aura" />
        <span className="fm-brain-ring fm-brain-ring-one" />
        <span className="fm-brain-ring fm-brain-ring-two" />
        <span className="fm-brain-ring fm-brain-ring-three" />

        {Array.from({ length: connectionCount }).map((_, index) => (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={`connection-${index}`}
            className="fm-brain-connection"
            style={{ "--connection-index": index, "--connection-rotate": `${index * 28 + 12}deg` }}
          />
        ))}

        {Array.from({ length: particleCount }).map((_, index) => (
          <span
            // eslint-disable-next-line react/no-array-index-key
            key={`particle-${index}`}
            className="fm-brain-orbit-particle"
            style={{ "--particle-index": index, "--particle-delay": `${index * 0.18}s` }}
          />
        ))}

        <Brain className="fm-brain-main-icon" strokeWidth={1.35} />
        {state === "goal-complete" ? <Smile className="fm-brain-smile" strokeWidth={1.8} /> : null}
        {state === "sleeping" ? <span className="fm-brain-sleep">zZ</span> : null}
      </div>

      {showLabel || message ? (
        <div className="mt-3 text-center">
          {showLabel ? <p className="fm-secondary text-xs font-semibold">{levelLabels[levelTier]}</p> : null}
          {message ? <p className="fm-muted mt-1 text-xs">{message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
