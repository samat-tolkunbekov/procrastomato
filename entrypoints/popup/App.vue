<script setup lang="ts">
import { onMounted } from "vue";
import { browser } from "wxt/browser";
import PhaseControls from "@/components/timer/PhaseControls.vue";
import TimerRing from "@/components/timer/TimerRing.vue";
import { useMetricsStore } from "@/stores/metrics";
import { useTimerStore } from "@/stores/timer";

const timer = useTimerStore();
const metrics = useMetricsStore();

onMounted(() => {
  timer.init();
  metrics.load();
});

function openDashboard() {
  browser.runtime.openOptionsPage();
}
</script>

<template>
  <div class="bg-white p-4 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
    <header class="mb-2 flex items-center justify-between">
      <h1 class="text-lg font-semibold">🍅 Procrastomato</h1>
      <button
        type="button"
        class="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
        @click="openDashboard"
      >
        Dashboard
      </button>
    </header>

    <main v-if="!timer.loading">
      <TimerRing
        :phase="timer.state.phase"
        :progress="timer.progress"
        :countdown="timer.countdown"
        :is-paused="timer.isPaused"
      />
      <PhaseControls />
      <p v-if="timer.error" class="mt-3 text-sm text-red-600">{{ timer.error }}</p>
    </main>
    <p v-else class="py-8 text-center text-sm text-slate-500">Loading…</p>
  </div>
</template>
