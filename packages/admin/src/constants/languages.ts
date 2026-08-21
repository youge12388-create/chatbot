import type { SupportedLang } from '../types'

/** 后台所有可维护的客服界面语言；新增语言时仅需在此处补充选项。 */
export const LANGUAGE_OPTIONS: ReadonlyArray<{ value: SupportedLang; label: string }> = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ja', label: '日本語' },
  { value: 'ko', label: '한국어' },
  { value: 'ru', label: 'Русский' },
]
