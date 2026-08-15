import { browser } from "wxt/browser";
import type { Session } from "../../types/session";
import { dateKeyFor } from "../date";
import { logKey } from "./keys";

export { dateKeyFor };

export async function getLogsForDate(dateKeyStr: string): Promise<Session[]> {
  const key = logKey(dateKeyStr);
  const result = await browser.storage.local.get(key);
  return (result[key] as Session[] | undefined) || [];
}

async function setLogsForDate(dateKeyStr: string, sessions: Session[]): Promise<void> {
  await browser.storage.local.set({ [logKey(dateKeyStr)]: sessions });
}

export async function appendLog(session: Session): Promise<Session> {
  const dateKeyStr = dateKeyFor(session.startedAt);
  const sessions = await getLogsForDate(dateKeyStr);
  sessions.unshift(session);
  await setLogsForDate(dateKeyStr, sessions);
  return session;
}

export async function updateLogEntry(
  dateKeyStr: string,
  id: string,
  fields: Partial<Session>
): Promise<Session[]> {
  const sessions = await getLogsForDate(dateKeyStr);
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return sessions;
  sessions[idx] = { ...sessions[idx], ...fields };
  await setLogsForDate(dateKeyStr, sessions);
  return sessions;
}

export async function deleteLogEntry(dateKeyStr: string, id: string): Promise<Session[]> {
  const sessions = await getLogsForDate(dateKeyStr);
  const filtered = sessions.filter((s) => s.id !== id);
  await setLogsForDate(dateKeyStr, filtered);
  return filtered;
}

// Editing a manual entry's start time can move it into a different day
// bucket — remove it from the old bucket and append it fresh under the new
// one (a no-op extra write when the date didn't actually change).
export async function moveLogEntry(oldDateKeyStr: string, updated: Session): Promise<void> {
  await deleteLogEntry(oldDateKeyStr, updated.id);
  await appendLog(updated);
}

// Scans the day-buckets spanning [startEpochMs, endEpochMs] (inclusive).
// Used for dashboard "today"/"this week" reads and suggestion lists so
// callers don't have to scan the entire history.
export async function getLogsInRange(startEpochMs: number, endEpochMs: number): Promise<Session[]> {
  const dateKeys: string[] = [];
  const cursor = new Date(startEpochMs);
  cursor.setHours(0, 0, 0, 0);
  const endMs = endEpochMs;
  while (cursor.getTime() <= endMs) {
    dateKeys.push(dateKeyFor(cursor.getTime()));
    cursor.setDate(cursor.getDate() + 1);
  }
  const perDay = await Promise.all(dateKeys.map(getLogsForDate));
  return perDay.flat().filter((s) => s.startedAt >= startEpochMs && s.startedAt <= endEpochMs);
}

// Unique past values for a field across recent days, most-recent first —
// populates the tag/title suggestion lists (was getCategorySuggestions/
// getTitleSuggestions in the old plain-JS storage.js).
export async function getFieldSuggestions(
  field: "tag" | "title",
  lookbackDays = 30
): Promise<string[]> {
  const now = Date.now();
  const sessions = await getLogsInRange(now - lookbackDays * 24 * 60 * 60 * 1000, now);
  const seen = new Set<string>();
  const values: string[] = [];
  for (const session of sessions) {
    const value = session[field];
    if (!value || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }
  return values;
}

export function getTagSuggestions(lookbackDays = 30): Promise<string[]> {
  return getFieldSuggestions("tag", lookbackDays);
}

export function getTitleSuggestions(lookbackDays = 30): Promise<string[]> {
  return getFieldSuggestions("title", lookbackDays);
}
