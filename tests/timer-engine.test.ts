import { describe, expect, it } from "vitest";
import {
  adjustDuration,
  completePhase,
  computeElapsedSeconds,
  computeRemainingSeconds,
  durationSecondsForPhase,
  formatDurationHuman,
  formatMMSS,
  isPhaseDue,
  nextPhaseType,
  pause,
  reset,
  resume,
  skip,
  start,
} from "../lib/timer/engine";
import { DEFAULT_SETTINGS } from "../types/settings";
import { IDLE_TIMER_STATE } from "../types/timer";

const T0 = 1_700_000_000_000;

describe("durationSecondsForPhase", () => {
  it("maps each phase to its configured minutes", () => {
    expect(durationSecondsForPhase("focus", DEFAULT_SETTINGS)).toBe(25 * 60);
    expect(durationSecondsForPhase("short-break", DEFAULT_SETTINGS)).toBe(5 * 60);
    expect(durationSecondsForPhase("long-break", DEFAULT_SETTINGS)).toBe(15 * 60);
  });
});

describe("nextPhaseType", () => {
  it("sends focus sessions to a short break, except every Nth to a long break", () => {
    const settings = { ...DEFAULT_SETTINGS, longBreakInterval: 4 };
    expect(nextPhaseType("focus", 1, settings)).toBe("short-break");
    expect(nextPhaseType("focus", 2, settings)).toBe("short-break");
    expect(nextPhaseType("focus", 3, settings)).toBe("short-break");
    expect(nextPhaseType("focus", 4, settings)).toBe("long-break");
    expect(nextPhaseType("focus", 8, settings)).toBe("long-break");
  });

  it("always returns to focus after any break", () => {
    expect(nextPhaseType("short-break", 0, DEFAULT_SETTINGS)).toBe("focus");
    expect(nextPhaseType("long-break", 0, DEFAULT_SETTINGS)).toBe("focus");
  });
});

describe("elapsed/remaining derivation", () => {
  it("computes elapsed and remaining from timestamps alone", () => {
    const state = start(IDLE_TIMER_STATE, "focus", DEFAULT_SETTINGS, T0);
    const now = T0 + 10 * 60 * 1000; // 10 minutes later
    expect(computeElapsedSeconds(state, now)).toBe(600);
    expect(computeRemainingSeconds(state, now)).toBe(25 * 60 - 600);
    expect(isPhaseDue(state, now)).toBe(false);
  });

  it("is due once remaining time reaches zero", () => {
    const state = start(IDLE_TIMER_STATE, "focus", DEFAULT_SETTINGS, T0);
    const now = T0 + 25 * 60 * 1000;
    expect(isPhaseDue(state, now)).toBe(true);
  });

  it("excludes paused time from elapsed, and freezes remaining while paused", () => {
    let state = start(IDLE_TIMER_STATE, "focus", DEFAULT_SETTINGS, T0);
    state = pause(state, T0 + 5 * 60 * 1000); // pause at 5m elapsed
    const duringPause = T0 + 15 * 60 * 1000; // 10m into the pause
    expect(computeElapsedSeconds(state, duringPause)).toBe(5 * 60);

    state = resume(state, duringPause); // resume after a 10m pause
    const afterResume = T0 + 20 * 60 * 1000; // 5m of active work after resuming
    expect(computeElapsedSeconds(state, afterResume)).toBe(10 * 60);
  });

  it("returns zero elapsed and remaining=phaseDuration when idle", () => {
    expect(computeElapsedSeconds(IDLE_TIMER_STATE, T0)).toBe(0);
    expect(isPhaseDue(IDLE_TIMER_STATE, T0)).toBe(false);
  });
});

describe("adjustDuration", () => {
  it("changes phaseDuration on a running phase without touching elapsed time", () => {
    let state = start(IDLE_TIMER_STATE, "focus", DEFAULT_SETTINGS, T0);
    state = adjustDuration(state, 30);
    expect(state.phaseDuration).toBe(30 * 60);
    expect(computeRemainingSeconds(state, T0)).toBe(30 * 60);
  });

  it("is a no-op when idle", () => {
    expect(adjustDuration(IDLE_TIMER_STATE, 30)).toEqual(IDLE_TIMER_STATE);
  });
});

describe("skip", () => {
  it("does not credit a focus session and advances to the phase that would follow it", () => {
    const settings = { ...DEFAULT_SETTINGS, longBreakInterval: 4 };
    let state = { ...IDLE_TIMER_STATE, focusSessionsCompleted: 3 };
    state = start(state, "focus", settings, T0);
    state = skip(state, settings);
    expect(state.focusSessionsCompleted).toBe(3);
    expect(state.phase).toBe("short-break"); // 3+1 would be a long break, but skip doesn't credit it
    expect(state.phaseStartedAt).toBeNull();
  });
});

describe("reset", () => {
  it("aborts the running phase back to idle without advancing to the next phase", () => {
    const settings = { ...DEFAULT_SETTINGS, longBreakInterval: 4 };
    let state = { ...IDLE_TIMER_STATE, focusSessionsCompleted: 3 };
    state = start(state, "focus", settings, T0);
    state = reset(state);
    expect(state.phase).toBe("focus"); // stays put, unlike skip which moves on
    expect(state.focusSessionsCompleted).toBe(3);
    expect(state.phaseStartedAt).toBeNull();
  });

  it("is a no-op when idle", () => {
    expect(reset(IDLE_TIMER_STATE)).toEqual(IDLE_TIMER_STATE);
  });
});

describe("completePhase", () => {
  it("credits a completed focus session and cycles to a long break on the Nth", () => {
    const settings = { ...DEFAULT_SETTINGS, longBreakInterval: 2 };
    let state = { ...IDLE_TIMER_STATE, focusSessionsCompleted: 1 };
    state = start(state, "focus", settings, T0);
    state = completePhase(state, settings);
    expect(state.focusSessionsCompleted).toBe(2);
    expect(state.phase).toBe("long-break");
    expect(state.phaseStartedAt).toBeNull();
    expect(state.isPaused).toBe(false);
  });

  it("returns to focus after a break completes, without changing the count", () => {
    let state = { ...IDLE_TIMER_STATE, focusSessionsCompleted: 2 };
    state = start(state, "short-break", DEFAULT_SETTINGS, T0);
    state = completePhase(state, DEFAULT_SETTINGS);
    expect(state.focusSessionsCompleted).toBe(2);
    expect(state.phase).toBe("focus");
  });
});

describe("formatMMSS / formatDurationHuman", () => {
  it("formats mm:ss with zero-padding", () => {
    expect(formatMMSS(65)).toBe("01:05");
    expect(formatMMSS(0)).toBe("00:00");
    expect(formatMMSS(-5)).toBe("00:00");
  });

  it("formats human-readable durations", () => {
    expect(formatDurationHuman(90)).toBe("1m 30s");
    expect(formatDurationHuman(60)).toBe("1m");
    expect(formatDurationHuman(45)).toBe("45s");
  });
});
