<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Layout from '../components/Layout.vue'
import EmptyState from '../components/EmptyState.vue'
import { request } from '../api/client'
import { pushToast } from '../components/toast-bus'
import type { Site, SiteSettings, FormConfig, CustomFieldType } from '../types'

const loading = ref(false)
const list = ref<Site[]>([])
const expanded = ref<Record<string, boolean>>({})
const saving = ref<Record<string, boolean>>({})
const drafts = ref<Record<string, { name: string; settings: SiteSettings }>>({})

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
    const data = await request<Site[]>('GET', '/api/admin/sites')
    list.value = data
    for (const s of data) {
      drafts.value[s.id] = {
        name: s.name,
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
    })
    pushToast('success', '保存成功')
    await fetchList()
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    saving.value[site.id] = false
  }
}

onMounted(fetchList)
</script>

<template>
  <Layout>
    <div v-if="loading" class="text-muted py-16 text-center">加载中...</div>

    <EmptyState v-else-if="list.length === 0" message="暂无站点" icon="◼" />

    <div v-else class="flex flex-col gap-3">
      <div
        v-for="site in list"
        :key="site.id"
        class="bg-bg rounded-lg border border-border"
      >
        <!-- 折叠头 -->
        <div
          class="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-surface/60"
          @click="toggle(site.id)"
        >
          <span class="text-sm">▾</span>
          <span class="text-sm font-medium text-ink">{{ site.name }}</span>
          <span class="text-xs text-muted">{{ site.domain }}</span>
          <span v-if="site._count" class="text-xs text-muted">
            · {{ site._count.conversations }} 会话 / {{ site._count.faqs }} FAQ
          </span>
        </div>

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
              <label class="text-sm text-muted block mb-1.5">域名（只读）</label>
              <input
                :value="site.domain"
                type="text"
                readonly
                class="px-3 py-2 rounded border border-border bg-surface text-muted w-full"
              />
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
            <div>
              <label class="text-sm text-muted block mb-1.5">欢迎语</label>
              <textarea
                v-model="getDraft(site.id)!.settings.welcomeMessage"
                rows="2"
                class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full resize-none"
              ></textarea>
            </div>
            <div>
              <label class="text-sm text-muted block mb-1.5">引导语</label>
              <textarea
                v-model="getDraft(site.id)!.settings.guideMessage"
                rows="2"
                class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full resize-none"
              ></textarea>
            </div>
            <div class="col-span-2">
              <label class="text-sm text-muted block mb-1.5">气泡文案（每行一条，轮播展示）</label>
              <textarea
                :value="(getDraft(site.id)!.settings.bubbleMessages || []).join('\n')"
                @input="(e) => { getDraft(site.id)!.settings.bubbleMessages = (e.target as HTMLTextAreaElement).value.split('\n').map((s: string) => s.trim()).filter(Boolean) }"
                rows="4"
                placeholder="每行一条气泡文案，留空则使用默认"
                class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full resize-none font-sans"
              ></textarea>
            </div>
            <div class="col-span-2">
              <label class="text-sm text-muted block mb-1.5">企微 Webhook 地址</label>
              <input
                v-model="getDraft(site.id)!.settings.webhookUrl"
                type="text"
                placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"
                class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full font-mono text-xs"
              />
            </div>
            <div class="col-span-2">
              <label class="text-sm text-muted block mb-1.5">n8n Webhook 地址</label>
              <input
                v-model="getDraft(site.id)!.settings.n8nWebhookUrl"
                type="text"
                placeholder="https://n8n.example.com/webhook/xxx"
                class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full font-mono text-xs"
              />
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
            </div>
            <div class="col-span-2">
              <label class="text-sm text-muted block mb-1.5">Dify API Key</label>
              <input
                v-model="getDraft(site.id)!.settings.difyApiKey"
                type="text"
                placeholder="app-xxxxxxxxxxxxxxxxx"
                class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full font-mono text-xs"
              />
              <p class="text-xs text-muted mt-1">留空则使用环境变量中的全局 Dify 配置</p>
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
                      :value="(field.options || []).join(',')"
                      @input="(e) => { field.options = (e.target as HTMLInputElement).value.split(',').map((s: string) => s.trim()).filter(Boolean) }"
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
              class="px-4 py-2 rounded bg-primary text-white text-sm hover:bg-primary-hover disabled:opacity-50"
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
