<script setup lang="ts">
import { computed, ref } from "vue";
import AppButton from "@/components/shared/AppButton.vue";
import { useMetricsStore } from "@/stores/metrics";
import { useTimerStore } from "@/stores/timer";

const timer = useTimerStore();
const metrics = useMetricsStore();

const tag = ref("");
const title = ref("");
const note = ref("");
const adjustMinutes = ref<number | null>(null);

const nextPhaseLabel = computed(() => {
  switch (timer.state.phase) {
    case "focus":
      return "Start focus";
    case "short-break":
      return "Start short break";
    case "long-break":
      return "Start long break";
  }
});

async function handleStart() {
  await timer.start(timer.state.phase, {
    tag: tag.value.trim() || undefined,
    title: title.value.trim() || undefined,
    note: note.value.trim() || undefined,
  });
  tag.value = "";
  title.value = "";
  note.value = "";
}

async function handlePauseResume() {
  if (timer.isPaused) await timer.resume();
  else await timer.pause();
}

async function handleSkip() {
  await timer.skip();
}

async function applyAdjust() {
  if (adjustMinutes.value && adjustMinutes.value > 0) {
    await timer.adjustDuration(adjustMinutes.value);
    adjustMinutes.value = null;
  }
}
</script>

<template>
  <div>
    <form v-if="!timer.isRunning" class="space-y-3" @submit.prevent="handleStart">
      <div v-if="timer.state.phase === 'focus'" class="space-y-2">
        <label class="block text-sm font-medium">
          Title
          <input
            v-model="title"
            type="text"
            maxlength="120"
            list="title-suggestions"
            placeholder="What are you working on?"
            class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </label>
        <label class="block text-sm font-medium">
          Tag
          <input
            v-model="tag"
            type="text"
            maxlength="60"
            list="tag-suggestions"
            placeholder="Optional"
            class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
          />
        </label>
        <label class="block text-sm font-medium">
          Note
          <textarea
            v-model="note"
            rows="2"
            maxlength="500"
            placeholder="Optional"
            class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
          ></textarea>
        </label>
        <datalist id="title-suggestions">
          <option v-for="t in metrics.titleSuggestions" :key="t" :value="t" />
        </datalist>
        <datalist id="tag-suggestions">
          <option v-for="t in metrics.tagSuggestions" :key="t" :value="t" />
        </datalist>
      </div>
      <AppButton type="submit" variant="primary" class="w-full">{{ nextPhaseLabel }}</AppButton>
    </form>

    <div v-else class="space-y-3">
      <div v-if="timer.state.currentTitle || timer.state.currentTag" class="text-center text-sm">
        <div v-if="timer.state.currentTitle" class="font-medium">{{ timer.state.currentTitle }}</div>
        <div v-if="timer.state.currentTag" class="text-slate-500 dark:text-slate-400">
          {{ timer.state.currentTag }}
        </div>
      </div>
      <div class="flex gap-2">
        <AppButton class="flex-1" @click="handlePauseResume">
          {{ timer.isPaused ? "Resume" : "Pause" }}
        </AppButton>
        <AppButton variant="ghost" class="flex-1" @click="handleSkip">Skip</AppButton>
      </div>
      <div class="flex items-center gap-2 text-sm">
        <span>Adjust minutes:</span>
        <input
          v-model.number="adjustMinutes"
          type="number"
          min="1"
          max="180"
          class="w-16 rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
        />
        <AppButton variant="ghost" @click="applyAdjust">Apply</AppButton>
      </div>
    </div>
  </div>
</template>
