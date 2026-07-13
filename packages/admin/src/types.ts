/**
 * 全局类型定义
 */

export type LeadStatus = 'new' | 'following' | 'contacted' | 'converted' | 'discarded'
export type ConversationStatus = 'active' | 'taken_over' | 'transferred' | 'closed'
export type InterestLevel = 'unknown' | 'low' | 'normal' | 'medium' | 'high' | 'strong'
export type MessageRole = 'user' | 'assistant' | 'system'
export type MessageSource = 'ai' | 'preset' | 'human' | 'user'
export type AdminRole = 'admin' | 'staff'

export interface AdminUser {
  id: string
  username: string
  role: AdminRole
  name: string | null
  createdAt?: string
}

export type CustomFieldType = 'text' | 'tel' | 'email' | 'select' | 'textarea'

export interface CustomField {
  id: string
  label: string
  type: CustomFieldType
  options?: string[]
  required: boolean
}

export interface FormConfig {
  presetFields: Record<string, { enabled: boolean; required: boolean }>
  customFields: CustomField[]
}

export interface SiteSettings {
  welcomeMessage?: string
  guideMessage?: string
  bubbleMessages?: string[]
  primaryColor?: string
  webhookUrl?: string
  n8nWebhookUrl?: string
  contactWhatsApp?: string
  contactWecomQrUrl?: string
  difyApiUrl?: string
  difyApiKey?: string
  formConfig?: FormConfig
}

export interface Site {
  id: string
  name: string
  domain: string
  apiKey: string
  settings: SiteSettings
  createdAt?: string
  updatedAt?: string
  _count?: { conversations: number; faqs: number }
}

export interface Faq {
  id: string
  siteId: string
  question: string
  answer: string
  priority: number
  site?: { name: string }
}

export interface Message {
  id: string
  conversationId: string
  role: MessageRole
  content: string
  source: MessageSource
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface Conversation {
  id: string
  siteId: string
  visitorId: string
  status: ConversationStatus
  interestLevel: InterestLevel
  metadata?: Record<string, unknown>
  createdAt: string
  updatedAt: string
  closedAt: string | null
  lastMessageAt: string | null
  site?: { name: string; domain: string }
  messages?: Message[]
  leads?: Lead[]
  _count?: { messages: number; leads: number }
}

export interface Lead {
  id: string
  conversationId: string
  name: string | null
  phone: string | null
  email: string | null
  wechat: string | null
  education: string | null
  targetMajor: string | null
  budget: string | null
  enrollmentDate: string | null
  status: LeadStatus
  note: string | null
  assignedTo: string | null
  extra?: Record<string, unknown>
  createdAt: string
  updatedAt: string
  conversation?: {
    id: string
    interestLevel: InterestLevel
    status: ConversationStatus
    createdAt: string
    lastMessageAt: string | null
    messages?: Message[]
    site?: { name: string; domain: string }
  }
}

export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  size: number
  totalPages: number
}
