import assert from 'node:assert/strict'
import test from 'node:test'
import { isLang, normalizeLang, resolveList, resolveText, t } from './i18n'

test('normalizes supported and browser language values', () => {
  assert.equal(isLang('en'), true)
  assert.equal(isLang('fr'), false)
  assert.equal(normalizeLang('zh-Hans'), 'zh-CN')
  assert.equal(normalizeLang('EN-us'), 'en')
  assert.equal(normalizeLang('ko-KR'), 'ko')
  assert.equal(normalizeLang('unknown', 'ru'), 'ru')
})

test('resolves localized text and legacy string values with fallbacks', () => {
  assert.equal(resolveText('  legacy value  ', 'en'), 'legacy value')
  assert.equal(resolveText({ en: 'English', 'zh-CN': '中文' }, 'en'), 'English')
  assert.equal(resolveText({ 'zh-CN': '中文' }, 'ru'), '中文')
  assert.equal(resolveText({ en: '  ' }, 'en', 'fallback'), 'fallback')
  assert.equal(resolveText(undefined, 'en', 'fallback'), 'fallback')
})

test('resolves localized lists and removes empty entries', () => {
  assert.deepEqual(resolveList([' one ', '', ' two '], 'en'), ['one', 'two'])
  assert.deepEqual(resolveList({ en: [' English '], 'zh-CN': ['中文'] }, 'en'), ['English'])
  assert.deepEqual(resolveList({ 'zh-CN': ['中文'] }, 'ru'), ['中文'])
  assert.deepEqual(resolveList(undefined, 'en'), [])
})

test('falls back to Chinese text and then the translation key', () => {
  assert.equal(t('en', 'form.submit'), 'Submit')
  assert.notEqual(t('ru', 'form.submit'), 'form.submit')
  assert.equal(t('en', 'missing.key'), 'missing.key')
})