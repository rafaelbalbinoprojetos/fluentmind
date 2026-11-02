// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), reads: [], queries: [] }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    rpc: mocks.rpc,
    from: () => {
      const query = {};
      for (const method of ["select", "order", "limit", "eq", "is"]) query[method] = vi.fn(() => query);
      query.maybeSingle = vi.fn(async () => mocks.reads.shift() || { data: null, error: null });
      mocks.queries.push(query);
      return query;
    },
  }),
}));

let usage;
beforeEach(async () => {
  vi.resetModules();
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_KEY", "server-test-key");
  mocks.reads = [];
  mocks.queries = [];
  mocks.rpc.mockReset().mockResolvedValue({ data: { ai_chat: 1 }, error: null });
  usage = await import("../../../api/_utils/aiUsage.js");
});

const user = { id: "account-a", email: "student@example.com" };
describe("trusted AI access and quotas", () => {
  it("ignores a self-assigned premium plan and future trial in user_metadata", async () => {
    const forged = { ...user, user_metadata: { plan: "premium", trial_status: "active", trial_expires_at: "2099-01-01" } };
    expect(await usage.resolveAiPlan(forged)).toBe("basic");
    await expect(usage.reserveAiUsage(forged)).rejects.toMatchObject({ statusCode: 403 });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("accepts server-managed premium and unexpired trials", async () => {
    expect(await usage.resolveAiPlan({ ...user, app_metadata: { plan: "premium" } })).toBe("pro");
    expect(await usage.resolveAiPlan({ ...user, app_metadata: { trial_status: "active", trial_expires_at: "2099-01-01" } })).toBe("pro");
  });

  it.each(["2000-01-01", "not-a-date", undefined])("rejects expired or malformed trials: %s", async (expiry) => {
    expect(await usage.resolveAiPlan({ ...user, app_metadata: { trial_status: "active", trial_expires_at: expiry } })).toBe("basic");
  });

  it.each(["pending", "revoked"])("rejects an Ultra grant with status %s", async (status) => {
    mocks.reads.push({ data: { status, plan: "premium" }, error: null });
    expect(await usage.resolveAiPlan(user)).toBe("basic");
  });

  it("accepts a valid grant and limits email fallback to unbound legacy grants", async () => {
    mocks.reads.push({ data: null, error: null }, { data: { status: "active", plan: "premium" }, error: null });
    expect(await usage.resolveAiPlan(user)).toBe("pro");
    expect(mocks.queries[1].is).toHaveBeenCalledWith("user_id", null);
  });

  it("reserves the shared budget through the atomic RPC", async () => {
    await usage.reserveAiUsage({ ...user, app_metadata: { plan: "premium" } });
    expect(mocks.rpc).toHaveBeenCalledWith("consume_ai_usage", { p_user_id: user.id, p_amount: 1, p_limit: 300 });
  });

  it("propagates exhausted budgets as 429 and infrastructure failures as 503", async () => {
    mocks.rpc.mockResolvedValueOnce({ error: { code: "P0001", message: "ai_limit_reached" } });
    await expect(usage.consumeAiUsage({ userId: user.id, plan: "pro", deltas: { ai_chat: 1 } })).rejects.toMatchObject({ statusCode: 429 });
    mocks.rpc.mockResolvedValueOnce({ error: { code: "42883", message: "function missing" } });
    await expect(usage.consumeAiUsage({ userId: user.id, plan: "pro", deltas: { ai_chat: 1 } })).rejects.toMatchObject({ statusCode: 503 });
  });

  it("does not accept negative increments or unknown counters", async () => {
    for (const deltas of [{ ai_chat: -1 }, { ai_chat: 1, arbitrary: 1 }, {}]) {
      await expect(usage.consumeAiUsage({ userId: user.id, plan: "pro", deltas })).rejects.toMatchObject({ statusCode: 400 });
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
