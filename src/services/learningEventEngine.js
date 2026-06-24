export const LEARNING_EVENTS_KEY = "fluentmind_learning_events";
export const LEARNING_EVENTS_UPDATED = "fluentmind:learning-events-updated";

const CATEGORY_KEYWORDS = [
  { category: "Work English", keywords: ["work", "factory", "shift", "job", "meeting", "deadline", "report"] },
  { category: "Programming", keywords: ["technology", "software", "developer", "api", "react", "code", "programmer"] },
  { category: "Feelings", keywords: ["tired", "exhausted", "sleepy", "happy", "sad", "feel"] },
  { category: "Travel", keywords: ["travel", "airport", "hotel", "flight", "trip"] },
  { category: "Entertainment", keywords: ["movie", "series", "game", "music"] },
  { category: "Daily Fluency", keywords: ["say", "sense", "looking", "forward", "used", "morning", "today"] },
];

const CORE_NODE = {
  id: "core",
  label: "Rafael / FluentMind Core",
  type: "core",
  category: "Core",
  mastery: 80,
  x: 500,
  y: 360,
  size: 34,
  lastReviewedAt: "Today",
  nextReviewAt: "Tomorrow",
  relatedIds: [],
};

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function safeParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function emitLearningEventsUpdated(events) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(LEARNING_EVENTS_UPDATED, { detail: events }));
}

function slugify(value) {
  return String(value || "node")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 58) || "node";
}

function todayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function importantWords(value) {
  const stopWords = new Set(["the", "and", "you", "your", "for", "with", "that", "this", "from", "have", "like", "can", "how", "what", "why", "when", "where", "into", "about", "uma", "com", "para", "por", "que", "em"]);
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopWords.has(word));
}

function inferCategory(expression, fallback = "Daily Fluency") {
  const normalized = String(expression || "").toLowerCase();
  const matched = CATEGORY_KEYWORDS.find((item) => item.keywords.some((keyword) => normalized.includes(keyword)));
  return matched?.category || fallback || "Daily Fluency";
}

function inferConnections(expression) {
  const normalized = String(expression || "").toLowerCase();
  return CATEGORY_KEYWORDS
    .filter((item) => item.keywords.some((keyword) => normalized.includes(keyword)))
    .map((item) => item.category);
}

function getPosition(index, total, radius = 260, centerX = 500, centerY = 380) {
  const angle = ((index / Math.max(1, total)) * Math.PI * 2) - Math.PI / 2;
  return {
    x: Math.round(centerX + Math.cos(angle) * radius),
    y: Math.round(centerY + Math.sin(angle) * radius * 0.8),
  };
}

function saveEvents(events) {
  if (!canUseStorage()) return events;
  window.localStorage.setItem(LEARNING_EVENTS_KEY, JSON.stringify(events));
  emitLearningEventsUpdated(events);
  return events;
}

export function getLearningEvents() {
  if (!canUseStorage()) return [];
  return safeParse(window.localStorage.getItem(LEARNING_EVENTS_KEY), []);
}

export function recordLearningEvent(type, payload = {}, source = "app") {
  const event = {
    id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    source,
    payload,
    createdAt: new Date().toISOString(),
  };
  const events = [...getLearningEvents(), event];
  saveEvents(events);
  return event;
}

export function clearLearningEvents() {
  return saveEvents([]);
}

export function getEventsByType(type) {
  return getLearningEvents().filter((event) => event.type === type);
}

export function getEventsSince(date) {
  const time = new Date(date).getTime();
  return getLearningEvents().filter((event) => new Date(event.createdAt).getTime() >= time);
}

function addConnection(connections, source, target, strength = 0.65, type = "semantic") {
  if (!source || !target || source === target) return;
  const id = `${source}-${target}-${type}`;
  const existing = connections.get(id);
  connections.set(id, {
    id,
    source,
    target,
    strength: Math.min(1, Math.max(strength, existing?.strength || 0)),
    type,
  });
}

function ensureCategory(nodes, connections, category) {
  const id = `category-${slugify(category)}`;
  if (!nodes.has(id)) {
    nodes.set(id, {
      id,
      label: category,
      type: "category",
      category,
      mastery: 58,
      size: 20,
      lastReviewedAt: "Today",
      nextReviewAt: "This week",
      relatedIds: [],
    });
  }
  addConnection(connections, "core", id, 0.86, "core");
  return id;
}

