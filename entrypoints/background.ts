// MV3 service worker. Can be killed and re-woken by the browser at any
// time, so it never keeps its own timer state — it reacts to storage
// changes, incoming messages, and a periodic alarm, recomputing everything
// from the persisted TimerState's timestamps (see lib/timer/engine.ts).

import { browser } from "wxt/browser";
import { STORAGE_KEYS } from "@/lib/storage/keys";
import { ALARM_NAME, syncBadgeAndAlarm } from "@/lib/timer/alarms";
import { handleCommand } from "@/lib/messaging/router";
import type { TimerCommand } from "@/lib/messaging/types";

export default defineBackground(() => {
  browser.runtime.onInstalled.addListener(syncBadgeAndAlarm);
  browser.runtime.onStartup.addListener(syncBadgeAndAlarm);

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && STORAGE_KEYS.timerState in changes) {
      syncBadgeAndAlarm();
    }
  });

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ALARM_NAME) {
      syncBadgeAndAlarm();
    }
  });

  browser.runtime.onMessage.addListener((message: unknown) => {
    return handleCommand(message as TimerCommand);
  });
});
