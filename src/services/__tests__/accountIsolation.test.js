import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ writes: [], read: vi.fn() }));
vi.mock("../../lib/supabase.js", () => ({ supabaseConfigured: true, supabase: {
  from: (table) => {
    const filters = {};
    const query = {};
    query.select = () => query;
    query.eq = (key, value) => { filters[key] = value; return query; };
    query.order = () => query;
    query.maybeSingle = () => mocks.read(table, filters);
    query.limit = () => mocks.read(table, filters);
    query.upsert = async (rows) => { mocks.writes.push({ table, rows }); return { error: null }; };
    return query;
  },
} }));
vi.mock("react-hot-toast", () => ({ default: { custom: vi.fn() } }));

import { addXp, trackProgressionAction, configureProgressionPersistence, getProgressionState, hydrateProgressionState, updateProgressionState } from "../progressionEngine.js";
import { configureLearningEventsPersistence, getLearningEvents, hydrateLearningEvents, recordLearningEvent } from "../learningEventEngine.js";

function switchAccount(userId) {
  configureProgressionPersistence(userId);
  configureLearningEventsPersistence(userId);
}

beforeEach(() => {
  switchAccount(null);
  localStorage.clear();
  mocks.writes = [];
  mocks.read.mockReset().mockResolvedValue({ data: null, error: null });
});

describe("account isolation", () => {
  it("ignores actions from async handlers belonging to a previous account", () => {
    switchAccount("account-b");
    recordLearningEvent("private-event-a", { expression: "Private" }, "chat", "account-a");
    trackProgressionAction("saveMindBlock", { userId: "account-a" });
    addXp(500, "Late reward", { userId: "account-a" });
    expect(getLearningEvents()).toEqual([]);
    expect(getProgressionState().totalXp).toBe(0);
    expect(mocks.writes).toEqual([]);
  });
  it("does not import legacy or guest data into a signed-in account", async () => {
    localStorage.setItem("fluentmind_progression_state", JSON.stringify({ totalXp: 5000 }));
    localStorage.setItem("fluentmind_learning_events", JSON.stringify([{ id: "private-legacy-event" }]));
    updateProgressionState({ totalXp: 500 });
    recordLearningEvent("private-guest-event");
    switchAccount("account-b");
    await hydrateProgressionState("account-b");
    await hydrateLearningEvents("account-b");
    expect(getProgressionState().totalXp).toBe(0);
    expect(getLearningEvents()).toEqual([]);
    expect(mocks.writes.every(({ rows }) => !Array.isArray(rows) && rows.total_xp === 0)).toBe(true);
  });

  it("keeps account A's XP, journey and events out of account B and restores them on return", async () => {
    switchAccount("account-a");
    updateProgressionState({ totalXp: 90, learningJourney: { activeChapterId: "chapter-a" } });
    const event = recordLearningEvent("mindblock_saved", { expression: "Private phrase" });
    switchAccount("account-b");
    await hydrateProgressionState("account-b");
    await hydrateLearningEvents("account-b");
    expect(getProgressionState().totalXp).toBe(0);
    expect(getProgressionState().learningJourney).toBeUndefined();
    expect(getLearningEvents()).toEqual([]);
    switchAccount("account-a");
    expect(getProgressionState().totalXp).toBe(90);
    expect(getLearningEvents()).toEqual([event]);
    expect(getProgressionState().learningJourney.activeChapterId).toBe("chapter-a");
  });

  it("discards a late progression response after switching accounts", async () => {
    let resolveRead;
    mocks.read.mockImplementationOnce(() => new Promise((resolve) => { resolveRead = resolve; }));
    const hydration = hydrateProgressionState("account-a");
    switchAccount("account-b");
    resolveRead({ data: { state: { totalXp: 9999 }, updated_at: "2099-01-01" }, error: null });
    await hydration;
    expect(getProgressionState().totalXp).toBe(0);
    expect(mocks.writes).toEqual([]);
  });

  it("discards late events and does not upload them into the next account", async () => {
    let resolveRead;
    mocks.read.mockImplementationOnce(() => new Promise((resolve) => { resolveRead = resolve; }));
    const hydration = hydrateLearningEvents("account-a");
    switchAccount("account-b");
    resolveRead({ data: [{ id: "event-a", event_type: "private", payload: {}, created_at: "2026-01-01" }], error: null });
    await hydration;
    expect(getLearningEvents()).toEqual([]);
    expect(mocks.writes).toEqual([]);
  });
});
