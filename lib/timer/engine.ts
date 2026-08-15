// Pure phase-cycling timer functions — no chrome.*/browser.* calls, so this
// is unit-testable with plain Vitest and safe to call from a service worker
// that may be woken up cold at any time (see CLAUDE.md: "why timestamps,
// not a ticking counter"). "Seconds remaining" is never stored — everything
// here is derived from TimerState's timestamps at the moment it's needed.

import type { PhaseType } from "../../types/session";
import type { Settings } from "../../types/settings";
import { IDLE_TIMER_STATE, type TimerState } from "../../types/timer";

export function durationSecondsForPhase(phase: PhaseType, settings: Settings): number {
  switch (phase) {
    case "focus":
      return settings.focusMinutes * 60;
    case "short-break":
      return settings.shortBreakMinutes * 60;
    case "long-break":
      return settings.longBreakMinutes * 60;
  }
}

// What phase should follow the completion (or skip) of `finishedPhase`,
// given the focus-session count *after* this one (pass the pre-increment
// count when skipping a focus phase, since it didn't complete).
export function nextPhaseType(
  finishedPhase: PhaseType,
  focusSessionsCompleted: number,
  settings: Settings
): PhaseType {
  if (finishedPhase !== "focus") return "focus";
  const interval = Math.max(1, settings.longBreakInterval);
  return focusSessionsCompleted % interval === 0 ? "long-break" : "short-break";
}

export function isRunning(state: TimerState): boolean {
  return state.phaseStartedAt !== null;
}

// Seconds accumulated from pauses so far, including the pause in progress
// (if any) as of `now`.
export function totalPausedSeconds(state: TimerState, now: number): number {
  if (!state.isPaused || state.pausedAt === null) return state.pausedElapsed;
  return state.pausedElapsed + Math.max(0, (now - state.pausedAt) / 1000);
}

// Elapsed active (non-paused) seconds since the phase started.
export function computeElapsedSeconds(state: TimerState, now: number): number {
  if (state.phaseStartedAt === null) return 0;
  const raw = (now - state.phaseStartedAt) / 1000;
  return Math.max(0, raw - totalPausedSeconds(state, now));
}

export function computeRemainingSeconds(state: TimerState, now: number): number {
  return state.phaseDuration - computeElapsedSeconds(state, now);
}

export function isPhaseDue(state: TimerState, now: number): boolean {
  return isRunning(state) && computeRemainingSeconds(state, now) <= 0;
}

export function formatMMSS(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatDurationHuman(totalSeconds: number): string {
  const clamped = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(clamped / 60);
  const seconds = clamped % 60;
  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

// ---------- Reducers: (state, ...) -> new TimerState ----------

export interface StartMeta {
  tag?: string;
  title?: string;
  note?: string;
}

export function start(
  state: TimerState,
  phase: PhaseType,
  settings: Settings,
  now: number,
  meta: StartMeta = {}
): TimerState {
  return {
    ...state,
    phase,
    phaseStartedAt: now,
    phaseDuration: durationSecondsForPhase(phase, settings),
    isPaused: false,
    pausedAt: null,
    pausedElapsed: 0,
    currentTag: meta.tag,
    currentTitle: meta.title,
    currentNote: meta.note,
  };
}

export function pause(state: TimerState, now: number): TimerState {
  if (!isRunning(state) || state.isPaused) return state;
  return { ...state, isPaused: true, pausedAt: now };
}

export function resume(state: TimerState, now: number): TimerState {
  if (!state.isPaused || state.pausedAt === null) return state;
  return {
    ...state,
    isPaused: false,
    pausedAt: null,
    pausedElapsed: state.pausedElapsed + Math.max(0, (now - state.pausedAt) / 1000),
  };
}

export function adjustDuration(state: TimerState, minutes: number): TimerState {
  if (!isRunning(state)) return state;
  return { ...state, phaseDuration: minutes * 60 };
}

// Ends the current phase without crediting a focus-session toward the
// long-break cycle count, and parks the timer idle on whatever phase should
// come next (caller is responsible for logging a Session with
// completed: false before/after calling this).
export function skip(state: TimerState, settings: Settings): TimerState {
  const upcoming = nextPhaseType(state.phase, state.focusSessionsCompleted, settings);
  return {
    ...IDLE_TIMER_STATE,
    phase: upcoming,
    focusSessionsCompleted: state.focusSessionsCompleted,
  };
}

// Ends the current phase because its time is up, crediting a completed
// focus session toward the cycle count when applicable, and parks the
// timer idle on the next phase. Caller logs a Session with completed: true.
export function completePhase(state: TimerState, settings: Settings): TimerState {
  const focusSessionsCompleted =
    state.phase === "focus" ? state.focusSessionsCompleted + 1 : state.focusSessionsCompleted;
  const upcoming = nextPhaseType(state.phase, focusSessionsCompleted, settings);
  return {
    ...IDLE_TIMER_STATE,
    phase: upcoming,
    focusSessionsCompleted,
  };
}
