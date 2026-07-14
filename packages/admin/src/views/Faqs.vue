<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import Layout from '../components/Layout.vue'
import EmptyState from '../components/EmptyState.vue'
import { request } from '../api/client'
import { pushToast } from '../components/toast-bus'
import { useSiteStore } from '../stores/site'
import { hasSiteUrl, siteDisplayUrl, siteHref } from '../utils/site'
import type { Faq } from '../types'

const siteStore = useSiteStore()
const loading = ref(false)
const list = ref<Faq[]>([])

const creating = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)

const blankForm = () => ({
  question: '',
  answer: '',
  priority: 0,
})
const form = ref(blankForm())

const editForm = ref(blankForm())
const confirmDeleteId = ref<string | null>(null)

async function fetchList() {
  if (!siteStore.selectedSiteId) return
  loading.value = true
  try {
    const data = await request<Faq[]>('GET', '/api/admin/faqs', { siteId: siteStore.selectedSiteId })
    list.value = data
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  form.value = blankForm()
  creating.value = true
}

function cancelCreate() {
  creating.value = false
}

async function submitCreate() {
  if (!form.value.question.trim() || !form.value.answer.trim()) {
    pushToast('error', '问题和答案不能为空')
    return
  }
  saving.value = true
  try {
    await request('POST', '/api/admin/faqs', {
      siteId: siteStore.selectedSiteId,
      question: form.value.question,
      answer: form.value.answer,
      priority: form.value.priority,
    })
    pushToast('success', '已新增')
    creating.value = false
    await fetchList()
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    saving.value = false
  }
}

function openEdit(f: Faq) {
  editingId.value = f.id
  editForm.value = { question: f.question, answer: f.answer, priority: f.priority }
  confirmDeleteId.value = null
}

function cancelEdit() {
  editingId.value = null
}

async function submitEdit(f: Faq) {
  if (!editForm.value.question.trim() || !editForm.value.answer.trim()) {
    pushToast('error', '问题和答案不能为空')
    return
  }
  saving.value = true
  try {
    await request('PATCH', `/api/admin/faqs/${f.id}`, {
      question: editForm.value.question,
      answer: editForm.value.answer,
      priority: editForm.value.priority,
    })
    pushToast('success', '已更新')
    editingId.value = null
    await fetchList()
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    saving.value = false
  }
}

async function confirmDelete(f: Faq) {
  saving.value = true
  try {
    await request('DELETE', `/api/admin/faqs/${f.id}`)
    pushToast('success', '已删除')
    confirmDeleteId.value = null
    await fetchList()
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    saving.value = false
  }
}

watch(() => siteStore.selectedSiteId, fetchList)

onMounted(async () => {
  await siteStore.loadSites()
  await fetchList()
})
</script>

<template>
  <Layout>
    <!-- FAQ 始终属于左上角选中的站点 -->
    <div class="flex items-center gap-3 mb-4">
      <div>
        <p class="font-semibold text-ink">{{ siteStore.currentSite?.name || '未选择站点' }}</p>
        <a
          v-if="siteStore.currentSite && hasSiteUrl(siteStore.currentSite.domain, siteStore.currentSite.id)"
          :href="siteHref(siteStore.currentSite.domain, siteStore.currentSite.id)"
          target="_blank"
          rel="noopener noreferrer"
          class="text-xs text-primary underline underline-offset-2"
        >
          {{ siteDisplayUrl(siteStore.currentSite.domain, siteStore.currentSite.id) }}
        </a>
      </div>
      <button
        class="ml-auto px-3 py-2 rounded bg-primary text-white text-sm hover:bg-primary-hover"
        @click="openCreate"
      >
        + 新增常见问题
      </button>
    </div>

    <!-- 新增表单 -->
    <div v-if="creating" class="bg-bg rounded-lg border border-border p-4 mb-3">
      <div class="grid grid-cols-3 gap-3">
        <input
          v-model="form.question"
          type="text"
          placeholder="问题"
          class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none"
        />
        <input
          v-model="form.answer"
          type="text"
          placeholder="答案"
          class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none"
        />
        <input
          v-model.number="form.priority"
          type="number"
          placeholder="优先级"
          class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none"
        />
      </div>
      <div class="flex justify-end gap-2 mt-3">
        <button class="px-3 py-1.5 rounded border border-border text-sm hover:bg-surface" @click="cancelCreate">取消</button>
        <button
          :disabled="saving"
          class="px-3 py-1.5 rounded bg-primary text-white text-sm hover:bg-primary-hover disabled:opacity-50"
          @click="submitCreate"
        >
          保存
        </button>
      </div>
    </div>

    <!-- 列表 -->
    <div class="bg-bg rounded-lg border border-border overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-surface text-muted text-left">
            <th class="px-4 py-3 font-medium">问题</th>
            <th class="px-4 py-3 font-medium">答案</th>
            <th class="px-4 py-3 font-medium w-20">优先级</th>
            <th class="px-4 py-3 font-medium text-right w-40">操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="i in 5" :key="`sk-${i}`" class="border-t border-border">
              <td v-for="j in 4" :key="j" class="px-4 py-3"><div class="h-4 bg-surface rounded animate-pulse"></div></td>
            </tr>
          </template>
          <template v-else>
            <tr
              v-for="f in list"
              :key="f.id"
              class="border-t border-border hover:bg-surface/60"
            >
              <!-- 编辑态 -->
              <template v-if="editingId === f.id">
                <td class="px-4 py-3">
                  <input
                    v-model="editForm.question"
                    type="text"
                    class="px-2 py-1.5 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full"
                  />
                </td>
                <td class="px-4 py-3">
                  <input
                    v-model="editForm.answer"
                    type="text"
                    class="px-2 py-1.5 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full"
                  />
                </td>
                <td class="px-4 py-3">
                  <input
                    v-model.number="editForm.priority"
                    type="number"
                    class="px-2 py-1.5 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full"
                  />
                </td>
                <td class="px-4 py-3 text-right">
                  <button class="text-primary hover:underline mr-3" :disabled="saving" @click="submitEdit(f)">保存</button>
                  <button class="text-muted hover:underline" @click="cancelEdit">取消</button>
                </td>
              </template>
              <!-- 删除确认态 -->
              <template v-else-if="confirmDeleteId === f.id">
                <td class="px-4 py-3 text-danger" colspan="3">确认删除此问题？</td>
                <td class="px-4 py-3 text-right">
                  <button class="text-danger hover:underline mr-3" :disabled="saving" @click="confirmDelete(f)">确认删除</button>
                  <button class="text-muted hover:underline" @click="confirmDeleteId = null">取消</button>
                </td>
              </template>
              <!-- 正常态 -->
              <template v-else>
                <td class="px-4 py-3 text-ink">{{ f.question }}</td>
                <td class="px-4 py-3 text-muted">{{ f.answer }}</td>
                <td class="px-4 py-3 text-muted">{{ f.priority }}</td>
                <td class="px-4 py-3 text-right">
                  <button class="text-primary hover:underline mr-3" @click="openEdit(f)">编辑</button>
                  <button class="text-danger hover:underline" @click="confirmDeleteId = f.id">删除</button>
                </td>
              </template>
            </tr>
          </template>
        </tbody>
      </table>
      <EmptyState v-if="!loading && list.length === 0" message="暂无常见问题" icon="◇" />
    </div>
  </Layout>
</template>
