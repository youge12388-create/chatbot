<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import Layout from '../components/Layout.vue'
import Pagination from '../components/Pagination.vue'
import StatusBadge from '../components/StatusBadge.vue'
import EmptyState from '../components/EmptyState.vue'
import { request } from '../api/client'
import { pushToast } from '../components/toast-bus'
import { useNotificationStore } from '../stores/notification'
import { useAuthStore } from '../stores/auth'
import { useSiteStore } from '../stores/site'
import { hasSiteUrl, siteDisplayUrl, siteHref } from '../utils/site'
import type { Conversation, PageResult, ConversationStatus, InterestLevel } from '../types'

const router = useRouter()
const route = useRoute()
const notification = useNotificationStore()
const auth = useAuthStore()
const siteStore = useSiteStore()

// 有实时新消息（未读）的会话 ID 集合，用于列表高亮
const unreadConvIds = computed(
  () => new Set(notification.latestMessages
    .filter((message) => message.siteId === siteStore.selectedSiteId)
    .map((message) => message.conversationId)),
)

function hasUnread(convId: string): boolean {
  return unreadConvIds.value.has(convId)
}

const loading = ref(false)
const list = ref<Conversation[]>([])
const total = ref(0)
const totalPages = ref(1)
const size = ref(20)

function conversationTime(c: Conversation): number {
  const value = c.lastMessageAt || c.updatedAt || c.createdAt
  const timestamp = new Date(value).getTime()
  return Number.isNaN(timestamp) ? 0 : timestamp
}

const sortedList = computed(() => [...list.value].sort(
  (a, b) => conversationTime(b) - conversationTime(a),
))
const selectedIds = ref<string[]>([])
const selectableIds = computed(() => sortedList.value.filter((conversation) => conversation.status !== 'closed').map((conversation) => conversation.id))
const allVisibleSelected = computed(() => selectableIds.value.length > 0 && selectableIds.value.every((id) => selectedIds.value.includes(id)))


// 筛选状态从 URL query 初始化，返回页面不丢失
const page = ref(Number(route.query.page) || 1)
const statusFilter = ref((route.query.status as 'all' | ConversationStatus) || 'all')

const interestLabels: Record<InterestLevel, string> = {
  unknown: '未知',
  low: '低',
  normal: '一般',
  medium: '中等',
  high: '高',
  strong: '极高',
}

const statusOptions: { value: 'all' | ConversationStatus; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'active', label: '进行中' },
  { value: 'taken_over', label: '人工接管中' },
  { value: 'transferred', label: '待人工' },
  { value: 'closed', label: '已处理' },
]

/** active 会话超过 2 小时无消息，仍按待处理展示，不再显示超时文案 */
const TIMEOUT_MS = 2 * 60 * 60 * 1000
function isTimeout(c: Conversation): boolean {
  if (c.status !== 'active') return false
  const last = c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : 0
  return Date.now() - last > TIMEOUT_MS
}
/** 访客显示名：有线索显示姓名，无线索显示"访客 + 后6位大写" */
function visitorLabel(c: Conversation): string {
  const lead = c.leads?.[0]
  if (lead?.name) return lead.name
  if (lead?.phone) return lead.phone
  const tail = c.visitorId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()
  return tail ? `访客 ${tail}` : '未知访客'
}

function lastMessagePreview(c: Conversation): string {
  const content = c.messages?.[0]?.content?.replace(/\s+/g, ' ').trim() || ''
  return content.length > 54 ? `${content.slice(0, 54)}…` : content
}

function handlingReason(c: Conversation): string {
  const noAnswerCount = Number(c.metadata?.aiNoAnswerCount || 0)
  if (c.status === 'transferred') return noAnswerCount >= 2 ? 'AI 连续未回答' : '客户请求人工'
  if (c.status === 'taken_over') return '人工处理中'
  if (c.status === 'closed') return '已处理'
  if (!c._count?.messages) return '等待客户消息'
  return 'AI 自动应答'
}

