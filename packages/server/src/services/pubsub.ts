/**
 * 内存 pub/sub 总线
 *
 * 两类通道：
 * - conversationId 通道：推送到对应 widget 的 SSE（人工回复 → widget）
 * - admin 全局通道：推送到后台 SSE（客户消息 → 后台实时显示）
 *
 * 单实例适用；多实例需换 Redis pub/sub。
 */

type Subscriber = (payload: any) => void

// conversationId -> 订阅者集合（widget 侧）
const subscribers = new Map<string, Set<Subscriber>>()

// admin 全局订阅者集合（后台侧）
const adminSubscribers = new Set<Subscriber>()

/** 订阅某个会话的消息（widget 侧） */
export function subscribe(conversationId: string, fn: Subscriber): () => void {
  let set = subscribers.get(conversationId)
  if (!set) {
    set = new Set()
    subscribers.set(conversationId, set)
  }
  set.add(fn)
  return () => {
    const s = subscribers.get(conversationId)
    if (!s) return
    s.delete(fn)
    if (s.size === 0) subscribers.delete(conversationId)
  }
}

/** 向某个会话的所有订阅者推送（widget 侧） */
export function publish(conversationId: string, payload: any): void {
  const set = subscribers.get(conversationId)
  if (!set || set.size === 0) return
  for (const fn of set) {
    try { fn(payload) } catch (e) {
      console.error('[pubsub] widget 订阅者回调异常:', (e as Error).message)
    }
  }
}

/** 订阅全局 admin 通道（后台侧） */
export function subscribeAdmin(fn: Subscriber): () => void {
  adminSubscribers.add(fn)
  return () => { adminSubscribers.delete(fn) }
}

/** 向所有后台订阅者推送（后台侧） */
export function publishAdmin(payload: any): void {
  if (adminSubscribers.size === 0) return
  for (const fn of adminSubscribers) {
    try { fn(payload) } catch (e) {
      console.error('[pubsub] admin 订阅者回调异常:', (e as Error).message)
    }
  }
}
