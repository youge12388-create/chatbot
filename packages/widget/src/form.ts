/**
 * 线索收集表单
 */

import { Lang, t } from './i18n'

export function renderForm(
  container: HTMLElement,
  lang: Lang,
  onSubmit: (data: Record<string, string>) => void,
  onCancel: () => void,
) {
  container.innerHTML = `
    <h4>${t(lang, 'form.title')}</h4>
    <div class="chat-form-row">
      <label>${t(lang, 'form.name')}</label>
      <input type="text" name="name" placeholder="${t(lang, 'form.namePlaceholder')}" />
    </div>
    <div class="chat-form-row">
      <label>${t(lang, 'form.phone')}</label>
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

  container.querySelector('.chat-form-submit')!.addEventListener('click', () => {
    const inputs = container.querySelectorAll<HTMLInputElement>('input')
    const data: Record<string, string> = {}
    inputs.forEach((input) => {
      data[input.name] = input.value
    })
    onSubmit(data)
  })

  container.querySelector('.chat-form-cancel')!.addEventListener('click', onCancel)
}