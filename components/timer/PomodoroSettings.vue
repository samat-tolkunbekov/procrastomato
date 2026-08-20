<script setup lang="ts">
// Quick-access settings for the idle focus page, collapsed by default.
// Writes straight to the shared Settings object (via metrics.saveSettings)
// so the choice persists and is reflected next time this page is shown —
// same store the dashboard's full SettingsPanel.vue reads/writes.

import { computed, ref } from "vue";
import AppButton from "@/components/shared/AppButton.vue";
import { useMetricsStore } from "@/stores/metrics";

const metrics = useMetricsStore();
const expanded = ref(false);

const POMODORO_MINUTES = 25;
const SHORT_BREAK_OPTIONS = [5, 10, 15, 20];
const LONG_BREAK_OPTIONS = [10, 15, 20, 30, 45];

const pomodoroCount = computed(() =>
  Math.max(1, Math.round(metrics.settings.focusMinutes / POMODORO_MINUTES))
);

// Always include the currently-saved value even if it's not one of the
// preset options, so the <select> doesn't silently jump to a different
// value just because it rendered.
const shortBreakOptions = computed(() =>
  [...new Set([...SHORT_BREAK_OPTIONS, metrics.settings.shortBreakMinutes])].sort((a, b) => a - b)
);
const longBreakOptions = computed(() =>
  [...new Set([...LONG_BREAK_OPTIONS, metrics.settings.longBreakMinutes])].sort((a, b) => a - b)
);

function toggle() {
  expanded.value = !expanded.value;
}

async function incrementPomodoros() {
  await metrics.saveSettings({ focusMinutes: metrics.settings.focusMinutes + POMODORO_MINUTES });
}

async function decrementPomodoros() {
  const next = Math.max(POMODORO_MINUTES, metrics.settings.focusMinutes - POMODORO_MINUTES);
  await metrics.saveSettings({ focusMinutes: next });
}

async function setShortBreakMinutes(event: Event) {
  const minutes = Number((event.target as HTMLSelectElement).value);
  await metrics.saveSettings({ shortBreakMinutes: minutes });
}

async function setLongBreakMinutes(event: Event) {
  const minutes = Number((event.target as HTMLSelectElement).value);
  await metrics.saveSettings({ longBreakMinutes: minutes });
}
</script>

<template>
  <div class="rounded border border-slate-200 dark:border-slate-700">
    <button
      type="button"
      class="flex w-full items-center justify-between px-3 py-2 text-sm font-medium"
      @click="toggle"
    >
      <span>Settings</span>
      <span aria-hidden="true">{{ expanded ? "−" : "+" }}</span>
    </button>
    <div v-if="expanded" class="space-y-3 border-t border-slate-200 px-3 py-3 dark:border-slate-700">
      <div class="flex items-center justify-between text-sm">
        <span class="font-medium">Pomodoros ({{ metrics.settings.focusMinutes }} min)</span>
        <div class="flex items-center gap-2">
          <AppButton variant="ghost" class="w-8 px-0" type="button" @click="decrementPomodoros">
            &minus;
          </AppButton>
          <span class="w-4 text-center tabular-nums">{{ pomodoroCount }}</span>
          <AppButton variant="ghost" class="w-8 px-0" type="button" @click="incrementPomodoros">
            +
          </AppButton>
        </div>
      </div>
      <label class="flex items-center justify-between text-sm font-medium">
        Short break length
        <select
          :value="metrics.settings.shortBreakMinutes"
          class="ml-2 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
          @change="setShortBreakMinutes"
        >
          <option v-for="m in shortBreakOptions" :key="m" :value="m">{{ m }} min</option>
        </select>
      </label>
      <label class="flex items-center justify-between text-sm font-medium">
        Long break length
        <select
          :value="metrics.settings.longBreakMinutes"
          class="ml-2 rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
          @change="setLongBreakMinutes"
        >
          <option v-for="m in longBreakOptions" :key="m" :value="m">{{ m }} min</option>
        </select>
      </label>
    </div>
  </div>
</template>
