<script setup lang="ts">
defineProps<{
  page: number
  totalPages: number
  total: number
}>()

const emit = defineEmits<{
  (e: 'change', page: number): void
}>()
</script>

<template>
  <div class="flex items-center justify-between gap-3 px-1 py-3 text-sm">
    <div class="text-muted">共 <span class="text-ink-2 font-medium">{{ total }}</span> 条</div>
    <div class="flex items-center gap-1">
      <button
        class="btn btn-sm"
        :disabled="page <= 1"
        @click="emit('change', page - 1)"
      >
        上一页
      </button>
      <span class="px-3 py-1.5 text-ink-2 tabular-nums">
        {{ page }} / {{ Math.max(totalPages, 1) }}
      </span>
      <button
        class="btn btn-sm"
        :disabled="page >= totalPages"
        @click="emit('change', page + 1)"
      >
        下一页
      </button>
    </div>
  </div>
</template>
