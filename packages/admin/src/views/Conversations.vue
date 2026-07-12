<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import Layout from '../components/Layout.vue'
import Pagination from '../components/Pagination.vue'
import StatusBadge from '../components/StatusBadge.vue'
import EmptyState from '../components/EmptyState.vue'
import { request } from '../api/client'
import { pushToast } from '../components/toast-bus'
import type { Conversation, PageResult, ConversationStatus, Site, InterestLevel } from '../types'

const router = useRouter()

const loading = ref(false)
const list = ref<Conversation[]>([])
const total = ref(0)
const page = ref(1)
const totalPages = ref(1)
const size = ref(20)

const statusFilter = ref<'all' | ConversationStatus>('all')
const siteFilter = ref('')
const sites = ref<Site[]>([])

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
  { value: 'transferred', label: '已转接' },
  { value: 'closed', label: '已关闭' },
]

async function fetchSites() {
  try {
    const data = await request<Site[]>('GET', '/api/admin/sites')
    sites.value = data
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
      siteId: siteFilter.value,
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
  router.push(`/conversations/${id}`)
}

function fmtTime(t: string | null | undefined): string {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN')
}

function truncateId(id: string): string {
  return id.length > 10 ? id.slice(0, 10) + '…' : id
}

watch([statusFilter, siteFilter], () => {
  page.value = 1
  fetchList()
})

onMounted(() => {
  fetchSites()
  fetchList()
})
</script>

<template>
  <Layout>
    <!-- 筛选栏 -->
    <div class="flex items-center gap-3 mb-4">
      <select
        v-model="statusFilter"
        class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none"
      >
        <option v-for="o in statusOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <select
        v-model="siteFilter"
        class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none"
      >
        <option value="">全部站点</option>
        <option v-for="s in sites" :key="s.id" :value="s.id">{{ s.name }}</option>
      </select>
    </div>

    <!-- 表格 -->
    <div class="bg-bg rounded-lg border border-border overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-surface text-muted text-left">
            <th class="px-4 py-3 font-medium">访客 ID</th>
            <th class="px-4 py-3 font-medium">站点</th>
            <th class="px-4 py-3 font-medium">状态</th>
            <th class="px-4 py-3 font-medium">兴趣</th>
            <th class="px-4 py-3 font-medium">消息数</th>
            <th class="px-4 py-3 font-medium">线索</th>
            <th class="px-4 py-3 font-medium">最后消息时间</th>
            <th class="px-4 py-3 font-medium text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="i in 8" :key="`sk-${i}`" class="border-t border-border">
              <td v-for="j in 8" :key="j" class="px-4 py-3">
                <div class="h-4 bg-surface rounded animate-pulse"></div>
              </td>
            </tr>
          </template>
          <template v-else>
            <tr
              v-for="c in list"
              :key="c.id"
              class="border-t border-border hover:bg-surface/60 transition-colors"
            >
              <td class="px-4 py-3 font-mono text-xs text-muted">{{ truncateId(c.visitorId) }}</td>
              <td class="px-4 py-3 text-ink">{{ c.site?.name || '-' }}</td>
              <td class="px-4 py-3"><StatusBadge :status="c.status" type="conversation" /></td>
              <td class="px-4 py-3 text-muted">{{ interestLabels[c.interestLevel] || c.interestLevel }}</td>
              <td class="px-4 py-3 text-muted">{{ c._count?.messages ?? '-' }}</td>
              <td class="px-4 py-3 text-muted">{{ c._count?.leads ?? '-' }}</td>
              <td class="px-4 py-3 text-muted">{{ fmtTime(c.lastMessageAt) }}</td>
              <td class="px-4 py-3 text-right">
                <button class="text-primary hover:underline" @click="viewDetail(c.id)">查看</button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <EmptyState v-if="!loading && list.length === 0" message="暂无会话" icon="∅" />
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
