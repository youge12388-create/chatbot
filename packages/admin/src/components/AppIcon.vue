<script setup lang="ts">
import { computed } from 'vue'

export type IconName =
  | 'grid' | 'target' | 'chat' | 'help' | 'settings' | 'users' | 'bell'
  | 'logout' | 'external' | 'chevron' | 'search' | 'download' | 'plus'
  | 'close' | 'filter' | 'globe' | 'arrow-left' | 'user' | 'copy' | 'edit' | 'trash' | 'code' | 'file' | 'key' | 'hash'

const props = withDefaults(defineProps<{
  name: IconName
  size?: number
  strokeWidth?: number
}>(), {
  size: 20,
  strokeWidth: 1.8,
})

const paths: Record<IconName, string[]> = {
  grid: ['M4 4h6v6H4z', 'M14 4h6v6h-6z', 'M4 14h6v6H4z', 'M14 14h6v6h-6z'],
  target: ['M12 3v3', 'M12 18v3', 'M3 12h3', 'M18 12h3', 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0-0-8', 'M12 10.5v3', 'M10.5 12h3'],
  chat: ['M20 11.5a7.5 7.5 0 0 1-8 7.5 8.6 8.6 0 0 1-3.2-.6L4 20l1.5-3.7A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z', 'M8 11.5h.01', 'M12 11.5h.01', 'M16 11.5h.01'],
  help: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M9.8 9a2.3 2.3 0 1 1 3.7 1.8c-.9.7-1.5 1.1-1.5 2.4', 'M12 17h.01'],
  settings: ['M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z', 'M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-1.7 1.7-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.1h-2.4v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L8 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H6.7v-2.4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L8 8.6l1.7-1.7.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.1h2.4v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1 1.7 1.7-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.1V14h-.1a1.7 1.7 0 0 0-1.6 1Z'],
  users: ['M16 20v-1.2a3.8 3.8 0 0 0-3.8-3.8H7.8A3.8 3.8 0 0 0 4 18.8V20', 'M10 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z', 'M16 4.2a3.5 3.5 0 0 1 0 6.8', 'M20 20v-1.2a3.8 3.8 0 0 0-2.6-3.6'],
  bell: ['M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9', 'M10 21h4', 'M9.5 3.5a2.8 2.8 0 0 1 5 0'],
  logout: ['M10 17l5-5-5-5', 'M15 12H3', 'M14 5V3.8A1.8 1.8 0 0 1 15.8 2h3.4A1.8 1.8 0 0 1 21 3.8v16.4a1.8 1.8 0 0 1-1.8 1.8h-3.4a1.8 1.8 0 0 1-1.8-1.8V19'],
  external: ['M14 4h6v6', 'M20 4l-9 9', 'M18 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5'],
  chevron: ['M7 9l5 5 5-5'],
  search: ['M10.8 18.2a7.4 7.4 0 1 0 0-14.8 7.4 7.4 0 0 0 0 14.8Z', 'M16.2 16.2 21 21'],
  download: ['M12 3v12', 'm7 10 5 5 5-5', 'M4 21h16'],
  plus: ['M12 5v14', 'M5 12h14'],
  close: ['M6 6l12 12', 'M18 6 6 18'],
  filter: ['M4 6h16', 'M7 12h10', 'M10 18h4'],
  globe: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M3 12h18', 'M12 3a13.7 13.7 0 0 1 0 18', 'M12 3a13.7 13.7 0 0 0 0 18'],
  'arrow-left': ['M19 12H5', 'm12 19-7-7 7-7'],
  user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4 21a8 8 0 0 1 16 0H4Z'],
  copy: ['M9 9h10v10H9z', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1'],
  edit: ['M12 20h9', 'M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z'],
  trash: ['M4 7h16', 'M10 11v6', 'M14 11v6', 'M6 7l1 14h10l1-14', 'M9 7V4h6v3'],
  code: ['m8 9-4 3 4 3', 'm16 9 4 3-4 3', 'm13 5-2 14'],
  file: ['M6 3h8l4 4v14H6z', 'M14 3v5h5', 'M9 13h6', 'M9 17h6'],
  key: ['M15.5 8.5a4.5 4.5 0 1 0-3.9 6.7L14 17.6V20h2v-2h2v-2h2v-2.2', 'M15.5 8.5h.01'],
  hash: ['M10 3 8 21', 'M16 3l-2 18', 'M4 9h17', 'M3 15h17'],
}

const iconPaths = computed(() => paths[props.name])
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-linecap="round"
    stroke-linejoin="round"
    :stroke-width="strokeWidth"
    aria-hidden="true"
  >
    <path v-for="(path, index) in iconPaths" :key="index" :d="path" :fill="name === 'user' ? 'currentColor' : 'none'" :stroke="name === 'user' ? 'none' : 'currentColor'" />
  </svg>
</template>