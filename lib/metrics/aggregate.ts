// Pure functions: daily/weekly totals, streaks, completion rate. No
// chrome.*/browser.* calls, so it's unit-testable with plain Vitest and
// reusable if a dashboard page or a future companion needs the same math
// (per Prompt.md's rule for this file).

import { dateKeyFor, shiftDateKey } from "../date";
import type { Session } from "../../types/session";

export interface DailyTotal {
  date: string; // YYYY-MM-DD
  focusSeconds: number;
  focusSessionsCompleted: number;
}

// Wall-clock span of a session. For a phase paused mid-way this slightly
// over-counts vs. active work time (pauses aren't broken out in the logged
// Session shape) — an accepted simplification, see lib/storage/logs.ts.
export function sessionDurationSeconds(session: Session): number {
  return Math.max(0, (session.endedAt - session.startedAt) / 1000);
}

export function totalFocusSeconds(sessions: Session[]): number {
  return sessions
    .filter((s) => s.type === "focus" && s.completed)
    .reduce((sum, s) => sum + sessionDurationSeconds(s), 0);
}

export function completionRate(sessions: Session[], type?: Session["type"]): number {
  const relevant = type ? sessions.filter((s) => s.type === type) : sessions;
  if (relevant.length === 0) return 0;
  const completed = relevant.filter((s) => s.completed).length;
  return completed / relevant.length;
}

// Groups completed focus sessions by local calendar day, most recent last.
export function dailyFocusTotals(sessions: Session[]): DailyTotal[] {
  const byDate = new Map<string, DailyTotal>();
  for (const session of sessions) {
    if (session.type !== "focus" || !session.completed) continue;
    const date = dateKeyFor(session.startedAt);
    const existing = byDate.get(date) ?? { date, focusSeconds: 0, focusSessionsCompleted: 0 };
    existing.focusSeconds += sessionDurationSeconds(session);
    existing.focusSessionsCompleted += 1;
    byDate.set(date, existing);
  }
  return Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
}

// Consecutive calendar days, ending today (or yesterday, if today has no
// completed focus session yet — an in-progress day doesn't break a streak),
// with at least one completed focus session.
export function currentStreakDays(sessions: Session[], todayKey: string): number {
  const daysWithFocus = new Set(
    sessions.filter((s) => s.type === "focus" && s.completed).map((s) => dateKeyFor(s.startedAt))
  );
  let cursor = daysWithFocus.has(todayKey) ? todayKey : shiftDateKey(todayKey, -1);
  let streak = 0;
  while (daysWithFocus.has(cursor)) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return streak;
}

// Fraction of a daily goal reached (0..1, uncapped above 1), or null if no
// goal is configured.
export function dailyGoalProgress(focusSecondsToday: number, dailyGoalMinutes: number | null): number | null {
  if (!dailyGoalMinutes || dailyGoalMinutes <= 0) return null;
  return focusSecondsToday / (dailyGoalMinutes * 60);
}
