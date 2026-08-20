<script setup lang="ts">
import { computed, ref } from "vue";
import AppButton from "@/components/shared/AppButton.vue";
import PomodoroSettings from "@/components/timer/PomodoroSettings.vue";
import { useMetricsStore } from "@/stores/metrics";
import { useTimerStore } from "@/stores/timer";
import type { PhaseType } from "@/types/session";

const timer = useTimerStore();
const metrics = useMetricsStore();

const tag = ref("");
const title = ref("");
const note = ref("");
const adjustMinutes = ref<number | null>(null);

// Focus adjusts in 25-minute steps, breaks in 5-minute steps.
const adjustStepMinutes = computed(() => (timer.state.phase === "focus" ? 25 : 5));

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

async function startPhase(phase: PhaseType) {
  await timer.start(phase, {
    tag: tag.value.trim() || undefined,
    title: title.value.trim() || undefined,
    note: note.value.trim() || undefined,
  });
  tag.value = "";
  title.value = "";
  note.value = "";
}

async function handleStart() {
  await startPhase(timer.state.phase);
}

// Break page's extra option to take a long break instead of whatever the
// auto-cycle computed (short break), without waiting for the Nth focus
// session — only shown when that's actually a different choice.
async function handleStartLongBreak() {
  await startPhase("long-break");
}

async function handlePauseResume() {
  if (timer.isPaused) await timer.resume();
  else await timer.pause();
}

// Skip: move on without saving any progress on the current phase.
async function handleSkip() {
  await timer.skip();
}

// Reset: discard progress on the current phase and go back to idle on the
// same phase, ready to start fresh.
async function handleReset() {
  await timer.reset();
}

// End: stop the current phase early but save it as completed "as it is",
// and advance to the next phase (short/long break after focus, focus after
// a break) — unlike Skip, which throws the progress away.
async function handleEnd() {
  await timer.end();
}

async function applyAdjust() {
  if (adjustMinutes.value && adjustMinutes.value > 0) {
    await timer.adjustDuration(adjustMinutes.value);
    adjustMinutes.value = null;
  }
}

async function incrementDuration() {
  const currentMinutes = Math.round(timer.state.phaseDuration / 60);
  await timer.adjustDuration(currentMinutes + adjustStepMinutes.value);
}

async function decrementDuration() {
  const currentMinutes = Math.round(timer.state.phaseDuration / 60);
  await timer.adjustDuration(Math.max(1, currentMinutes - adjustStepMinutes.value));
}
</script>

<template>
  <div>
    <template v-if="!timer.isRunning">
      <form v-if="timer.state.phase === 'focus'" class="space-y-3" @submit.prevent="handleStart">
        <div class="space-y-2">
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
        <PomodoroSettings />
        <AppButton type="submit" variant="primary" class="w-full">{{ nextPhaseLabel }}</AppButton>
      </form>

      <div v-else class="space-y-2">
        <div class="flex gap-2">
          <AppButton variant="primary" class="flex-1" @click="handleSkip">Skip</AppButton>
          <AppButton variant="secondary" class="flex-1" @click="handleStart">
            {{ nextPhaseLabel }}
          </AppButton>
        </div>
        <AppButton
          v-if="timer.state.phase !== 'long-break'"
          variant="ghost"
          class="w-full"
          @click="handleStartLongBreak"
        >
          Start long break
        </AppButton>
      </div>
    </template>

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
        <AppButton
          v-if="timer.state.phase === 'focus'"
          variant="ghost"
          class="flex-1"
          @click="handleReset"
        >
          Reset
        </AppButton>
        <AppButton v-else variant="ghost" class="flex-1" @click="handleSkip">Skip</AppButton>
        <AppButton variant="primary" class="flex-1" @click="handleEnd">End</AppButton>
      </div>
      <div class="flex items-center gap-2 text-sm">
        <span>Adjust minutes ({{ adjustStepMinutes > 0 ? `±${adjustStepMinutes}` : "" }}):</span>
        <AppButton variant="ghost" class="w-8 px-0" @click="decrementDuration">&minus;</AppButton>
        <input
          v-model.number="adjustMinutes"
          type="number"
          min="1"
          max="180"
          class="w-16 rounded border border-slate-300 px-2 py-1 dark:border-slate-600 dark:bg-slate-800"
        />
        <AppButton variant="ghost" class="w-8 px-0" @click="incrementDuration">+</AppButton>
        <AppButton variant="ghost" @click="applyAdjust">Apply</AppButton>
      </div>
    </div>
  </div>
</template>
