import type { SiteLanguage } from '../types'

/** 后台默认客服界面语言；站点级新增语言由“网站语言”配置持久化管理。 */
export const LANGUAGE_OPTIONS: ReadonlyArray<SiteLanguage> = [
  { code: 'zh-CN', label: '中文', enabled: true },
  { code: 'en', label: 'English', enabled: true },
  { code: 'ja', label: '日本語', enabled: true },
  { code: 'ko', label: '한국어', enabled: true },
  { code: 'ru', label: 'Русский', enabled: true },
]
