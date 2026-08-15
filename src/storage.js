// All reads/writes to chrome.storage.local, plus the session mutation logic
// shared between popup.js (user actions) and background.js (auto-complete).

import { isSessionDue, isCurrentlyPaused, totalPausedSeconds } from "./timer.js";

const STORAGE_KEY = "procrastomatoState";

const DEFAULT_STATE = {
  sessions: [],
  activeSessionId: null,
  settings: {
    defaultDurationMinutes: 25,
  },
};

export function generateId() {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export async function getState() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const stored = result[STORAGE_KEY];
  if (!stored) return structuredClone(DEFAULT_STATE);
  return {
    ...structuredClone(DEFAULT_STATE),
    ...stored,
    settings: { ...DEFAULT_STATE.settings, ...(stored.settings || {}) },
  };
}

async function saveState(state) {
  await chrome.storage.local.set({ [STORAGE_KEY]: state });
  return state;
}

// Lets sync.js write a merged state back to local storage without going
// through a specific mutator (the merge already produced the final shape).
export async function overwriteState(state) {
  return saveState(state);
}

export function getActiveSession(state) {
  if (!state.activeSessionId) return null;
  return state.sessions.find((s) => s.id === state.activeSessionId) || null;
}

// Unique past values for a session field, most-recently-created first (the
// sessions array is newest-first already), for populating suggestion lists.
function fieldSuggestions(state, field) {
  const seen = new Set();
  const values = [];
  for (const session of state.sessions) {
    if (session.deletedAt) continue;
    const value = session[field];
    if (!value || seen.has(value)) continue;
    seen.add(value);
    values.push(value);
  }
  return values;
}

export function getTitleSuggestions(state) {
  return fieldSuggestions(state, "title");
}

export function getCategorySuggestions(state) {
  return fieldSuggestions(state, "category");
}

export async function startSession({ title, description, category, plannedDurationMinutes }) {
  const state = await getState();
  if (state.activeSessionId) {
    throw new Error("A session is already in progress.");
  }
  const session = {
    id: generateId(),
    title: title.trim(),
    description: (description || "").trim(),
    category: (category || "").trim(),
    plannedDurationMinutes,
    status: "active",
    startTime: new Date().toISOString(),
    endTime: null,
    pauses: [],
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  };
  state.sessions.unshift(session);
  state.activeSessionId = session.id;
  await saveState(state);
  return session;
}

export async function pauseActiveSession() {
  const state = await getState();
  const session = getActiveSession(state);
  if (!session || session.status !== "active") return state;
  session.status = "paused";
  session.pauses.push({ pausedAt: new Date().toISOString(), resumedAt: null });
  session.updatedAt = new Date().toISOString();
  await saveState(state);
  return state;
}

export async function resumeActiveSession() {
  const state = await getState();
  const session = getActiveSession(state);
  if (!session || session.status !== "paused") return state;
  session.status = "active";
  const last = session.pauses[session.pauses.length - 1];
  if (last && !last.resumedAt) last.resumedAt = new Date().toISOString();
  session.updatedAt = new Date().toISOString();
  await saveState(state);
  return state;
}

export async function stopActiveSession() {
  const state = await getState();
  const session = getActiveSession(state);
  if (!session) return state;
  if (isCurrentlyPaused(session)) {
    session.pauses[session.pauses.length - 1].resumedAt = new Date().toISOString();
  }
  session.status = "stopped";
  session.endTime = new Date().toISOString();
  session.updatedAt = session.endTime;
  state.activeSessionId = null;
  await saveState(state);
  return state;
}

export async function adjustActiveDuration(plannedDurationMinutes) {
  const state = await getState();
  const session = getActiveSession(state);
  if (!session) return state;
  session.plannedDurationMinutes = plannedDurationMinutes;
  session.updatedAt = new Date().toISOString();
  await saveState(state);
  return state;
}

// Checks the active session and marks it completed + fires the passed
// notify() callback if it just finished. Called from the popup on open and
// from the background alarm handler.
export async function checkAndCompleteActiveSession(notify) {
  const state = await getState();
  const session = getActiveSession(state);
  if (!session) return state;
  if (isSessionDue(session)) {
    const finishSeconds =
      session.plannedDurationMinutes * 60 + totalPausedSeconds(session.pauses);
    session.status = "completed";
    session.endTime = new Date(
      new Date(session.startTime).getTime() + finishSeconds * 1000
    ).toISOString();
    session.updatedAt = new Date().toISOString();
    state.activeSessionId = null;
    await saveState(state);
    if (notify) notify(session);
  }
  return state;
}

export async function addManualSession({ title, description, category, startTime, endTime }) {
  const state = await getState();
  const session = {
    id: generateId(),
    title: title.trim(),
    description: (description || "").trim(),
    category: (category || "").trim(),
    plannedDurationMinutes: Math.round((new Date(endTime) - new Date(startTime)) / 60000),
    status: "manual",
    startTime: new Date(startTime).toISOString(),
    endTime: new Date(endTime).toISOString(),
    pauses: [],
    updatedAt: new Date().toISOString(),
    deletedAt: null,
  };
  state.sessions.unshift(session);
  await saveState(state);
  return session;
}

export async function updateSessionRecord(id, fields) {
  const state = await getState();
  const session = state.sessions.find((s) => s.id === id);
  if (!session) return state;
  Object.assign(session, fields);
  session.updatedAt = new Date().toISOString();
  await saveState(state);
  return state;
}

// Tombstones rather than removes the record: a hard delete would let a
// sync merge resurrect it from a machine that hasn't seen the deletion yet.
// popup.js filters deletedAt sessions out of the rendered history.
export async function deleteSessionRecord(id) {
  const state = await getState();
  const session = state.sessions.find((s) => s.id === id);
  if (!session) return state;
  session.deletedAt = new Date().toISOString();
  session.updatedAt = session.deletedAt;
  if (state.activeSessionId === id) state.activeSessionId = null;
  await saveState(state);
  return state;
}

