<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import Layout from '../components/Layout.vue'
import EmptyState from '../components/EmptyState.vue'
import { request } from '../api/client'
import { pushToast } from '../components/toast-bus'
import type { CustomField, Site, SiteSettings, FormConfig, CustomFieldType, LocalizedList, LocalizedText, SupportedLang } from '../types'
import { useSiteStore } from '../stores/site'
import { useAuthStore } from '../stores/auth'
import { hasSiteUrl, siteDisplayUrl } from '../utils/site'
import { normalizeSiteSettings } from '../utils/site-settings'

const loading = ref(false)
const siteStore = useSiteStore()
const auth = useAuthStore()
const list = ref<Site[]>([])
const expanded = ref<Record<string, boolean>>({})
const saving = ref<Record<string, boolean>>({})
const testing = ref<Record<string, boolean>>({})
const testingWecom = ref<Record<string, boolean>>({})
const deleting = ref<Record<string, boolean>>({})
const drafts = ref<Record<string, { id: string; name: string; domain: string; apiKey: string; settings: SiteSettings }>>({})
const showCreateForm = ref(false)
const creating = ref(false)
const newSite = ref({ name: '', domain: '' })
const createdSite = ref<Pick<Site, 'id' | 'name' | 'domain' | 'apiKey'> | null>(null)
const SUPPORTED_LANGS: Array<{ value: SupportedLang; label: string }> = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ko', label: '한국어' },
  { value: 'ru', label: 'Русский' },
]

const selectedLanguage = ref<Record<string, SupportedLang>>({})

function getSelectedLanguage(siteId: string): SupportedLang {
  return selectedLanguage.value[siteId] || 'zh-CN'
}

function setSelectedLanguage(siteId: string, event: Event) {
  const value = (event.target as HTMLSelectElement).value as SupportedLang
  if (SUPPORTED_LANGS.some(language => language.value === value)) selectedLanguage.value[siteId] = value
}

function selectedLanguageLabel(siteId: string): string {
  const value = getSelectedLanguage(siteId)
  return SUPPORTED_LANGS.find(language => language.value === value)?.label || value
}
type LocalizedTextKey = 'welcomeMessage' | 'guideMessage'

function getLocalizedText(siteId: string, key: LocalizedTextKey, lang: SupportedLang): string {
  const settings = drafts.value[siteId]?.settings
  const value = settings?.[key]
  if (typeof value === 'string') return lang === 'zh-CN' ? value : ''
  return value?.[lang] || ''
}

function setLocalizedText(siteId: string, key: LocalizedTextKey, lang: SupportedLang, value: string) {
  const settings = drafts.value[siteId]?.settings
  if (!settings) return
  const current = settings[key]
  const localized: LocalizedText = typeof current === 'string' ? { 'zh-CN': current } : { ...(current || {}) }
  localized[lang] = value
  settings[key] = localized
}

function getLocalizedMessages(siteId: string, lang: SupportedLang): string {
  const value = drafts.value[siteId]?.settings.bubbleMessages
  if (Array.isArray(value)) return lang === 'zh-CN' ? value.join('\n') : ''
  return (value?.[lang] || []).join('\n')
}

function setLocalizedMessages(siteId: string, lang: SupportedLang, value: string) {
  const settings = drafts.value[siteId]?.settings
  if (!settings) return
  const current = settings.bubbleMessages
  const localized: LocalizedList = Array.isArray(current) ? { 'zh-CN': current } : { ...(current || {}) }
  localized[lang] = value.replace(/\r\n/g, '\n').split('\n')
  settings.bubbleMessages = localized
}

function getCustomFieldOptions(field: CustomField): string {
  if (Array.isArray(field.options)) return field.options.join(',')
  return (field.options?.['zh-CN'] || []).join(',')
}

