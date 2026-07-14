export function normalizeSiteDomain(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const raw = value.trim()
  if (!raw || raw.length > 255) return null

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    const hostname = url.hostname.toLowerCase()
    const isWebsiteHost = hostname === 'localhost' || hostname.includes('.')
    const hasUnexpectedParts = url.username || url.password || url.search || url.hash
    const hasPath = url.pathname !== '/'

    if (!isWebsiteHost || !['http:', 'https:'].includes(url.protocol) || hasUnexpectedParts || hasPath) {
      return null
    }

    return url.host.toLowerCase()
  } catch {
    return null
  }
}
