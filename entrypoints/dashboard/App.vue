<script setup lang="ts">
import { onMounted, ref } from "vue";
import FocusChart from "@/components/dashboard/FocusChart.vue";
import SessionHistoryTable from "@/components/dashboard/SessionHistoryTable.vue";
import SettingsPanel from "@/components/dashboard/SettingsPanel.vue";
import StreakCard from "@/components/dashboard/StreakCard.vue";
import ManualLogForm from "@/components/timer/ManualLogForm.vue";
import { useMetricsStore } from "@/stores/metrics";
import type { Session } from "@/types/session";

const metrics = useMetricsStore();
const showForm = ref(false);
const editingSession = ref<Session | null>(null);

onMounted(() => {
  metrics.load();
});

function openAddForm() {
  editingSession.value = null;
  showForm.value = true;
}

function openEditForm(session: Session) {
  editingSession.value = session;
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingSession.value = null;
}
</script>

<template>
  <div class="mx-auto max-w-3xl bg-white p-6 text-slate-900 dark:bg-slate-900 dark:text-slate-100">
    <header class="mb-6">
      <h1 class="text-2xl font-semibold">🍅 Procrastomato — Dashboard</h1>
    </header>

    <section v-if="!metrics.loading" class="space-y-8">
      <StreakCard
        :streak-days="metrics.streakDays"
        :today-focus-seconds="metrics.todayFocusSeconds"
        :week-focus-seconds="metrics.weekFocusSeconds"
        :goal-progress="metrics.goalProgress"
      />

      <div>
        <h2 class="mb-2 text-lg font-semibold">Focus time (last 14 days)</h2>
        <FocusChart :daily-totals="metrics.dailyTotals.slice(-14)" />
      </div>

      <div>
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-lg font-semibold">History</h2>
          <button
            type="button"
            class="text-sm font-medium text-red-600 hover:text-red-700"
            @click="openAddForm"
          >
            + Log a past session
          </button>
        </div>
        <ManualLogForm v-if="showForm" :editing="editingSession" @saved="closeForm" @cancel="closeForm" />
        <SessionHistoryTable class="mt-4" @edit="openEditForm" />
      </div>

      <div>
        <h2 class="mb-2 text-lg font-semibold">Settings</h2>
        <SettingsPanel />
      </div>
    </section>
    <p v-else class="py-12 text-center text-sm text-slate-500">Loading…</p>
  </div>
</template>
