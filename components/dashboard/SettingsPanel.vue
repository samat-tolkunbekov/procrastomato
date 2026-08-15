<script setup lang="ts">
import { reactive, ref, watch } from "vue";
import AppButton from "@/components/shared/AppButton.vue";
import { useMetricsStore } from "@/stores/metrics";

const metrics = useMetricsStore();
const saved = ref(false);

const form = reactive({
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  longBreakInterval: 4,
  soundEnabled: true,
  dailyGoalMinutes: null as number | null,
});

watch(
  () => metrics.settings,
  (settings) => {
    form.focusMinutes = settings.focusMinutes;
    form.shortBreakMinutes = settings.shortBreakMinutes;
    form.longBreakMinutes = settings.longBreakMinutes;
    form.longBreakInterval = settings.longBreakInterval;
    form.soundEnabled = settings.soundEnabled;
    form.dailyGoalMinutes = settings.dailyGoalMinutes;
  },
  { immediate: true }
);

async function handleSubmit() {
  await metrics.saveSettings({ ...form });
  saved.value = true;
  setTimeout(() => {
    saved.value = false;
  }, 1500);
}
</script>

<template>
  <form class="grid grid-cols-2 gap-4" @submit.prevent="handleSubmit">
    <label class="block text-sm font-medium">
      Focus minutes
      <input
        v-model.number="form.focusMinutes"
        type="number"
        min="1"
        max="180"
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
      />
    </label>
    <label class="block text-sm font-medium">
      Short break minutes
      <input
        v-model.number="form.shortBreakMinutes"
        type="number"
        min="1"
        max="60"
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
      />
    </label>
    <label class="block text-sm font-medium">
      Long break minutes
      <input
        v-model.number="form.longBreakMinutes"
        type="number"
        min="1"
        max="120"
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
      />
    </label>
    <label class="block text-sm font-medium">
      Focus sessions between long breaks
      <input
        v-model.number="form.longBreakInterval"
        type="number"
        min="1"
        max="12"
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
      />
    </label>
    <label class="block text-sm font-medium">
      Daily goal (minutes, optional)
      <input
        v-model.number="form.dailyGoalMinutes"
        type="number"
        min="1"
        max="1440"
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
      />
    </label>
    <label class="flex items-center gap-2 text-sm font-medium">
      <input v-model="form.soundEnabled" type="checkbox" />
      Notification sound
    </label>
    <div class="col-span-2 flex items-center gap-3">
      <AppButton type="submit" variant="primary">Save settings</AppButton>
      <span v-if="saved" class="text-sm text-emerald-600">Saved</span>
    </div>
  </form>
</template>
