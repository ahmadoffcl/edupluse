import { describe, expect, it } from "vitest";
import {
  awardXpForAction,
  calculateLevel,
  calculateStreak,
} from "@/lib/gamification";

describe("gamification", () => {
  it("calculates levels with bounded progress", () => {
    expect(calculateLevel(0)).toMatchObject({ level: 1, progress: 0 });
    expect(calculateLevel(18420).level).toBeGreaterThan(1);
    expect(calculateLevel(18420).progress).toBeLessThanOrEqual(100);
  });

  it("calculates consecutive daily streaks", () => {
    expect(
      calculateStreak({
        today: "2026-05-18",
        activeDates: ["2026-05-18", "2026-05-17", "2026-05-16"],
      }),
    ).toBe(3);
  });

  it("awards deterministic action XP", () => {
    expect(awardXpForAction("assignment_submitted")).toBe(120);
    expect(awardXpForAction("unknown")).toBe(10);
  });
});
