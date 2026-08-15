import { describe, expect, it } from "vitest";
import {
  completionRate,
  currentStreakDays,
  dailyFocusTotals,
  dailyGoalProgress,
  sessionDurationSeconds,
  totalFocusSeconds,
} from "../lib/metrics/aggregate";
import type { Session } from "../types/session";

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: overrides.id ?? Math.random().toString(36),
    type: "focus",
    startedAt: 0,
    endedAt: 0,
    completed: true,
    ...overrides,
  };
}

// 2024-01-15 00:00:00 local time, used as a stable anchor.
const DAY0 = new Date(2024, 0, 15).getTime();
const DAY_MS = 24 * 60 * 60 * 1000;

describe("sessionDurationSeconds", () => {
  it("returns the wall-clock span in seconds", () => {
    const session = makeSession({ startedAt: DAY0, endedAt: DAY0 + 25 * 60 * 1000 });
    expect(sessionDurationSeconds(session)).toBe(25 * 60);
  });
});

describe("totalFocusSeconds", () => {
  it("sums only completed focus sessions, ignoring breaks and skipped sessions", () => {
    const sessions = [
      makeSession({ type: "focus", completed: true, startedAt: DAY0, endedAt: DAY0 + 1500 * 1000 }),
      makeSession({ type: "focus", completed: false, startedAt: DAY0, endedAt: DAY0 + 300 * 1000 }),
      makeSession({ type: "short-break", completed: true, startedAt: DAY0, endedAt: DAY0 + 300 * 1000 }),
    ];
    expect(totalFocusSeconds(sessions)).toBe(1500);
  });
});

describe("completionRate", () => {
  it("computes the fraction completed, optionally filtered by type", () => {
    const sessions = [
      makeSession({ type: "focus", completed: true }),
      makeSession({ type: "focus", completed: false }),
      makeSession({ type: "short-break", completed: true }),
    ];
    expect(completionRate(sessions)).toBeCloseTo(2 / 3);
    expect(completionRate(sessions, "focus")).toBe(0.5);
  });

  it("returns 0 for an empty list rather than NaN", () => {
    expect(completionRate([])).toBe(0);
  });
});

describe("dailyFocusTotals", () => {
  it("groups completed focus sessions by local calendar day", () => {
    const sessions = [
      makeSession({ startedAt: DAY0, endedAt: DAY0 + 1500 * 1000 }),
      makeSession({ startedAt: DAY0 + 3600 * 1000, endedAt: DAY0 + 3600 * 1000 + 1500 * 1000 }),
      makeSession({ startedAt: DAY0 + DAY_MS, endedAt: DAY0 + DAY_MS + 1500 * 1000 }),
      makeSession({ type: "short-break", startedAt: DAY0, endedAt: DAY0 + 300 * 1000 }),
    ];
    const totals = dailyFocusTotals(sessions);
    expect(totals).toHaveLength(2);
    expect(totals[0].focusSessionsCompleted).toBe(2);
    expect(totals[0].focusSeconds).toBe(3000);
    expect(totals[1].focusSessionsCompleted).toBe(1);
  });
});

describe("currentStreakDays", () => {
  it("counts consecutive days with a completed focus session, back from today", () => {
    const day0Key = "2024-01-15";
    const day1 = DAY0 - DAY_MS;
    const day2 = DAY0 - 2 * DAY_MS;
    const sessions = [
      makeSession({ startedAt: DAY0, endedAt: DAY0 + 1500 * 1000 }),
      makeSession({ startedAt: day1, endedAt: day1 + 1500 * 1000 }),
      makeSession({ startedAt: day2, endedAt: day2 + 1500 * 1000 }),
    ];
    expect(currentStreakDays(sessions, day0Key)).toBe(3);
  });

  it("doesn't break the streak just because today has no session yet", () => {
    const day0Key = "2024-01-15";
    const day1 = DAY0 - DAY_MS;
    const sessions = [makeSession({ startedAt: day1, endedAt: day1 + 1500 * 1000 })];
    expect(currentStreakDays(sessions, day0Key)).toBe(1);
  });

  it("returns 0 once there's a gap", () => {
    const day0Key = "2024-01-15";
    const day2 = DAY0 - 2 * DAY_MS;
    const sessions = [makeSession({ startedAt: day2, endedAt: day2 + 1500 * 1000 })];
    expect(currentStreakDays(sessions, day0Key)).toBe(0);
  });
});

describe("dailyGoalProgress", () => {
  it("returns null when no goal is set", () => {
    expect(dailyGoalProgress(1000, null)).toBeNull();
    expect(dailyGoalProgress(1000, 0)).toBeNull();
  });

  it("returns the fraction of the goal reached, uncapped above 1", () => {
    expect(dailyGoalProgress(30 * 60, 60)).toBeCloseTo(0.5);
    expect(dailyGoalProgress(90 * 60, 60)).toBeCloseTo(1.5);
  });
});
