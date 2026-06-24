import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Brain,
  Eye,
  EyeOff,
  Filter,
  Focus,
  Maximize2,
  MessageCircle,
  Pause,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Star,
  Volume2,
  Zap,
} from "lucide-react";
import {
  neuralUniverseConnections,
  neuralUniverseNodes,
  neuralUniverseStats,
} from "../data/neuralUniverseMock.js";
import { trackProgressionAction } from "../services/progressionEngine.js";

const VIEWBOX = { width: 1000, height: 850 };
const FILTERS = [
  { id: "all", label: "All" },
  { id: "expression", label: "Expressions" },
  { id: "mistake", label: "Mistakes" },
  { id: "mastered", label: "Mastered" },
  { id: "reviewDue", label: "Review Due" },
  { id: "favorite", label: "Favorites" },
  { id: "conversation", label: "Conversations" },
  { id: "playlist", label: "Playlists" },
];

const TIMELINES = [
  { id: "today", label: "Today", nodeLimit: 11 },
  { id: "7d", label: "7 days", nodeLimit: 17 },
  { id: "30d", label: "30 days", nodeLimit: 24 },
  { id: "90d", label: "90 days", nodeLimit: 30 },
  { id: "all", label: "All time", nodeLimit: 999 },
];

const typeLabels = {
  core: "Core",
  category: "Cluster",
  expression: "Expression",
  mistake: "Mistake",
  favorite: "Favorite",
  mastered: "Mastered",
  reviewDue: "Review Due",
  conversation: "Conversation",
  playlist: "Playlist",
};

function createInitialPositions() {
  return Object.fromEntries(neuralUniverseNodes.map((node) => [node.id, { x: node.x, y: node.y }]));
}

function createInitialVelocities() {
  return Object.fromEntries(neuralUniverseNodes.map((node) => [node.id, { vx: 0, vy: 0 }]));
}

function isNodeInFilter(node, filter) {
  if (filter === "all") return true;
  if (filter === "expression") return ["expression", "favorite", "mastered", "reviewDue"].includes(node.type);
  return node.type === filter;
}

function getNodeClasses(node, isSelected, isDimmed, isRelated) {
  return [
    "neural-node",
    `neural-node-${node.type}`,
    isSelected ? "is-selected" : "",
    isDimmed ? "is-dimmed" : "",
    isRelated ? "is-related" : "",
  ].join(" ");
}

function getGraphPoint(event, transform) {
  const rect = event.currentTarget.getBoundingClientRect();
  const localX = ((event.clientX - rect.left) / rect.width) * VIEWBOX.width;
  const localY = ((event.clientY - rect.top) / rect.height) * VIEWBOX.height;
  return {
    x: (localX - transform.x) / transform.scale,
    y: (localY - transform.y) / transform.scale,
  };
}

function getRelatedNodeIds(selectedNodeId, connections) {
  if (!selectedNodeId) return new Set();
  const ids = new Set([selectedNodeId]);
  connections.forEach((connection) => {
    if (connection.source === selectedNodeId) ids.add(connection.target);
    if (connection.target === selectedNodeId) ids.add(connection.source);
  });
  return ids;
}

