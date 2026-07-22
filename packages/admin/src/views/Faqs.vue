<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import Layout from '../components/Layout.vue'
import EmptyState from '../components/EmptyState.vue'
import AppIcon from '../components/AppIcon.vue'
import { request } from '../api/client'
import { pushToast } from '../components/toast-bus'
import { useSiteStore } from '../stores/site'
import { hasSiteUrl, siteDisplayUrl, siteHref } from '../utils/site'
import type { Faq } from '../types'

const siteStore = useSiteStore()
const loading = ref(false)
const list = ref<Faq[]>([])
const activeLanguage = ref<'all' | Faq['language']>('zh-CN')
const draggingId = ref<string | null>(null)
const reordering = ref(false)

const creating = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)

const blankForm = () => ({
  question: '',
  answer: '',
  language: 'zh-CN',
})
const form = ref(blankForm())

const editForm = ref(blankForm())
const confirmDeleteId = ref<string | null>(null)

const languageOptions = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en', label: 'English' },
  { value: 'ko', label: '한국어' },
  { value: 'ru', label: 'Русский' },
] as const

const visibleList = computed(() => {
  if (activeLanguage.value === 'all') return list.value
  return list.value.filter(faq => faq.language === activeLanguage.value)
})

function languageLabel(language: Faq['language']): string {
  return languageOptions.find(option => option.value === language)?.label || language
}

function positionOf(id: string): number {
  return visibleList.value.findIndex(faq => faq.id === id) + 1
}


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
      language: form.value.language,
      priority: visibleList.value.filter(faq => faq.language === form.value.language).length + 1,
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
  editForm.value = { question: f.question, answer: f.answer, language: f.language || 'zh-CN' }
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
      language: editForm.value.language,
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