function normalizeExpressionPayload(payload = {}) {
  const expression = payload.expression || payload.label || "Saved expression";
  const category = inferCategory(expression, payload.category);
  return {
    expression,
    translation: payload.translation || "",
    category,
    mastery: Number(payload.mastery ?? 10),
    isFavorite: Boolean(payload.isFavorite),
    playlistIds: Array.isArray(payload.playlistIds) ? payload.playlistIds : [],
    expressionId: payload.expressionId || payload.id || slugify(expression),
  };
}

export function buildNeuralUniverseFromEvents(events = getLearningEvents()) {
  const orderedEvents = [...events].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const nodes = new Map([["core", { ...CORE_NODE }]]);
  const connections = new Map();
  const expressionIndex = new Map();
  const playlistExpressionIds = new Map();

  orderedEvents.forEach((event) => {
    const payload = event.payload || {};

    if (event.type === "expression_saved") {
      const item = normalizeExpressionPayload(payload);
      const expressionId = `expression-${slugify(item.expressionId || item.expression)}`;
      const categoryId = ensureCategory(nodes, connections, item.category);
      const existing = nodes.get(expressionId);
      nodes.set(expressionId, {
        id: expressionId,
        label: item.expression,
        type: item.isFavorite ? "favorite" : item.mastery >= 90 ? "mastered" : item.mastery < 35 ? "reviewDue" : "expression",
        category: item.category,
        mastery: Math.max(existing?.mastery || 0, item.mastery),
        size: 12 + Math.min(6, Math.round((item.mastery || 10) / 18)),
        translation: item.translation,
        lastReviewedAt: "Today",
        nextReviewAt: item.mastery >= 90 ? "In 7 days" : "Today",
        source: event.source,
        relatedIds: existing?.relatedIds || [],
        star: item.isFavorite || existing?.star || false,
      });
      expressionIndex.set(expressionId, { ...item, id: expressionId, words: importantWords(item.expression) });
      addConnection(connections, categoryId, expressionId, 0.7, item.isFavorite ? "favorite" : "category");
      inferConnections(item.expression).forEach((category) => {
        addConnection(connections, ensureCategory(nodes, connections, category), expressionId, 0.66, "semantic");
      });
      item.playlistIds.forEach((playlistId) => {
        const id = `playlist-${slugify(playlistId)}`;
        if (!playlistExpressionIds.has(id)) playlistExpressionIds.set(id, new Set());
        playlistExpressionIds.get(id).add(expressionId);
      });
    }

    if (event.type === "correction_saved") {
      const wrongText = payload.wrongText || payload.originalText || payload.wrong || "Incorrect phrase";
      const correctText = payload.correctText || payload.correctedText || payload.correct || "Correct phrase";
      const id = `mistake-${slugify(`${wrongText}-${correctText}`)}`;
      const categoryId = ensureCategory(nodes, connections, "My Mistakes");
      nodes.set(id, {
        id,
        label: `${wrongText} -> ${correctText}`,
        type: "mistake",
        category: "My Mistakes",
        mastery: Number(payload.mastery ?? 35),
        size: 13,
        wrongVersion: wrongText,
        correctVersion: correctText,
        lastReviewedAt: "Today",
        nextReviewAt: "Today",
      });
      addConnection(connections, categoryId, id, 0.78, "correction");
      const matchingExpression = [...expressionIndex.values()].find((item) => item.expression.toLowerCase() === correctText.toLowerCase());
      if (matchingExpression) addConnection(connections, id, matchingExpression.id, 0.86, "correction");
    }

    if (event.type === "review_completed" || event.type === "mistake_reviewed") {
      const expressionId = payload.expressionId ? `expression-${slugify(payload.expressionId)}` : null;
      const matchingNode = expressionId && nodes.get(expressionId);
      if (matchingNode) {
        const delta = payload.correct === false ? -4 : 7;
        nodes.set(expressionId, {
          ...matchingNode,
          mastery: Math.min(100, Math.max(0, (matchingNode.mastery || 0) + delta)),
          reviewCount: (matchingNode.reviewCount || 0) + 1,
          type: (matchingNode.mastery || 0) + delta >= 90 ? "mastered" : matchingNode.type,
          nextReviewAt: payload.correct === false ? "Today" : "Tomorrow",
        });
      }
    }

    if (event.type === "expression_mastered") {
      const expressionId = payload.expressionId ? `expression-${slugify(payload.expressionId)}` : null;
      if (expressionId && nodes.has(expressionId)) {
        const node = nodes.get(expressionId);
        nodes.set(expressionId, { ...node, type: "mastered", mastery: 95, glow: "gold", nextReviewAt: "In 7 days" });
      }
    }

    if (event.type === "favorite_added") {
      const expressionId = payload.expressionId ? `expression-${slugify(payload.expressionId)}` : null;
      if (expressionId && nodes.has(expressionId)) {
        const node = nodes.get(expressionId);
        nodes.set(expressionId, { ...node, type: node.type === "mastered" ? "mastered" : "favorite", star: true });
      }
      if (expressionId) addConnection(connections, ensureCategory(nodes, connections, "Favorites"), expressionId, 0.88, "favorite");
    }

    if (event.type === "conversation_completed") {
      const id = `conversation-${slugify(payload.conversationId || event.id)}`;
      nodes.set(id, {
        id,
        label: payload.label || "Conversation Session",
        type: "conversation",
        category: "Conversations",
        mastery: 70,
        size: 13,
        lastReviewedAt: "Today",
        nextReviewAt: "In 3 days",
      });
      addConnection(connections, ensureCategory(nodes, connections, "Conversations"), id, 0.82, "conversation");
      (payload.expressionIds || []).forEach((expressionId) => {
        addConnection(connections, id, `expression-${slugify(expressionId)}`, 0.82, "conversation");
      });
    }

    if (event.type === "playlist_created" || event.type === "playlist_updated") {
      const id = `playlist-${slugify(payload.playlistId || payload.name || event.id)}`;
      nodes.set(id, {
        id,
        label: payload.name || "Playlist",
        type: "playlist",
        category: "Playlists",
        mastery: 68,
        size: 15,
        lastReviewedAt: "Today",
        nextReviewAt: "This week",
      });
      addConnection(connections, ensureCategory(nodes, connections, "Playlists"), id, 0.8, "playlist");
      (payload.expressionIds || []).forEach((expressionId) => addConnection(connections, id, `expression-${slugify(expressionId)}`, 0.78, "playlist"));
    }
  });

  playlistExpressionIds.forEach((expressionIds, playlistId) => {
    if (!nodes.has(playlistId)) {
      nodes.set(playlistId, {
        id: playlistId,
        label: "Playlist",
        type: "playlist",
        category: "Playlists",
        mastery: 65,
        size: 14,
        lastReviewedAt: "Today",
        nextReviewAt: "This week",
      });
      addConnection(connections, ensureCategory(nodes, connections, "Playlists"), playlistId, 0.78, "playlist");
    }
    expressionIds.forEach((expressionId) => addConnection(connections, playlistId, expressionId, 0.74, "playlist"));
  });

  const expressions = [...expressionIndex.values()];
  for (let i = 0; i < expressions.length; i += 1) {
    for (let j = i + 1; j < expressions.length; j += 1) {
      const shared = expressions[i].words.filter((word) => expressions[j].words.includes(word));
      if (shared.length > 0) addConnection(connections, expressions[i].id, expressions[j].id, 0.52 + shared.length * 0.08, "related");
    }
  }

  const nodeList = [...nodes.values()];
  const nonCore = nodeList.filter((node) => node.id !== "core");
  const positioned = nodeList.map((node, index) => {
    if (node.id === "core") return { ...node, size: Math.min(46, 30 + Math.floor(nonCore.length / 10)) };
    if (typeof node.x === "number" && typeof node.y === "number") return node;
    const position = getPosition(index, nodeList.length, node.type === "category" ? 250 : 320);
    return { ...node, ...position };
  });

  const connectionList = [...connections.values()].filter((connection) => nodes.has(connection.source) && nodes.has(connection.target));
  const categoryCounts = positioned.reduce((acc, node) => {
    if (node.id === "core") return acc;
    acc[node.category] = (acc[node.category] || 0) + 1;
    return acc;
  }, {});
  const largestCluster = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "Core";
  const today = todayKey();

  return {
    nodes: positioned,
    connections: connectionList,
    stats: {
      nodes: positioned.length,
      connections: connectionList.length,
      mastered: positioned.filter((node) => node.type === "mastered").length,
      reviewDue: positioned.filter((node) => node.type === "reviewDue" || node.mastery < 45).length,
      largestCluster,
      growthToday: orderedEvents.filter((event) => event.createdAt?.slice(0, 10) === today).length,
      mindBlocks: orderedEvents.filter((event) => event.type === "expression_saved").length,
      corrections: orderedEvents.filter((event) => event.type === "correction_saved").length,
      conversations: orderedEvents.filter((event) => event.type === "conversation_completed").length,
      strongConnections: connectionList.filter((connection) => connection.strength >= 0.78).length,
    },
  };
}