function setCustomFieldOptions(field: CustomField, value: string) {
  const options = value.split(',').map(item => item.trim()).filter(Boolean)
  if (Array.isArray(field.options)) {
    field.options = options
    return
  }
  field.options = { ...(field.options || {}), 'zh-CN': options }
}
const canCreateSite = computed(() => auth.user?.role === 'admin')
const displayedSites = computed(() => list.value.filter(
  (site) => site.id === siteStore.selectedSiteId,
))

// 预设字段中文名映射（按固定顺序展示）
const PRESET_FIELD_LABELS: Record<string, string> = {
  name: '姓名',
  phone: '电话',
  email: '邮箱',
  wechat: '微信',
  education: '学历',
  targetMajor: '意向专业',
  budget: '预算',
}

const PRESET_FIELD_KEYS = Object.keys(PRESET_FIELD_LABELS)

// 默认表单配置（旧数据兜底）
const DEFAULT_FORM_CONFIG: FormConfig = {
  presetFields: {
    name:        { enabled: true,  required: true },
    phone:       { enabled: true,  required: true },
    email:       { enabled: false, required: false },
    wechat:      { enabled: true,  required: false },
    education:   { enabled: false, required: false },
    targetMajor: { enabled: false, required: false },
    budget:      { enabled: false, required: false },
  },
  customFields: [],
}

const FIELD_TYPE_OPTIONS: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: '单行文本' },
  { value: 'tel', label: '电话' },
  { value: 'email', label: '邮箱' },
  { value: 'select', label: '下拉选择' },
  { value: 'textarea', label: '多行文本' },
]

/** 兜底 formConfig：补全缺失预设字段，customFields 缺失则空数组 */
function ensureFormConfig(settings: SiteSettings): FormConfig {
  const fc = settings.formConfig
  if (!fc || typeof fc !== 'object') {
    return JSON.parse(JSON.stringify(DEFAULT_FORM_CONFIG))
  }
  const presetFields: FormConfig['presetFields'] = {}
  for (const key of PRESET_FIELD_KEYS) {
    const item = fc.presetFields?.[key]
    presetFields[key] = {
      enabled: !!item?.enabled,
      required: !!item?.required,
    }
  }
  const customFields = Array.isArray(fc.customFields)
    ? fc.customFields.filter(f => f && typeof f.id === 'string' && typeof f.label === 'string')
    : []
  return { presetFields, customFields }
}

/** 生成自定义字段唯一 id（随机串，保证唯一即可） */
function genFieldId(): string {
  return 'f_' + Math.random().toString(36).slice(2, 10)
}

/** 新增空自定义字段 */
function addCustomField(settings: SiteSettings) {
  if (!settings.formConfig) settings.formConfig = ensureFormConfig(settings)
  settings.formConfig.customFields.push({
    id: genFieldId(),
    label: '',
    type: 'text',
    required: false,
  })
}

/** 删除自定义字段 */
function removeCustomField(settings: SiteSettings, index: number) {
  if (!settings.formConfig) return
  settings.formConfig.customFields.splice(index, 1)
}

/** 预设字段启用了才能必填：关闭启用时同步关闭必填 */
function onPresetEnabledChange(settings: SiteSettings, key: string) {
  const item = settings.formConfig?.presetFields[key]
  if (!item) return
  if (!item.enabled) item.required = false
}

async function fetchList() {
  loading.value = true
  try {
    const data = await siteStore.loadSites(true)
    list.value = data
    for (const s of data) {
      if (expanded.value[s.id] === undefined) expanded.value[s.id] = true
      const settings = normalizeSiteSettings(s.settings)
      drafts.value[s.id] = {
        id: s.id,
        name: s.name,
        domain: hasSiteUrl(s.domain, s.id) ? siteDisplayUrl(s.domain, s.id) : '',
        apiKey: s.apiKey,
        settings: {
          ...settings,
          formConfig: ensureFormConfig(settings),
        },
      }
    }
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    loading.value = false
  }
}


