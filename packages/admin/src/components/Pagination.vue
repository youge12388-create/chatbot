<script setup lang="ts">
defineProps<{
  page: number
  totalPages: number
  total: number
}>()

const emit = defineEmits<{
  (e: 'change', page: number): void
}>()

function go(p: number) {
  emit('change', p)
}
</script>

<template>
  <div class="flex items-center justify-between gap-3 px-1 py-3 text-sm">
    <div class="text-muted">共 {{ total }} 条</div>
    <div class="flex items-center gap-1">
      <button
        class="px-3 py-1.5 rounded border border-border bg-bg hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        :disabled="page <= 1"
        @click="go(page - 1)"
      >
        上一页
      </button>
      <span class="px-3 py-1.5 text-ink">
        {{ page }} / {{ Math.max(totalPages, 1) }}
      </span>
      <button
        class="px-3 py-1.5 rounded border border-border bg-bg hover:bg-surface disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        :disabled="page >= totalPages"
        @click="go(page + 1)"
      >
        下一页
      </button>
    </div>
  </div>
</template>
