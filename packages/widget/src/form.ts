/**
 * 线索收集表单
 * - 姓名、手机号为必填
 * - 手机号校验格式（支持中国/国际格式）
 * - 邮箱选填但校验格式
 */

import { Lang, t } from './i18n'

/** 校验手机号（中国11位或国际格式） */
function isValidPhone(phone: string): boolean {
  const trimmed = phone.trim()
  // 中国手机号：1开头11位
  if (/^1[3-9]\d{9}$/.test(trimmed)) return true
  // 国际格式：+国家号 手机号
  if (/^\+\d{6,15}$/.test(trimmed)) return true
  return false
}

/** 校验邮箱格式 */
function isValidEmail(email: string): boolean {
  if (!email.trim()) return true // 选填
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/** 显示字段错误 */
function showError(input: HTMLInputElement, msg: string) {
  input.style.borderColor = '#ff4d4f'
  let errEl = input.parentElement!.querySelector('.chat-form-error')
  if (!errEl) {
    errEl = document.createElement('div')
    errEl.className = 'chat-form-error'
    errEl.style.cssText = 'color: #ff4d4f; font-size: 12px; margin-top: 4px;'
    input.parentElement!.appendChild(errEl)
  }
  errEl.textContent = msg
}

/** 清除字段错误 */
function clearError(input: HTMLInputElement) {
  input.style.borderColor = '#ddd'
  const errEl = input.parentElement!.querySelector('.chat-form-error')
  if (errEl) errEl.remove()
}

export function renderForm(
  container: HTMLElement,
  lang: Lang,
  onSubmit: (data: Record<string, string>) => void,
  onCancel: () => void,
) {
  container.innerHTML = `
    <h4>${t(lang, 'form.title')}</h4>
    <div class="chat-form-row">
      <label>${t(lang, 'form.name')} <span style="color:#ff4d4f">*</span></label>
      <input type="text" name="name" placeholder="${t(lang, 'form.namePlaceholder')}" />
    </div>
    <div class="chat-form-row">
      <label>${t(lang, 'form.phone')} <span style="color:#ff4d4f">*</span></label>
      <input type="tel" name="phone" placeholder="${t(lang, 'form.phonePlaceholder')}" />
    </div>
    <div class="chat-form-row">
      <label>${t(lang, 'form.wechat')}</label>
      <input type="text" name="wechat" placeholder="${t(lang, 'form.wechatPlaceholder')}" />
    </div>
    <div class="chat-form-row">
      <label>${t(lang, 'form.education')}</label>
      <input type="text" name="education" placeholder="${t(lang, 'form.educationPlaceholder')}" />
    </div>
    <div class="chat-form-row">
      <label>${t(lang, 'form.major')}</label>
      <input type="text" name="targetMajor" placeholder="${t(lang, 'form.majorPlaceholder')}" />
    </div>
    <div class="chat-form-actions">
      <button class="chat-form-submit">${t(lang, 'form.submit')}</button>
      <button class="chat-form-cancel">${t(lang, 'form.cancel')}</button>
    </div>
  `

  const nameInput = container.querySelector<HTMLInputElement>('input[name="name"]')!
  const phoneInput = container.querySelector<HTMLInputElement>('input[name="phone"]')!

  // 输入时清除错误
  nameInput.addEventListener('input', () => clearError(nameInput))
  phoneInput.addEventListener('input', () => clearError(phoneInput))

  container.querySelector('.chat-form-submit')!.addEventListener('click', () => {
    let hasError = false

    // 校验姓名
    if (!nameInput.value.trim()) {
      showError(nameInput, lang === 'zh-CN' ? '请填写姓名' : lang === 'en' ? 'Name is required' : 'Введите имя')
      hasError = true
    }

    // 校验手机号
    if (!phoneInput.value.trim()) {
      showError(phoneInput, lang === 'zh-CN' ? '请填写手机号' : lang === 'en' ? 'Phone is required' : 'Введите телефон')
      hasError = true
    } else if (!isValidPhone(phoneInput.value)) {
      showError(phoneInput, lang === 'zh-CN' ? '手机号格式不正确' : lang === 'en' ? 'Invalid phone format' : 'Неверный формат телефона')
      hasError = true
    }

    if (hasError) return

    const inputs = container.querySelectorAll<HTMLInputElement>('input')
    const data: Record<string, string> = {}
    inputs.forEach((input) => {
      data[input.name] = input.value.trim()
    })
    onSubmit(data)
  })

  container.querySelector('.chat-form-cancel')!.addEventListener('click', onCancel)
}