async function createSite() {
  const name = newSite.value.name.trim()
  const domain = newSite.value.domain.trim()
  if (!name) {
    pushToast('error', '请输入站点名称')
    return
  }
  if (!domain) {
    pushToast('error', '请输入网站域名')
    return
  }

  creating.value = true
  try {
    const site = await request<Site>('POST', '/api/admin/sites', { name, domain })
    createdSite.value = { id: site.id, name: site.name, domain: site.domain, apiKey: site.apiKey }
    newSite.value = { name: '', domain: '' }
    showCreateForm.value = false
    await fetchList()
    siteStore.selectSite(site.id)
    expanded.value[site.id] = true
    pushToast('success', '站点创建成功，请保存植入凭据')
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    creating.value = false
  }
}

async function deleteSite(site: Site): Promise<void> {
  if (!canCreateSite.value) return
  const conversationCount = site._count?.conversations || 0
  const faqCount = site._count?.faqs || 0
  const confirmed = window.confirm(
    `确定删除站点“${site.name}”（${site.domain}）吗？此操作将永久删除 ${conversationCount} 个会话、${faqCount} 个 FAQ 及其线索和消息。`,
  )
  if (!confirmed) return

  deleting.value[site.id] = true
  try {
    const result = await request<{ domain: string; conversations: number; faqs: number }>(
      'DELETE',
      `/api/admin/sites/${site.id}`,
    )
    delete drafts.value[site.id]
    delete expanded.value[site.id]
    pushToast('success', `站点 ${result.domain} 已删除`)
    await fetchList()
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    deleting.value[site.id] = false
  }
}

async function copySiteValue(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    pushToast('success', `${label}已复制`)
  } catch {
    pushToast('error', '复制失败，请手动复制')
  }
}
const WIDGET_API_HOST = 'https://canhuo.site'

function escapeHtmlAttribute(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function siteEmbedCode(siteId: string): string {
  const draft = drafts.value[siteId]
  if (!draft) return ''
  const closingScriptTag = '</' + 'script>'
  return `<!-- Chatbot Widget：不要添加 data-lang，Widget 会跟随页面 html lang -->
<script
  src="${WIDGET_API_HOST}/widget.js"
  data-site-id="${escapeHtmlAttribute(draft.id)}"
  data-site-key="${escapeHtmlAttribute(draft.apiKey)}"
  data-api-host="${WIDGET_API_HOST}"
  defer>
${closingScriptTag}
<!-- 多语言网站：切换语言时调用 window.ChatbotWidget?.setLanguage('en') -->`
}

async function copyEmbedCode(site: Site): Promise<void> {
  const code = siteEmbedCode(site.id)
  if (!code) {
    pushToast('error', '站点配置尚未加载')
    return
  }
  await copySiteValue(code, '植入代码')
}
function toggle(id: string) {
  expanded.value[id] = !expanded.value[id]
}

function getDraft(id: string) {
  return drafts.value[id]
}

const MAX_QR_FILE_SIZE = 256 * 1024

function qrValue(siteId: string): string {
  return drafts.value[siteId]?.settings.contactWecomQrUrl?.trim() || ''
}

function clearQr(siteId: string): void {
  const settings = drafts.value[siteId]?.settings
  if (settings) settings.contactWecomQrUrl = ''
}

function onQrFileChange(siteId: string, event: Event): void {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    pushToast('error', '请上传 PNG、JPG 或 WebP 图片')
    return
  }
  if (file.size > MAX_QR_FILE_SIZE) {
    pushToast('error', '二维码图片不能超过 256KB')
    return
  }
  const reader = new FileReader()
  reader.onload = () => {
    const value = reader.result
    const settings = drafts.value[siteId]?.settings
    if (typeof value === 'string' && settings) {
      settings.contactWecomQrUrl = value
      pushToast('success', '二维码已载入，点击保存后生效')
    }
  }
  reader.onerror = () => pushToast('error', '读取二维码图片失败')
  reader.readAsDataURL(file)
}
async function save(site: Site) {
  const draft = drafts.value[site.id]
  if (!draft) return
  const nextId = draft.id.trim()
  if (nextId !== site.id && !window.confirm('修改 Site ID 会导致已嵌入网站需要同步更新 data-site-id，确定继续吗？')) return
  saving.value[site.id] = true
  try {
    const payload: Record<string, unknown> = {
      name: draft.name,
      settings: draft.settings,
      ...(draft.domain.trim() ? { domain: draft.domain } : {}),
    }
    if (canCreateSite.value) {
      payload.id = nextId
      payload.apiKey = draft.apiKey.trim()
    }
    const updated = await request<Site>('PATCH', `/api/admin/sites/${site.id}`, payload)
    pushToast('success', '保存成功')
    await fetchList()
    siteStore.selectSite(updated.id)
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    saving.value[site.id] = false
  }
}

