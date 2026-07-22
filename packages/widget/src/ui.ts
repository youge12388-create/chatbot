/**
 * 渲染 UI：浮窗按钮 + 聊天窗口
 */

import { ChatApi, FaqItem, SiteSettings } from './api'
import { renderForm } from './form'
import { Lang, resolveList, resolveText, SUPPORTED_LANGS, t } from './i18n'

const CSS = `
.chat-widget-container {
  position: fixed;
  top: 50%;
  right: 20px;
  transform: translateY(-50%);
  z-index: 999999;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 14px;
  line-height: 1.5;
}

.chat-widget-button {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background: #165DFF;
  box-shadow: 0 4px 12px rgba(22, 93, 255, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s;
  position: relative;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  touch-action: none;
}
.chat-widget-button:hover {
  transform: scale(1.05);
}
.chat-widget-button svg {
  width: 28px;
  height: 28px;
  fill: white;
}

.chat-widget-bubble {
  position: absolute;
  right: 72px;
  top: 50%;
  transform: translateY(-50%);
  background: #165DFF;
  color: #fff;
  padding: 12px 18px;
  border-radius: 14px;
  font-size: 13px;
  font-weight: 500;
  width: max-content;
  max-width: min(260px, calc(100vw - 104px));
  box-sizing: border-box;
  white-space: normal;
  overflow-wrap: anywhere;
  line-height: 1.4;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.4s ease;
  pointer-events: none;
}
.chat-widget-bubble.show {
  opacity: 1;
  pointer-events: auto;
}
.chat-widget-bubble.switching {
  opacity: 0;
  pointer-events: none;
}
.chat-widget-bubble::after {
  content: '';
  position: absolute;
  right: -6px;
  top: 50%;
  transform: translateY(-50%);
  border: 6px solid transparent;
  border-left-color: #165DFF;
}
.chat-widget-bubble.bubble-right::after {
  right: auto;
  left: -6px;
  border-left-color: transparent;
  border-right-color: #165DFF;
}

.chat-widget-window {
  position: absolute;
  left: auto;
  right: 0;
  bottom: 76px;
  width: 380px;
  height: 520px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  display: none;
  flex-direction: column;
  overflow: hidden;
  margin-bottom: 0;
}
.chat-widget-window.open {
  display: flex;
}

.chat-widget-header {
  background: #165DFF;
  color: white;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.chat-widget-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}
.chat-widget-language-wrap {
  position: relative;
}
.chat-widget-language-trigger {
  min-width: 64px;
  height: 24px;
  padding: 0 5px 0 7px;
  border: 0;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.88);
  display: inline-flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  font: inherit;
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.18s ease;
}
.chat-widget-language-trigger:hover,
.chat-widget-language-trigger[aria-expanded="true"] {
  background: rgba(255, 255, 255, 0.18);
}
.chat-widget-language-trigger:focus-visible,
.chat-widget-language-option:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.95);
  outline-offset: 2px;
}
.chat-widget-language-trigger svg {
  width: 11px;
  height: 11px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2;
  transition: transform 0.18s ease;
}
.chat-widget-language-trigger[aria-expanded="true"] svg {
  transform: rotate(180deg);
}
.chat-widget-language-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  min-width: 128px;
  padding: 4px;
  border: 1px solid #e5e7eb;
  border-radius: 9px;
  background: #fff;
  box-shadow: 0 10px 24px rgba(15, 23, 42, 0.2);
  z-index: 20;
}
.chat-widget-language-option {
  width: 100%;
  min-height: 30px;
  padding: 5px 8px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: #374151;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  font: inherit;
  font-size: 12px;
  text-align: left;
  cursor: pointer;
}
.chat-widget-language-option:hover,
.chat-widget-language-option[aria-selected="true"] {
  background: #eff6ff;
  color: #165DFF;
}
.chat-widget-language-option[aria-selected="true"] {
  font-weight: 600;
}
.chat-widget-language-check {
  width: 12px;
  height: 12px;
  opacity: 0;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.4;
}
.chat-widget-language-option[aria-selected="true"] .chat-widget-language-check {
  opacity: 1;
}
.chat-widget-close {
  cursor: pointer;
  padding: 4px;
  line-height: 1;
}
.chat-widget-close svg {
  width: 20px;
  height: 20px;
  fill: white;
}

.chat-widget-contact-btn {
  cursor: pointer;
  padding: 4px 10px;
  line-height: 1;
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
  margin-right: 8px;
}
.chat-widget-contact-btn svg {
  width: 14px;
  height: 14px;
  fill: white;
}

/* 联系顾问弹窗 */
.chat-widget-contact-modal {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
.chat-widget-contact-modal.open {
  display: flex;
}
.chat-widget-contact-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  width: 80%;
  max-width: 280px;
  text-align: center;
}
.chat-widget-contact-card h4 {
  margin: 0 0 16px 0;
  font-size: 15px;
  color: #333;
}
.chat-widget-contact-option {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px;
  border: 1px solid #165DFF;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  color: #165DFF;
  font-size: 14px;
  text-decoration: none;
}
.chat-widget-contact-option:hover {
  background: #165DFF;
  color: #fff;
}
.chat-widget-contact-option svg {
  width: 18px;
  height: 18px;
  fill: currentColor;
}
.chat-widget-contact-qr {
  width: 200px;
  height: 200px;
  margin: 8px auto;
  display: block;
  object-fit: contain;
}
.chat-widget-contact-close {
  background: #f5f5f5;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #666;
  margin-top: 8px;
}

/* 退出挽留卡片 */
.chat-widget-retain-modal {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: none;
  align-items: center;
  justify-content: center;
  z-index: 10;
}
.chat-widget-retain-modal.open {
  display: flex;
}
.chat-widget-retain-card {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  width: 84%;
  max-width: 300px;
  text-align: center;
}
.chat-widget-retain-card h4 {
  margin: 0 0 8px 0;
  font-size: 15px;
  color: #333;
}
.chat-widget-retain-card p {
  margin: 0 0 12px 0;
  font-size: 13px;
  color: #666;
  line-height: 1.5;
}
.chat-widget-retain-card input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  box-sizing: border-box;
  margin-bottom: 12px;
}
.chat-widget-retain-actions {
  display: flex;
  gap: 8px;
}
.chat-widget-retain-submit {
  flex: 1;
  padding: 10px;
  background: #165DFF;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
}
.chat-widget-retain-skip {
  padding: 10px 14px;
  background: #f5f5f5;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  color: #666;
}

.chat-widget-messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: #f8f9fa;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chat-message {
  max-width: 80%;
  padding: 10px 14px;
  border-radius: 12px;
  line-height: 1.5;
  word-wrap: break-word;
}
.chat-message.user {
  align-self: flex-end;
  background: #165DFF;
  color: white;
  border-bottom-right-radius: 4px;
}
.chat-message.assistant {
  align-self: flex-start;
  background: white;
  color: #333;
  border-bottom-left-radius: 4px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

.chat-widget-faqs {
  padding: 8px 16px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  border-top: 1px solid #eee;
  background: #fff;
}
.chat-faq-btn {
  padding: 6px 12px;
  border: 1px solid #165DFF;
  border-radius: 16px;
  background: #fff;
  color: #165DFF;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s;
}
.chat-faq-btn:hover {
  background: #165DFF;
  color: #fff;
}

.chat-widget-input {
  display: flex;
  padding: 12px 16px;
  gap: 8px;
  border-top: 1px solid #eee;
  background: #fff;
}
.chat-widget-input input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #ddd;
  border-radius: 20px;
  outline: none;
  font-size: 14px;
}
.chat-widget-input input:focus {
  border-color: #165DFF;
}
.chat-widget-send {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #165DFF;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chat-widget-send:disabled {
  background: #ccc;
  cursor: not-allowed;
}
.chat-widget-send svg {
  width: 18px;
  height: 18px;
  fill: white;
}

.chat-widget-form-overlay {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  max-height: 80%;
  background: #fff;
  color: #1f2937;
  display: none;
  padding: 20px 16px 16px;
  overflow-y: auto;
  border-radius: 16px 16px 0 0;
  box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.1);
  transform: translateY(100%);
  transition: transform 0.3s ease;
}
.chat-widget-form-overlay.open {
  display: block;
  transform: translateY(0);
}
.chat-widget-form-overlay h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #111827;
}
.chat-form-overlay-handle {
  width: 36px;
  height: 4px;
  background: #ddd;
  border-radius: 2px;
  margin: 0 auto 12px;
}
.chat-form-row {
  margin-bottom: 12px;
}
.chat-form-row label {
  display: block;
  font-size: 13px;
  color: #4b5563;
  margin-bottom: 4px;
}
.chat-form-row input,
.chat-form-row select,
.chat-form-row textarea {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-sizing: border-box;
  font-size: 14px;
  color: #1f2937;
  background: #fff;
}
.chat-form-row input::placeholder,
.chat-form-row textarea::placeholder {
  color: #9ca3af;
  opacity: 1;
}
.chat-form-row select option {
  color: #1f2937;
  background: #fff;
}
.chat-form-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}
.chat-form-submit {
  flex: 1;
  padding: 10px;
  background: #165DFF;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}
.chat-form-cancel {
  padding: 10px 16px;
  background: #f5f5f5;
  color: #374151;
  border: 1px solid #ddd;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
}

.chat-widget-loading {
  align-self: flex-start;
  padding: 8px 12px;
  background: white;
  border-radius: 12px;
  color: #666;
  font-size: 13px;
}

.chat-message.assistant strong {
  font-weight: 600;
}
.chat-message.assistant ol,
.chat-message.assistant ul {
  margin: 4px 0;
  padding-left: 20px;
}
.chat-message.assistant li {
  margin-bottom: 2px;
}
.chat-message.assistant p {
  margin: 0 0 4px 0;
}
.chat-message.assistant p:last-child {
  margin: 0;
}

@media (max-width: 480px) {
  .chat-widget-window {
    width: calc(100vw - 40px);
    height: 70vh;
    right: 0;
  }
}
`

