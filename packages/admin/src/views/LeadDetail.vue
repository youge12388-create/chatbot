<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Layout from '../components/Layout.vue'
import StatusBadge from '../components/StatusBadge.vue'
import EmptyState from '../components/EmptyState.vue'
import { request } from '../api/client'
import { pushToast } from '../components/toast-bus'
import type { Lead, LeadStatus, Message } from '../types'
import { useSiteStore } from '../stores/site'
import { siteDisplayUrl, siteHref } from '../utils/site'

const route = useRoute()
const router = useRouter()
const siteStore = useSiteStore()

const loading = ref(false)
const saving = ref(false)
const lead = ref<Lead | null>(null)
const messages = ref<Message[]>([])

const statusOptions: { value: LeadStatus; label: string }[] = [
  { value: 'new', label: '新线索' },
  { value: 'following', label: '跟进中' },
  { value: 'contacted', label: '已联系' },
  { value: 'converted', label: '已转化' },
  { value: 'discarded', label: '已废弃' },
]

const status = ref<LeadStatus>('new')
const note = ref('')
const assignedTo = ref('')

async function fetchDetail() {
  loading.value = true
  try {
    const data = await request<Lead>('GET', `/api/admin/leads/${route.params.id}`)
    lead.value = data
    if (data.conversation?.siteId) siteStore.selectSite(data.conversation.siteId)
    status.value = data.status
    note.value = data.note || ''
    assignedTo.value = data.assignedTo || ''
    messages.value = data.conversation?.messages || []
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    loading.value = false
  }
}

async function onStatusChange() {
  await patch({ status: status.value })
}

async function onNoteBlur() {
  if (!lead.value) return
  if (note.value === (lead.value.note || '')) return
  await patch({ note: note.value })
}

async function onAssignedBlur() {
  if (!lead.value) return
  if (assignedTo.value === (lead.value.assignedTo || '')) return
  await patch({ assignedTo: assignedTo.value })
}

async function patch(payload: Record<string, unknown>) {
  saving.value = true
  try {
    const updated = await request<Lead>('PATCH', `/api/admin/leads/${route.params.id}`, payload)
    lead.value = updated
    pushToast('success', '已保存')
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    saving.value = false
  }
}

function fmtTime(t: string | null | undefined): string {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN')
}

/** 把 extra 中的任意值转为可读字符串（对象/数组转 JSON） */
function formatExtraValue(val: unknown): string {
  if (val === null || val === undefined) return '-'
  if (typeof val === 'string') return val || '-'
  if (typeof val === 'number' || typeof val === 'boolean') return String(val)
  try {
    return JSON.stringify(val)
  } catch {
    return String(val)
  }
}

function back() {
  // 优先用浏览器历史返回（保留列表页的筛选 query）
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/leads')
  }
}

onMounted(fetchDetail)
</script>