async function testDify(site: Site) {
  testing.value[site.id] = true
  try {
    const result = await request<{ name: string; mode: string }>(
      'POST',
      `/api/admin/sites/${site.id}/test-dify`,
      {},
    )
    const detail = [result.name, result.mode].filter(Boolean).join(' · ')
    pushToast('success', `Dify 连接成功：${detail}`)
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    testing.value[site.id] = false
  }
}

async function testWecom(site: Site) {
  const draft = drafts.value[site.id]
  const webhookUrl = draft?.settings.webhookUrl?.trim()
  if (!webhookUrl) {
    pushToast('error', '请先填写并保存企业微信机器人 Webhook')
    return
  }
  testingWecom.value[site.id] = true
  try {
    await request('POST', `/api/admin/sites/${site.id}/test-wecom`, {})
    pushToast('success', '测试消息已发送到企业微信群')
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    testingWecom.value[site.id] = false
  }
}
onMounted(fetchList)
</script>

<template>
  <Layout>
    <div class="mb-4 flex items-center justify-between gap-3">
      <div>
        <p class="text-sm font-semibold text-ink">站点管理</p>
        <p class="mt-1 text-xs text-muted">每个站点都有独立的 ID、API Key 和配置。</p>
      </div>
      <button
        v-if="canCreateSite"
        type="button"
        class="btn btn-primary btn-sm whitespace-nowrap"
        @click="showCreateForm = !showCreateForm"
      >
        {{ showCreateForm ? '取消新增' : '+ 新增站点' }}
      </button>
    </div>

    <div v-if="canCreateSite && showCreateForm" class="panel mb-4 border-primary">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-ink">新增站点</h2>
          <p class="mt-1 text-xs text-muted">创建后会生成独立凭据，用于新网站植入。</p>
        </div>
      </div>
      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label class="text-sm text-muted block mb-1.5">站点名称</label>
          <input
            v-model="newSite.name"
            type="text"
            placeholder="例如：英国留学官网"
            class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full"
          />
        </div>
        <div>
          <label class="text-sm text-muted block mb-1.5">网站域名</label>
          <input
            v-model="newSite.domain"
            type="text"
            inputmode="url"
            spellcheck="false"
            placeholder="例如：uk.example.com"
            class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full"
          />
        </div>
      </div>
      <div class="mt-4 flex justify-end">
        <button
          type="button"
          class="btn btn-primary"
          :disabled="creating"
          @click="createSite"
        >
          {{ creating ? '创建中...' : '创建站点' }}
        </button>
      </div>
    </div>

    <div v-if="createdSite" class="panel mb-4 border-primary bg-primary-soft">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-ink">站点已创建</h2>
          <p class="mt-1 text-xs text-muted">请将下面的 Site ID 和 API Key 用于新网站植入。</p>
        </div>
        <button type="button" class="text-xs text-muted hover:text-ink" @click="createdSite = null">关闭</button>
      </div>
      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label class="text-xs text-muted block mb-1">Site ID</label>
          <div class="flex gap-2">
            <code class="min-w-0 flex-1 truncate rounded border border-border bg-bg px-3 py-2 text-xs text-ink">{{ createdSite.id }}</code>
            <button type="button" class="btn btn-ghost btn-sm" @click="copySiteValue(createdSite.id, 'Site ID')">复制</button>
          </div>
        </div>
        <div>
          <label class="text-xs text-muted block mb-1">API Key</label>
          <div class="flex gap-2">
            <code class="min-w-0 flex-1 truncate rounded border border-border bg-bg px-3 py-2 text-xs text-ink">{{ createdSite.apiKey }}</code>
            <button type="button" class="btn btn-ghost btn-sm" @click="copySiteValue(createdSite.apiKey, 'API Key')">复制</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="loading" class="text-muted py-16 text-center">加载中...</div>

    <EmptyState v-else-if="list.length === 0" message="暂无站点" icon="settings" />

    <div v-else class="flex flex-col gap-3">
      <div class="site-config-list">
      <div
        v-for="site in displayedSites"
        :key="site.id"
        class="panel overflow-hidden"
      >
        <button
          type="button"
          class="grid w-full grid-cols-[4px_minmax(0,1fr)_auto_auto] items-center gap-4 px-5 py-4 text-left hover:bg-surface-2 focus:bg-primary-soft focus:outline-none"
          :aria-expanded="!!expanded[site.id]"
          @click="toggle(site.id)"
        >
          <span class="h-10 w-1 bg-primary" aria-hidden="true"></span>
          <span class="min-w-0">
            <span class="block truncate text-sm font-semibold text-ink">{{ site.name }}</span>
            <span
              class="mt-1 block truncate text-xs"
              :class="hasSiteUrl(site.domain, site.id) ? 'text-muted' : 'text-ink-3'"
            >
              {{ siteDisplayUrl(site.domain, site.id) }}
            </span>
          </span>
          <span v-if="site._count" class="hidden text-right text-xs text-muted sm:block">
            <span class="block tabular-nums text-ink-2">{{ site._count.conversations }} 会话</span>
            <span class="mt-1 block tabular-nums">{{ site._count.faqs }} FAQ</span>
          </span>
          <span class="border-l border-border pl-4 text-xs font-medium text-primary">
            {{ expanded[site.id] ? '收起配置' : '展开配置' }}
          </span>
        </button>

        <!-- 展开编辑 -->
        <div v-if="expanded[site.id] && getDraft(site.id)" class="site-config-body">
          <div class="site-config-embed-notice">
            <div>
              <p class="text-xs text-muted">复制下面的代码，粘贴到对应网站的 HTML 或 Next.js 布局中。</p>
              <p class="mt-1 text-xs text-muted">多语言网站请保持 html lang 同步，或在语言切换时调用 ChatbotWidget.setLanguage(lang)。</p>
            </div>
            <button
              type="button"
              class="btn btn-primary btn-sm whitespace-nowrap"
              @click="copyEmbedCode(site)"
            >
              一键复制植入代码
            </button>
          </div>
          <div class="site-config-section">
            <div class="site-config-section__header">
              <h3>{{ '\u57fa\u672c\u4fe1\u606f' }}</h3>
            </div>
            <div class="site-config-grid">
            <div>
              <label class="text-sm text-muted block mb-1.5">名称</label>
              <input
                v-model="getDraft(site.id)!.name"
                type="text"
                class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full"
              />
            </div>
            <div>
              <label class="text-sm text-muted block mb-1.5">网站域名</label>
              <input
                v-model="getDraft(site.id)!.domain"
                type="text"
                inputmode="url"
                spellcheck="false"
                placeholder="例如 luckyboy.me"
                class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full"
              />
              <p class="mt-1.5 text-xs text-muted">只填写域名，不需要输入 https:// 或页面路径。</p>
            </div>
            <div>
              <label class="text-sm text-muted block mb-1.5">Site ID</label>
              <input
                v-model="getDraft(site.id)!.id"
                type="text"
                spellcheck="false"
                class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full font-mono text-xs"
              />
              <p class="mt-1.5 text-xs text-muted">修改后必须同步更新网站代码中的 data-site-id。</p>
            </div>
            <div>
              <label class="text-sm text-muted block mb-1.5">API Key</label>
              <input
                v-model="getDraft(site.id)!.apiKey"
                type="text"
                autocomplete="new-password"
                spellcheck="false"
                class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full font-mono text-xs"
              />
            </div>
            <div>
              <label class="text-sm text-muted block mb-1.5">主题色</label>
              <div class="flex items-center gap-2">
                <input
                  v-model="getDraft(site.id)!.settings.primaryColor"
                  type="color"
                  class="w-10 h-9 rounded border border-border cursor-pointer"
                />
                <input
                  v-model="getDraft(site.id)!.settings.primaryColor"
                  type="text"
                  class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none flex-1 font-mono text-xs"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="site-config-section site-config-section--muted">
              <div class="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h4 class="text-sm font-semibold text-ink">多语言文案</h4>
                  <p class="mt-1 text-xs text-muted">选择语言后编辑该语言的欢迎语、引导语和气泡文案。</p>
                </div>
                <select
                  :value="getSelectedLanguage(site.id)"
                  class="select w-36"
                  @change="setSelectedLanguage(site.id, $event)"
                >
                  <option v-for="language in SUPPORTED_LANGS" :key="language.value" :value="language.value">
                    {{ language.label }}
                  </option>
                </select>
              </div>
              <div class="site-config-grid site-config-grid--copy">
                <div>
                  <label class="text-sm text-muted block mb-1.5">欢迎语 · {{ selectedLanguageLabel(site.id) }}</label>
                  <textarea
                    :value="getLocalizedText(site.id, 'welcomeMessage', getSelectedLanguage(site.id))"
                    rows="3"
                    class="textarea resize-y"
                    @input="setLocalizedText(site.id, 'welcomeMessage', getSelectedLanguage(site.id), ($event.target as HTMLTextAreaElement).value)"
                  ></textarea>
                </div>
                <div>
                  <label class="text-sm text-muted block mb-1.5">引导语 · {{ selectedLanguageLabel(site.id) }}</label>
                  <textarea
                    :value="getLocalizedText(site.id, 'guideMessage', getSelectedLanguage(site.id))"
                    rows="3"
                    class="textarea resize-y"
                    @input="setLocalizedText(site.id, 'guideMessage', getSelectedLanguage(site.id), ($event.target as HTMLTextAreaElement).value)"
                  ></textarea>
                </div>
                <div class="col-span-2">
                  <label class="text-sm text-muted block mb-1.5">气泡文案 · {{ selectedLanguageLabel(site.id) }}（每行一条）</label>
                  <textarea
                    :value="getLocalizedMessages(site.id, getSelectedLanguage(site.id))"
                    @input="setLocalizedMessages(site.id, getSelectedLanguage(site.id), ($event.target as HTMLTextAreaElement).value)"
                    rows="4"
                    placeholder="每行一条气泡文案"
                    class="textarea resize-y"
                  ></textarea>
                </div>
              </div>
            </div>
          </div>
          <div class="site-config-section">
            <div class="site-config-section__header">
              <h3>{{ '\u8054\u7cfb\u4e0e\u901a\u77e5' }}</h3>
            </div>
            <div class="site-config-grid">
            <div class="col-span-2">
              <label class="text-sm text-muted block mb-1.5">企业微信群机器人 Webhook（人工接管通知）</label>
              <div class="flex gap-2">
                <input
                  v-model="getDraft(site.id)!.settings.webhookUrl"
                  type="text"
                  placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"
                  class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none flex-1 font-mono text-xs"
                />
                <button
                  type="button"
                  class="btn btn-ghost btn-sm whitespace-nowrap"
                  :disabled="testingWecom[site.id]"
                  @click="testWecom(site)"
                >
                  {{ testingWecom[site.id] ? '发送中...' : '测试推送' }}
                </button>
              </div>
              <p class="mt-1.5 text-xs text-muted">保存后，客户请求人工客服时会直接推送到这个企业微信群。</p>
            </div>
            <!-- 联系顾问配置 -->
            <div class="col-span-2 mt-2 pt-4 border-t border-border">
              <h4 class="text-sm font-semibold text-ink mb-3">联系顾问配置（聊天窗口头部按钮，留空不显示）</h4>
            </div>
            <div>
              <label class="text-sm text-muted block mb-1.5">WhatsApp 号码</label>
              <input
                v-model="getDraft(site.id)!.settings.contactWhatsApp"
                type="text"
                placeholder="国际格式不带+，如 8613800138000"
                class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full font-mono text-xs"
              />
            </div>
            <div>
              <label class="text-sm text-muted block mb-1.5">企微二维码</label>
              <div v-if="qrValue(site.id)" class="mb-3 flex items-center gap-3 rounded-lg border border-border bg-surface-2 p-3">
                <img
                  :src="qrValue(site.id)"
                  alt="企微二维码预览"
                  class="h-24 w-24 rounded border border-border bg-white object-contain"
                />
                <div class="min-w-0">
                  <p class="text-xs text-muted">当前二维码预览</p>
                  <button
                    type="button"
                    class="mt-2 text-xs text-danger hover:underline"
                    @click="clearQr(site.id)"
                  >
                    移除图片
                  </button>
                </div>
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                class="block w-full text-xs text-muted file:mr-3 file:rounded file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary"
                @change="onQrFileChange(site.id, $event)"
              />
              <input
                v-model="getDraft(site.id)!.settings.contactWecomQrUrl"
                type="url"
                placeholder="也可以填写公网图片 URL，例如 https://xxx/qr.png"
                class="mt-2 px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full font-mono text-xs"
              />
              <p class="text-xs text-muted mt-1">上传图片或填写 URL，点击站点保存后生效；图片限制 256KB。</p>
            </div>

            <!-- Dify 配置 -->
            </div>
          </div>
          <div class="site-config-section">
            <div class="site-config-grid">
            <div class="col-span-2 mt-2 pt-4 border-t border-border">
              <h4 class="text-sm font-semibold text-ink mb-3">Dify AI 配置（每个站点可独立配置不同智能体）</h4>
            </div>
            <div class="col-span-2">
              <label class="text-sm text-muted block mb-1.5">Dify API 地址</label>
              <input
                v-model="getDraft(site.id)!.settings.difyApiUrl"
                type="text"
                placeholder="https://api.dify.ai/v1/chat-messages"
                class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full font-mono text-xs"
              />
              <p class="text-xs text-muted mt-1">
                填 API 域名、/v1 基础地址或完整 chat-messages 地址；不要填写智能体访问页面链接。
              </p>
            </div>
            <div class="col-span-2">
              <label class="text-sm text-muted block mb-1.5">Dify API Key</label>
              <input
                v-model="getDraft(site.id)!.settings.difyApiKey"
                type="password"
                autocomplete="new-password"
                placeholder="app-xxxxxxxxxxxxxxxxx"
                class="input w-full font-mono text-xs"
              />
              <p class="text-xs text-muted mt-1">留空则使用环境变量中的全局 Dify 配置</p>
            </div>
            <div class="col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-2 px-4 py-3">
              <p class="text-xs text-muted">连接测试读取已保存配置，不会把 API Key 返回到浏览器。</p>
              <button
                type="button"
                class="btn btn-ghost btn-sm"
                :disabled="testing[site.id]"
                @click="testDify(site)"
              >
                {{ testing[site.id] ? '测试中...' : '保存后测试连接' }}
              </button>
            </div>
          </div>

          <!-- 表单配置 -->
          </div>
          <div
            v-if="getDraft(site.id)!.settings.formConfig"
            class="site-config-section site-config-section--muted"
          >
            <h4 class="text-sm font-semibold text-ink mb-3">表单配置</h4>

            <!-- 预设字段（表格样式） -->
            <div class="bg-bg rounded border border-border overflow-hidden">
              <div class="grid grid-cols-3 text-xs text-muted bg-surface px-3 py-2 border-b border-border">
                <div>字段名</div>
                <div class="text-center">启用</div>
                <div class="text-center">必填</div>
              </div>
              <div
                v-for="key in PRESET_FIELD_KEYS"
                :key="key"
                class="grid grid-cols-3 items-center px-3 py-2 border-b border-border last:border-b-0 text-sm"
              >
                <div class="text-ink">{{ PRESET_FIELD_LABELS[key] }}</div>
                <div class="text-center">
                  <input
                    type="checkbox"
                    v-model="getDraft(site.id)!.settings.formConfig!.presetFields[key].enabled"
                    @change="onPresetEnabledChange(getDraft(site.id)!.settings, key)"
                    class="w-4 h-4 align-middle cursor-pointer"
                  />
                </div>
                <div class="text-center">
                  <input
                    type="checkbox"
                    v-model="getDraft(site.id)!.settings.formConfig!.presetFields[key].required"
                    :disabled="!getDraft(site.id)!.settings.formConfig!.presetFields[key].enabled"
                    class="w-4 h-4 align-middle cursor-pointer disabled:opacity-40"
                  />
                </div>
              </div>
            </div>

            <!-- 自定义字段（堆叠卡片样式） -->
            <div class="mt-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs text-muted">自定义字段</span>
                <button
                  type="button"
                  class="text-xs px-2.5 py-1 rounded border border-primary text-primary hover:bg-primary hover:text-white transition-colors"
                  @click="addCustomField(getDraft(site.id)!.settings)"
                >
                  + 新增自定义字段
                </button>
              </div>

              <div
                v-if="getDraft(site.id)!.settings.formConfig!.customFields.length === 0"
                class="text-xs text-muted py-2"
              >
                暂无自定义字段
              </div>

              <div
                v-for="(field, idx) in getDraft(site.id)!.settings.formConfig!.customFields"
                :key="field.id"
                class="bg-bg rounded border border-border p-3 mb-2"
              >
                <div class="grid grid-cols-2 gap-3">
                  <div>
                    <label class="text-xs text-muted block mb-1">字段标签</label>
                    <input
                      v-model="field.label"
                      type="text"
                      placeholder="如：年龄"
                      class="px-2.5 py-1.5 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full text-sm"
                    />
                  </div>
                  <div>
                    <label class="text-xs text-muted block mb-1">字段类型</label>
                    <select
                      v-model="field.type"
                      class="px-2.5 py-1.5 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full text-sm"
                    >
                      <option v-for="o in FIELD_TYPE_OPTIONS" :key="o.value" :value="o.value">{{ o.label }}</option>
                    </select>
                  </div>
                  <div v-if="field.type === 'select'" class="col-span-2">
                    <label class="text-xs text-muted block mb-1">选项（逗号分隔）</label>
                    <input
                      :value="getCustomFieldOptions(field)"
                      @input="(e) => setCustomFieldOptions(field, (e.target as HTMLInputElement).value)"
                      type="text"
                      placeholder="如：英国,美国,澳洲"
                      class="px-2.5 py-1.5 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full text-sm"
                    />
                  </div>
                  <div class="col-span-2 flex items-center justify-between">
                    <label class="text-xs text-muted flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        v-model="field.required"
                        class="w-3.5 h-3.5 align-middle cursor-pointer"
                      />
                      必填
                    </label>
                    <button
                      type="button"
                      class="text-xs text-danger hover:underline"
                      @click="removeCustomField(getDraft(site.id)!.settings, idx)"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="site-config-actions">
            <button
              v-if="canCreateSite"
              type="button"
              class="btn btn-danger btn-sm"
              :disabled="deleting[site.id]"
              @click="deleteSite(site)"
            >
              {{ deleting[site.id] ? '删除中...' : '删除站点' }}
            </button>
            <button
              type="button"
              :disabled="saving[site.id]"
              class="btn btn-primary"
              @click="save(site)"
            >
              {{ saving[site.id] ? '保存中...' : '保存' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Layout>
</template>
