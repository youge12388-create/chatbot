/**
 * 内存 pub/sub 总线
 *
 * 用于把后台人工回复推送到 widget 的 SSE 长连接。
 * 单实例适用；多实例需换 Redis pub/sub。
 */

type Subscriber = (payload: any) => void

// conversationId -> 订阅者集合
const subscribers = new Map<string, Set<Subscriber>>()

/** 订阅某个会话的消息 */
export function subscribe(conversationId: string, fn: Subscriber): () => void {
  let set = subscribers.get(conversationId)
  if (!set) {
    set = new Set()
    subscribers.set(conversationId, set)
  }
  set.add(fn)
  // 返回取消订阅函数
  return () => {
    const s = subscribers.get(conversationId)
    if (!s) return
    s.delete(fn)
    if (s.size === 0) subscribers.delete(conversationId)
  }
}

/** 向某个会话的所有订阅者推送消息 */
export function publish(conversationId: string, payload: any): void {
  const set = subscribers.get(conversationId)
  if (!set || set.size === 0) return
  for (const fn of set) {
    try {
      fn(payload)
    } catch (e) {
      console.error('[pubsub] 订阅者回调异常:', (e as Error).message)
    }
  }
}
