/**
 * Chat Widget 入口
 *
 * 用法：
 * <script src="https://your-domain.com/widget.js"
 *         data-site-id="xxx"
 *         data-api-host="https://your-api.com"
 *         data-lang="zh-CN|en|ru">
 * </script>
 *
 * 不传 data-lang 则自动检测浏览器语言。
 */

import { createWidget } from './ui'
import { detectLang, Lang } from './i18n'

interface WidgetConfig {
  siteId: string
  apiHost: string
  lang: Lang
}

function getConfig(): WidgetConfig {
  const script = document.querySelector('script[data-site-id]')
  if (!script) {
    console.error('[ChatWidget] 缺少 data-site-id 属性')
    return { siteId: '', apiHost: '', lang: 'zh-CN' }
  }
  return {
    siteId: script.getAttribute('data-site-id') || '',
    apiHost: script.getAttribute('data-api-host') || 'http://localhost:3001',
    lang: detectLang(),
  }
}

;(function init() {
  const config = getConfig()
  if (!config.siteId) return
  createWidget(config)
})()