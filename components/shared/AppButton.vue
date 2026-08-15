<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: "primary" | "secondary" | "danger" | "ghost";
    type?: "button" | "submit";
  }>(),
  {
    variant: "secondary",
    type: "button",
  }
);
</script>

<template>
  <button
    :type="type"
    class="rounded px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    :class="{
      'bg-red-600 text-white hover:bg-red-700': variant === 'primary',
      'bg-slate-800 text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900': variant === 'secondary',
      'border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-950':
        variant === 'danger',
      'border border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800':
        variant === 'ghost',
    }"
  >
    <slot />
  </button>
</template>