function waitingLabel(c: Conversation): string {
  if (c.status !== 'transferred') return ''
  const start = new Date(c.lastMessageAt || c.createdAt).getTime()
  if (!Number.isFinite(start)) return ''
  const minutes = Math.max(0, Math.floor((Date.now() - start) / 60000))
  if (minutes < 1) return '刚刚转人工'
  if (minutes < 60) return `等待 ${minutes} 分钟`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `等待 ${hours} 小时`
  return `等待 ${Math.floor(hours / 24)} 天`
}

function actionLabel(c: Conversation): string {
  if (c.status === 'transferred') return '打开处理'
  if (c.status === 'taken_over') return '继续处理'
  return '查看'
}

function assigneeName(c: Conversation): string {
  return c.assignee?.name || c.assignee?.username || '未分配'
}

function toggleSelection(id: string): void {
  selectedIds.value = selectedIds.value.includes(id)
    ? selectedIds.value.filter((selectedId) => selectedId !== id)
    : [...selectedIds.value, id]
}

function toggleAll(): void {
  selectedIds.value = allVisibleSelected.value ? [] : [...selectableIds.value]
}

async function batchResolve(): Promise<void> {
  if (selectedIds.value.length === 0) return
  const count = selectedIds.value.length
  if (!window.confirm(`确认将选中的 ${count} 个会话标记为已处理吗？`)) return
  try {
    const result = await request<{ count: number }>('POST', '/api/admin/conversations/bulk-resolve', { ids: selectedIds.value })
    pushToast('success', `已处理 ${result.count} 个会话`)
    selectedIds.value = []
    await fetchList()
  } catch (e) {
    pushToast('error', (e as Error).message)
  }
}
async function fetchList() {
  loading.value = true
  try {
    const data = await request<PageResult<Conversation>>('GET', '/api/admin/conversations', {
      page: page.value,
      size: size.value,
      status: statusFilter.value,
      siteId: siteStore.selectedSiteId,
    })
    list.value = data.list
    total.value = data.total
    totalPages.value = data.totalPages
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    loading.value = false
  }
}

function onPageChange(p: number) {
  page.value = p
  fetchList()
}

function viewDetail(id: string) {
  notification.markConversationRead(id)
  router.push(`/conversations/${id}`)
}

function fmtTime(t: string | null | undefined): string {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN')
}

/** 筛选变化时同步到 URL query（保留页面状态） */
function syncQueryToUrl() {
  router.replace({
    query: {
      ...route.query,
      page: page.value > 1 ? String(page.value) : undefined,
      status: statusFilter.value !== 'all' ? statusFilter.value : undefined,
    },
  })
}

watch([statusFilter, () => siteStore.selectedSiteId], () => {
  selectedIds.value = []
  page.value = 1
  syncQueryToUrl()
  fetchList()
})

onMounted(async () => {
  await siteStore.loadSites()
  await fetchList()
})

watch(
  () => notification.latestMessages[notification.latestMessages.length - 1],
  (message) => {
    if (!message || message.siteId !== siteStore.selectedSiteId) return
    const conversation = list.value.find((item) => item.id === message.conversationId)
    if (conversation) {
      conversation.lastMessageAt = message.createdAt
      conversation.messages = [{
        id: message.id,
        conversationId: message.conversationId,
        role: 'user' as const,
        content: message.content,
        source: 'user' as const,
        createdAt: message.createdAt,
      }]
    }
  },
)
</script>

