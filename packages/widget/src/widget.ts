/**
 * Chat Widget 入口
 *
 * 用法：
 * <script src="https://your-domain.com/widget.js"
 *         data-site-id="xxx"
 *         data-site-key="xxx"
 *         data-api-host="https://your-api.com"
 *         data-lang="zh-CN|en|ru">
 * </script>
 *
 * data-site-key 可选，用于提前获取站点配置（欢迎语、气泡提示等）
 * 不传 data-lang 则自动检测浏览器语言。宿主页面修改 html lang 后 Widget 会自动跟随。
 * 宿主语言组件也可调用 window.ChatbotWidget.setLanguage('en')，或派发
 * chatbot:language-change 事件（detail: { lang: 'en' }）同步语言。
 */

import { createWidget, WidgetController } from './ui'
import { detectLang, Lang, normalizeLang } from './i18n'

interface WidgetConfig {
  siteId: string
  siteKey?: string
  apiHost: string
  lang: Lang
  followHostLanguage: boolean
}

interface ChatbotWidgetApi {
  setLanguage(value: string): Promise<void>
  getLanguage(): Lang
}

declare global {
  interface Window {
    ChatbotWidget?: ChatbotWidgetApi
  }
}

function getConfig(): WidgetConfig {
  const script = document.querySelector('script[data-site-id]')
  if (!script) {
    console.error('[ChatWidget] 缺少 data-site-id 属性')
    return { siteId: '', apiHost: '', lang: 'zh-CN', followHostLanguage: false }
  }
  const explicitLang = script.getAttribute('data-lang')
  return {
    siteId: script.getAttribute('data-site-id') || '',
    siteKey: script.getAttribute('data-site-key') || undefined,
    apiHost: script.getAttribute('data-api-host') || 'http://localhost:3001',
    lang: detectLang(),
    followHostLanguage: !explicitLang,
  }
}

function installLanguageBridge(config: WidgetConfig, controller: WidgetController): void {
  const syncFromHost = (value: unknown) => {
    const nextLang = normalizeLang(value, controller.getLanguage())
    if (nextLang !== controller.getLanguage()) void controller.setLanguage(nextLang)
  }

  const onLanguageChange = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail
    const value = detail && typeof detail === 'object' && 'lang' in detail
      ? (detail as { lang?: unknown }).lang
      : detail
    if (value !== undefined) syncFromHost(value)
  }

  window.addEventListener('chatbot:language-change', onLanguageChange)

  if (config.followHostLanguage) {
    const observer = new MutationObserver(() => syncFromHost(document.documentElement.lang))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] })
  }

  window.ChatbotWidget = {
    setLanguage(value: string) {
      const nextLang = normalizeLang(value, controller.getLanguage())
      return controller.setLanguage(nextLang)
    },
    getLanguage: () => controller.getLanguage(),
  }
}

;(function init() {
  const config = getConfig()
  if (!config.siteId) return
  const controller = createWidget(config)
  installLanguageBridge(config, controller)
})()