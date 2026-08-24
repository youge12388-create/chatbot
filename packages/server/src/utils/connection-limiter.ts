/**
 * Bounded slot limiter for long-lived connections (SSE).
 * Prevents one instance from being exhausted by too many open streams.
 */
export function createConnectionLimiter(max: number) {
  let active = 0
  return {
    tryAcquire(): boolean {
      if (active >= max) return false
      active += 1
      return true
    },
    release(): void {
      if (active > 0) active -= 1
    },
    activeCount(): number {
      return active
    },
  }
}
