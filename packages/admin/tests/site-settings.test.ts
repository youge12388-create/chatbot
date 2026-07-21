import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeSiteSettings } from '../src/utils/site-settings'

test('migrates legacy single-language site copy into zh-CN fields', () => {
  const legacy = {
    welcomeMessage: 'legacy welcome',
    guideMessage: 'legacy guide',
    bubbleMessages: ['legacy bubble 1', 'legacy bubble 2'],
  }

  const normalized = normalizeSiteSettings(legacy)

  assert.deepEqual(normalized.welcomeMessage, { 'zh-CN': 'legacy welcome' })
  assert.deepEqual(normalized.guideMessage, { 'zh-CN': 'legacy guide' })
  assert.deepEqual(normalized.bubbleMessages, { 'zh-CN': ['legacy bubble 1', 'legacy bubble 2'] })
  assert.deepEqual(legacy, {
    welcomeMessage: 'legacy welcome',
    guideMessage: 'legacy guide',
    bubbleMessages: ['legacy bubble 1', 'legacy bubble 2'],
  })
})

test('migrates legacy singular bubbleMessage and preserves localized copy', () => {
  const normalized = normalizeSiteSettings({
    bubbleMessage: 'legacy bubble',
    welcomeMessage: { 'zh-CN': '中文', en: 'English' },
  } as { bubbleMessage: string; welcomeMessage: { 'zh-CN': string; en: string } })

  assert.deepEqual(normalized.bubbleMessages, { 'zh-CN': ['legacy bubble'] })
  assert.deepEqual(normalized.welcomeMessage, { 'zh-CN': '中文', en: 'English' })
  assert.equal('bubbleMessage' in normalized, false)
})
