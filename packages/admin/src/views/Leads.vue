<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import Layout from '../components/Layout.vue'
import Pagination from '../components/Pagination.vue'
import StatusBadge from '../components/StatusBadge.vue'
import EmptyState from '../components/EmptyState.vue'
import { request } from '../api/client'
import { pushToast } from '../components/toast-bus'
import type { Lead, PageResult, LeadStatus, InterestLevel } from '../types'

const router = useRouter()

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

function fmtInterest(level: InterestLevel | undefined): string {
  if (!level) return '未知'
  return interestLabels[level] || level
}

async function exportCsv() {
  try {
    const csv = await request<string>('GET', '/api/admin/leads/export')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'leads.csv'
    a.click()
    URL.revokeObjectURL(url)
    pushToast('success', '导出成功')
  } catch (e) {
    pushToast('error', (e as Error).message)
  }
}

watch(statusFilter, onStatusChange)

onMounted(fetchList)
</script>

<template>
  <Layout>
    <!-- 筛选栏 -->
    <div class="flex items-center gap-3 mb-4">
      <select v-model="statusFilter" class="select w-auto">
        <option v-for="o in statusOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <input
        v-model="search"
        type="text"
        placeholder="搜索姓名/电话/邮箱"
        class="input w-64"
        @keyup.enter="onSearch"
      />
      <button class="btn" @click="onSearch">搜索</button>
      <div class="flex-1"></div>
      <button class="btn" @click="exportCsv">导出 CSV</button>
    </div>

    <!-- 表格 -->
    <div class="panel overflow-hidden">
      <table class="table-base">
        <thead>
          <tr>
            <th>姓名</th>
            <th>电话</th>
            <th>邮箱</th>
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
              <td v-for="j in 7" :key="j">
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
      <EmptyState v-if="!loading && list.length === 0" message="暂无线索" icon="∅" />
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