<template>
  <Layout>
    <!-- 筛选栏 -->
    <div class="mb-5 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.16em] text-primary">会话工作台</p>
        <h2 class="mt-1 text-xl font-semibold text-ink">先处理待人工，再开始回复</h2>
        <p class="mt-1 text-sm text-muted">打开会话后，点击“接管并回复”，客户就会进入人工服务。</p>
      </div>
      <div class="flex flex-wrap gap-2" aria-label="会话筛选">
        <button
          v-for="o in statusOptions"
          :key="o.value"
          type="button"
          class="rounded-full border px-3 py-1.5 text-sm transition-colors"
          :class="statusFilter === o.value ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-muted hover:border-primary hover:text-primary'"
          @click="statusFilter = o.value"
        >
          {{ o.label }}
        </button>
      </div>
    </div>

    <div v-if="auth.user?.role === 'admin' && selectedIds.length > 0" class="mb-3 flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
      <span class="text-muted">已选择 {{ selectedIds.length }} 个会话</span>
      <button
        type="button"
        class="rounded-lg bg-primary px-3 py-1.5 font-medium text-white hover:bg-primary-hover"
        @click="batchResolve"
      >
        批量标记已处理
      </button>
    </div>
    <!-- 表格 -->
    <div class="panel overflow-hidden">
      <table class="table-base">
        <thead>
          <tr>
            <th class="w-10">
              <input
                v-if="auth.user?.role === 'admin'"
                type="checkbox"
                :checked="allVisibleSelected"
                :disabled="selectableIds.length === 0"
                aria-label="全选当前页未处理会话"
                @change="toggleAll"
              />
            </th>
            <th>访客</th>
            <th>站点</th>
            <th>状态</th>
            <th>兴趣</th>
            <th>消息数</th>
            <th>线索</th>
            <th>初始时间</th>
            <th>最后消息时间</th>
            <th class="text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="i in 8" :key="`sk-${i}`">
              <td v-for="j in 10" :key="j">
                <div class="h-4 bg-surface-2 rounded animate-pulse"></div>
              </td>
            </tr>
          </template>
          <template v-else>
            <tr
              v-for="c in sortedList"
              :key="c.id"
              :class="hasUnread(c.id) || c.status === 'transferred' ? 'bg-accent/10' : ''"
            >
              <td>
                <input
                  v-if="auth.user?.role === 'admin' && c.status !== 'closed'"
                  type="checkbox"
                  :checked="selectedIds.includes(c.id)"
                  :aria-label="'选择会话：' + visitorLabel(c)"
                  @change="toggleSelection(c.id)"
                />
              </td>
              <td>
                <div class="text-ink font-medium">{{ visitorLabel(c) }}</div>
                <div v-if="lastMessagePreview(c)" class="mt-1 max-w-[15rem] truncate text-xs text-muted" :title="lastMessagePreview(c)">
                  {{ lastMessagePreview(c) }}
                </div>
              </td>
              <td>
                <div class="font-medium text-ink">{{ c.site?.name || '-' }}</div>
                <a
                  v-if="hasSiteUrl(c.site?.domain, c.siteId)"
                  :href="siteHref(c.site?.domain, c.siteId)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs text-primary underline underline-offset-2"
                >
                  {{ siteDisplayUrl(c.site?.domain, c.siteId) }}
                </a>
              </td>
              <td>
                <StatusBadge :status="c.status" type="conversation" :timeout="isTimeout(c)" />
                <div class="mt-1 text-xs text-muted">{{ handlingReason(c) }}</div>
                <div v-if="waitingLabel(c)" class="mt-0.5 text-xs text-info">{{ waitingLabel(c) }}</div>
                <div class="mt-0.5 text-xs text-muted">负责人：{{ assigneeName(c) }}</div>
              </td>
              <td class="text-muted">{{ interestLabels[c.interestLevel] || c.interestLevel }}</td>
              <td class="text-muted tabular-nums">{{ c._count?.messages ?? '-' }}</td>
              <td class="text-muted tabular-nums">{{ c._count?.leads ?? '-' }}</td>
              <td class="text-muted tabular-nums">{{ fmtTime(c.createdAt) }}</td>
              <td class="text-muted tabular-nums">{{ fmtTime(c.lastMessageAt) }}</td>
              <td class="text-right">
                <button class="text-primary hover:underline" :aria-label="actionLabel(c) + '：' + visitorLabel(c)" @click="viewDetail(c.id)">{{ actionLabel(c) }}</button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <EmptyState v-if="!loading && list.length === 0" message="暂无会话" icon="chat" />
    </div>

    <Pagination
      v-if="!loading && list.length > 0"
      :page="page"
      :total-pages="totalPages"
      :total="total"
      @change="onPageChange"
    />
  </Layout>
</template>
