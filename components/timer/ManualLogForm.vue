<script setup lang="ts">
import { computed, ref, watch } from "vue";
import AppButton from "@/components/shared/AppButton.vue";
import { useMetricsStore } from "@/stores/metrics";
import type { PhaseType, Session } from "@/types/session";

const props = defineProps<{ editing?: Session | null }>();
const emit = defineEmits<{ saved: []; cancel: [] }>();

const metrics = useMetricsStore();

const type = ref<PhaseType>("focus");
const title = ref("");
const tag = ref("");
const note = ref("");
const startLocal = ref("");
const endLocal = ref("");
const error = ref("");

function toLocalInputValue(epochMs: number): string {
  const d = new Date(epochMs);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function resetForm() {
  type.value = "focus";
  title.value = "";
  tag.value = "";
  note.value = "";
  startLocal.value = "";
  endLocal.value = "";
  error.value = "";
}

watch(
  () => props.editing,
  (session) => {
    if (!session) {
      resetForm();
      return;
    }
    type.value = session.type;
    title.value = session.title || "";
    tag.value = session.tag || "";
    note.value = session.note || "";
    startLocal.value = toLocalInputValue(session.startedAt);
    endLocal.value = toLocalInputValue(session.endedAt);
    error.value = "";
  },
  { immediate: true }
);

const heading = computed(() => (props.editing ? "Edit session" : "Log a past session"));

async function handleSubmit() {
  error.value = "";
  if (!startLocal.value || !endLocal.value) {
    error.value = "Start and end are both required.";
    return;
  }
  const startedAt = new Date(startLocal.value).getTime();
  const endedAt = new Date(endLocal.value).getTime();
  if (endedAt <= startedAt) {
    error.value = "End time must be after start time.";
    return;
  }

  const fields = {
    type: type.value,
    startedAt,
    endedAt,
    tag: tag.value.trim() || undefined,
    title: title.value.trim() || undefined,
    note: note.value.trim() || undefined,
  };

  if (props.editing) {
    await metrics.editSession(props.editing, fields);
  } else {
    await metrics.addManualSession(fields);
  }
  resetForm();
  emit("saved");
}

function handleCancel() {
  resetForm();
  emit("cancel");
}
</script>

<template>
  <form
    class="space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700"
    @submit.prevent="handleSubmit"
  >
    <h2 class="text-base font-semibold">{{ heading }}</h2>
    <label class="block text-sm font-medium">
      Phase
      <select
        v-model="type"
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
      >
        <option value="focus">Focus</option>
        <option value="short-break">Short break</option>
        <option value="long-break">Long break</option>
      </select>
    </label>
    <label class="block text-sm font-medium">
      Title
      <input
        v-model="title"
        type="text"
        maxlength="120"
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
      />
    </label>
    <label class="block text-sm font-medium">
      Tag
      <input
        v-model="tag"
        type="text"
        maxlength="60"
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
      />
    </label>
    <label class="block text-sm font-medium">
      Note
      <textarea
        v-model="note"
        rows="2"
        maxlength="500"
        class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
      ></textarea>
    </label>
    <div class="grid grid-cols-2 gap-3">
      <label class="block text-sm font-medium">
        Start
        <input
          v-model="startLocal"
          type="datetime-local"
          required
          class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
      </label>
      <label class="block text-sm font-medium">
        End
        <input
          v-model="endLocal"
          type="datetime-local"
          required
          class="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
        />
      </label>
    </div>
    <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    <div class="flex gap-2">
      <AppButton type="submit" variant="primary">Save</AppButton>
      <AppButton variant="ghost" type="button" @click="handleCancel">Cancel</AppButton>
    </div>
  </form>
</template>
