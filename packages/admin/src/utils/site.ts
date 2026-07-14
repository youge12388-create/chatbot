export interface SiteUrlInfo {
  configured: boolean
  display: string
  href: string | null
}

const UNCONFIGURED_LABEL = '未配置网址'

export function siteUrlInfo(domain: string | null | undefined, siteId?: string): SiteUrlInfo {
  const raw = domain?.trim() || ''
  if (!raw || raw === siteId) return unconfiguredSiteUrl()

  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    const hostname = url.hostname.toLowerCase()
    const isWebsiteHost = hostname === 'localhost' || hostname.includes('.')

    if (
      !isWebsiteHost
      || !['http:', 'https:'].includes(url.protocol)
      || url.username
      || url.password
    ) {
      return unconfiguredSiteUrl()
    }

    return {
      configured: true,
      display: url.host + (url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '')),
      href: url.href,
    }
  } catch {
    return unconfiguredSiteUrl()
  }
}

export function hasSiteUrl(domain: string | null | undefined, siteId?: string): boolean {
  return siteUrlInfo(domain, siteId).configured
}

export function siteHref(domain: string | null | undefined, siteId?: string): string | undefined {
  return siteUrlInfo(domain, siteId).href || undefined
}

export function siteDisplayUrl(domain: string | null | undefined, siteId?: string): string {
  return siteUrlInfo(domain, siteId).display
}

function unconfiguredSiteUrl(): SiteUrlInfo {
  return { configured: false, display: UNCONFIGURED_LABEL, href: null }
}
