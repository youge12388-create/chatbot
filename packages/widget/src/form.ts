/**
 * 线索收集表单
 * - 根据 siteSettings.formConfig 动态渲染
 * - 预设字段（name/phone/email/wechat/education/targetMajor/budget）按启用开关渲染
 * - 自定义字段渲染到 extra 对象
 * - 必填字段前端校验
 */

import { Lang, t } from './i18n'
import { FormConfig } from './api'

/** 默认表单配置（站点未配置时兜底） */
const DEFAULT_FORM_CONFIG: FormConfig = {
  presetFields: {
    name:          { enabled: true,  required: true },
    phone:         { enabled: true,  required: true },
    applyingLevel: { enabled: true,  required: false },
    email:         { enabled: false, required: false },
    wechat:        { enabled: false, required: false },
    education:     { enabled: false, required: false },
    targetMajor:   { enabled: false, required: false },
    budget:        { enabled: false, required: false },
  },
  customFields: [],
}

/** 申请学历层次选项 */
const APPLYING_LEVEL_OPTIONS = ['本科', '硕士', '博士', '预科', '语言班']

/** 预设字段顺序与多语言 label。select 类型用 options 渲染下拉 */
const PRESET_FIELDS: Array<{
  key: string
  labels: Record<Lang, string>
  placeholder: Record<Lang, string>
  type?: 'text' | 'tel' | 'email' | 'select'
  options?: string[]
}> = [
  { key: 'name',          labels: { 'zh-CN': '姓名',       en: 'Name',           ru: 'Имя' },            placeholder: { 'zh-CN': '您的称呼',          en: 'Your name',            ru: 'Ваше имя' } },
  { key: 'phone',         labels: { 'zh-CN': '手机号',     en: 'Phone',          ru: 'Телефон' },        placeholder: { 'zh-CN': '您的手机号码',      en: 'Your phone number',    ru: 'Ваш номер телефона' }, type: 'tel' },
  { key: 'applyingLevel', labels: { 'zh-CN': '申请学历',   en: 'Applying Level', ru: 'Уровень' },        placeholder: { 'zh-CN': '请选择',            en: 'Please select',        ru: 'Выберите' },           type: 'select', options: APPLYING_LEVEL_OPTIONS },
  { key: 'email',          labels: { 'zh-CN': '邮箱',       en: 'Email',          ru: 'Email' },          placeholder: { 'zh-CN': '您的邮箱',          en: 'Your email',           ru: 'Ваш email' },           type: 'email' },
  { key: 'wechat',         labels: { 'zh-CN': '微信号',     en: 'WeChat',         ru: 'WeChat' },         placeholder: { 'zh-CN': '微信号',            en: 'WeChat ID',            ru: 'WeChat ID' } },
  { key: 'education',      labels: { 'zh-CN': '学历',       en: 'Education',      ru: 'Образование' },   placeholder: { 'zh-CN': '如：本科、大专、高中', en: 'e.g. Bachelor',       ru: 'напр. Бакалавр' } },
  { key: 'targetMajor',    labels: { 'zh-CN': '意向专业',   en: 'Intended Major', ru: 'Специальность' }, placeholder: { 'zh-CN': '您想申请的专业',    en: 'Intended major',       ru: 'Ваша специальность' } },
  { key: 'budget',         labels: { 'zh-CN': '预算',       en: 'Budget',         ru: 'Бюджет' },         placeholder: { 'zh-CN': '如：30万/年',       en: 'e.g. 300k/year',       ru: 'напр. 300k/год' } },
]

/** 校验手机号（中国11位或国际格式） */
function isValidPhone(phone: string): boolean {
  const trimmed = phone.trim()
  if (/^1[3-9]\d{9}$/.test(trimmed)) return true
  if (/^\+\d{6,15}$/.test(trimmed)) return true
  return false
}

