<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Layout from '../components/Layout.vue'
import EmptyState from '../components/EmptyState.vue'
import { request } from '../api/client'
import { pushToast } from '../components/toast-bus'
import type { Site, SiteSettings } from '../types'

const loading = ref(false)
const list = ref<Site[]>([])
const expanded = ref<Record<string, boolean>>({})
const saving = ref<Record<string, boolean>>({})
const drafts = ref<Record<string, { name: string; settings: SiteSettings }>>({})

async function fetchList() {
  loading.value = true
  try {
    const data = await request<Site[]>('GET', '/api/admin/sites')
    list.value = data
    for (const s of data) {
      drafts.value[s.id] = {
        name: s.name,
        settings: { ...s.settings },
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
              <label class="text-sm text-muted block mb-1.5">气泡文案</label>
              <input
                v-model="getDraft(site.id)!.settings.bubbleMessage"
                type="text"
                class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full"
              />
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
