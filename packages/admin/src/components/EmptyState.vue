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
  <div class="flex flex-col items-center justify-center py-16 text-muted">
    <div class="text-3xl mb-3 opacity-50">{{ icon }}</div>
    <div class="text-sm">{{ message }}</div>
  </div>
</template>