export function seedLearningEvents() {
  const baseDate = Date.now() - 1000 * 60 * 60 * 24 * 3;
  const expressions = [
    ["I'm a little tired.", "Estou um pouco cansado.", "Feelings"],
    ["I'm exhausted.", "Estou exausto.", "Feelings"],
    ["I work the night shift.", "Eu trabalho no turno da noite.", "Work English"],
    ["I sleep during the day.", "Eu durmo durante o dia.", "Daily Fluency"],
    ["How do you say shift in English?", "Como se diz turno em ingles?", "Work English"],
    ["I like technology.", "Eu gosto de tecnologia.", "Programming"],
    ["I work in a factory.", "Eu trabalho em uma fabrica.", "Work English"],
    ["I am a programmer.", "Eu sou programador.", "Programming"],
    ["I'm looking forward to it.", "Estou ansioso por isso.", "Daily Fluency"],
    ["That makes sense.", "Isso faz sentido.", "Daily Fluency"],
    ["My brain stopped working for a second.", "Minha mente travou por um segundo.", "Daily Fluency"],
  ];
  const corrections = [
    ["I like of technology", "I like technology.", "Do not use 'of' after like."],
    ["I work a factory", "I work in a factory.", "Use 'in' for workplace location."],
    ["I am programmer", "I am a programmer.", "Use article 'a' before singular job names."],
    ["I wake up at 9 PM", "I woke up at 9 PM.", "Use past tense when talking about a completed past action."],
  ];

  const seeded = expressions.map(([expression, translation, category], index) => ({
    id: `seed-expression-${index}`,
    type: "expression_saved",
    source: "seed",
    payload: {
      expressionId: `seed-${slugify(expression)}`,
      expression,
      translation,
      category,
      mastery: 12 + index * 7,
      isFavorite: index === 8 || index === 9,
      playlistIds: category === "Work English" ? ["work-english"] : [],
    },
    createdAt: new Date(baseDate + index * 1000 * 60 * 45).toISOString(),
  }));

  corrections.forEach(([wrongText, correctText, explanation], index) => {
    seeded.push({
      id: `seed-correction-${index}`,
      type: "correction_saved",
      source: "seed",
      payload: { wrongText, correctText, explanation, category: "My Mistakes" },
      createdAt: new Date(baseDate + (index + 12) * 1000 * 60 * 45).toISOString(),
    });
  });

  seeded.push(
    {
      id: "seed-playlist-work",
      type: "playlist_created",
      source: "seed",
      payload: { playlistId: "work-english", name: "Work English", expressionIds: ["seed-i-work-the-night-shift", "seed-i-work-in-a-factory"] },
      createdAt: new Date(baseDate + 18 * 1000 * 60 * 45).toISOString(),
    },
    {
      id: "seed-conversation-1",
      type: "conversation_completed",
      source: "seed",
      payload: { conversationId: "seed-conversation-1", expressionIds: ["seed-im-a-little-tired", "seed-i-work-the-night-shift"], xpEarned: 45, durationMinutes: 12 },
      createdAt: new Date(baseDate + 19 * 1000 * 60 * 45).toISOString(),
    },
  );

  saveEvents([...getLearningEvents(), ...seeded]);
  return seeded;
}
