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
 * 不传 data-lang 则自动检测浏览器语言。
 */

import { createWidget } from './ui'
import { detectLang, Lang } from './i18n'

interface WidgetConfig {
  siteId: string
  siteKey?: string
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
    siteKey: script.getAttribute('data-site-key') || undefined,
    apiHost: script.getAttribute('data-api-host') || 'http://localhost:3001',
    lang: detectLang(),
  }
}

;(function init() {
  const config = getConfig()
  if (!config.siteId) return
  createWidget(config)
})()