import type { LocalizedList, LocalizedText, SiteSettings } from '../types'

type LegacySiteSettings = SiteSettings & { bubbleMessage?: string }

/** Convert the legacy single-language site copy into the current localized shape. */
export function normalizeSiteSettings(settings: SiteSettings): SiteSettings {
  const normalized: LegacySiteSettings = { ...settings }

  if (typeof normalized.welcomeMessage === 'string') {
    normalized.welcomeMessage = { 'zh-CN': normalized.welcomeMessage } satisfies LocalizedText
  }
  if (typeof normalized.guideMessage === 'string') {
    normalized.guideMessage = { 'zh-CN': normalized.guideMessage } satisfies LocalizedText
  }

  if (Array.isArray(normalized.bubbleMessages)) {
    normalized.bubbleMessages = { 'zh-CN': [...normalized.bubbleMessages] } satisfies LocalizedList
  } else if (
    normalized.bubbleMessages === undefined &&
    typeof normalized.bubbleMessage === 'string' &&
    normalized.bubbleMessage.trim()
  ) {
    normalized.bubbleMessages = { 'zh-CN': [normalized.bubbleMessage.trim()] } satisfies LocalizedList
  }

  delete normalized.bubbleMessage
  return normalized
}
