/**
 * Small in-memory TTL cache. Not shared across instances; each server keeps
 * its own copy. Use a short TTL so admin edits become visible quickly.
 */
export interface TtlCache<T> {
  get(key: string): T | undefined
  set(key: string, value: T): void
  delete(key: string): void
  clear(): void
  size(): number
}

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export function createTtlCache<T>(ttlMs: number, max = 500): TtlCache<T> {
  const store = new Map<string, CacheEntry<T>>()

  function evictIfFull(now: number): void {
    if (store.size < max) return
    for (const [key, entry] of store) {
      if (entry.expiresAt <= now) {
        store.delete(key)
        return
      }
    }
    const oldest = store.keys().next().value
    if (oldest !== undefined) store.delete(oldest)
  }

  return {
    get(key) {
      const entry = store.get(key)
      if (!entry) return undefined
      if (entry.expiresAt <= Date.now()) {
        store.delete(key)
        return undefined
      }
      return entry.value
    },
    set(key, value) {
      const now = Date.now()
      evictIfFull(now)
      store.set(key, { value, expiresAt: now + ttlMs })
    },
    delete(key) {
      store.delete(key)
    },
    clear() {
      store.clear()
    },
    size() {
      return store.size
    },
  }
}