/** 校验邮箱格式（空字符串视为合法，必填由上层校验） */
function isValidEmail(email: string): boolean {
  if (!email.trim()) return true
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

/** 显示字段错误 */
function showError(input: HTMLElement, msg: string) {
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
function clearError(input: HTMLElement) {
  input.style.borderColor = '#ddd'
  const errEl = input.parentElement!.querySelector('.chat-form-error')
  if (errEl) errEl.remove()
}

/** 必填项错误提示本地化 */
function requiredMsg(lang: Lang): string {
  if (lang === 'en') return 'This field is required'
  if (lang === 'ru') return 'Поле обязательно для заполнения'
  return '请填写完整信息'
}

/** 手机号格式错误提示本地化 */
function invalidPhoneMsg(lang: Lang): string {
  if (lang === 'en') return 'Invalid phone format'
  if (lang === 'ru') return 'Неверный формат телефона'
  return '手机号格式不正确'
}

/** 邮箱格式错误提示本地化 */
function invalidEmailMsg(lang: Lang): string {
  if (lang === 'en') return 'Invalid email format'
  if (lang === 'ru') return 'Неверный формат email'
  return '邮箱格式不正确'
}

/** 兜底 formConfig：补全缺失预设字段，customFields 缺失则空数组 */
function normalizeFormConfig(fc?: FormConfig): FormConfig {
  if (!fc || typeof fc !== 'object') return JSON.parse(JSON.stringify(DEFAULT_FORM_CONFIG))
  const presetFields: FormConfig['presetFields'] = {}
  for (const item of PRESET_FIELDS) {
    const cur = fc.presetFields?.[item.key]
    presetFields[item.key] = {
      enabled: !!cur?.enabled,
      required: !!cur?.required,
    }
  }
  const customFields = Array.isArray(fc.customFields)
    ? fc.customFields.filter(f => f && typeof f.id === 'string' && typeof f.label === 'string')
    : []
  return { presetFields, customFields }
}

/** 创建字段容器（.chat-form-row，包含 label 和必填标记） */
function createRow(labelText: string, required: boolean): HTMLElement {
  const row = document.createElement('div')
  row.className = 'chat-form-row'
  const label = document.createElement('label')
  label.innerHTML = required
    ? `${labelText} <span style="color:#ff4d4f">*</span>`
    : labelText
  row.appendChild(label)
  return row
}

/** 为输入元素绑定清除错误事件 */
function bindClearOnError(input: HTMLElement) {
  input.addEventListener('input', () => clearError(input))
}

/**
 * 渲染动态表单
 * - 预设字段值通过 onSubmit 第一参数（顶层字段）回传
 * - 自定义字段值通过 onSubmit 第二参数 extra 回传
 */
export function renderForm(
  container: HTMLElement,
  lang: Lang,
  onSubmit: (data: Record<string, string>, extra: Record<string, string>) => void,
  onCancel: () => void,
  formConfig?: FormConfig,
) {
  const fc = normalizeFormConfig(formConfig)

  container.innerHTML = ''
  const title = document.createElement('h4')
  title.textContent = t(lang, 'form.title')
  container.appendChild(title)

  // 跟踪每个字段对应的 input 元素和校验函数
  type FieldEntry = {
    name: string
    el: HTMLElement
    required: boolean
    validate: (value: string) => string | null // 返回错误信息，null 表示通过
  }
  const fields: FieldEntry[] = []

  // 1. 渲染启用的预设字段
  for (const preset of PRESET_FIELDS) {
    const conf = fc.presetFields[preset.key]
    if (!conf || !conf.enabled) continue
    const labelText = preset.labels[lang] || preset.labels['zh-CN']
    const placeholder = preset.placeholder[lang] || preset.placeholder['zh-CN']
    const row = createRow(labelText, conf.required)
    let input: HTMLElement
    if (preset.type === 'select') {
      const sel = document.createElement('select')
      sel.name = preset.key
      sel.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; font-size: 14px; background: #fff;'
      const placeholderOpt = document.createElement('option')
      placeholderOpt.value = ''
      placeholderOpt.textContent = placeholder
      placeholderOpt.disabled = true
      placeholderOpt.selected = true
      sel.appendChild(placeholderOpt)
      for (const opt of preset.options || []) {
        const o = document.createElement('option')
        o.value = opt
        o.textContent = opt
        sel.appendChild(o)
      }
      input = sel
    } else {
      const inp = document.createElement('input')
      inp.type = preset.type || (preset.key === 'phone' ? 'tel' : (preset.key === 'email' ? 'email' : 'text'))
      inp.name = preset.key
      inp.placeholder = placeholder
      input = inp
    }
    row.appendChild(input)
    container.appendChild(row)
    bindClearOnError(input)

    fields.push({
      name: preset.key,
      el: input,
      required: conf.required,
      validate: (value: string) => {
        if (conf.required && !value.trim()) return requiredMsg(lang)
        if (preset.key === 'phone' && value.trim() && !isValidPhone(value)) return invalidPhoneMsg(lang)
        if (preset.key === 'email' && value.trim() && !isValidEmail(value)) return invalidEmailMsg(lang)
        return null
      },
    })
  }

  // 2. 渲染自定义字段（值提交到 extra，name 用字段 id）
  for (const custom of fc.customFields) {
    const row = createRow(custom.label, custom.required)
    let input: HTMLElement
    if (custom.type === 'textarea') {
      const ta = document.createElement('textarea')
      ta.rows = 2
      ta.name = custom.id
      ta.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; font-size: 14px; resize: vertical;'
      input = ta
    } else if (custom.type === 'select') {
      const sel = document.createElement('select')
      sel.name = custom.id
      sel.style.cssText = 'width: 100%; padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; box-sizing: border-box; font-size: 14px; background: #fff;'
      const placeholderOpt = document.createElement('option')
      placeholderOpt.value = ''
      placeholderOpt.textContent = lang === 'en' ? 'Please select' : lang === 'ru' ? 'Выберите' : '请选择'
      placeholderOpt.disabled = true
      placeholderOpt.selected = true
      sel.appendChild(placeholderOpt)
      for (const opt of custom.options || []) {
        const o = document.createElement('option')
        o.value = opt
        o.textContent = opt
        sel.appendChild(o)
      }
      input = sel
    } else {
      const inp = document.createElement('input')
      inp.type = custom.type === 'tel' ? 'tel' : (custom.type === 'email' ? 'email' : 'text')
      inp.name = custom.id
      input = inp
    }
    row.appendChild(input)
    container.appendChild(row)
    bindClearOnError(input)

    fields.push({
      name: custom.id,
      el: input,
      required: custom.required,
      validate: (value: string) => {
        if (custom.required && !value.trim()) return requiredMsg(lang)
        if (custom.type === 'email' && value.trim() && !isValidEmail(value)) return invalidEmailMsg(lang)
        return null
      },
    })
  }

  // 3. 操作按钮
  const actions = document.createElement('div')
  actions.className = 'chat-form-actions'
  const submitBtn = document.createElement('button')
  submitBtn.className = 'chat-form-submit'
  submitBtn.textContent = t(lang, 'form.submit')
  const cancelBtn = document.createElement('button')
  cancelBtn.className = 'chat-form-cancel'
  cancelBtn.textContent = t(lang, 'form.cancel')
  actions.appendChild(submitBtn)
  actions.appendChild(cancelBtn)
  container.appendChild(actions)

  submitBtn.addEventListener('click', () => {
    let hasError = false
    let firstErrorEl: HTMLElement | null = null
    const data: Record<string, string> = {}
    const extra: Record<string, string> = {}

    for (const f of fields) {
      const el = f.el as HTMLInputElement & HTMLTextAreaElement & HTMLSelectElement
      const value = el.value
      const err = f.validate(value)
      if (err) {
        showError(f.el, err)
        if (!firstErrorEl) firstErrorEl = f.el
        hasError = true
        continue
      }
      // 预设字段 key 在 PRESET_FIELDS 列表中
      const isPreset = PRESET_FIELDS.some(p => p.key === f.name)
      if (isPreset) {
        data[f.name] = value.trim()
      } else {
        extra[f.name] = value.trim()
      }
    }

    if (hasError) {
      if (firstErrorEl) (firstErrorEl as HTMLElement).focus()
      return
    }

    onSubmit(data, extra)
  })

  cancelBtn.addEventListener('click', onCancel)
}
