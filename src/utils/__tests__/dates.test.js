import { afterEach, describe, expect, it, vi } from "vitest";
import { localDateKey, shiftDateKey } from "../dates.js";

afterEach(() => vi.useRealTimers());

describe("learner calendar days", () => {
  it("uses the local calendar even when the UTC date is already tomorrow", () => {
    const localEvening = {
      getFullYear: () => 2026, getMonth: () => 9, getDate: () => 31,
      toISOString: () => "2026-11-01T02:30:00.000Z",
    };
    expect(localDateKey(localEvening)).toBe("2026-10-31");
  });

  it("handles year boundaries and leap days for streaks", () => {
    expect(shiftDateKey("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDateKey("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("keeps the activity window on the user's local day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 31, 23, 30));
    const { getLastDateKeys } = await import("../../services/learningProgress.js");
    expect(getLastDateKeys(3)).toEqual(["2026-10-29", "2026-10-30", "2026-10-31"]);
  });
});
