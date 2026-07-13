<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { subscribe, dismissToast, type ToastItem } from './toast-bus'

const items = ref<ToastItem[]>([])
let unsub: (() => void) | null = null

onMounted(() => {
  unsub = subscribe((list) => {
    items.value = list
  })
})

onUnmounted(() => {
  unsub?.()
})

function colorClass(type: ToastItem['type']): string {
  switch (type) {
    case 'success':
      return 'bg-success text-white'
    case 'error':
      return 'bg-danger text-white'
    case 'info':
      return 'bg-info text-white'
  }
}
</script>

<template>
  <div class="fixed top-4 right-4 z-50 flex flex-col gap-2">
    <transition-group name="toast">
      <div
        v-for="t in items"
        :key="t.id"
        class="px-4 py-2.5 rounded-lg shadow-md ring-1 ring-black/5 text-sm min-w-[220px] max-w-[360px] flex items-center justify-between gap-3"
        :class="colorClass(t.type)"
      >
        <span>{{ t.message }}</span>
        <button
          class="shrink-0 -mr-1 ml-1 w-6 h-6 inline-flex items-center justify-center rounded text-lg leading-none opacity-80 hover:opacity-100 hover:bg-white/15 transition-colors"
          aria-label="关闭"
          @click="dismissToast(t.id)"
        >×</button>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.25s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
