/**
 * 渲染 UI：浮窗按钮 + 聊天窗口
 */

import { ChatApi, FaqItem } from './api'
import { renderForm } from './form'
import { Lang, t } from './i18n'

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
}
.chat-widget-button:hover {
  transform: scale(1.05);
}
.chat-widget-button svg {
  width: 28px;
  height: 28px;
  fill: white;
}

.chat-widget-window {
  width: 380px;
  height: 520px;
  background: #fff;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  display: none;
  flex-direction: column;
  overflow: hidden;
  margin-bottom: 16px;
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
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(255, 255, 255, 0.98);
  display: none;
  padding: 16px;
  overflow-y: auto;
}
.chat-widget-form-overlay.open {
  display: block;
}
.chat-widget-form-overlay h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
}
.chat-form-row {
  margin-bottom: 12px;
}
.chat-form-row label {
  display: block;
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
}
.chat-form-row input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-sizing: border-box;
  font-size: 14px;
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
  apiHost: string
  lang: Lang
}

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function createWidget(config: WidgetConfig) {
  const api = new ChatApi(config.apiHost, config.siteId, config.lang)
  const lang = config.lang

  // Shadow DOM 隔离样式
  const container = document.createElement('div')
  container.className = 'chat-widget-container'
  const shadow = container.attachShadow({ mode: 'open' })

  // HTML 结构
  shadow.innerHTML = `
    <style>${CSS}</style>
    <div class="chat-widget-window">
      <div class="chat-widget-header">
        <h3>${t(lang, 'header.title')}</h3>
        <div class="chat-widget-close">
          <svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
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
      <div class="chat-widget-form-overlay"></div>
    </div>
    <div class="chat-widget-button">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
    </div>
  `

  document.body.appendChild(container)

  // 元素引用
  const button = shadow.querySelector('.chat-widget-button')!
  const window = shadow.querySelector('.chat-widget-window')!
  const closeBtn = shadow.querySelector('.chat-widget-close')!
  const messagesEl = shadow.querySelector('.chat-widget-messages')!
  const faqsEl = shadow.querySelector('.chat-widget-faqs')!
  const input = shadow.querySelector('.chat-widget-input input')!
  const sendBtn = shadow.querySelector('.chat-widget-send')!
  const formOverlay = shadow.querySelector<HTMLElement>('.chat-widget-form-overlay')!

  // 状态
  let isOpen = false
  let messages: Message[] = []
  let faqs: FaqItem[] = []
  let conversationCreated = false

  // 切换窗口
  function toggle() {
    isOpen = !isOpen
    if (isOpen) {
      window.classList.add('open')
      button.style.display = 'none'
      if (!conversationCreated) {
        initConversation()
      }
    } else {
      window.classList.remove('open')
      button.style.display = 'block'
    }
  }

  button.addEventListener('click', toggle)
  closeBtn.addEventListener('click', toggle)

  // 初始化会话
  async function initConversation() {
    conversationCreated = true
    await api.createSession()
    loadFaqs()
  }

  // 加载高频问题
  async function loadFaqs() {
    faqs = await api.getFaqs()
    faqs.forEach(faq => {
      const btn = document.createElement('button')
      btn.className = 'chat-faq-btn'
      btn.textContent = faq.question
      btn.addEventListener('click', () => sendMessage(faq.question))
      faqsEl.appendChild(btn)
    })
  }

  // 添加消息到 UI
  function addMessage(message: Message) {
    messages.push(message)
    const el = document.createElement('div')
    el.className = `chat-message ${message.role}`
    el.textContent = message.content
    messagesEl.appendChild(el)
    messagesEl.scrollTop = messagesEl.scrollHeight
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
      addMessage({ role: 'assistant', content: res.reply })

      if (res.needForm) {
        openForm()
      }
    } catch (err) {
      removeLoading()
      addMessage({ role: 'assistant', content: t(lang, 'networkError') })
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
    renderForm(formOverlay, lang, async (data) => {
      await api.submitLead(data)
      closeForm()
      addMessage({ role: 'assistant', content: t(lang, 'form.success') })
    }, closeForm)
    formOverlay.classList.add('open')
  }

  function closeForm() {
    formOverlay.classList.remove('open')
  }

  // enable send button when input has content
  input.addEventListener('input', () => {
    sendBtn.disabled = !input.value.trim()
  })
}