import { browser } from "wxt/browser";
import { IDLE_TIMER_STATE, type TimerState } from "../../types/timer";
import { STORAGE_KEYS } from "./keys";

export async function getTimerState(): Promise<TimerState> {
  const result = await browser.storage.local.get(STORAGE_KEYS.timerState);
  const stored = result[STORAGE_KEYS.timerState] as TimerState | undefined;
  return stored ? { ...IDLE_TIMER_STATE, ...stored } : structuredClone(IDLE_TIMER_STATE);
}

export async function setTimerState(state: TimerState): Promise<TimerState> {
  await browser.storage.local.set({ [STORAGE_KEYS.timerState]: state });
  return state;
}