export interface WidgetConfig {
  siteId: string
  siteKey?: string
  apiHost: string
  lang: Lang
}

export interface WidgetController {
  setLanguage(lang: Lang): Promise<void>
  getLanguage(): Lang
}

const MAX_VISIBLE_FAQS = 5
const LANGUAGE_LABELS: Record<Lang, string> = {
  'zh-CN': '中文',
  en: 'English',
  ko: '한국어',
  ru: 'Русский',
}
const LANGUAGE_OPTIONS = SUPPORTED_LANGS.map(value => ({ value, label: LANGUAGE_LABELS[value] }))

interface Message {
  role: 'user' | 'assistant'
  content: string
}

/** 轻量 Markdown 渲染：粗体、有序/无序列表、段落 */
function renderMarkdown(text: string): string {
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\r\n?/g, '\n')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')

  const lines = html.split('\n')
  const result: string[] = []
  let inOl = false
  let inUl = false
  let paragraphLines: string[] = []

  const closeLists = () => {
    if (inOl) {
      result.push('</ol>')
      inOl = false
    }
    if (inUl) {
      result.push('</ul>')
      inUl = false
    }
  }

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return
    result.push('<p>' + paragraphLines.join('<br>') + '</p>')
    paragraphLines = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)/)
    const ulMatch = trimmed.match(/^[-*]\s+(.+)/)

    if (olMatch) {
      flushParagraph()
      if (inUl) {
        result.push('</ul>')
        inUl = false
      }
      if (!inOl) {
        result.push('<ol>')
        inOl = true
      }
      result.push('<li>' + olMatch[2] + '</li>')
    } else if (ulMatch) {
      flushParagraph()
      if (inOl) {
        result.push('</ol>')
        inOl = false
      }
      if (!inUl) {
        result.push('<ul>')
        inUl = true
      }
      result.push('<li>' + ulMatch[1] + '</li>')
    } else if (trimmed) {
      closeLists()
      paragraphLines.push(trimmed)
    } else {
      flushParagraph()
      closeLists()
    }
  }

  flushParagraph()
  closeLists()
  return result.join('')
}

