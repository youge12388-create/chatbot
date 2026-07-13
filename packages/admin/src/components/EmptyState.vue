<script setup lang="ts">
withDefaults(
  defineProps<{
    message: string
    icon?: string
  }>(),
  {
    icon: '∅',
  },
)
</script>

<template>
  <div class="flex flex-col items-center justify-center py-16 px-4">
    <div class="text-2xl text-muted/50 mb-2.5 leading-none">{{ icon }}</div>
    <div class="text-sm text-ink-2">{{ message }}</div>
  </div>
</template>
