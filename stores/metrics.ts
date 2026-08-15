// Pinia store — derived stats over session logs (dashboard's data source).
// Talks to lib/storage/logs.ts directly rather than through the background:
// unlike the live timer (which the background arbitrates to avoid races),
// log CRUD has no concurrent-writer risk, matching the old plain-JS
// popup.js's pattern of calling storage.js mutators directly.

import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { generateId } from "@/lib/id";
import {
  appendLog,
  dateKeyFor,
  deleteLogEntry,
  getLogsInRange,
  getTagSuggestions,
  getTitleSuggestions,
  moveLogEntry,
  updateLogEntry,
} from "@/lib/storage/logs";
import { getSettings, updateSettings } from "@/lib/storage/settings";
import {
  currentStreakDays,
  dailyFocusTotals,
  dailyGoalProgress,
  totalFocusSeconds,
} from "@/lib/metrics/aggregate";
import type { Session } from "@/types/session";
import { DEFAULT_SETTINGS, type Settings } from "@/types/settings";

const LOOKBACK_DAYS = 60;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export interface ManualSessionInput {
  type: Session["type"];
  startedAt: number;
  endedAt: number;
  tag?: string;
  title?: string;
  note?: string;
}

export const useMetricsStore = defineStore("metrics", () => {
  const sessions = ref<Session[]>([]);
  const settings = ref<Settings>(structuredClone(DEFAULT_SETTINGS));
  const tagSuggestions = ref<string[]>([]);
  const titleSuggestions = ref<string[]>([]);
  const loading = ref(true);

  async function load(): Promise<void> {
    loading.value = true;
    const now = Date.now();
    const [logs, currentSettings, tags, titles] = await Promise.all([
      getLogsInRange(now - LOOKBACK_DAYS * 24 * 60 * 60 * 1000, now),
      getSettings(),
      getTagSuggestions(),
      getTitleSuggestions(),
    ]);
    sessions.value = logs;
    settings.value = currentSettings;
    tagSuggestions.value = tags;
    titleSuggestions.value = titles;
    loading.value = false;
  }

  const dailyTotals = computed(() => dailyFocusTotals(sessions.value));
  const todayKey = computed(() => dateKeyFor(Date.now()));
  const todayFocusSeconds = computed(
    () => dailyTotals.value.find((d) => d.date === todayKey.value)?.focusSeconds ?? 0
  );
  const weekFocusSeconds = computed(() => {
    const weekAgo = Date.now() - WEEK_MS;
    return totalFocusSeconds(sessions.value.filter((s) => s.startedAt >= weekAgo));
  });
  const streakDays = computed(() => currentStreakDays(sessions.value, todayKey.value));
  const goalProgress = computed(() =>
    dailyGoalProgress(todayFocusSeconds.value, settings.value.dailyGoalMinutes)
  );

  async function addManualSession(input: ManualSessionInput): Promise<Session> {
    const session: Session = { id: generateId(), completed: true, ...input };
    await appendLog(session);
    await load();
    return session;
  }

  async function editSession(session: Session, fields: Partial<Session>): Promise<void> {
    const oldKey = dateKeyFor(session.startedAt);
    if (fields.startedAt !== undefined && dateKeyFor(fields.startedAt) !== oldKey) {
      await moveLogEntry(oldKey, { ...session, ...fields });
    } else {
      await updateLogEntry(oldKey, session.id, fields);
    }
    await load();
  }

  async function removeSession(session: Session): Promise<void> {
    await deleteLogEntry(dateKeyFor(session.startedAt), session.id);
    await load();
  }

  async function saveSettings(fields: Partial<Settings>): Promise<void> {
    settings.value = await updateSettings(fields);
  }

  return {
    sessions,
    settings,
    tagSuggestions,
    titleSuggestions,
    loading,
    dailyTotals,
    todayFocusSeconds,
    weekFocusSeconds,
    streakDays,
    goalProgress,
    load,
    addManualSession,
    editSession,
    removeSession,
    saveSettings,
  };
});
