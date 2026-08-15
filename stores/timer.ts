// Pinia store — mirrors the background's TimerState and dispatches commands
// to it. This store never invents its own countdown truth: `nowMs` just
// re-triggers the computed getters below to re-derive elapsed/remaining
// from the same timestamps the background persisted, once a second, purely
// for a smooth display (same role as the old popup.js's tick()).

import { defineStore } from "pinia";
import { computed, onScopeDispose, ref, watch } from "vue";
import { onStateUpdate, sendCommand } from "@/lib/messaging/client";
import type { SessionMeta, TimerCommandResult } from "@/lib/messaging/types";
import * as engine from "@/lib/timer/engine";
import type { PhaseType } from "@/types/session";
import { IDLE_TIMER_STATE, type TimerState } from "@/types/timer";

export const useTimerStore = defineStore("timer", () => {
  const state = ref<TimerState>(structuredClone(IDLE_TIMER_STATE));
  const nowMs = ref(Date.now());
  const loading = ref(true);
  const error = ref<string | null>(null);

  let tickHandle: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;
  let completionCheckInFlight = false;

  function applyResult(result: TimerCommandResult): TimerCommandResult {
    if (result.ok) {
      state.value = result.state;
      error.value = null;
    } else {
      error.value = result.error;
    }
    return result;
  }

  async function init(): Promise<void> {
    loading.value = true;
    applyResult(await sendCommand({ type: "getState" }));
    loading.value = false;

    if (!unsubscribe) {
      unsubscribe = onStateUpdate((next) => {
        state.value = next;
      });
    }
    if (!tickHandle) {
      tickHandle = setInterval(() => {
        nowMs.value = Date.now();
      }, 1000);
    }
  }

  function dispose(): void {
    if (tickHandle) clearInterval(tickHandle);
    tickHandle = undefined;
    unsubscribe?.();
    unsubscribe = undefined;
  }

  onScopeDispose(dispose);

  async function start(phase: PhaseType, meta?: SessionMeta) {
    return applyResult(await sendCommand({ type: "start", phase, meta }));
  }
  async function pause() {
    return applyResult(await sendCommand({ type: "pause" }));
  }
  async function resume() {
    return applyResult(await sendCommand({ type: "resume" }));
  }
  async function skip() {
    return applyResult(await sendCommand({ type: "skip" }));
  }
  async function adjustDuration(minutes: number) {
    return applyResult(await sendCommand({ type: "adjustDuration", minutes }));
  }
  async function updateCurrentMeta(meta: SessionMeta) {
    return applyResult(await sendCommand({ type: "updateCurrentMeta", meta }));
  }

  const isRunning = computed(() => engine.isRunning(state.value));
  const isPaused = computed(() => state.value.isPaused);
  const remainingSeconds = computed(() => engine.computeRemainingSeconds(state.value, nowMs.value));
  const elapsedSeconds = computed(() => engine.computeElapsedSeconds(state.value, nowMs.value));
  const countdown = computed(() => engine.formatMMSS(Math.max(0, remainingSeconds.value)));
  const progress = computed(() => {
    if (!state.value.phaseDuration) return 0;
    return Math.min(1, Math.max(0, elapsedSeconds.value / state.value.phaseDuration));
  });

  // The background alarm only ticks once a minute — if the local display
  // notices remaining time hit zero first, re-fetch state right away
  // (getState triggers the same completion check background does) rather
  // than sitting on a stale 00:00 until the next alarm.
  watch(remainingSeconds, (value) => {
    if (completionCheckInFlight) return;
    if (isRunning.value && !isPaused.value && value <= 0) {
      completionCheckInFlight = true;
      init().finally(() => {
        completionCheckInFlight = false;
      });
    }
  });

  return {
    state,
    loading,
    error,
    isRunning,
    isPaused,
    remainingSeconds,
    elapsedSeconds,
    countdown,
    progress,
    init,
    dispose,
    start,
    pause,
    resume,
    skip,
    adjustDuration,
    updateCurrentMeta,
  };
});
