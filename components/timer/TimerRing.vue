<script setup lang="ts">
import { computed } from "vue";
import type { PhaseType } from "@/types/session";

const props = defineProps<{
  phase: PhaseType;
  progress: number;
  countdown: string;
  isPaused: boolean;
}>();

const PHASE_LABEL: Record<PhaseType, string> = {
  focus: "Focus",
  "short-break": "Short break",
  "long-break": "Long break",
};

const PHASE_COLOR: Record<PhaseType, string> = {
  focus: "#e63946",
  "short-break": "#2a9d8f",
  "long-break": "#264653",
};

const radius = 54;
const circumference = 2 * Math.PI * radius;
const dashOffset = computed(() => circumference * (1 - Math.min(1, Math.max(0, props.progress))));
const color = computed(() => PHASE_COLOR[props.phase]);
const label = computed(() => PHASE_LABEL[props.phase]);
</script>

<template>
  <div class="flex flex-col items-center py-4">
    <div class="relative flex h-36 w-36 items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 120 120" class="-rotate-90">
        <circle
          cx="60"
          cy="60"
          :r="radius"
          fill="none"
          stroke="currentColor"
          stroke-width="8"
          class="text-slate-200 dark:text-slate-700"
        />
        <circle
          cx="60"
          cy="60"
          :r="radius"
          fill="none"
          :stroke="color"
          stroke-width="8"
          stroke-linecap="round"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="dashOffset"
          style="transition: stroke-dashoffset 0.3s linear"
        />
      </svg>
      <div class="absolute flex flex-col items-center">
        <span class="font-mono text-3xl font-semibold tabular-nums">{{ countdown }}</span>
        <span class="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {{ label }}<template v-if="isPaused"> · Paused</template>
        </span>
      </div>
    </div>
  </div>
</template>
