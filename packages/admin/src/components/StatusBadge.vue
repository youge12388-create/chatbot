<script setup lang="ts">
import { computed } from 'vue'
import type { LeadStatus, ConversationStatus } from '../types'

const props = defineProps<{
  status: LeadStatus | ConversationStatus
  type: 'lead' | 'conversation'
}>()

const leadColors: Record<LeadStatus, string> = {
  new: 'bg-accent/15 text-accent',
  following: 'bg-info/15 text-info',
  contacted: 'bg-[oklch(0.55_0.13_290)]/15 text-[oklch(0.55_0.13_290)]',
  converted: 'bg-success/15 text-success',
  discarded: 'bg-muted/15 text-muted',
}

const convColors: Record<ConversationStatus, string> = {
  active: 'bg-success/15 text-success',
  taken_over: 'bg-accent/15 text-accent',
  transferred: 'bg-info/15 text-info',
  closed: 'bg-muted/15 text-muted',
}

const leadLabels: Record<LeadStatus, string> = {
  new: '新线索',
  following: '跟进中',
  contacted: '已联系',
  converted: '已转化',
  discarded: '已废弃',
}

const convLabels: Record<ConversationStatus, string> = {
  active: '进行中',
  taken_over: '人工接管中',
  transferred: '已转接',
  closed: '已关闭',
}

const colorClass = computed(() => {
  if (props.type === 'lead') {
    return leadColors[props.status as LeadStatus] || 'bg-muted/15 text-muted'
  }
  return convColors[props.status as ConversationStatus] || 'bg-muted/15 text-muted'
})

const label = computed(() => {
  if (props.type === 'lead') {
    return leadLabels[props.status as LeadStatus] || props.status
  }
  return convLabels[props.status as ConversationStatus] || props.status
})
</script>

<template>
  <span
    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap"
    :class="colorClass"
  >
    {{ label }}
  </span>
</template>
