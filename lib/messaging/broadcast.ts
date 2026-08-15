import { browser } from "wxt/browser";
import type { TimerState } from "../../types/timer";
import type { StateUpdateBroadcast } from "./types";

// Background -> UI broadcast. Split into its own module (rather than living
// in router.ts) so lib/timer/alarms.ts can call it too, without alarms.ts
// and router.ts importing each other.
export async function broadcastState(state: TimerState): Promise<void> {
  try {
    await browser.runtime.sendMessage({ type: "stateUpdate", state } satisfies StateUpdateBroadcast);
  } catch {
    // No popup/dashboard open to receive it — fine, they'll fetch fresh
    // state via a "getState" command the next time they open.
  }
}
