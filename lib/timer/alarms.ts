// chrome.alarms wiring — the background service worker never ticks its own
// countdown (it can be killed and re-woken by the browser at any time, see
// CLAUDE.md). It reacts to a periodic alarm capped at 1-minute granularity
// (the platform minimum) to update the toolbar badge and detect phase
// completion, recomputing everything from the persisted TimerState's
// timestamps via lib/timer/engine.ts.

import { browser } from "wxt/browser";
import { generateId } from "../id";
import { broadcastState } from "../messaging/broadcast";
import { appendLog } from "../storage/logs";
import { getSettings } from "../storage/settings";
import { getTimerState, setTimerState } from "../storage/timer-state";
import type { Session } from "../../types/session";
import type { TimerState } from "../../types/timer";
import * as engine from "./engine";

export const ALARM_NAME = "procrastomato-tick";

const PHASE_LABEL: Record<Session["type"], string> = {
  focus: "Focus session",
  "short-break": "Short break",
  "long-break": "Long break",
};

const BADGE_COLOR: Record<TimerState["phase"], string> = {
  focus: "#e63946",
  "short-break": "#2a9d8f",
  "long-break": "#264653",
};

function buildSessionFromState(state: TimerState, now: number, completed: boolean): Session {
  return {
    id: generateId(),
    type: state.phase,
    startedAt: state.phaseStartedAt as number,
    endedAt: now,
    completed,
    tag: state.currentTag,
    title: state.currentTitle,
    note: state.currentNote,
  };
}

// Note: settings.soundEnabled is stored (see lib/storage/settings.ts and
// the dashboard's SettingsPanel.vue) but not wired to actual audio here —
// chrome.notifications has no cross-browser "silent" option, and playing a
// sound from a service worker needs an offscreen document. Left as a
// stored preference for now rather than faking a feature that doesn't work.
async function notifyPhaseComplete(session: Session): Promise<void> {
  const label = PHASE_LABEL[session.type];
  const message = session.title ? `"${session.title}" — ${label} done.` : `${label} done.`;
  await browser.notifications.create({
    type: "basic",
    iconUrl: browser.runtime.getURL("/icons/icon128.png"),
    title: "Procrastomato",
    message,
  });
}

// Logs a completed Session and advances the phase if the running phase has
// reached its planned duration. Safe to call redundantly — a no-op unless
// the phase is actually due. Called from the alarm, on install/startup, on
// storage changes, and from the "getState" command so the UI never has to
// wait for the next 1-minute tick to see a finished phase.
export async function checkAndComplete(): Promise<TimerState> {
  const settings = await getSettings();
  const state = await getTimerState();
  const now = Date.now();

  if (!engine.isPhaseDue(state, now)) return state;

  const session = buildSessionFromState(state, now, true);
  await appendLog(session);
  const next = engine.completePhase(state, settings);
  await setTimerState(next);
  await notifyPhaseComplete(session);
  await broadcastState(next);
  return next;
}

export async function syncBadgeAndAlarm(): Promise<void> {
  const state = await checkAndComplete();

  if (!engine.isRunning(state)) {
    await browser.action.setBadgeText({ text: "" });
    await browser.alarms.clear(ALARM_NAME);
    return;
  }

  if (state.isPaused) {
    await browser.action.setBadgeBackgroundColor({ color: "#f4a261" });
    await browser.action.setBadgeText({ text: "⏸" });
    await browser.alarms.clear(ALARM_NAME);
    return;
  }

  const minutesLeft = Math.max(0, Math.ceil(engine.computeRemainingSeconds(state, Date.now()) / 60));
  await browser.action.setBadgeBackgroundColor({ color: BADGE_COLOR[state.phase] });
  await browser.action.setBadgeText({ text: String(minutesLeft) });
  await browser.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
}
