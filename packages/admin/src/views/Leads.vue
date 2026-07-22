<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import Layout from '../components/Layout.vue'
import Pagination from '../components/Pagination.vue'
import StatusBadge from '../components/StatusBadge.vue'
import EmptyState from '../components/EmptyState.vue'
import AppIcon from '../components/AppIcon.vue'
import { request } from '../api/client'
import { pushToast } from '../components/toast-bus'
import { useSiteStore } from '../stores/site'
import { hasSiteUrl, siteDisplayUrl, siteHref } from '../utils/site'
import type { Lead, PageResult, LeadStatus, InterestLevel } from '../types'

const router = useRouter()
const siteStore = useSiteStore()

const loading = ref(false)
const list = ref<Lead[]>([])
const total = ref(0)
const page = ref(1)
const totalPages = ref(1)
const size = ref(20)

const statusFilter = ref<'all' | LeadStatus>('all')
const search = ref('')

const interestLabels: Record<InterestLevel, string> = {
  unknown: '未知',
  low: '低',
  normal: '一般',
  medium: '中等',
  high: '高',
  strong: '极高',
}

const statusOptions: { value: 'all' | LeadStatus; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'new', label: '新线索' },
  { value: 'following', label: '跟进中' },
  { value: 'contacted', label: '已联系' },
  { value: 'converted', label: '已转化' },
  { value: 'discarded', label: '已废弃' },
]

