/**
 * API 调用封装
 */

import { Lang } from './i18n'

export interface ChatResponse {
  reply: string
  source: 'preset' | 'ai' | 'human'
  needForm: boolean
}

export interface FaqItem {
  id: string
  question: string
  answer: string
}

export class ChatApi {
  private apiHost: string
  private siteId: string
  private lang: Lang
  private conversationId: string | null = null
  private visitorId: string

  constructor(apiHost: string, siteId: string, lang: Lang) {
    this.apiHost = apiHost
    this.siteId = siteId
    this.lang = lang
    this.visitorId = this.getOrCreateVisitorId()
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

  async createSession(): Promise<string> {
    const res = await fetch(`${this.apiHost}/api/chat/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteId: this.siteId,
        visitorId: this.visitorId,
        metadata: {
          url: location.href,
          userAgent: navigator.userAgent,
        },
      }),
    })
    const data = await res.json()
    this.conversationId = data.data.id
    return this.conversationId
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
    return data.data
  }

  async submitLead(fields: Record<string, string>): Promise<void> {
    await fetch(`${this.apiHost}/api/chat/lead`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: this.conversationId,
        ...fields,
      }),
    })
  }

  async getFaqs(): Promise<FaqItem[]> {
    const res = await fetch(`${this.apiHost}/api/chat/faqs?siteId=${this.siteId}`)
    const data = await res.json()
    return data.data || []
  }
}