import type { PhaseType } from "./session";

// The single source of truth for the running timer, persisted to
// chrome.storage.local under STORAGE_KEYS.timerState. Never keeps "seconds
// remaining" as mutable state — phaseStartedAt/pausedAt/pausedElapsed are
// timestamps/derived-durations that remaining time is always computed from
// (see lib/timer/engine.ts), so a killed-and-restarted service worker loses
// nothing.
export interface TimerState {
  phase: PhaseType;
  phaseStartedAt: number | null; // epoch ms; null when idle (nothing running)
  phaseDuration: number; // seconds
  isPaused: boolean;
  pausedAt: number | null; // epoch ms the current pause started, if paused
  pausedElapsed: number; // seconds accumulated from previously-completed pauses this phase
  focusSessionsCompleted: number; // count since the last long break, drives phase cycling
  currentTag?: string;
  currentTitle?: string;
  currentNote?: string;
}

export const IDLE_TIMER_STATE: TimerState = {
  phase: "focus",
  phaseStartedAt: null,
  phaseDuration: 0,
  isPaused: false,
  pausedAt: null,
  pausedElapsed: 0,
  focusSessionsCompleted: 0,
};
