<script setup lang="ts">
import { formatDurationHuman } from "@/lib/timer/engine";

defineProps<{
  streakDays: number;
  todayFocusSeconds: number;
  weekFocusSeconds: number;
  goalProgress: number | null;
}>();
</script>

<template>
  <div class="grid grid-cols-3 gap-4">
    <div class="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div class="text-2xl font-semibold">{{ streakDays }}</div>
      <div class="text-sm text-slate-500 dark:text-slate-400">Day streak</div>
    </div>
    <div class="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div class="text-2xl font-semibold">{{ formatDurationHuman(todayFocusSeconds) }}</div>
      <div class="text-sm text-slate-500 dark:text-slate-400">Focus today</div>
      <div
        v-if="goalProgress !== null"
        class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
      >
        <div
          class="h-full bg-emerald-500"
          :style="{ width: Math.min(100, goalProgress * 100) + '%' }"
        ></div>
      </div>
    </div>
    <div class="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div class="text-2xl font-semibold">{{ formatDurationHuman(weekFocusSeconds) }}</div>
      <div class="text-sm text-slate-500 dark:text-slate-400">Focus this week</div>
    </div>
  </div>
</template>
