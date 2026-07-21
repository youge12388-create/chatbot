/**
 * API 调用封装
 */

import { Lang, LocalizedList, LocalizedText } from './i18n'

export interface ChatResponse {
  reply: string
  source: 'preset' | 'ai' | 'human'
  needForm: boolean
  suggestedQuestions?: string[]
}

export interface FaqItem {
  id: string
  question: string
  answer: string
}

export type CustomFieldType = 'text' | 'tel' | 'email' | 'select' | 'textarea'

export interface CustomField {
  id: string
  label: string | LocalizedText
  placeholder?: string | LocalizedText
  type: CustomFieldType
  options?: string[] | LocalizedList
  required: boolean
}

export interface FormConfig {
  presetFields: Record<string, { enabled: boolean; required: boolean }>
  customFields: CustomField[]
}

export interface SiteSettings {
  welcomeMessage: string | LocalizedText
  guideMessage: string | LocalizedText
  bubbleMessages: string[] | LocalizedList
  primaryColor: string
  formConfig?: FormConfig
  contactWhatsApp?: string
  contactWecomQrUrl?: string
}

export class ChatApi {
  private apiHost: string
  private siteId: string
  private lang: Lang
  private conversationId: string | null = null
  private visitorId: string
  private siteKey: string | null = null

  constructor(apiHost: string, siteId: string, lang: Lang) {
    this.apiHost = apiHost
    this.siteId = siteId
    this.lang = lang
    this.visitorId = this.getOrCreateVisitorId()
  }

  /** 设置 siteKey，用于提前获取站点配置 */
  setSiteKey(key: string) {
    this.siteKey = key
  }

  /** 更新当前语言，后续会话、消息和 FAQ 请求都会使用新语言 */
  setLanguage(lang: Lang) {
    this.lang = lang
  }

  private getOrCreateVisitorId(): string {
    const key = 'chatbot_visitor_id'
    let id = localStorage.getItem(key)
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
      localStorage.setItem(key, id)
    }
    return id
  }

  /** 提前获取站点配置（无需创建会话） */
  async getSiteSettings(): Promise<SiteSettings | null> {
    if (!this.siteKey) return null
    try {
      const res = await fetch(`${this.apiHost}/api/chat/site?siteKey=${this.siteKey}`)
      const data = await res.json()
      return data.data?.settings || null
    } catch {
      return null
    }
  }

  async createSession(): Promise<{ conversationId: string; siteSettings?: SiteSettings }> {
    const res = await fetch(`${this.apiHost}/api/chat/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: this.siteId,
        ...(this.siteKey ? { siteKey: this.siteKey } : {}),
        visitorId: this.visitorId,
        metadata: {
          url: location.href,
          userAgent: navigator.userAgent,
          lang: this.lang,
        },
      }),
    })
    const data = await res.json()
    if (!res.ok || data.code !== 0 || !data.data?.id) {
      throw new Error(data.message || '站点配置无效')
    }
    this.conversationId = data.data.id
    return { conversationId: this.conversationId, siteSettings: data.data.siteSettings }
  }

  async sendMessage(content: string): Promise<ChatResponse> {
    if (!this.conversationId) {
      await this.createSession()
    }
    const res = await fetch(`${this.apiHost}/api/chat/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: this.conversationId,
        content,
        lang: this.lang,
      }),
    })
    const data = await res.json()
    if (!res.ok || data.code !== 0) {
      throw new Error(data.message || '消息发送失败')
    }
    return data.data
  }

  async submitLead(fields: Record<string, string>, extra?: Record<string, string>): Promise<void> {
    const body: Record<string, unknown> = { conversationId: this.conversationId, ...fields }
    if (extra && Object.keys(extra).length > 0) body.extra = extra
    await fetch(`${this.apiHost}/api/chat/lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  async getFaqs(): Promise<FaqItem[]> {
    const res = await fetch(`${this.apiHost}/api/chat/faqs?siteId=${encodeURIComponent(this.siteId)}&lang=${encodeURIComponent(this.lang)}`)
    const data = await res.json()
    if (!res.ok || data.code !== 0) {
      throw new Error(data.message || 'FAQ 获取失败')
    }
    return data.data || []
  }

  /** 当前会话 ID（未创建会话时为 null） */
  getConversationId(): string | null {
    return this.conversationId
  }

  /**
   * 建立 SSE 长连接，监听后台人工回复
   * 返回一个 close 函数，调用即断开
   */
  startStream(onMessage: (payload: any) => void): () => void {
    if (!this.conversationId) return () => {}

    const url = `${this.apiHost}/api/chat/stream?conversationId=${encodeURIComponent(this.conversationId)}`
    const es = new EventSource(url)

    es.onmessage = (ev) => {
      try {
        const payload = JSON.parse(ev.data)
        onMessage(payload)
      } catch (e) {
        // 忽略心跳等非 JSON 数据
      }
    }

    es.onerror = () => {
      // EventSource 会自动重连，无需手动处理
    }

    return () => es.close()
  }

  /**
   * 拉取某个时间点之后的消息（重连时拉未读）
   */
  async fetchMessagesAfter(afterISO: string): Promise<any[]> {
    if (!this.conversationId) return []
    try {
      const url = `${this.apiHost}/api/chat/messages?conversationId=${encodeURIComponent(this.conversationId)}&after=${encodeURIComponent(afterISO)}`
      const res = await fetch(url)
      const data = await res.json()
      return data.data || []
    } catch {
      return []
    }
  }
}
