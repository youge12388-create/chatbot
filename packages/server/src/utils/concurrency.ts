/**
 * Bounded concurrency limiter. Limits how many tasks run at the same time and
 * queues the rest; once the queue is full it rejects immediately so callers
 * can fall back instead of accumulating unbounded work.
 */
export function createLimiter(maxConcurrent: number, maxQueue = 100) {
  let active = 0
  const queue: Array<() => void> = []

  return {
    get activeCount() {
      return active
    },
    get queueLength() {
      return queue.length
    },
    async run<T>(fn: () => Promise<T>): Promise<T> {
      if (active >= maxConcurrent) {
        await new Promise<void>((resolve, reject) => {
          if (queue.length >= maxQueue) {
            reject(new Error('queue full'))
            return
          }
          queue.push(resolve)
        })
      }
      active += 1
      try {
        return await fn()
      } finally {
        active -= 1
        const next = queue.shift()
        if (next) next()
      }
    },
  }
}
