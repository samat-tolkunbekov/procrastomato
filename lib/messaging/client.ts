// UI-side messaging: send typed commands to the background, subscribe to
// its broadcasts. The popup/dashboard are dumb views — they never derive
// timer truth themselves, only send commands and render whatever state
// comes back.

import { browser } from "wxt/browser";
import type { TimerState } from "../../types/timer";
import { isStateUpdateBroadcast } from "./types";
import type { TimerCommand, TimerCommandResult } from "./types";

export async function sendCommand(command: TimerCommand): Promise<TimerCommandResult> {
  return browser.runtime.sendMessage(command);
}

export function onStateUpdate(callback: (state: TimerState) => void): () => void {
  const listener = (message: unknown) => {
    if (isStateUpdateBroadcast(message)) callback(message.state);
  };
  browser.runtime.onMessage.addListener(listener);
  return () => browser.runtime.onMessage.removeListener(listener);
}