export function createWidget(config: WidgetConfig): WidgetController {
  const api = new ChatApi(config.apiHost, config.siteId, config.lang)
  if (config.siteKey) api.setSiteKey(config.siteKey)
  let lang = config.lang

  // Shadow DOM 隔离样式
  const container = document.createElement('div')
  // 容器在 Shadow DOM 外部，必须用 inline style 才不会被宿主页面覆盖
  container.style.cssText = [
    'position: fixed',
    'top: 50%',
    'right: 20px',
    'transform: translateY(-50%)',
    'z-index: 999999',
    'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    'font-size: 14px',
    'line-height: 1.5',
    'width: 60px',
    'height: 60px',
  ].join(';')
  const shadow = container.attachShadow({ mode: 'open' })

  // HTML 结构
  shadow.innerHTML = `
    <style>${CSS}</style>
    <div class="chat-widget-window">
      <div class="chat-widget-header">
        <h3>${t(lang, 'header.title')}</h3>
        <div style="display:flex;align-items:center;gap:6px;">
          <div class="chat-widget-language-wrap">
            <button type="button" class="chat-widget-language-trigger" aria-haspopup="listbox" aria-expanded="false" aria-label="${t(lang, 'language.label')}" aria-controls="chat-widget-language-menu">
              <span class="chat-widget-language-value">${LANGUAGE_LABELS[lang]}</span>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
            </button>
            <div id="chat-widget-language-menu" class="chat-widget-language-menu" role="listbox" aria-label="${t(lang, 'language.label')}" hidden>
              ${LANGUAGE_OPTIONS.map(option => `
                <button type="button" class="chat-widget-language-option" role="option" data-lang="${option.value}" aria-selected="${option.value === lang}">
                  <span>${option.label}</span>
                  <svg class="chat-widget-language-check" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>
                </button>
              `).join('')}
            </div>
          </div>
          <div class="chat-widget-contact-btn" style="display:none;">
            <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
            <span>${t(lang, 'contact.button')}</span>
          </div>
          <div class="chat-widget-close">
            <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </div>
        </div>
      </div>
      <div class="chat-widget-messages"></div>
      <div class="chat-widget-faqs"></div>
      <div class="chat-widget-input">
        <input type="text" placeholder="${t(lang, 'input.placeholder')}" />
        <button class="chat-widget-send" disabled>
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
      <div class="chat-widget-form-overlay">
        <div class="chat-form-overlay-handle"></div>
      </div>
      <div class="chat-widget-contact-modal">
        <div class="chat-widget-contact-card">
          <h4>${t(lang, 'contact.title')}</h4>
          <div class="chat-widget-contact-options"></div>
          <button class="chat-widget-contact-close">${t(lang, 'contact.close')}</button>
        </div>
      </div>
      <div class="chat-widget-retain-modal">
        <div class="chat-widget-retain-card">
          <h4>${t(lang, 'retain.title')}</h4>
          <p>${t(lang, 'retain.description')}</p>
          <input type="tel" placeholder="${t(lang, 'retain.phonePlaceholder')}" />
          <div class="chat-widget-retain-actions">
            <button class="chat-widget-retain-skip">${t(lang, 'retain.stillClose')}</button>
            <button class="chat-widget-retain-submit">${t(lang, 'retain.submit')}</button>
          </div>
        </div>
      </div>
    </div>
    <div class="chat-widget-button">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
      <div class="chat-widget-bubble"></div>
    </div>
  `

  document.body.appendChild(container)

  // 元素引用
  const button = shadow.querySelector<HTMLElement>('.chat-widget-button')!
  const chatWindow = shadow.querySelector<HTMLElement>('.chat-widget-window')!
  const closeBtn = shadow.querySelector('.chat-widget-close')!
  const languageTrigger = shadow.querySelector<HTMLButtonElement>('.chat-widget-language-trigger')!
  const languageValue = shadow.querySelector<HTMLElement>('.chat-widget-language-value')!
  const languageMenu = shadow.querySelector<HTMLElement>('.chat-widget-language-menu')!
  const languageOptions = Array.from(shadow.querySelectorAll<HTMLButtonElement>('.chat-widget-language-option'))
  const headerTitle = shadow.querySelector<HTMLElement>('.chat-widget-header h3')!
  const contactLabel = shadow.querySelector<HTMLElement>('.chat-widget-contact-btn span')!
  const contactTitle = shadow.querySelector<HTMLElement>('.chat-widget-contact-card h4')!
  const contactCloseLabel = shadow.querySelector<HTMLElement>('.chat-widget-contact-close')!
  const messagesEl = shadow.querySelector('.chat-widget-messages')!
  const faqsEl = shadow.querySelector('.chat-widget-faqs')!
  const input = shadow.querySelector<HTMLInputElement>('.chat-widget-input input')!
  const sendBtn = shadow.querySelector('.chat-widget-send')!
  const formOverlay = shadow.querySelector<HTMLElement>('.chat-widget-form-overlay')!
  const bubble = shadow.querySelector<HTMLElement>('.chat-widget-bubble')!
  const contactBtn = shadow.querySelector<HTMLElement>('.chat-widget-contact-btn')!
  const contactModal = shadow.querySelector<HTMLElement>('.chat-widget-contact-modal')!
  const contactOptions = shadow.querySelector<HTMLElement>('.chat-widget-contact-options')!
  const contactCloseBtn = shadow.querySelector<HTMLElement>('.chat-widget-contact-close')!
  const retainModal = shadow.querySelector<HTMLElement>('.chat-widget-retain-modal')!
  const retainInput = shadow.querySelector<HTMLInputElement>('.chat-widget-retain-card input')!
  const retainSubmitBtn = shadow.querySelector<HTMLElement>('.chat-widget-retain-submit')!
  const retainSkipBtn = shadow.querySelector<HTMLElement>('.chat-widget-retain-skip')!
  const retainTitle = shadow.querySelector<HTMLElement>('.chat-widget-retain-card h4')!
  const retainDescription = shadow.querySelector<HTMLElement>('.chat-widget-retain-card p')!

  // 状态
  let isOpen = false
  let messages: Message[] = []
  let faqs: FaqItem[] = []
  let conversationCreated = false
  let siteSettings: SiteSettings | null = null
  let retainShown = false  // 挽留卡片只触发一次
  let welcomeMessage: Message | null = null
  let guideMessage: Message | null = null
  let welcomeMessageEl: HTMLElement | null = null
  let guideMessageEl: HTMLElement | null = null
  const typewriterTimers = new Map<HTMLElement, ReturnType<typeof setInterval>>()

  // 气泡状态：多条文案轮播，常驻显示（仅打开聊天窗口时隐藏）
  let bubbleIndex = 0
  let bubbleVisible = false
  let bubbleInterval: ReturnType<typeof setInterval> | null = null
  const BUBBLE_INTERVAL_MS = 5000
  const BUBBLE_SWITCH_MS = 400

  // 提前获取站点配置（用于气泡提示和欢迎语）
  if (config.siteKey) {
    api.getSiteSettings().then(settings => {
      if (settings) {
        siteSettings = settings
        applyThemeColor(settings.primaryColor)
        updateContactButton()
        // 气泡已显示时，更新文案列表并按需启动轮播
        if (bubbleVisible) refreshBubble()
      }
    })
  }

  // 延迟 3 秒显示气泡（常驻，不自动隐藏）
  setTimeout(() => {
    if (!isOpen) showBubble()
  }, 3000)

  // 应用主题色
  function applyThemeColor(color: string) {
    if (!color) return
    const styleEl = shadow.querySelector('style')!
    styleEl.textContent += `
      .chat-widget-button { background: ${color} !important; }
      .chat-widget-header { background: ${color} !important; }
      .chat-message.user { background: ${color} !important; }
      .chat-widget-send { background: ${color} !important; }
      .chat-faq-btn { border-color: ${color} !important; color: ${color} !important; }
      .chat-faq-btn:hover { background: ${color} !important; }
      .chat-form-submit { background: ${color} !important; }
      .chat-widget-bubble { background: ${color} !important; }
      .chat-widget-bubble::after { border-left-color: ${color} !important; }
      .chat-widget-bubble.bubble-right::after { border-right-color: ${color} !important; }
      .chat-widget-contact-option { border-color: ${color} !important; color: ${color} !important; }
      .chat-widget-contact-option:hover { background: ${color} !important; }
      .chat-widget-retain-submit { background: ${color} !important; }
    `
  }

  // 更新联系顾问按钮显示（配置了至少一个联系方式才显示）
  function updateContactButton() {
    const hasWhatsApp = siteSettings?.contactWhatsApp && siteSettings.contactWhatsApp.trim()
    const hasQr = siteSettings?.contactWecomQrUrl && siteSettings.contactWecomQrUrl.trim()
    if (hasWhatsApp || hasQr) {
      contactBtn.style.display = 'flex'
    } else {
      contactBtn.style.display = 'none'
    }
  }

  function updateLanguageUi() {
    languageValue.textContent = LANGUAGE_LABELS[lang]
    languageTrigger.setAttribute('aria-label', t(lang, 'language.label'))
    languageMenu.setAttribute('aria-label', t(lang, 'language.label'))
    languageOptions.forEach(option => {
      option.setAttribute('aria-selected', String(option.dataset.lang === lang))
    })
    headerTitle.textContent = t(lang, 'header.title')
    contactLabel.textContent = t(lang, 'contact.button')
    input.placeholder = t(lang, 'input.placeholder')
    contactTitle.textContent = t(lang, 'contact.title')
    contactCloseLabel.textContent = t(lang, 'contact.close')
    retainTitle.textContent = t(lang, 'retain.title')
    retainDescription.textContent = t(lang, 'retain.description')
    retainInput.placeholder = t(lang, 'retain.phonePlaceholder')
    retainSkipBtn.textContent = t(lang, 'retain.stillClose')
    retainSubmitBtn.textContent = t(lang, 'retain.submit')
  }

  async function switchLanguage(nextLang: Lang) {
    if (nextLang === lang) return
    lang = nextLang
    api.setLanguage(lang)
    updateLanguageUi()
    updateWelcomeMessages()
    refreshBubble()
    if (conversationCreated) {
      try {
        await loadFaqs()
      } catch {
        // 切换语言失败时保留当前 FAQ，避免影响正在进行的对话
      }
    }
  }

  function setLanguageMenuOpen(open: boolean) {
    languageMenu.hidden = !open
    languageTrigger.setAttribute('aria-expanded', String(open))
    if (open) {
      const selected = languageOptions.find(option => option.dataset.lang === lang)
      selected?.focus()
    }
  }

  languageTrigger.addEventListener('click', event => {
    event.stopPropagation()
    setLanguageMenuOpen(languageMenu.hidden)
  })

  languageTrigger.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setLanguageMenuOpen(true)
    } else if (event.key === 'Escape') {
      setLanguageMenuOpen(false)
    }
  })

  languageOptions.forEach((option, index) => {
    option.addEventListener('click', event => {
      event.stopPropagation()
      setLanguageMenuOpen(false)
      void switchLanguage(option.dataset.lang as Lang)
    })
    option.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault()
        const offset = event.key === 'ArrowDown' ? 1 : -1
        languageOptions[(index + offset + languageOptions.length) % languageOptions.length]?.focus()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        setLanguageMenuOpen(false)
        languageTrigger.focus()
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        setLanguageMenuOpen(false)
        void switchLanguage(option.dataset.lang as Lang)
      }
    })
  })

  document.addEventListener('click', () => {
    setLanguageMenuOpen(false)
  })

  // 打开联系顾问弹窗
  function openContactModal() {
    contactOptions.innerHTML = ''
    const wa = siteSettings?.contactWhatsApp?.trim()
    const qr = siteSettings?.contactWecomQrUrl?.trim()
    if (wa) {
      const a = document.createElement('a')
      a.className = 'chat-widget-contact-option'
      a.href = `https://wa.me/${wa}`
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.innerHTML = `<svg viewBox="0 0 24 24"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2zm0 18.15c-1.48 0-2.93-.4-4.2-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.264 8.264 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.183 8.183 0 0 1 2.41 5.83c0 4.54-3.7 8.23-8.24 8.23zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.02-.38-1.94-1.2-.72-.64-1.2-1.43-1.34-1.68-.14-.25-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.17-.25.25-.41.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43-.14 0-.31-.01-.47-.01s-.43.06-.66.31c-.23.25-.87.85-.87 2.07 0 1.22.89 2.4 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.6 1.68-1.18.21-.58.21-1.07.14-1.18-.06-.11-.22-.17-.47-.29z"/></svg><span>WhatsApp</span>`
      contactOptions.appendChild(a)
    }
    if (qr) {
      const btn = document.createElement('div')
      btn.className = 'chat-widget-contact-option'
      btn.style.cursor = 'pointer'
      btn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h4v4H7V7zm6 0h4v4h-4V7zM7 13h4v4H7v-4zm6 0h4v4h-4v-4z"/></svg><span>${t(lang, 'contact.wechatQr')}</span>`
      btn.addEventListener('click', () => {
        contactOptions.innerHTML = ''
        const img = document.createElement('img')
        img.className = 'chat-widget-contact-qr'
        img.src = qr
        img.alt = t(lang, 'contact.wechatQr')
        contactOptions.appendChild(img)
      })
      contactOptions.appendChild(btn)
    }
    contactModal.classList.add('open')
  }

  function closeContactModal() {
    contactModal.classList.remove('open')
  }
  contactBtn.addEventListener('click', openContactModal)
  contactCloseBtn.addEventListener('click', closeContactModal)

  // 退出挽留：关闭聊天窗口时触发一次
  function tryShowRetain(): boolean {
    if (retainShown) return false
    retainShown = true
    retainInput.value = ''
    retainModal.classList.add('open')
    return true
  }

  function closeRetainModal() {
    retainModal.classList.remove('open')
  }

  // 挽留卡片提交手机号
  retainSubmitBtn.addEventListener('click', async () => {
    const phone = retainInput.value.trim()
    if (!phone) {
      retainInput.focus()
      return
    }
    closeRetainModal()
    // 提交线索（若会话已创建）
    if (conversationCreated) {
      try {
        await api.submitLead({ phone })
      } catch (e) {
        // 忽略，不影响关闭
      }
    }
    addMessage({ role: 'assistant', content: t(lang, 'retain.success') }, true)
  })

  // 仍要关闭
  retainSkipBtn.addEventListener('click', () => {
    closeRetainModal()
    actuallyCloseWindow()
  })

  // 当前气泡文案列表
  function getBubbleMessages(): string[] {
    const list = resolveList(siteSettings?.bubbleMessages, lang)
    if (list.length > 0) return list
    return [t(lang, 'header.welcome')]
  }

  // 显示气泡（常驻，不自动隐藏）
  function showBubble() {
    const msgs = getBubbleMessages()
    if (msgs.length === 0 || isOpen) return
    bubbleIndex = bubbleIndex % msgs.length
    bubble.textContent = msgs[bubbleIndex]
    bubble.classList.remove('switching')
    bubble.classList.add('show')
    bubbleVisible = true
    adjustBubbleDirection()
    startBubbleRotation()
  }

  // 根据按钮位置调整气泡方向：左半屏 → 气泡在右；右半屏 → 气泡在左（默认）
  function adjustBubbleDirection() {
    const rect = button.getBoundingClientRect()
    const isLeftHalf = rect.left + rect.width / 2 < globalThis.innerWidth / 2
    if (isLeftHalf) {
      bubble.style.right = 'auto'
      bubble.style.left = '72px'
      bubble.style.transform = 'translateY(-50%)'
      bubble.classList.add('bubble-right')
    } else {
      bubble.style.left = 'auto'
      bubble.style.right = '72px'
      bubble.style.transform = 'translateY(-50%)'
      bubble.classList.remove('bubble-right')
    }
  }

  // 站点配置到达后刷新：更新文案并按需启动轮播
  function refreshBubble() {
    const msgs = getBubbleMessages()
    if (msgs.length === 0) {
      hideBubble()
      return
    }
    if (bubbleIndex >= msgs.length) bubbleIndex = 0
    bubble.textContent = msgs[bubbleIndex]
    startBubbleRotation()
  }

  function startBubbleRotation() {
    stopBubbleRotation()
    const msgs = getBubbleMessages()
    if (msgs.length <= 1) return
    bubbleInterval = setInterval(() => {
      if (isOpen || !bubbleVisible) return
      bubble.classList.add('switching')
      setTimeout(() => {
        bubbleIndex = (bubbleIndex + 1) % msgs.length
        bubble.textContent = msgs[bubbleIndex]
        bubble.classList.remove('switching')
      }, BUBBLE_SWITCH_MS)
    }, BUBBLE_INTERVAL_MS)
  }

  function stopBubbleRotation() {
    if (bubbleInterval) {
      clearInterval(bubbleInterval)
      bubbleInterval = null
    }
  }

  function hideBubble() {
    bubble.classList.remove('show', 'switching')
    bubbleVisible = false
    stopBubbleRotation()
  }

  // 点击气泡打开窗口
  bubble.addEventListener('click', (e) => {
    e.stopPropagation()
    hideBubble()
    if (!isOpen) toggle()
  })

  // 切换窗口
  function adjustChatWindowPosition() {
    const containerRect = container.getBoundingClientRect()
    const windowRect = chatWindow.getBoundingClientRect()
    const viewportPadding = 8
    const maxLeft = Math.max(viewportPadding, globalThis.innerWidth - windowRect.width - viewportPadding)
    const maxTop = Math.max(viewportPadding, globalThis.innerHeight - windowRect.height - viewportPadding)
    const preferWindowRight = containerRect.left + containerRect.width / 2 < globalThis.innerWidth / 2
    const desiredLeft = preferWindowRight
      ? containerRect.left
      : containerRect.right - windowRect.width
    const desiredTop = containerRect.top - windowRect.height - 16
    const left = Math.min(maxLeft, Math.max(viewportPadding, desiredLeft))
    const top = Math.min(maxTop, Math.max(viewportPadding, desiredTop))

    chatWindow.style.left = (left - containerRect.left) + 'px'
    chatWindow.style.right = 'auto'
    chatWindow.style.top = (top - containerRect.top) + 'px'
    chatWindow.style.bottom = 'auto'
  }
  function toggle() {
    isOpen = !isOpen
    if (isOpen) {
      chatWindow.classList.add('open')
      button.style.display = 'none'
      hideBubble()
      adjustChatWindowPosition()
      if (!conversationCreated) {
        initConversation()
      }
    } else {
      // 关闭聊天窗口：先尝试触发挽留（仅一次），未触发则真关
      if (conversationCreated && tryShowRetain()) {
        // 挽留卡片已弹出，用户选择后再决定是否真关
        isOpen = true  // 保持打开状态，等挽留结果
      } else {
        actuallyCloseWindow()
      }
    }
  }

  // 真正关闭窗口（挽留跳过或已挽留过）
  function actuallyCloseWindow() {
    chatWindow.classList.remove('open')
    chatWindow.style.left = ''
    chatWindow.style.right = ''
    chatWindow.style.top = ''
    chatWindow.style.bottom = ''
    button.style.display = 'flex'
    isOpen = false
    showBubble()
  }

  button.addEventListener('click', toggle)
  closeBtn.addEventListener('click', toggle)

  // === 气泡按钮拖动（拖动整个容器，容器本身已 fixed 且有 z-index）===
  let isDragging = false
  let dragStartX = 0
  let dragStartY = 0
  let conLeft0 = 0
  let conTop0 = 0
  let hasDragged = false
  const DRAG_THRESHOLD = 5

  function onDragStart(clientX: number, clientY: number) {
    const rect = container.getBoundingClientRect()
    conLeft0 = rect.left
    conTop0 = rect.top
    dragStartX = clientX
    dragStartY = clientY
    hasDragged = false
    isDragging = true
  }

  function onDragMove(clientX: number, clientY: number) {
    if (!isDragging) return
    const dx = clientX - dragStartX
    const dy = clientY - dragStartY
    if (!hasDragged && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
      hasDragged = true
      // 首次越阈值：容器从 right+transform 定位切到 left/top 定位（容器本身已 fixed）
      container.style.right = 'auto'
      container.style.transform = 'none'
      container.style.left = conLeft0 + 'px'
      container.style.top = conTop0 + 'px'
      hideBubble()
    }
    if (hasDragged) {
      const buttonRect = button.getBoundingClientRect()
      let newLeft = Math.max(0, Math.min(globalThis.innerWidth - buttonRect.width, conLeft0 + dx))
      let newTop = Math.max(0, Math.min(globalThis.innerHeight - buttonRect.height, conTop0 + dy))
      container.style.left = newLeft + 'px'
      container.style.top = newTop + 'px'
    }
  }

  function onDragEnd() {
    if (!isDragging) return
    isDragging = false
    if (hasDragged) {
      // 拖动后延迟恢复气泡
      setTimeout(() => { if (!isOpen) showBubble() }, 800)
    }
  }

  // 阻止 click 事件在拖动后触发
  button.addEventListener('click', (e) => {
    if (hasDragged) {
      e.preventDefault()
      e.stopPropagation()
      hasDragged = false
      return
    }
  }, true) // 捕获阶段，先于 toggle

  button.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return
    onDragStart(e.clientX, e.clientY)
  })
  document.addEventListener('mousemove', (e) => onDragMove(e.clientX, e.clientY))
  document.addEventListener('mouseup', onDragEnd)

  // 触摸事件
  button.addEventListener('touchstart', (e) => {
    const t = e.touches[0]
    onDragStart(t.clientX, t.clientY)
  }, { passive: true })
  document.addEventListener('touchmove', (e) => {
    if (!isDragging) return
    const t = e.touches[0]
    onDragMove(t.clientX, t.clientY)
    e.preventDefault()
  }, { passive: false })
  document.addEventListener('touchend', onDragEnd)

  // 初始化会话
  async function initConversation() {
    conversationCreated = true
    const result = await api.createSession()
    // 优先用 session 返回的配置，否则用提前获取的
    const settings = result.siteSettings || siteSettings
    if (settings) {
      siteSettings = settings
      applyThemeColor(settings.primaryColor)
      updateContactButton()
    }
    // 显示欢迎消息
    welcomeMessage = { role: 'assistant', content: resolveText(settings?.welcomeMessage, lang, t(lang, 'header.welcome')) }
    welcomeMessageEl = addMessage(welcomeMessage, true)
    // 显示引导语
    const guide = resolveText(settings?.guideMessage, lang)
    if (guide) {
      setTimeout(() => {
        const currentGuide = resolveText(siteSettings?.guideMessage, lang)
        if (!currentGuide) return
        guideMessage = { role: 'assistant', content: currentGuide }
        guideMessageEl = addMessage(guideMessage, true)
      }, 1500)
    }
    loadFaqs()
    // 启动 SSE 监听后台人工回复
    startAgentStream()
    // 重连时拉取未读消息
    fetchUnreadMessages()
  }

  // SSE 监听后台消息
  let closeStream: (() => void) | null = null
  let lastMessageTime: string | null = null
  function startAgentStream() {
    if (closeStream) closeStream()
    closeStream = api.startStream((payload: any) => {
      if (payload.event === 'agent_reply' && payload.data) {
        const d = payload.data
        addMessage({ role: 'assistant', content: d.content }, true)
        lastMessageTime = d.createdAt || new Date().toISOString()
      }
    })
  }

  // 重连时拉取未读消息（对比本地最后消息时间）
  async function fetchUnreadMessages() {
    if (!lastMessageTime) return
    const msgs = await api.fetchMessagesAfter(lastMessageTime)
    for (const m of msgs) {
      if (m.role === 'assistant' && m.source === 'human') {
        addMessage({ role: 'assistant', content: m.content }, true)
        lastMessageTime = m.createdAt
      }
    }
  }

  // 加载高频问题（初始）
  async function loadFaqs() {
    faqs = await api.getFaqs()
    renderFaqs(faqs.map(f => f.question))
  }

  // 渲染 FAQ 按钮区域（先清空旧的，再渲染新的）
  function renderFaqs(questions: string[]) {
    faqsEl.innerHTML = ''
    questions.slice(0, MAX_VISIBLE_FAQS).forEach(q => {
      const btn = document.createElement('button')
      btn.className = 'chat-faq-btn'
      btn.textContent = q
      btn.addEventListener('click', () => sendMessage(q))
      faqsEl.appendChild(btn)
    })
  }

  function updateWelcomeMessages() {
    if (welcomeMessage && welcomeMessageEl) {
      welcomeMessage.content = resolveText(siteSettings?.welcomeMessage, lang, t(lang, 'header.welcome'))
      setAssistantContent(welcomeMessageEl, welcomeMessage.content)
    }
    if (guideMessage && guideMessageEl) {
      guideMessage.content = resolveText(siteSettings?.guideMessage, lang)
      setAssistantContent(guideMessageEl, guideMessage.content)
    }
  }

  // 添加消息到 UI（用户消息直接显示，AI 消息用打字机效果）
  function addMessage(message: Message, useTypewriter = false): HTMLElement {
    messages.push(message)
    const el = document.createElement('div')
    el.className = `chat-message ${message.role}`
    messagesEl.appendChild(el)

    if (useTypewriter && message.role === 'assistant') {
      typewriter(el, message.content)
    } else if (message.role === 'assistant') {
      el.innerHTML = renderMarkdown(message.content)
      messagesEl.scrollTop = messagesEl.scrollHeight
    } else {
      el.textContent = message.content
      messagesEl.scrollTop = messagesEl.scrollHeight
    }
    return el
  }

  function setAssistantContent(el: HTMLElement, text: string) {
    const timer = typewriterTimers.get(el)
    if (timer) {
      clearInterval(timer)
      typewriterTimers.delete(el)
    }
    el.innerHTML = renderMarkdown(text)
    el.style.cursor = ''
    messagesEl.scrollTop = messagesEl.scrollHeight
  }

  // 打字机效果：逐字显示
  function typewriter(el: HTMLElement, text: string, speed = 25) {
    let index = 0
    el.style.cursor = 'pointer'
    el.addEventListener('click', () => setAssistantContent(el, text))

    const timer = setInterval(() => {
      if (index < text.length) {
        el.innerHTML = renderMarkdown(text.slice(0, index + 1))
        index++
        messagesEl.scrollTop = messagesEl.scrollHeight
      } else {
        clearInterval(timer)
        typewriterTimers.delete(el)
        el.style.cursor = ''
      }
    }, speed)
    typewriterTimers.set(el, timer)
  }

  // 显示 loading
  function addLoading() {
    const el = document.createElement('div')
    el.className = 'chat-widget-loading'
    el.textContent = t(lang, 'loading')
    el.id = 'loading-msg'
    messagesEl.appendChild(el)
    messagesEl.scrollTop = messagesEl.scrollHeight
  }

  function removeLoading() {
    const el = shadow.getElementById('loading-msg')
    if (el) el.remove()
  }

  // 发送消息
  async function sendMessage(content: string) {
    if (!content.trim()) return

    input.value = ''
    sendBtn.disabled = true
    addMessage({ role: 'user', content })
    addLoading()

    try {
      const res = await api.sendMessage(content)
      removeLoading()
      addMessage({ role: 'assistant', content: res.reply }, true)

      // 动态更新 FAQ 推荐区域（基于当前问题，排除已问过的）
      if (Array.isArray(res.suggestedQuestions) && res.suggestedQuestions.length > 0) {
        renderFaqs(res.suggestedQuestions)
      }

      if (res.needForm) {
        openForm()
      }
    } catch (err) {
      removeLoading()
      addMessage({ role: 'assistant', content: t(lang, 'networkError') }, true)
    } finally {
      sendBtn.disabled = false
      input.focus()
    }
  }

  sendBtn.addEventListener('click', () => sendMessage(input.value))
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      sendMessage(input.value)
    }
  })

  // 打开表单
  function openForm() {
    renderForm(formOverlay, lang, async (data, extra) => {
      await api.submitLead(data, extra)
      closeForm()
      addMessage({ role: 'assistant', content: t(lang, 'form.success') })
    }, closeForm, siteSettings?.formConfig)
    // 重新插入拖动条 handle（renderForm 会清空容器）
    const handle = document.createElement('div')
    handle.className = 'chat-form-overlay-handle'
    formOverlay.insertBefore(handle, formOverlay.firstChild)
    formOverlay.classList.add('open')
  }

  function closeForm() {
    formOverlay.classList.remove('open')
  }

  // enable send button when input has content
  input.addEventListener('input', () => {
    sendBtn.disabled = !input.value.trim()
  })

  return {
    setLanguage: switchLanguage,
    getLanguage: () => lang,
  }
}
