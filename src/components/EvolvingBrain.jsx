import React from "react";
import { Brain } from "lucide-react";

export default function EvolvingBrain({
  level = 1,
  xp = 0,
  stage = 1,
  size = "md",
  animated = true,
  mood = "idle",
  showLabel = true,
}) {
  const normalizedStage = Number(stage) || 1;
  const particles = normalizedStage >= 10 ? [0, 1, 2, 3] : [];
  const connections = normalizedStage >= 20 ? [0, 1, 2] : [];

  return (
    <div className={`evolving-brain evolving-brain-${size} is-stage-${normalizedStage} is-${mood} ${animated ? "is-animated" : ""}`}>
      <div className="evolving-brain-core" aria-hidden="true">
        {normalizedStage >= 30 ? <span className="evolving-brain-halo" /> : null}
        {normalizedStage >= 50 ? <span className="evolving-brain-aura" /> : null}
        {normalizedStage >= 75 ? <span className="evolving-brain-energy" /> : null}
        {normalizedStage >= 100 ? <span className="evolving-brain-galaxy" /> : null}
        {connections.map((item) => <span key={item} className={`evolving-brain-line line-${item}`} />)}
        {particles.map((item) => <span key={item} className={`evolving-brain-particle particle-${item}`} />)}
        <Brain className="evolving-brain-icon" />
      </div>
      {showLabel ? (
        <div className="evolving-brain-label">
          <strong>Level {level}</strong>
          <span>{xp.toLocaleString("en-US")} XP</span>
        </div>
      ) : null}
    </div>
  );
}
