/**
 * 全局 Toast 事件总线
 *
 * 用法：
 *   import { pushToast } from '../components/Toast.vue'
 *   pushToast('success', '保存成功')
 */

export type ToastType = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  type: ToastType
  message: string
}

type Listener = (items: ToastItem[]) => void

const listeners = new Set<Listener>()
let items: ToastItem[] = []
let seq = 0

function emit() {
  for (const fn of listeners) fn(items)
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  fn(items)
  return () => {
    listeners.delete(fn)
  }
}

export function pushToast(type: ToastType, message: string): void {
  const id = ++seq
  items = [...items, { id, type, message }]
  emit()
  setTimeout(() => {
    items = items.filter((t) => t.id !== id)
    emit()
  }, 3000)
}

export function dismissToast(id: number): void {
  items = items.filter((t) => t.id !== id)
  emit()
}
