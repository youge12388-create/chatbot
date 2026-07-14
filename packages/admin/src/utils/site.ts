export function siteHref(domain: string): string {
  if (/^https?:\/\//i.test(domain)) return domain
  return `https://${domain}`
}

export function siteDisplayUrl(domain: string): string {
  return domain.replace(/^https?:\/\//i, '').replace(/\/$/, '')
}