<template>
  <Layout>
    <button class="text-sm text-muted hover:text-ink mb-4" @click="back">← 返回线索列表</button>

    <div v-if="loading" class="text-muted py-16 text-center">加载中...</div>

    <template v-else-if="lead">
      <div class="grid grid-cols-3 gap-6">
        <!-- 左侧：基本信息 -->
        <div class="col-span-1 bg-bg rounded-lg border border-border p-6">
          <h3 class="text-sm font-semibold text-muted mb-4">线索基本信息</h3>
          <dl class="text-sm flex flex-col gap-3">
            <div class="pb-3 border-b border-border">
              <dt class="text-muted">来源站点</dt>
              <dd class="mt-1 text-ink font-medium">{{ lead.conversation?.site?.name || '-' }}</dd>
              <dd v-if="lead.conversation?.site?.domain" class="mt-0.5">
                <a
                  :href="siteHref(lead.conversation.site.domain)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs text-primary underline underline-offset-2"
                >
                  {{ siteDisplayUrl(lead.conversation.site.domain) }}
                </a>
              </dd>
            </div>
            <div class="flex justify-between"><dt class="text-muted">姓名</dt><dd class="text-ink">{{ lead.name || '-' }}</dd></div>
            <div class="flex justify-between"><dt class="text-muted">电话</dt><dd class="text-ink">{{ lead.phone || '-' }}</dd></div>
            <div class="flex justify-between"><dt class="text-muted">邮箱</dt><dd class="text-ink">{{ lead.email || '-' }}</dd></div>
            <div class="flex justify-between"><dt class="text-muted">微信</dt><dd class="text-ink">{{ lead.wechat || '-' }}</dd></div>
            <div class="flex justify-between"><dt class="text-muted">学历</dt><dd class="text-ink">{{ lead.education || '-' }}</dd></div>
            <div class="flex justify-between"><dt class="text-muted">意向专业</dt><dd class="text-ink">{{ lead.targetMajor || '-' }}</dd></div>
            <div class="flex justify-between"><dt class="text-muted">预算</dt><dd class="text-ink">{{ lead.budget || '-' }}</dd></div>
            <div class="flex justify-between"><dt class="text-muted">提交时间</dt><dd class="text-ink">{{ fmtTime(lead.createdAt) }}</dd></div>
          </dl>

          <!-- 自定义字段（仅当 lead.extra 有内容时显示） -->
          <div
            v-if="lead.extra && Object.keys(lead.extra as Record<string, unknown>).length > 0"
            class="mt-4 pt-3 border-t border-border"
          >
            <h4 class="text-xs font-semibold text-muted mb-3">自定义信息</h4>
            <dl class="text-sm flex flex-col gap-3">
              <div
                v-for="(val, key) in (lead.extra as Record<string, unknown>)"
                :key="key"
                class="flex justify-between gap-3"
              >
                <dt class="text-muted shrink-0">{{ key }}</dt>
                <dd class="text-ink text-right break-all">{{ formatExtraValue(val) }}</dd>
              </div>
            </dl>
          </div>
        </div>

        <!-- 右侧：状态/备注/负责人 -->
        <div class="col-span-2 bg-bg rounded-lg border border-border p-6">
          <h3 class="text-sm font-semibold text-muted mb-4">跟进信息</h3>
          <div class="flex flex-col gap-4">
            <div>
              <label class="text-sm text-muted block mb-1.5">状态流转</label>
              <select
                v-model="status"
                :disabled="saving"
                class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full"
                @change="onStatusChange"
              >
                <option v-for="o in statusOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
              </select>
            </div>
            <div>
              <label class="text-sm text-muted block mb-1.5">负责人 ID</label>
              <input
                v-model="assignedTo"
                type="text"
                :disabled="saving"
                class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full"
                placeholder="留空表示未分配"
                @blur="onAssignedBlur"
              />
            </div>
            <div>
              <label class="text-sm text-muted block mb-1.5">备注</label>
              <textarea
                v-model="note"
                :disabled="saving"
                rows="5"
                class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full resize-none"
                placeholder="失焦自动保存"
                @blur="onNoteBlur"
              ></textarea>
            </div>
            <div class="flex items-center gap-3 text-xs text-muted">
              <span v-if="saving">保存中...</span>
              <StatusBadge :status="lead.status" type="lead" />
            </div>
          </div>
        </div>
      </div>

      <!-- 对话时间线 -->
      <div class="mt-6 bg-bg rounded-lg border border-border p-6">
        <h3 class="text-sm font-semibold text-muted mb-4">完整对话</h3>
        <EmptyState v-if="messages.length === 0" message="暂无对话记录" icon="∅" />
        <div v-else class="flex flex-col gap-3">
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="flex"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[70%] px-4 py-2.5 rounded-lg text-sm"
              :class="[
                msg.role === 'user'
                  ? 'bg-surface text-ink'
                  : msg.source === 'human'
                    ? 'bg-bg border-2 border-accent text-ink'
                    : 'bg-bg border border-border text-ink',
              ]"
            >
              <div class="text-xs text-muted mb-1">
                {{ msg.role === 'user' ? '访客' : msg.source === 'human' ? '人工回复' : 'AI' }}
                · {{ fmtTime(msg.createdAt) }}
              </div>
              <div class="whitespace-pre-wrap">{{ msg.content }}</div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </Layout>
</template>
