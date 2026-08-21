import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_SITE_LANGUAGES,
  isEnabledSiteLanguage,
  normalizeSiteLanguages,
  resolveEnabledSiteLanguage,
  validateSiteLanguages,
} from './site-languages'

test('site languages normalize legacy and custom language entries', () => {
  assert.deepEqual(normalizeSiteLanguages(undefined), DEFAULT_SITE_LANGUAGES)
  assert.deepEqual(normalizeSiteLanguages([
    { code: 'zh-cn', label: 'Chinese', enabled: true },
    { code: 'fr', label: 'French', enabled: false },
    { code: 'fr', label: 'Duplicate', enabled: true },
  ]), [
    { code: 'zh-CN', label: 'Chinese', enabled: true },
    { code: 'fr', label: 'French', enabled: false },
  ])
})

test('site language validation protects the management boundary', () => {
  assert.equal(validateSiteLanguages([{ code: 'fr', label: 'French', enabled: true }]), null)
  assert.match(validateSiteLanguages([{ code: 'f', label: 'French', enabled: true }]) || '', /invalid language code/)
  assert.match(validateSiteLanguages([{ code: 'en-US-extra', label: 'Invalid', enabled: true }]) || '', /invalid language code/)
  assert.match(validateSiteLanguages([
    { code: 'fr', label: 'French', enabled: true },
    { code: 'FR', label: 'Duplicate', enabled: true },
  ]) || '', /duplicate language code/)
  assert.match(validateSiteLanguages([{ code: 'fr', label: 'French', enabled: false }]) || '', /at least one language/)
  assert.equal(isEnabledSiteLanguage([{ code: 'fr', label: 'French', enabled: true }], 'fr'), true)
  assert.equal(resolveEnabledSiteLanguage([{ code: 'fr', label: 'French', enabled: true }], 'FR'), 'fr')
  assert.equal(isEnabledSiteLanguage([{ code: 'fr', label: 'French', enabled: false }], 'fr'), false)
})
