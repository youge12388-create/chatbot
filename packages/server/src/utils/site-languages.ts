export interface SiteLanguage {
  code: string
  label: string
  enabled: boolean
}

export const DEFAULT_SITE_LANGUAGES: readonly SiteLanguage[] = [
  { code: 'zh-CN', label: '中文', enabled: true },
  { code: 'en', label: 'English', enabled: true },
  { code: 'ja', label: '日本語', enabled: true },
  { code: 'ko', label: '한국어', enabled: true },
  { code: 'ru', label: 'Русский', enabled: true },
]

const LANGUAGE_CODE_PATTERN = /^[a-z]{2,3}(?:-[A-Za-z]{2,8})?$/

function canonicalLanguageCode(value: string): string {
  const parts = value.trim().split('-')
  if (parts.length > 2) return value.trim()
  const [language, region] = parts
  if (!region) return language.toLowerCase()
  return `${language.toLowerCase()}-${region.length === 2 ? region.toUpperCase() : region}`
}

export function isLanguageCode(value: unknown): value is string {
  return typeof value === 'string' && LANGUAGE_CODE_PATTERN.test(value.trim())
}

export function normalizeSiteLanguages(raw: unknown): SiteLanguage[] {
  if (!Array.isArray(raw)) return DEFAULT_SITE_LANGUAGES.map(language => ({ ...language }))

  const seen = new Set<string>()
  const languages = raw.flatMap((item): SiteLanguage[] => {
    if (!item || typeof item !== 'object') return []
    const candidate = item as Partial<SiteLanguage>
    const code = typeof candidate.code === 'string' ? candidate.code.trim() : ''
    const label = typeof candidate.label === 'string' ? candidate.label.trim() : ''
    const normalizedCode = canonicalLanguageCode(code)
    if (!isLanguageCode(normalizedCode) || !label || seen.has(normalizedCode)) return []
    seen.add(normalizedCode)
    return [{ code: normalizedCode, label, enabled: candidate.enabled !== false }]
  })

  return languages.length > 0
    ? languages
    : DEFAULT_SITE_LANGUAGES.map(language => ({ ...language }))
}

export function isEnabledSiteLanguage(raw: unknown, code: string): boolean {
  const normalizedCode = typeof code === 'string' ? canonicalLanguageCode(code) : ''
  return normalizeSiteLanguages(raw).some(language => language.enabled && language.code === normalizedCode)
}

export function resolveEnabledSiteLanguage(raw: unknown, code: string): string | null {
  const normalizedCode = typeof code === 'string' ? canonicalLanguageCode(code) : ''
  return normalizeSiteLanguages(raw).find(language => language.enabled && language.code === normalizedCode)?.code || null
}

export function validateSiteLanguages(raw: unknown): string | null {
  if (!Array.isArray(raw)) return 'languages must be an array'
  const seen = new Set<string>()
  let enabledCount = 0
  for (const item of raw) {
    if (!item || typeof item !== 'object') return 'each language must be an object'
    const candidate = item as Partial<SiteLanguage>
    const code = typeof candidate.code === 'string' ? candidate.code.trim() : ''
    const label = typeof candidate.label === 'string' ? candidate.label.trim() : ''
    const normalizedCode = canonicalLanguageCode(code)
    if (!isLanguageCode(normalizedCode)) return `invalid language code: ${code || '(empty)'}`
    if (!label) return `language label is required: ${normalizedCode}`
    if (seen.has(normalizedCode)) return `duplicate language code: ${normalizedCode}`
    seen.add(normalizedCode)
    if (candidate.enabled !== false) enabledCount += 1
  }
  return enabledCount > 0 ? null : 'at least one language must remain enabled'
}
