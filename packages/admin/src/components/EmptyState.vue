<script setup lang="ts">
import AppIcon, { type IconName } from './AppIcon.vue'

withDefaults(
  defineProps<{
    message: string
    icon?: IconName
  }>(),
  {
    icon: 'grid',
  },
)
</script>

<template>
  <div class="empty-state">
    <div class="empty-state-icon"><AppIcon :name="icon" :size="46" :stroke-width="1.25" /></div>
    <div class="empty-state-message">{{ message }}</div>
  </div>
</template>