function onDragStart(faq: Faq, event: DragEvent) {
  if (reordering.value || editingId.value || confirmDeleteId.value || activeLanguage.value === 'all') return
  draggingId.value = faq.id
  event.dataTransfer?.setData('text/plain', faq.id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDragEnd() {
  draggingId.value = null
}

async function onDrop(target: Faq) {
  const sourceId = draggingId.value
  draggingId.value = null
  if (!sourceId || sourceId === target.id || activeLanguage.value === 'all') return

  const orderedIds = visibleList.value.map(faq => faq.id)
  const sourceIndex = orderedIds.indexOf(sourceId)
  const targetIndex = orderedIds.indexOf(target.id)
  if (sourceIndex < 0 || targetIndex < 0) return
  orderedIds.splice(sourceIndex, 1)
  const insertIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
  orderedIds.splice(insertIndex, 0, sourceId)
  await saveOrder(orderedIds)
}

async function promote(faq: Faq) {
  if (activeLanguage.value === 'all') return
  const orderedIds = visibleList.value.map(item => item.id).filter(id => id !== faq.id)
  orderedIds.unshift(faq.id)
  await saveOrder(orderedIds)
}

async function saveOrder(orderedIds: string[]) {
  if (!siteStore.selectedSiteId || activeLanguage.value === 'all') return
  reordering.value = true
  try {
    await request('POST', '/api/admin/faqs/reorder', {
      siteId: siteStore.selectedSiteId,
      language: activeLanguage.value,
      orderedIds,
    })
    pushToast('success', '展示顺序已保存')
    await fetchList()
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    reordering.value = false
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
    <div class="mobile-page-heading faq-mobile-heading">
      <h2>常见问题</h2>
      <p>管理常见问题及自动回复内容</p>
      <button type="button" class="mobile-primary-action" @click="openCreate">
        <AppIcon name="plus" :size="20" />
        新增常见问题
      </button>
    </div>

    <!-- FAQ 始终属于左上角选中的站点 -->
    <div class="page-toolbar faq-desktop-toolbar">
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
        class="btn btn-primary ml-auto"
        @click="openCreate"
      >
        <AppIcon name="plus" :size="16" />
        新增常见问题
      </button>
    </div>

    <div class="panel mb-3 flex flex-wrap items-center gap-3 px-4 py-3 faq-language-panel">
      <div>
        <p class="text-sm font-medium text-ink">快捷问题展示顺序</p>
        <p class="mt-1 text-xs text-muted">当前语言前 5 个会显示在聊天窗口，可拖拽排序或将问题置顶。</p>
      </div>
      <select v-model="activeLanguage" class="select ml-auto w-36" :disabled="reordering">
        <option value="zh-CN">中文</option>
        <option value="en">English</option>
        <option value="ko">한국어</option>
        <option value="ru">Русский</option>
        <option value="all">全部语言（仅查看）</option>
      </select>
    </div>

    <!-- 新增表单 -->
    <div v-if="creating" class="panel p-4 mb-3 faq-create-panel">
      <div class="grid grid-cols-4 gap-3">
        <input
          v-model="form.question"
          type="text"
          placeholder="问题"
          class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none"
        />
        <textarea
          v-model="form.answer"
          rows="3"
          placeholder="答案（支持分段）"
          class="textarea resize-y"
        ></textarea>
        <select
          v-model="form.language"
          class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none"
        >
          <option value="zh-CN">中文</option>
          <option value="en">English</option>
          <option value="ko">한국어</option>
          <option value="ru">Русский</option>
        </select>
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
    <div class="panel overflow-hidden faq-table-panel">
      <div class="mobile-faq-list">
        <div v-for="f in visibleList" :key="`mobile-faq-${f.id}`" class="mobile-faq-card">
          <template v-if="editingId === f.id">
            <input v-model="editForm.question" type="text" class="mobile-faq-input" />
            <textarea v-model="editForm.answer" rows="4" class="mobile-faq-input mobile-faq-textarea"></textarea>
            <select v-model="editForm.language" class="mobile-faq-input">
              <option value="zh-CN">中文</option>
              <option value="en">English</option>
              <option value="ko">한국어</option>
              <option value="ru">Русский</option>
            </select>
            <span class="mobile-faq-actions">
              <button type="button" class="mobile-faq-action mobile-faq-action--primary" :disabled="saving" @click="submitEdit(f)">保存</button>
              <button type="button" class="mobile-faq-action" @click="cancelEdit">取消</button>
            </span>
          </template>
          <template v-else-if="confirmDeleteId === f.id">
            <strong class="mobile-faq-delete-title">确认删除此问题？</strong>
            <span class="mobile-faq-actions">
              <button type="button" class="mobile-faq-action mobile-faq-action--danger" :disabled="saving" @click="confirmDelete(f)">确认删除</button>
              <button type="button" class="mobile-faq-action" @click="confirmDeleteId = null">取消</button>
            </span>
          </template>
          <template v-else>
            <h3>{{ f.question }}</h3>
            <p><span>回答：</span>{{ f.answer }}</p>
            <div class="mobile-faq-meta">语言：{{ languageLabel(f.language) }} <span>排序：{{ positionOf(f.id) }}</span></div>
            <div class="mobile-faq-actions">
              <button type="button" class="mobile-faq-action mobile-faq-action--primary" @click="openEdit(f)"><AppIcon name="edit" :size="17" />编辑</button>
              <button type="button" class="mobile-faq-action mobile-faq-action--danger" @click="confirmDeleteId = f.id"><AppIcon name="trash" :size="17" />删除</button>
            </div>
          </template>
        </div>
      </div>
      <table class="table-base">
        <thead>
          <tr class="bg-surface text-muted text-left">
            <th class="px-4 py-3 font-medium">问题</th>
            <th class="px-4 py-3 font-medium">答案</th>
            <th class="px-4 py-3 font-medium w-24">语言</th>
            <th class="px-4 py-3 font-medium w-28">展示顺序</th>
            <th class="px-4 py-3 font-medium text-right w-40">操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="i in 5" :key="`sk-${i}`" class="border-t border-border">
              <td v-for="j in 5" :key="j" class="px-4 py-3"><div class="h-4 bg-surface rounded animate-pulse"></div></td>
            </tr>
          </template>
          <template v-else>
            <tr
              v-for="f in visibleList"
              :key="f.id"
              class="border-t border-border hover:bg-surface/60"
              draggable="true"
              @dragstart="onDragStart(f, $event)"
              @dragover.prevent
              @drop.prevent="onDrop(f)"
              @dragend="onDragEnd"
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
                  <textarea
                    v-model="editForm.answer"
                    rows="3"
                    placeholder="答案（支持分段）"
                    class="textarea resize-y"
                  ></textarea>
                </td>                <td class="px-4 py-3">
                  <select
                    v-model="editForm.language"
                    class="px-2 py-1.5 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full"
                  >
                    <option value="zh-CN">中文</option>
                    <option value="en">English</option>
                    <option value="ko">한국어</option>
                    <option value="ru">Русский</option>
                  </select>
                </td>
                <td class="px-4 py-3 text-muted">{{ positionOf(f.id) }}</td>
                <td class="px-4 py-3 text-right">
                  <button class="text-primary hover:underline mr-3" :disabled="saving" @click="submitEdit(f)">保存</button>
                  <button class="text-muted hover:underline" @click="cancelEdit">取消</button>
                </td>
              </template>
              <!-- 删除确认态 -->
              <template v-else-if="confirmDeleteId === f.id">
                <td class="px-4 py-3 text-danger" colspan="4">确认删除此问题？</td>
                <td class="px-4 py-3 text-right">
                  <button class="text-danger hover:underline mr-3" :disabled="saving" @click="confirmDelete(f)">确认删除</button>
                  <button class="text-muted hover:underline" @click="confirmDeleteId = null">取消</button>
                </td>
              </template>
              <!-- 正常态 -->
              <template v-else>
                <td class="px-4 py-3 text-ink">{{ f.question }}</td>
                <td class="px-4 py-3 text-muted">{{ f.answer }}</td>
                <td class="px-4 py-3 text-muted">{{ languageLabel(f.language) }}</td>
                <td class="px-4 py-3 text-muted">
                  <span v-if="positionOf(f.id) <= 5">展示 {{ positionOf(f.id) }}</span>
                  <span v-else>第 {{ positionOf(f.id) }} 条</span>
                </td>
                <td class="px-4 py-3 text-right">
                  <button v-if="positionOf(f.id) > 5" class="text-primary hover:underline mr-3" :disabled="reordering" @click="promote(f)">置顶</button>
                  <button class="text-primary hover:underline mr-3" @click="openEdit(f)">编辑</button>
                  <button class="text-danger hover:underline" @click="confirmDeleteId = f.id">删除</button>
                </td>
              </template>
            </tr>
          </template>
        </tbody>
      </table>
      <EmptyState v-if="!loading && visibleList.length === 0" message="暂无常见问题" icon="help" />
    </div>
  </Layout>
</template>
