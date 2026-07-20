import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { adminSseUrl, request } from '../api/client'
import { useSiteStore } from './site'

export interface NotificationMessage {
  id: string
  conversationId: string
  siteId: string
  content: string
  createdAt: string
}

const MAX_KEPT = 50
const PENDING_PREFIX = 'admin_notification_pending:'
const SYNC_PREFIX = 'admin_notification_sync:'
const READ_PREFIX = 'admin_notification_read:'

function pendingKey(siteId: string): string {
  return PENDING_PREFIX + siteId
}

function syncKey(siteId: string): string {
  return SYNC_PREFIX + siteId
}

function readKey(siteId: string): string {
  return READ_PREFIX + siteId
}

function storedReadIds(siteId: string): Set<string> {
  try {
    const raw = localStorage.getItem(readKey(siteId))
    return new Set(raw ? JSON.parse(raw) as string[] : [])
  } catch {
    return new Set()
  }
}

function rememberRead(messages: NotificationMessage[]): void {
  const grouped = new Map<string, string[]>()
  for (const message of messages) {
    const ids = grouped.get(message.siteId) || []
    ids.push(message.id)
    grouped.set(message.siteId, ids)
  }
  for (const [siteId, ids] of grouped) {
    const merged = [...storedReadIds(siteId), ...ids].filter(Boolean).slice(-500)
    try {
      localStorage.setItem(readKey(siteId), JSON.stringify([...new Set(merged)]))
    } catch {
      // Local storage is optional.
    }
  }
}

function pushUniqueCapped(list: NotificationMessage[], item: NotificationMessage): NotificationMessage[] {
  if (!item.id || list.some((existing) => existing.id === item.id)) return list
  const next = [...list, item]
  return next.length > MAX_KEPT ? next.slice(-MAX_KEPT) : next
}

function loadStoredPending(): NotificationMessage[] {
  const messages: NotificationMessage[] = []
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key?.startsWith(PENDING_PREFIX)) continue
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const parsed = JSON.parse(raw) as NotificationMessage[]
      for (const item of parsed) {
        if (item?.id && item.conversationId && item.siteId) {
          const next = pushUniqueCapped(messages, item)
          messages.splice(0, messages.length, ...next)
        }
      }
    }
  } catch {
    return []
  }
  return messages
}

export const useNotificationStore = defineStore('notification', () => {
  const latestMessages = ref<NotificationMessage[]>(loadStoredPending())
  const latestAgentReplies = ref<NotificationMessage[]>([])
  const siteStore = useSiteStore()

  let es: EventSource | null = null

  const unreadCount = computed(() => latestMessages.value.filter(
    (message) => message.siteId === siteStore.selectedSiteId,
  ).length)
  const hasUnread = computed(() => unreadCount.value > 0)

  function persistSite(siteId: string): void {
    if (!siteId) return
    try {
      const messages = latestMessages.value.filter((message) => message.siteId === siteId)
      if (messages.length > 0) {
        localStorage.setItem(pendingKey(siteId), JSON.stringify(messages))
      } else {
        localStorage.removeItem(pendingKey(siteId))
      }
    } catch {
      // Local storage is optional; the in-memory notification still works.
    }
  }

  function appendMessage(item: NotificationMessage, target: 'user' | 'agent'): void {
    if (target === 'user') {
      if (storedReadIds(item.siteId).has(item.id)) return
      latestMessages.value = pushUniqueCapped(latestMessages.value, item)
      persistSite(item.siteId)
    } else {
      latestAgentReplies.value = pushUniqueCapped(latestAgentReplies.value, item)
    }
  }

  function parseMessage(data: Record<string, unknown>): NotificationMessage {
    return {
      id: String(data.id ?? ''),
      conversationId: String(data.conversationId ?? ''),
      siteId: String(data.siteId ?? ''),
      content: String(data.content ?? ''),
      createdAt: String(data.createdAt ?? ''),
    }
  }

  async function syncSite(siteId: string): Promise<void> {
    if (!siteId) return
    const now = new Date().toISOString()
    let since = now
    try {
      since = localStorage.getItem(syncKey(siteId)) || now
      const messages = await request<NotificationMessage[]>('GET', '/api/admin/notifications', { siteId, since })
      for (const message of messages) appendMessage(message, 'user')
      localStorage.setItem(syncKey(siteId), now)
    } catch {
      // Keep the previous sync time so the next page load retries the gap.
    }
  }

  function connect(): void {
    if (es) return
    void syncSite(siteStore.selectedSiteId)
    try {
      es = new EventSource(adminSseUrl())
      es.onmessage = (ev: MessageEvent) => {
        try {
          const payload = JSON.parse(ev.data) as {
            event?: string
            data?: Record<string, unknown>
          }
          if (!payload?.event || !payload.data) return
          const item = parseMessage(payload.data)
          if (payload.event === 'user_message') appendMessage(item, 'user')
          if (payload.event === 'agent_reply') appendMessage(item, 'agent')
        } catch {
          // Ignore malformed SSE payloads.
        }
      }
      es.onerror = () => {
        // EventSource retries the connection automatically.
      }
    } catch {
      // EventSource is optional; the list still loads through normal HTTP requests.
    }
  }

  function disconnect(): void {
    es?.close()
    es = null
  }

  function markConversationRead(conversationId: string): void {
    const removed = latestMessages.value.filter((message) => message.conversationId === conversationId)
    const affectedSites = new Set(removed.map((message) => message.siteId))
    latestMessages.value = latestMessages.value.filter(
      (message) => message.conversationId !== conversationId,
    )
    rememberRead(removed)
    for (const siteId of affectedSites) persistSite(siteId)
  }

  function markSiteRead(siteId: string): void {
    const removed = latestMessages.value.filter((message) => message.siteId === siteId)
    latestMessages.value = latestMessages.value.filter(
      (message) => message.siteId !== siteId,
    )
    rememberRead(removed)
    persistSite(siteId)
  }

  return {
    unreadCount,
    latestMessages,
    latestAgentReplies,
    hasUnread,
    connect,
    disconnect,
    syncSite,
    markConversationRead,
    markSiteRead,
  }
})
