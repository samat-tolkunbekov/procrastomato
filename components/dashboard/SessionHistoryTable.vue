<script setup lang="ts">
import { computed } from "vue";
import AppButton from "@/components/shared/AppButton.vue";
import { formatDurationHuman } from "@/lib/timer/engine";
import { useMetricsStore } from "@/stores/metrics";
import type { Session } from "@/types/session";

const metrics = useMetricsStore();
const emit = defineEmits<{ edit: [session: Session] }>();

const PHASE_LABEL: Record<Session["type"], string> = {
  focus: "Focus",
  "short-break": "Short break",
  "long-break": "Long break",
};

const sorted = computed(() => [...metrics.sessions].sort((a, b) => b.startedAt - a.startedAt));

function formatDateTime(epochMs: number): string {
  return new Date(epochMs).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

async function handleDelete(session: Session) {
  const label = PHASE_LABEL[session.type].toLowerCase();
  if (confirm(`Delete this ${label} entry? This can't be undone.`)) {
    await metrics.removeSession(session);
  }
}
</script>

<template>
  <div class="overflow-x-auto">
    <table class="w-full text-left text-sm">
      <thead>
        <tr class="border-b border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400">
          <th class="py-2 pr-4 font-medium">When</th>
          <th class="py-2 pr-4 font-medium">Phase</th>
          <th class="py-2 pr-4 font-medium">Title / Tag</th>
          <th class="py-2 pr-4 font-medium">Duration</th>
          <th class="py-2 pr-4 font-medium">Status</th>
          <th class="py-2 font-medium"></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="session in sorted"
          :key="session.id"
          class="border-b border-slate-100 dark:border-slate-800"
        >
          <td class="whitespace-nowrap py-2 pr-4">{{ formatDateTime(session.startedAt) }}</td>
          <td class="py-2 pr-4">{{ PHASE_LABEL[session.type] }}</td>
          <td class="py-2 pr-4">
            <div v-if="session.title">{{ session.title }}</div>
            <div v-if="session.tag" class="text-xs text-slate-500 dark:text-slate-400">{{ session.tag }}</div>
          </td>
          <td class="py-2 pr-4">
            {{ formatDurationHuman((session.endedAt - session.startedAt) / 1000) }}
          </td>
          <td class="py-2 pr-4">{{ session.completed ? "Completed" : "Skipped" }}</td>
          <td class="py-2 text-right whitespace-nowrap">
            <AppButton variant="ghost" class="mr-2 px-2 py-1 text-xs" @click="emit('edit', session)">
              Edit
            </AppButton>
            <AppButton variant="danger" class="px-2 py-1 text-xs" @click="handleDelete(session)">
              Delete
            </AppButton>
          </td>
        </tr>
        <tr v-if="sorted.length === 0">
          <td colspan="6" class="py-6 text-center text-slate-500 dark:text-slate-400">
            No sessions yet.
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
