<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import Layout from '../components/Layout.vue'
import EmptyState from '../components/EmptyState.vue'
import { request } from '../api/client'
import { pushToast } from '../components/toast-bus'
import type { CustomField, Site, SiteSettings, FormConfig, CustomFieldType, LocalizedList, LocalizedText, SupportedLang } from '../types'
import { useSiteStore } from '../stores/site'
import { hasSiteUrl, siteDisplayUrl } from '../utils/site'

const loading = ref(false)
const siteStore = useSiteStore()
const list = ref<Site[]>([])
const expanded = ref<Record<string, boolean>>({})
const saving = ref<Record<string, boolean>>({})
const testing = ref<Record<string, boolean>>({})
const testingWecom = ref<Record<string, boolean>>({})
const drafts = ref<Record<string, { name: string; domain: string; settings: SiteSettings }>>({})
const SUPPORTED_LANGS: Array<{ value: SupportedLang; label: string }> = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ko', label: '한국어' },
  { value: 'ru', label: 'Русский' },
]

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
  localized[lang] = value.split('\n').map(item => item.trim()).filter(Boolean)
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
      drafts.value[s.id] = {
        name: s.name,
        domain: hasSiteUrl(s.domain, s.id) ? siteDisplayUrl(s.domain, s.id) : '',
        settings: {
          ...s.settings,
          formConfig: ensureFormConfig(s.settings),
        },
      }
    }
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    loading.value = false
  }
}

function toggle(id: string) {
  expanded.value[id] = !expanded.value[id]
}

function getDraft(id: string) {
  return drafts.value[id]
}

async function save(site: Site) {
  const draft = drafts.value[site.id]
  if (!draft) return
  saving.value[site.id] = true
  try {
    await request('PATCH', `/api/admin/sites/${site.id}`, {
      name: draft.name,
      settings: draft.settings,
      ...(draft.domain.trim() ? { domain: draft.domain } : {}),
    })
    pushToast('success', '保存成功')
    await fetchList()
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
    <div v-if="loading" class="text-muted py-16 text-center">加载中...</div>

    <EmptyState v-else-if="list.length === 0" message="暂无站点" icon="settings" />

    <div v-else class="flex flex-col gap-3">
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
        <div v-if="expanded[site.id] && getDraft(site.id)" class="px-5 pb-5 pt-1 border-t border-border">
          <div class="grid grid-cols-2 gap-4 mt-4">
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
              <label class="text-sm text-muted block mb-1.5">API Key（只读）</label>
              <input
                :value="site.apiKey"
                type="text"
                readonly
                class="px-3 py-2 rounded border border-border bg-surface text-muted w-full font-mono text-xs"
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
            <div class="col-span-2 grid grid-cols-2 gap-3">
              <div v-for="language in SUPPORTED_LANGS" :key="`welcome-${language.value}`">
                <label class="text-sm text-muted block mb-1.5">欢迎语 · {{ language.label }}</label>
                <textarea
                  :value="getLocalizedText(site.id, 'welcomeMessage', language.value)"
                  rows="2"
                  class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full resize-none"
                  @input="setLocalizedText(site.id, 'welcomeMessage', language.value, ($event.target as HTMLTextAreaElement).value)"
                ></textarea>
              </div>
              <div v-for="language in SUPPORTED_LANGS" :key="`guide-${language.value}`">
                <label class="text-sm text-muted block mb-1.5">引导语 · {{ language.label }}</label>
                <textarea
                  :value="getLocalizedText(site.id, 'guideMessage', language.value)"
                  rows="2"
                  class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full resize-none"
                  @input="setLocalizedText(site.id, 'guideMessage', language.value, ($event.target as HTMLTextAreaElement).value)"
                ></textarea>
              </div>
            </div>
            <div class="col-span-2">
              <label class="text-sm text-muted block mb-1.5">气泡文案 · 每种语言每行一条</label>
              <div class="grid grid-cols-2 gap-3">
                <div v-for="language in SUPPORTED_LANGS" :key="`bubble-${language.value}`">
                  <label class="text-xs text-muted block mb-1">{{ language.label }}</label>
                  <textarea
                    :value="getLocalizedMessages(site.id, language.value)"
                    @input="setLocalizedMessages(site.id, language.value, ($event.target as HTMLTextAreaElement).value)"
                    rows="4"
                    placeholder="每行一条气泡文案"
                    class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full resize-none font-sans"
                  ></textarea>
                </div>
              </div>
            </div>            <div class="col-span-2">
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
              <label class="text-sm text-muted block mb-1.5">企微二维码图片 URL</label>
              <input
                v-model="getDraft(site.id)!.settings.contactWecomQrUrl"
                type="text"
                placeholder="https://xxx/qr.png"
                class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full font-mono text-xs"
              />
            </div>

            <!-- Dify 配置 -->
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
          <div
            v-if="getDraft(site.id)!.settings.formConfig"
            class="mt-5 bg-surface rounded-lg border border-border p-4"
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

          <div class="flex justify-end mt-4">
            <button
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
