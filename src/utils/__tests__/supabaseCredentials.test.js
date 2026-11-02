import { describe, expect, it } from "vitest";
import { isServerSupabaseKey } from "../supabaseCredentials.js";

const jwt = (role) => `header.${btoa(JSON.stringify({ role, ref: "test-project" }))}.signature`;

describe("public Supabase credential validation", () => {
  it("rejects legacy administrator JWTs and new secret keys", () => {
    expect(isServerSupabaseKey(jwt("service_role"))).toBe(true);
    expect(isServerSupabaseKey("sb_secret_fake-test-key")).toBe(true);
  });
  it("allows public anon JWTs and publishable keys", () => {
    expect(isServerSupabaseKey(jwt("anon"))).toBe(false);
    expect(isServerSupabaseKey("sb_publishable_fake-test-key")).toBe(false);
  });
  it("handles missing or malformed values without crashing", () => {
    for (const value of [undefined, null, "", "malformed", "a.invalid.b"]) {
      expect(isServerSupabaseKey(value)).toBe(false);
    }
  });
});