export default function NeuralUniversePage() {
  const canvasRef = useRef(null);
  const positionsRef = useRef(createInitialPositions());
  const velocitiesRef = useRef(createInitialVelocities());
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });
  const dragNodeRef = useRef(null);
  const visibleIdsRef = useRef(new Set(neuralUniverseNodes.map((node) => node.id)));
  const [positions, setPositions] = useState(createInitialPositions);
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [filter, setFilter] = useState("all");
  const [timeline, setTimeline] = useState("all");
  const [search, setSearch] = useState("");
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [dragState, setDragState] = useState(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [showRetrospective, setShowRetrospective] = useState(false);
  const [thoughtPulse, setThoughtPulse] = useState(null);
  const [replayCount, setReplayCount] = useState(neuralUniverseNodes.length);
  const [frameTime, setFrameTime] = useState(0);
  const [mouseParallax, setMouseParallax] = useState({ x: 0, y: 0 });

  const nodeMap = useMemo(() => new Map(neuralUniverseNodes.map((node) => [node.id, node])), []);
  const timelineLimit = TIMELINES.find((item) => item.id === timeline)?.nodeLimit ?? 999;

  useEffect(() => {
    trackProgressionAction("openNeuralUniverse", { reason: "Neural Universe opened" });
  }, []);

  const visibleNodes = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return neuralUniverseNodes
      .slice(0, timelineLimit)
      .filter((node) => !normalizedSearch || node.label.toLowerCase().includes(normalizedSearch) || node.category.toLowerCase().includes(normalizedSearch))
      .slice(0, isReplaying ? replayCount : undefined);
  }, [isReplaying, replayCount, search, timelineLimit]);

  const visibleNodeIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);
  const visibleConnections = useMemo(
    () => neuralUniverseConnections.filter((connection) => visibleNodeIds.has(connection.source) && visibleNodeIds.has(connection.target)),
    [visibleNodeIds],
  );
  const relatedNodeIds = useMemo(() => getRelatedNodeIds(selectedNode, visibleConnections), [selectedNode, visibleConnections]);
  const selected = selectedNode ? nodeMap.get(selectedNode) : null;

  useEffect(() => {
    visibleIdsRef.current = visibleNodeIds;
  }, [visibleNodeIds]);

  useEffect(() => {
    transformRef.current = transform;
  }, [transform]);

  useEffect(() => {
    let animationFrame = 0;
    let lastRender = 0;

    const tick = (time) => {
      const ids = visibleIdsRef.current;
      const positionsNext = positionsRef.current;
      const velocitiesNext = velocitiesRef.current;
      const visible = neuralUniverseNodes.filter((node) => ids.has(node.id));

      for (let i = 0; i < visible.length; i += 1) {
        const a = visible[i];
        const aPos = positionsNext[a.id];
        const aVel = velocitiesNext[a.id];
        if (!aPos || !aVel) continue;

        for (let j = i + 1; j < visible.length; j += 1) {
          const b = visible[j];
          const bPos = positionsNext[b.id];
          const bVel = velocitiesNext[b.id];
          if (!bPos || !bVel) continue;

          const dx = aPos.x - bPos.x;
          const dy = aPos.y - bPos.y;
          const distanceSq = Math.max(900, dx * dx + dy * dy);
          const distance = Math.sqrt(distanceSq);
          const force = 780 / distanceSq;
          const fx = (dx / distance) * force;
          const fy = (dy / distance) * force;
          const aMass = Math.max(1, a.size / 12);
          const bMass = Math.max(1, b.size / 12);
          aVel.vx += fx / aMass;
          aVel.vy += fy / aMass;
          bVel.vx -= fx / bMass;
          bVel.vy -= fy / bMass;
        }
      }

      neuralUniverseConnections.forEach((connection) => {
        if (!ids.has(connection.source) || !ids.has(connection.target)) return;
        const source = nodeMap.get(connection.source);
        const target = nodeMap.get(connection.target);
        const sourcePos = positionsNext[connection.source];
        const targetPos = positionsNext[connection.target];
        const sourceVel = velocitiesNext[connection.source];
        const targetVel = velocitiesNext[connection.target];
        if (!source || !target || !sourcePos || !targetPos || !sourceVel || !targetVel) return;

        const dx = targetPos.x - sourcePos.x;
        const dy = targetPos.y - sourcePos.y;
        const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const targetDistance = 92 + (source.size + target.size) * 1.6;
        const force = (distance - targetDistance) * 0.0035 * connection.strength;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        sourceVel.vx += fx;
        sourceVel.vy += fy;
        targetVel.vx -= fx;
        targetVel.vy -= fy;
      });

      visible.forEach((node) => {
        const pos = positionsNext[node.id];
        const vel = velocitiesNext[node.id];
        if (!pos || !vel) return;

        const anchorStrength = node.id === "core" ? 0.022 : 0.0022;
        vel.vx += (node.x - pos.x) * anchorStrength;
        vel.vy += (node.y - pos.y) * anchorStrength;

        if (dragNodeRef.current?.id !== node.id) {
          vel.vx *= 0.9;
          vel.vy *= 0.9;
          pos.x = Math.min(960, Math.max(40, pos.x + vel.vx));
          pos.y = Math.min(810, Math.max(40, pos.y + vel.vy));
        }
      });

      if (time - lastRender > 32) {
        lastRender = time;
        setPositions({ ...positionsNext });
        setFrameTime(time);
      }

      animationFrame = window.requestAnimationFrame(tick);
    };

    animationFrame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [nodeMap]);

  useEffect(() => {
    if (!isReplaying) return undefined;
    setReplayCount(1);
    setSelectedNode(null);
    const interval = window.setInterval(() => {
      setReplayCount((current) => {
        if (current >= Math.min(timelineLimit, neuralUniverseNodes.length)) {
          window.clearInterval(interval);
          setIsReplaying(false);
          setShowRetrospective(true);
          setThoughtPulse({ startedAt: performance.now(), targetId: "looking-forward" });
          window.setTimeout(() => setShowRetrospective(false), 5200);
          return current;
        }
        return current + 1;
      });
    }, 220);
    return () => window.clearInterval(interval);
  }, [isReplaying, timelineLimit]);

  useEffect(() => {
    if (!thoughtPulse) return undefined;
    const timeout = window.setTimeout(() => setThoughtPulse(null), 2300);
    return () => window.clearTimeout(timeout);
  }, [thoughtPulse]);

  const resetView = () => setTransform({ x: 0, y: 0, scale: 1 });
  const centerCore = () => setTransform({ x: 0, y: 0, scale: 1.08 });
  const openFullscreen = () => canvasRef.current?.requestFullscreen?.();

  const handleWheel = (event) => {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    setTransform((current) => ({
      ...current,
      scale: Math.min(1.9, Math.max(0.62, current.scale + delta)),
    }));
  };

  const handlePointerDown = (event) => {
    if (event.button !== 0 || dragNodeRef.current) return;
    setDragState({ startX: event.clientX, startY: event.clientY, originX: transform.x, originY: transform.y });
  };

  const handlePointerMove = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setMouseParallax({
      x: ((event.clientX - rect.left) / rect.width - 0.5) * 16,
      y: ((event.clientY - rect.top) / rect.height - 0.5) * 16,
    });

    if (dragNodeRef.current) {
      const graphPoint = getGraphPoint(event, transformRef.current);
      const drag = dragNodeRef.current;
      const previous = positionsRef.current[drag.id];
      const dx = graphPoint.x - previous.x;
      const dy = graphPoint.y - previous.y;
      positionsRef.current[drag.id] = graphPoint;
      velocitiesRef.current[drag.id] = { vx: 0, vy: 0 };
      neuralUniverseConnections.forEach((connection) => {
        const neighborId = connection.source === drag.id ? connection.target : connection.target === drag.id ? connection.source : null;
        if (!neighborId || !positionsRef.current[neighborId]) return;
        velocitiesRef.current[neighborId].vx += dx * 0.055 * connection.strength;
        velocitiesRef.current[neighborId].vy += dy * 0.055 * connection.strength;
      });
      setPositions({ ...positionsRef.current });
      return;
    }

    if (!dragState) return;
    setTransform((current) => ({
      ...current,
      x: dragState.originX + event.clientX - dragState.startX,
      y: dragState.originY + event.clientY - dragState.startY,
    }));
  };

  const handlePointerUp = () => {
    dragNodeRef.current = null;
    setDragState(null);
  };

  const handleNodePointerDown = (event, node) => {
    event.stopPropagation();
    dragNodeRef.current = { id: node.id };
  };

  const toggleReplay = () => {
    if (isReplaying) {
      setIsReplaying(false);
      return;
    }
    setReplayCount(1);
    setShowRetrospective(false);
    setIsReplaying(true);
  };

  const triggerThoughtPulse = () => {
    setThoughtPulse({ startedAt: performance.now(), targetId: "looking-forward" });
  };

  const replayProgress = Math.min(100, (replayCount / Math.min(timelineLimit, neuralUniverseNodes.length)) * 100);

  return (
    <main className={`neural-universe ${isFocusMode ? "is-focus-mode" : ""} relative min-h-[calc(100vh-7rem)] overflow-hidden rounded-[28px] border border-[var(--border-soft)] shadow-lg`}>
      <NeuralParticles parallax={mouseParallax} intense={isFocusMode} />

      <div className="relative z-10 flex min-h-[calc(100vh-7rem)] flex-col">
        <header className="neural-topbar">
          <div>
            <div className="fm-chip inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]">
              <Sparkles className="h-3.5 w-3.5" />
              MindBlocks Method
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">Neural Universe</h1>
            <p className="fm-muted mt-2 max-w-3xl text-sm">
              Watch your English mind grow through expressions, mistakes, reviews and conversations.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-[240px,auto,auto,auto,auto]">
            <label className="fm-input flex min-h-11 items-center gap-2 rounded-2xl border px-3">
              <Search className="fm-subtle h-4 w-4" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search node" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
            </label>
            <button type="button" className="neural-tool-button">
              <Filter className="h-4 w-4" />
              Filter
            </button>
            <button type="button" onClick={toggleReplay} className="neural-tool-button">
              {isReplaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              Replay Growth
            </button>
            <button type="button" onClick={() => setIsFocusMode((current) => !current)} className="neural-tool-button">
              {isFocusMode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              Focus Mode
            </button>
            <button type="button" onClick={openFullscreen} className="neural-tool-button">
              <Maximize2 className="h-4 w-4" />
              Fullscreen
            </button>
          </div>
        </header>

        <NeuralUniverseStats />
        <NeuralUniverseFilters activeFilter={filter} onChange={setFilter} />
        <NeuralTimeline timeline={timeline} onChange={setTimeline} />

        <section className="neural-stage-grid grid flex-1 gap-4 p-4 xl:grid-cols-[1fr,340px]">
          <div className="neural-canvas-shell">
            <div className="neural-canvas-actions">
              <button type="button" onClick={resetView} className="neural-icon-button" aria-label="Reset view">
                <RotateCcw className="h-4 w-4" />
              </button>
              <button type="button" onClick={centerCore} className="neural-icon-button" aria-label="Center core">
                <Focus className="h-4 w-4" />
              </button>
              <button type="button" onClick={triggerThoughtPulse} className="neural-icon-button" aria-label="Thought pulse">
                <Zap className="h-4 w-4" />
              </button>
            </div>

            {isReplaying ? (
              <div className="neural-replay-banner">
                <span>Building your English mind...</span>
                <div className="fm-progress-track h-1.5 flex-1 overflow-hidden rounded-full">
                  <div className="fm-progress-fill h-full rounded-full" style={{ width: `${replayProgress}%` }} />
                </div>
              </div>
            ) : null}

            <div
              ref={canvasRef}
              className="neural-canvas"
              onWheel={handleWheel}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
            >
              <svg viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`} className="h-full w-full">
                <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
                  {visibleConnections.map((connection, index) => {
                    const source = nodeMap.get(connection.source);
                    const target = nodeMap.get(connection.target);
                    const sourcePos = positions[source?.id];
                    const targetPos = positions[target?.id];
                    if (!source || !target || !sourcePos || !targetPos) return null;
                    const isSelectedPath = selectedNode && (connection.source === selectedNode || connection.target === selectedNode);
                    const isDimmed = selectedNode && !isSelectedPath;
                    const pulsePhase = ((frameTime / (4300 + index * 97)) + index * 0.137) % 1;
                    const pulseX = sourcePos.x + (targetPos.x - sourcePos.x) * pulsePhase;
                    const pulseY = sourcePos.y + (targetPos.y - sourcePos.y) * pulsePhase;
                    const thoughtActive = thoughtPulse && (connection.source === "core" || connection.target === thoughtPulse.targetId || connection.source === "daily");
                    return (
                      <g key={connection.id} className={isDimmed ? "is-dimmed" : ""}>
                        <line
                          x1={sourcePos.x}
                          y1={sourcePos.y}
                          x2={targetPos.x}
                          y2={targetPos.y}
                          className={`neural-connection neural-connection-${connection.type} ${isSelectedPath ? "is-selected" : ""} ${thoughtActive ? "is-thought-pulse" : ""}`}
                          strokeWidth={Math.max(0.8, connection.strength * 2.7)}
                        />
                        <circle cx={pulseX} cy={pulseY} r={thoughtActive ? 4 : 2.2} className={`neural-impulse ${thoughtActive ? "is-thought-pulse" : ""}`} />
                      </g>
                    );
                  })}

                  {visibleNodes.map((node) => {
                    const pos = positions[node.id] ?? node;
                    const relevant = isNodeInFilter(node, filter);
                    const selectedThisNode = selectedNode === node.id;
                    const related = relatedNodeIds.has(node.id);
                    const dimmedBySelection = selectedNode && !related;
                    const thoughtTarget = thoughtPulse && (node.id === thoughtPulse.targetId || node.id === "core" || node.id === "daily");
                    return (
                      <g
                        key={node.id}
                        className={`${getNodeClasses(node, selectedThisNode, !relevant || dimmedBySelection, related)} ${thoughtTarget ? "is-thought-pulse" : ""}`}
                        onPointerDown={(event) => handleNodePointerDown(event, node)}
                        onMouseEnter={() => setHoveredNode(node)}
                        onMouseLeave={() => setHoveredNode(null)}
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedNode(node.id);
                        }}
                      >
                        {selectedThisNode ? <circle cx={pos.x} cy={pos.y} r={node.size + 12} className="neural-selection-ring" /> : null}
                        {node.type === "core" ? (
                          <>
                            <circle cx={pos.x} cy={pos.y} r={node.size + 28} className="neural-core-wave" />
                            <circle cx={pos.x} cy={pos.y} r={node.size + 17} className="neural-core-halo" />
                          </>
                        ) : null}
                        <circle cx={pos.x} cy={pos.y} r={node.size} />
                        {node.type === "core" ? <Brain x={pos.x - 14} y={pos.y - 14} width="28" height="28" className="neural-core-icon" /> : null}
                        {node.type === "favorite" ? <Star x={pos.x - 8} y={pos.y - 8} width="16" height="16" className="neural-node-icon" /> : null}
                        {["category", "conversation", "favorite"].includes(node.type) ? <ClusterConstellation node={node} position={pos} /> : null}
                        <text x={pos.x} y={pos.y + node.size + 18} textAnchor="middle" className="neural-node-label">
                          {node.label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>

              {hoveredNode ? <NodeTooltip node={hoveredNode} /> : null}
            </div>
          </div>

          {!isFocusMode ? <NodeDetailsPanel node={selected} onClose={() => setSelectedNode(null)} /> : null}
        </section>

        {showRetrospective ? <ReplayRetrospective /> : null}
      </div>
    </main>
  );
}

function ClusterConstellation({ node, position }) {
  if (node.mastery < 70) return null;
  return (
    <g className="neural-constellation">
      {[0, 1, 2, 3].map((item) => (
        <circle
          // eslint-disable-next-line react/no-array-index-key
          key={item}
          cx={position.x + Math.cos(item * 1.7) * (node.size + 16)}
          cy={position.y + Math.sin(item * 1.7) * (node.size + 13)}
          r="1.8"
        />
      ))}
    </g>
  );
}

function NeuralUniverseStats() {
  const stats = [
    { label: "Nodes", value: neuralUniverseStats.nodes },
    { label: "Connections", value: neuralUniverseStats.connections },
    { label: "Mastered", value: neuralUniverseStats.mastered },
    { label: "Review Due", value: neuralUniverseStats.reviewDue },
    { label: "Growth Today", value: neuralUniverseStats.growthToday, prefix: "+" },
  ];

  return (
    <div className="neural-hud">
      {stats.map((item) => (
        <div key={item.label} className="neural-hud-card">
          <span>{item.label}</span>
          <strong>
            {item.prefix}
            <AnimatedCounter value={item.value} />
          </strong>
        </div>
      ))}
    </div>
  );
}

function AnimatedCounter({ value }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let animationFrame = 0;
    const start = performance.now();
    const duration = 1100;
    const animate = (time) => {
      const progress = Math.min(1, (time - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      setCurrent(Math.round(value * eased));
      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(animate);
      }
    };
    animationFrame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [value]);

  return current.toLocaleString("en-US");
}

function NeuralUniverseFilters({ activeFilter, onChange }) {
  return (
    <div className="neural-filter-row">
      {FILTERS.map((item) => (
        <button key={item.id} type="button" onClick={() => onChange(item.id)} className={`neural-filter-chip ${activeFilter === item.id ? "is-active" : ""}`}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function NeuralTimeline({ timeline, onChange }) {
  return (
    <div className="neural-timeline">
      <span>Timeline</span>
      {TIMELINES.map((item) => (
        <button key={item.id} type="button" onClick={() => onChange(item.id)} className={timeline === item.id ? "is-active" : ""}>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function NodeTooltip({ node }) {
  return (
    <div className="neural-tooltip">
      <strong>{node.label}</strong>
      <span>{typeLabels[node.type] ?? node.type}</span>
      <span>{node.category}</span>
      <span>Mastery {node.mastery}%</span>
      <span>Next: {node.nextReviewAt}</span>
    </div>
  );
}

function NodeDetailsPanel({ node, onClose }) {
  const isCategory = node?.type === "category";
  const clusterNodes = isCategory
    ? neuralUniverseNodes.filter((item) => item.category === node.label || node.relatedIds?.includes(item.id))
    : [];
  const mastered = clusterNodes.filter((item) => item.type === "mastered").length;
  const reviewDue = clusterNodes.filter((item) => item.type === "reviewDue").length;

  if (!node) {
    return (
      <aside className="neural-side-panel">
        <p className="fm-chip inline-flex rounded-full border px-3 py-1 text-xs font-semibold">Your Universe</p>
        <h2 className="mt-4 text-2xl font-semibold">Your English mind is forming.</h2>
        <PanelMetric label="Nodes" value={neuralUniverseStats.nodes} />
        <PanelMetric label="Connections" value={neuralUniverseStats.connections} />
        <PanelMetric label="Mastered" value={neuralUniverseStats.mastered} />
        <PanelMetric label="Review Due" value={neuralUniverseStats.reviewDue} />
        <PanelMetric label="Largest Cluster" value={neuralUniverseStats.largestCluster} />
        <PanelMetric label="Growth Today" value={`+${neuralUniverseStats.growthToday} nodes`} />
      </aside>
    );
  }

  return (
    <aside className="neural-side-panel">
      <button type="button" onClick={onClose} className="neural-panel-close">Close</button>
      <p className="fm-chip inline-flex rounded-full border px-3 py-1 text-xs font-semibold">{typeLabels[node.type] ?? node.type}</p>
      <h2 className="mt-4 text-2xl font-semibold">{node.label}</h2>

      {isCategory ? (
        <>
          <PanelMetric label="Total nodes" value={clusterNodes.length} />
          <PanelMetric label="Mastered" value={mastered} />
          <PanelMetric label="Learning" value={Math.max(0, clusterNodes.length - mastered - reviewDue)} />
          <PanelMetric label="Review due" value={reviewDue} />
          <PanelMetric label="Growth this week" value="+7" />
        </>
      ) : (
        <>
          {node.translation ? <PanelMetric label="Translation" value={node.translation} /> : null}
          {node.wrongVersion ? <PanelMetric label="Wrong version" value={node.wrongVersion} /> : null}
          {node.correctVersion ? <PanelMetric label="Correct version" value={node.correctVersion} /> : null}
          <PanelMetric label="Category" value={node.category} />
          <PanelMetric label="Mastery" value={`${node.mastery}%`} />
          <PanelMetric label="Last review" value={node.lastReviewedAt} />
          <PanelMetric label="Next review" value={node.nextReviewAt} />
        </>
      )}

      <div className="mt-5 grid gap-2">
        <button type="button" className="neural-panel-action"><Volume2 className="h-4 w-4" /> Listen</button>
        <button type="button" className="neural-panel-action"><MessageCircle className="h-4 w-4" /> Practice with Neo</button>
        <button type="button" className="neural-panel-action"><Sparkles className="h-4 w-4" /> Add to Review</button>
        <button type="button" className="neural-panel-action"><Star className="h-4 w-4" /> Favorite</button>
      </div>
    </aside>
  );
}

function PanelMetric({ label, value }) {
  return (
    <div className="neural-panel-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ReplayRetrospective() {
  return (
    <div className="neural-retrospective">
      <strong>248 Nodes</strong>
      <strong>1482 Connections</strong>
      <strong>86 Mastered</strong>
      <strong>+8 Today</strong>
    </div>
  );
}

function NeuralParticles({ parallax, intense }) {
  const particleCount = intense ? 34 : 20;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="fm-neural-grid absolute inset-0 opacity-70"
        style={{ transform: `translate(${parallax.x * 0.35}px, ${parallax.y * 0.35}px)` }}
      />
      {Array.from({ length: particleCount }).map((_, index) => (
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          className="fm-particle"
          style={{
            left: `${4 + ((index * 17) % 92)}%`,
            top: `${8 + ((index * 23) % 82)}%`,
            animationDelay: `${index * 0.24}s`,
            transform: `translate(${parallax.x * (0.2 + (index % 4) * 0.08)}px, ${parallax.y * (0.2 + (index % 5) * 0.06)}px)`,
          }}
        />
      ))}
    </div>
  );
}
