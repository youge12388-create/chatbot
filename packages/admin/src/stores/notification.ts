/**
 * 全局通知 store
 *
 * 管理后台实时通知：通过单一 admin SSE 连接接收客户消息，
 * - unreadCount：未读客户消息数（仅 user_message 累加）
 * - latestMessages：最近收到的客户消息（用于会话列表高亮 / 详情页实时追加）
 * - latestAgentReplies：最近的人工回复（供会话详情页实时追加，避免新建连接）
 *
 * 连接生命周期：connect() 幂等，Layout 挂载时调用；不在页面切换时断开，
 * logout 走全页刷新自然销毁连接。
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { adminSseUrl } from '../api/client'

export interface NotificationMessage {
  id: string
  conversationId: string
  content: string
  createdAt: string
}

const MAX_KEPT = 50

export const useNotificationStore = defineStore('notification', () => {
  const unreadCount = ref(0)
  const latestMessages = ref<NotificationMessage[]>([])
  const latestAgentReplies = ref<NotificationMessage[]>([])

  let es: EventSource | null = null

  const hasUnread = computed(() => unreadCount.value > 0)

  function pushCapped(list: NotificationMessage[], item: NotificationMessage): NotificationMessage[] {
    list.push(item)
    return list.length > MAX_KEPT ? list.slice(-MAX_KEPT) : list
  }

  function connect(): void {
    if (es) return
    try {
      es = new EventSource(adminSseUrl())
      es.onmessage = (ev: MessageEvent) => {
        try {
          const payload = JSON.parse(ev.data) as {
            event?: string
            data?: Record<string, unknown>
          }
          if (!payload || !payload.event || !payload.data) return
          const d = payload.data
          const item: NotificationMessage = {
            id: String(d.id ?? ''),
            conversationId: String(d.conversationId ?? ''),
            content: String(d.content ?? ''),
            createdAt: String(d.createdAt ?? ''),
          }
          if (payload.event === 'user_message') {
            unreadCount.value++
            latestMessages.value = pushCapped(latestMessages.value, item)
          } else if (payload.event === 'agent_reply') {
            latestAgentReplies.value = pushCapped(latestAgentReplies.value, item)
          }
        } catch {
          /* 异常 payload 静默跳过 */
        }
      }
      es.onerror = () => {
        /* EventSource 会自动重连，不崩 */
      }
    } catch {
      /* EventSource 不可用时静默降级 */
    }
  }

  function disconnect(): void {
    es?.close()
    es = null
  }

  function clearUnread(): void {
    unreadCount.value = 0
  }

  function markConversationRead(conversationId: string): void {
    latestMessages.value = latestMessages.value.filter(
      (m) => m.conversationId !== conversationId,
    )
  }

  return {
    unreadCount,
    latestMessages,
    latestAgentReplies,
    hasUnread,
    connect,
    disconnect,
    clearUnread,
    markConversationRead,
  }
})
