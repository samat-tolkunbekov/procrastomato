// MV3 service worker. Can be killed and re-woken by Chrome at any time, so
// it never keeps its own timer state — it just reacts to storage changes and
// a periodic alarm, recomputing everything from stored timestamps.

import { getState, getActiveSession, checkAndCompleteActiveSession } from "./storage.js";
import { computeRemainingSeconds } from "./timer.js";

const ALARM_NAME = "procrastomato-tick";

async function notifyCompletion(session) {
  chrome.notifications.create({
    type: "basic",
    iconUrl: chrome.runtime.getURL("icons/icon128.png"),
    title: "Pomodoro complete",
    message: session.title ? `"${session.title}" is done.` : "Your pomodoro session is done.",
  });
}

async function checkCompletion() {
  await checkAndCompleteActiveSession(notifyCompletion);
}

async function syncBadgeAndAlarm() {
  const state = await getState();
  const session = getActiveSession(state);

  if (!session) {
    await chrome.action.setBadgeText({ text: "" });
    await chrome.alarms.clear(ALARM_NAME);
    return;
  }

  if (session.status === "paused") {
    await chrome.action.setBadgeBackgroundColor({ color: "#f4a261" });
    await chrome.action.setBadgeText({ text: "⏸" });
    await chrome.alarms.clear(ALARM_NAME);
    return;
  }

  const minutesLeft = Math.max(0, Math.ceil(computeRemainingSeconds(session) / 60));
  await chrome.action.setBadgeBackgroundColor({ color: "#e63946" });
  await chrome.action.setBadgeText({ text: String(minutesLeft) });
  chrome.alarms.create(ALARM_NAME, { periodInMinutes: 1 });
}

async function sync() {
  await checkCompletion();
  await syncBadgeAndAlarm();
}

chrome.runtime.onInstalled.addListener(sync);
chrome.runtime.onStartup.addListener(sync);

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && "procrastomatoState" in changes) {
    sync();
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === ALARM_NAME) {
    sync();
  }
});
