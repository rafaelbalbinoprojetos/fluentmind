// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), update: vi.fn() }));
vi.mock("../../../api/_utils/auth.js", () => ({ requireUser: async () => ({ id: "student-a", email: "student@example.com", app_metadata: { provider: "email" } }) }));
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc: mocks.rpc, auth: { admin: { updateUserById: mocks.update } } }) }));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_KEY", "test-service-key");
  mocks.rpc.mockReset();
  mocks.update.mockReset().mockResolvedValue({ error: null });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

async function requestTrial() {
  const { default: handler } = await import("../../../api/ultra-access.js");
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), setHeader: vi.fn() };
  await handler({ method: "POST", body: { action: "start-trial", userId: "other-user", trial_expires_at: "2099-01-01" } }, res);
  return res;
}

describe("server-owned trial activation", () => {
  it.each(["active", "expired"])("uses the database's %s trial dates, ignoring dates and identity supplied by the client", async (status) => {
    const trial = { trial_status: status, trial_started_at: "2026-01-01", trial_expires_at: "2026-01-08" };
    mocks.rpc.mockResolvedValue({ data: trial, error: null });
    const res = await requestTrial();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(mocks.rpc).toHaveBeenCalledWith("start_ai_trial", { p_user_id: "student-a" });
    expect(mocks.update).toHaveBeenCalledWith("student-a", { app_metadata: { provider: "email", ...trial } });
  });

  it("does not activate a trial when the durable first-activation record cannot be read", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("Database unavailable") });
    const res = await requestTrial();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(mocks.update).not.toHaveBeenCalled();
  });
});
