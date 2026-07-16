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
import { useSiteStore } from '../stores/site'
import { hasSiteUrl, siteDisplayUrl, siteHref } from '../utils/site'
import type { Conversation, PageResult, InterestLevel } from '../types'

const router = useRouter()
const route = useRoute()
const notification = useNotificationStore()
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

// 筛选状态从 URL query 初始化，返回页面不丢失
const page = ref(Number(route.query.page) || 1)
type ConversationFilter = 'all' | 'pending' | 'processed'
const requestedFilter = String(route.query.status || '')
const statusFilter = ref<ConversationFilter>(
  requestedFilter === 'pending' || requestedFilter === 'processed' ? requestedFilter : 'all',
)

const interestLabels: Record<InterestLevel, string> = {
  unknown: '未知',
  low: '低',
  normal: '一般',
  medium: '中等',
  high: '高',
  strong: '极高',
}

const statusOptions: { value: ConversationFilter; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待处理' },
  { value: 'processed', label: '已处理' },
]

/** 访客显示名：有线索显示姓名，无线索显示"访客 + 后6位大写" */
function visitorLabel(c: Conversation): string {
  const lead = c.leads?.[0]
  if (lead?.name) return lead.name
  if (lead?.phone) return lead.phone
  const tail = c.visitorId.replace(/[^a-zA-Z0-9]/g, '').slice(-6).toUpperCase()
  return tail ? `访客 ${tail}` : '未知访客'
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
    if (conversation) conversation.lastMessageAt = message.createdAt
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

    <!-- 表格 -->
    <div class="panel overflow-hidden">
      <table class="table-base">
        <thead>
          <tr>
            <th>访客</th>
            <th>站点</th>
            <th>状态</th>
            <th>兴趣</th>
            <th>消息数</th>
            <th>线索</th>
            <th>最后消息时间</th>
            <th class="text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="i in 8" :key="`sk-${i}`">
              <td v-for="j in 8" :key="j">
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
              <td class="text-ink font-medium">{{ visitorLabel(c) }}</td>
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
              <td><StatusBadge :status="c.status" type="conversation" /></td>
              <td class="text-muted">{{ interestLabels[c.interestLevel] || c.interestLevel }}</td>
              <td class="text-muted tabular-nums">{{ c._count?.messages ?? '-' }}</td>
              <td class="text-muted tabular-nums">{{ c._count?.leads ?? '-' }}</td>
              <td class="text-muted tabular-nums">{{ fmtTime(c.lastMessageAt) }}</td>
              <td class="text-right">
                <button class="text-primary hover:underline" @click="viewDetail(c.id)">查看</button>
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
