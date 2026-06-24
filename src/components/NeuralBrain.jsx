import React, { memo, useMemo, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

const SIZE_MAP = {
  sm: 80,
  md: 140,
  lg: 240,
  xl: 360,
};

const MOOD_SPEED = {
  idle: 1,
  thinking: 0.72,
  learning: 0.86,
  celebrating: 0.58,
  focused: 1.12,
  sleeping: 1.85,
};

function getEvolutionTier(level = 1) {
  if (level >= 100) return "galaxy";
  if (level >= 50) return "advanced";
  if (level >= 20) return "dense";
  if (level >= 10) return "connected";
  if (level >= 5) return "forming";
  return "seed";
}

function getDetailCounts(level, mode, nodes) {
  const tier = getEvolutionTier(level);
  const base = {
    seed: { nodes: 8, links: 7, particles: 5 },
    forming: { nodes: 12, links: 12, particles: 8 },
    connected: { nodes: 18, links: 20, particles: 11 },
    dense: { nodes: 26, links: 32, particles: 15 },
    advanced: { nodes: 34, links: 44, particles: 18 },
    galaxy: { nodes: 42, links: 58, particles: 22 },
  }[tier];

  const modeScale = mode === "compact" ? 0.48 : mode === "avatar" ? 0.36 : mode === "universe" ? 1.15 : 1;
  return {
    nodeCount: Math.max(5, Math.min(44, Math.round(Math.min(base.nodes + nodes / 22, 44) * modeScale))),
    linkCount: Math.max(5, Math.min(60, Math.round(base.links * modeScale))),
    particleCount: Math.max(3, Math.min(24, Math.round(base.particles * modeScale))),
  };
}

function createNeuralMap({ level, nodes, connections, mastery, mode }) {
  const { nodeCount, linkCount, particleCount } = getDetailCounts(level, mode, nodes);
  const points = Array.from({ length: nodeCount }, (_, index) => {
    const ring = index % 3;
    const angle = (index / nodeCount) * Math.PI * 2 + ring * 0.42;
    const radius = 28 + ring * 20 + ((index * 11) % 18) + Math.min(18, mastery / 7);
    const wobbleX = Math.sin(index * 1.9) * 7;
    const wobbleY = Math.cos(index * 1.43) * 9;
    const importance = ((index * 17) % 100) / 100;
    return {
      id: `node-${index}`,
      x: 100 + Math.cos(angle) * radius + wobbleX,
      y: 100 + Math.sin(angle) * radius * 0.76 + wobbleY,
      r: 1.9 + importance * 2.7,
      importance,
    };
  });

  const lines = Array.from({ length: linkCount }, (_, index) => {
    const source = points[index % points.length];
    const target = points[(index * 5 + 7) % points.length];
    const strength = 0.34 + (((index * 13) % 70) / 100) + Math.min(0.2, connections / 9000);
    return {
      id: `link-${index}`,
      source,
      target,
      strength: Math.min(1, strength),
      delay: `${(index % 8) * 0.34}s`,
    };
  }).filter((line) => line.source.id !== line.target.id);

  const particles = Array.from({ length: particleCount }, (_, index) => lines[index % Math.max(1, lines.length)]).filter(Boolean);
  return { points, lines, particles };
}

function NeuralBrain({
  level = 1,
  xp = 0,
  nextLevelXp = 100,
  nodes = 8,
  connections = 12,
  mastery = 20,
  size = "lg",
  theme = "auto",
  mode = "hero",
  animated = true,
  interactive = false,
  mood = "idle",
  showStats = false,
  className = "",
  onClick,
  onXpGain,
  onLevelUp,
  onExpressionSaved,
  onMissionCompleted,
  onReviewCompleted,
}) {
  const reducedMotion = useReducedMotion();
  const [pulseKey, setPulseKey] = useState(0);
  const tier = getEvolutionTier(level);
  const pixelSize = SIZE_MAP[size] || SIZE_MAP.lg;
  const speed = MOOD_SPEED[mood] || 1;
  const map = useMemo(
    () => createNeuralMap({ level, nodes, connections, mastery, mode }),
    [connections, level, mastery, mode, nodes],
  );
  const xpPercent = Math.min(100, Math.round((xp / Math.max(1, nextLevelXp)) * 100));
  const shouldAnimate = animated && !reducedMotion;

  const handleClick = () => {
    setPulseKey((current) => current + 1);
    onClick?.();
    onXpGain?.(xp);
    if (xpPercent >= 100) onLevelUp?.(level + 1);
    if (mood === "learning") onExpressionSaved?.();
    if (mood === "celebrating") onMissionCompleted?.();
    if (mood === "focused") onReviewCompleted?.();
  };

  return (
    <motion.div
      className={[
        "neural-brain",
        `neural-brain-${size}`,
        `neural-brain-${mode}`,
        `neural-brain-${tier}`,
        `neural-brain-${mood}`,
        shouldAnimate ? "is-animated" : "is-static",
        interactive ? "is-interactive" : "",
        className,
      ].join(" ")}
      style={{
        "--neural-brain-size": `${pixelSize}px`,
        "--neural-brain-speed": speed,
      }}
      data-theme={theme}
      role={interactive ? "button" : "img"}
      tabIndex={interactive ? 0 : undefined}
      aria-label={`Neural brain level ${level}, ${nodes} nodes, ${connections} connections, ${mastery}% mastery`}
      onClick={interactive ? handleClick : undefined}
      onKeyDown={(event) => {
        if (!interactive || (event.key !== "Enter" && event.key !== " ")) return;
        event.preventDefault();
        handleClick();
      }}
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.55, ease: "easeOut" }}
    >
      <span className="neural-brain-field" />
      <span className="neural-brain-orbital orbital-one" />
      <span className="neural-brain-orbital orbital-two" />
      <span className="neural-brain-orbital orbital-three" />

      <svg className="neural-brain-svg" viewBox="0 0 200 200" aria-hidden="true">
        <defs>
          <radialGradient id="neuralBrainCore" cx="50%" cy="45%" r="58%">
            <stop offset="0%" stopColor="rgb(255 255 255)" stopOpacity="0.95" />
            <stop offset="35%" stopColor="rgb(103 232 249)" stopOpacity="0.82" />
            <stop offset="68%" stopColor="rgb(99 102 241)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="rgb(168 85 247)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="neuralBrainLine" x1="0%" x2="100%" y1="0%" y2="100%">
            <stop offset="0%" stopColor="rgb(34 211 238)" stopOpacity="0.14" />
            <stop offset="52%" stopColor="rgb(216 180 254)" stopOpacity="0.76" />
            <stop offset="100%" stopColor="rgb(99 102 241)" stopOpacity="0.16" />
          </linearGradient>
          <filter id="neuralBrainGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="neural-brain-waves">
          <circle cx="100" cy="100" r="26" />
          <circle cx="100" cy="100" r="48" />
          <circle cx="100" cy="100" r="72" />
        </g>

        <g className="neural-brain-lines">
          {map.lines.map((line) => {
            const midX = (line.source.x + line.target.x) / 2 + Math.sin(line.strength * 8) * 12;
            const midY = (line.source.y + line.target.y) / 2 + Math.cos(line.strength * 8) * 10;
            return (
              <path
                key={line.id}
                d={`M ${line.source.x} ${line.source.y} Q ${midX} ${midY} ${line.target.x} ${line.target.y}`}
                style={{ "--line-strength": line.strength, "--line-delay": line.delay }}
              />
            );
          })}
        </g>

        <g className="neural-brain-impulses">
          {map.particles.map((line, index) => {
            const midX = (line.source.x + line.target.x) / 2 + Math.sin(line.strength * 8) * 12;
            const midY = (line.source.y + line.target.y) / 2 + Math.cos(line.strength * 8) * 10;
            return (
              <circle key={`${line.id}-pulse-${index}`} r="1.8" style={{ "--pulse-delay": `${index * 0.42}s` }}>
                <animateMotion dur={`${4.2 * speed}s`} repeatCount="indefinite" begin={`${index * 0.24}s`} path={`M ${line.source.x} ${line.source.y} Q ${midX} ${midY} ${line.target.x} ${line.target.y}`} />
              </circle>
            );
          })}
        </g>

        <g className="neural-brain-nodes">
          {map.points.map((point) => (
            <circle
              key={point.id}
              cx={point.x}
              cy={point.y}
              r={point.r}
              style={{ "--node-importance": point.importance, "--node-delay": `${point.importance * 2}s` }}
            />
          ))}
        </g>

        <circle className="neural-brain-core" cx="100" cy="100" r="14" />
        <circle key={pulseKey} className="neural-brain-click-pulse" cx="100" cy="100" r="18" />
      </svg>

      {interactive ? (
        <div className="neural-brain-tooltip">
          <strong>Level {level}</strong>
          <span>{xp.toLocaleString("en-US")} XP</span>
          <span>{nodes.toLocaleString("en-US")} nodes</span>
          <span>{connections.toLocaleString("en-US")} connections</span>
          <span>{mastery}% mastery</span>
        </div>
      ) : null}

      {showStats ? (
        <div className="neural-brain-stats">
          <strong>Level {level}</strong>
          <span>{xpPercent}% to next level</span>
        </div>
      ) : null}
    </motion.div>
  );
}

export default memo(NeuralBrain);