async function fetchList() {
  loading.value = true
  try {
    const data = await request<PageResult<Lead>>('GET', '/api/admin/leads', {
      page: page.value,
      size: size.value,
      status: statusFilter.value,
      search: search.value,
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

function onSearch() {
  page.value = 1
  fetchList()
}

function onStatusChange() {
  page.value = 1
  fetchList()
}

function onPageChange(p: number) {
  page.value = p
  fetchList()
}

function viewDetail(id: string) {
  router.push(`/leads/${id}`)
}

function fmtTime(t: string | null | undefined): string {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN')
}

function fmtTimeOnly(t: string | null | undefined): string {
  if (!t) return '-'
  return new Date(t).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function avatarTone(index: number): string {
  return ['blue', 'pink', 'orange', 'green', 'purple'][index % 5]
}

function fmtInterest(level: InterestLevel | undefined): string {
  if (!level) return '未知'
  return interestLabels[level] || level
}

async function exportCsv() {
  try {
    const csv = await request<string>('GET', '/api/admin/leads/export', {
      siteId: siteStore.selectedSiteId,
    })
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `leads-${siteStore.currentSite?.domain || 'site'}.csv`
    a.click()
    URL.revokeObjectURL(url)
    pushToast('success', '导出成功')
  } catch (e) {
    pushToast('error', (e as Error).message)
  }
}

watch([statusFilter, () => siteStore.selectedSiteId], onStatusChange)

onMounted(async () => {
  await siteStore.loadSites()
  await fetchList()
})
</script>

<template>
  <Layout>
    <div class="mobile-page-heading leads-mobile-heading">
      <h2>线索管理</h2>
      <p>管理线索信息，跟进客户需求</p>
    </div>

    <div v-if="loading" class="mobile-lead-list">
      <div v-for="i in 5" :key="`mobile-lead-skeleton-${i}`" class="mobile-lead-card mobile-lead-card--skeleton">
        <span class="mobile-skeleton mobile-skeleton--avatar"></span>
        <span class="mobile-lead-card__body">
          <span class="mobile-skeleton mobile-skeleton--line mobile-skeleton--line-wide"></span>
          <span class="mobile-skeleton mobile-skeleton--line"></span>
          <span class="mobile-skeleton mobile-skeleton--line mobile-skeleton--line-short"></span>
        </span>
      </div>
    </div>

    <div v-else class="mobile-lead-list">
      <button
        v-for="(lead, index) in list"
        :key="lead.id"
        type="button"
        class="mobile-lead-card"
        @click="viewDetail(lead.id)"
      >
        <span class="mobile-avatar" :class="`mobile-avatar--${avatarTone(index)}`">
          <AppIcon name="user" :size="24" :stroke-width="2" />
        </span>
        <span class="mobile-lead-card__body">
          <span class="mobile-lead-card__topline">
            <strong>{{ lead.name || '访客' }}</strong>
            <time>{{ fmtTimeOnly(lead.createdAt) }}</time>
            <AppIcon name="chevron" class="mobile-chevron-right" :size="20" />
          </span>
          <span class="mobile-lead-card__contact">{{ lead.phone || '-' }}</span>
          <span class="mobile-lead-card__contact">{{ lead.email || '-' }}</span>
          <span class="mobile-lead-card__source">
            <AppIcon name="users" :size="16" />
            <span>来源站点：{{ lead.conversation?.site?.name || '-' }}</span>
          </span>
          <span class="mobile-lead-card__meta">
            <span class="mobile-meta-pill">兴趣等级：{{ fmtInterest(lead.conversation?.interestLevel) }}</span>
            <span class="mobile-meta-pill mobile-meta-pill--status">状态：<StatusBadge :status="lead.status" type="lead" /></span>
          </span>
          <span class="mobile-lead-card__submitted">提交时间：{{ fmtTime(lead.createdAt) }}</span>
        </span>
      </button>
    </div>
    <!-- 筛选栏 -->
    <div class="page-toolbar">
      <div class="toolbar-field">
        <select v-model="statusFilter" class="select">
          <option v-for="o in statusOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </div>
      <label class="search-control">
        <AppIcon name="search" :size="20" />
        <input
          v-model="search"
          type="text"
          placeholder="搜索姓名 / 电话 / 邮箱"
          class="input"
          @keyup.enter="onSearch"
        />
      </label>
      <button class="btn btn-primary toolbar-search" @click="onSearch">搜索</button>
      <span class="toolbar-spacer"></span>
      <button class="btn toolbar-export" @click="exportCsv">
        <AppIcon name="download" :size="18" />
        导出 CSV
      </button>
    </div>
    <!-- 表格 -->
    <div class="panel table-panel overflow-hidden">
      <table class="table-base">
        <thead>
          <tr>
            <th>姓名</th>
            <th>电话</th>
            <th>邮箱</th>
            <th>来源站点</th>
            <th>兴趣等级</th>
            <th>状态</th>
            <th>提交时间</th>
            <th class="text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <!-- 骨架屏 -->
          <template v-if="loading">
            <tr v-for="i in 8" :key="`sk-${i}`">
              <td v-for="j in 8" :key="j">
                <div class="h-4 bg-surface-2 rounded animate-pulse"></div>
              </td>
            </tr>
          </template>
          <!-- 数据行 -->
          <template v-else>
            <tr v-for="lead in list" :key="lead.id">
              <td class="text-ink font-medium">{{ lead.name || '-' }}</td>
              <td class="text-ink-2">{{ lead.phone || '-' }}</td>
              <td class="text-ink-2">{{ lead.email || '-' }}</td>
              <td>
                <div class="font-medium text-ink">{{ lead.conversation?.site?.name || '-' }}</div>
                <a
                  v-if="hasSiteUrl(lead.conversation?.site?.domain, lead.conversation?.siteId)"
                  :href="siteHref(lead.conversation?.site?.domain, lead.conversation?.siteId)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-xs text-primary underline underline-offset-2"
                >
                  {{ siteDisplayUrl(lead.conversation?.site?.domain, lead.conversation?.siteId) }}
                </a>
              </td>
              <td class="text-muted">{{ fmtInterest(lead.conversation?.interestLevel) }}</td>
              <td><StatusBadge :status="lead.status" type="lead" /></td>
              <td class="text-muted tabular-nums">{{ fmtTime(lead.createdAt) }}</td>
              <td class="text-right">
                <button class="text-primary hover:underline" @click="viewDetail(lead.id)">查看</button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <!-- 空态 -->
      <EmptyState v-if="!loading && list.length === 0" message="暂无线索" icon="target" />
    </div>

    <!-- 分页 -->
    <Pagination
      v-if="!loading && list.length > 0"
      :page="page"
      :total-pages="totalPages"
      :total="total"
      @change="onPageChange"
    />
  </Layout>
</template>
