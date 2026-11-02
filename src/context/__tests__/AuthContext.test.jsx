import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ listener: null, getUser: vi.fn(), updateUser: vi.fn(), preferences: vi.fn() }));
const accountA = { id: "account-a", email: "a@example.com", app_metadata: {}, user_metadata: {} };
const accountB = { id: "account-b", email: "b@example.com", app_metadata: {}, user_metadata: {} };
vi.mock("../../lib/supabase.js", () => ({ supabaseConfigured: true, supabase: { auth: {
  getSession: async () => ({ data: { session: { user: accountA, access_token: "token-a" } } }),
  getUser: mocks.getUser,
  updateUser: mocks.updateUser,
  onAuthStateChange: (callback) => { mocks.listener = callback; return { data: { subscription: { unsubscribe: vi.fn() } } }; },
} } }));
vi.mock("../../services/learningEventEngine.js", () => ({ configureLearningEventsPersistence: vi.fn(), hydrateLearningEvents: async () => [] }));
vi.mock("../../services/progressionEngine.js", () => ({ configureProgressionPersistence: vi.fn(), hydrateProgressionState: async () => ({}) }));
vi.mock("../../services/ultraAccess.js", () => ({ fetchUltraAccessPassByUserId: async () => ({ active: false, isLifetime: false }) }));
vi.mock("../../services/userPreferences.js", () => ({
  buildPreferencesFromMetadata: (_metadata, user) => ({ displayName: user?.id, extra: {} }),
  getOrCreateUserPreferences: mocks.preferences,
  updateUserPreferences: async (_userId, patch) => patch,
}));

import { AuthProvider, useAuth } from "../AuthContext.jsx";

function Probe() {
  const auth = useAuth();
  return <>
    <div data-testid="account">{auth.user?.id}</div>
    <div data-testid="memory">{auth.userPreferences.extra?.neoMemory?.[0] || "empty"}</div>
    <div data-testid="premium">{String(auth.subscription.hasPremiumAccess)}</div>
    <div data-testid="loading">{String(auth.loading)}</div>
    <button onClick={() => auth.refreshUser()}>Refresh</button>
    <button onClick={() => auth.updateUserMetadata({ display_name: "Updated" })}>Save</button>
  </>;
}

beforeEach(() => {
  mocks.getUser.mockReset().mockResolvedValue({ data: { user: accountA }, error: null });
  mocks.updateUser.mockReset();
  mocks.preferences.mockReset().mockImplementation(async (user) => ({ displayName: user.id, extra: { neoMemory: [`memory-${user.id}`] } }));
  accountA.user_metadata = {};
});

async function setup() {
  render(<AuthProvider><Probe /></AuthProvider>);
  await waitFor(() => expect(screen.getByTestId("memory")).toHaveTextContent("memory-account-a"));
}

async function switchToB() {
  await act(async () => mocks.listener("SIGNED_IN", { user: accountB, access_token: "token-b" }));
}

describe("authentication account boundaries", () => {
  it("ignores forged premium/trial metadata in the UI", async () => {
    accountA.user_metadata = { plan: "premium", trial_status: "active", trial_expires_at: "2099-01-01" };
    await setup();
    expect(screen.getByTestId("premium")).toHaveTextContent("false");
  });

  it("does not show account A's preferences while account B is loading", async () => {
    await setup();
    mocks.preferences.mockImplementationOnce(() => new Promise(() => {}));
    await switchToB();
    expect(screen.getByTestId("account")).toHaveTextContent("account-b");
    expect(screen.getByTestId("memory")).toHaveTextContent("empty");
    expect(screen.getByTestId("loading")).toHaveTextContent("true");
  });

  it.each(["Refresh", "Save"])("ignores a late %s response from the previous account", async (action) => {
    await setup();
    let resolveRequest;
    const pending = new Promise((resolve) => { resolveRequest = resolve; });
    (action === "Refresh" ? mocks.getUser : mocks.updateUser).mockReturnValueOnce(pending);
    fireEvent.click(screen.getByRole("button", { name: action }));
    await switchToB();
    await act(async () => { resolveRequest({ data: { user: accountA }, error: null }); await pending; });
    expect(screen.getByTestId("account")).toHaveTextContent("account-b");
    expect(screen.getByTestId("memory")).toHaveTextContent("memory-account-b");
  });
});
