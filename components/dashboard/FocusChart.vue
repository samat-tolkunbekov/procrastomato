<script setup lang="ts">
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  Title,
  Tooltip,
} from "chart.js";
import { computed } from "vue";
import { Bar } from "vue-chartjs";
import type { DailyTotal } from "@/lib/metrics/aggregate";

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const props = defineProps<{ dailyTotals: DailyTotal[] }>();

const chartData = computed(() => ({
  labels: props.dailyTotals.map((d) => d.date.slice(5)), // MM-DD
  datasets: [
    {
      label: "Focus minutes",
      backgroundColor: "#e63946",
      borderRadius: 4,
      data: props.dailyTotals.map((d) => Math.round(d.focusSeconds / 60)),
    },
  ],
}));

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true } },
};
</script>

<template>
  <div class="h-64">
    <p v-if="dailyTotals.length === 0" class="flex h-full items-center justify-center text-sm text-slate-500 dark:text-slate-400">
      No focus sessions logged yet.
    </p>
    <Bar v-else :data="chartData" :options="chartOptions" />
  </div>
</template>
