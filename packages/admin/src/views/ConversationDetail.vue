<script setup lang="ts">
import { computed, ref, onMounted, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Layout from '../components/Layout.vue'
import StatusBadge from '../components/StatusBadge.vue'
import { request } from '../api/client'
import { pushToast } from '../components/toast-bus'
import { useNotificationStore, type NotificationMessage } from '../stores/notification'
import type { Conversation, Message, ConversationStatus, InterestLevel, MessageRole, MessageSource } from '../types'
import { useSiteStore } from '../stores/site'
import { hasSiteUrl, siteDisplayUrl, siteHref } from '../utils/site'

const route = useRoute()
const router = useRouter()

const loading = ref(false)
const sending = ref(false)
const acting = ref(false)
const conv = ref<Conversation | null>(null)
const messages = ref<Message[]>([])
const replyText = ref('')

const notification = useNotificationStore()
const siteStore = useSiteStore()

const waitingForHuman = computed(() => conv.value?.status === 'transferred')
const humanHandling = computed(() => conv.value?.status === 'taken_over')

const interestLabels: Record<InterestLevel, string> = {
  unknown: '未知',
  low: '低',
  normal: '一般',
  medium: '中等',
  high: '高',
  strong: '极高',
}

const messagesEl = ref<HTMLElement | null>(null)

function fmtTime(t: string | null | undefined): string {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN')
}

async function fetchDetail() {
  loading.value = true
  try {
    const data = await request<Conversation>('GET', `/api/admin/conversations/${route.params.id}`)
    conv.value = data
    siteStore.selectSite(data.siteId)
    messages.value = data.messages || []
    await nextTick()
    scrollToBottom()
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    loading.value = false
  }
}

function scrollToBottom() {
  if (messagesEl.value) {
    messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }
}

function appendIfNew(m: NotificationMessage, role: MessageRole, source: MessageSource): void {
  const convId = String(route.params.id)
  if (m.conversationId !== convId) return
  if (messages.value.some((x) => x.id === m.id)) return
  messages.value.push({
    id: m.id,
    conversationId: m.conversationId,
    role,
    content: m.content,
    source,
    createdAt: m.createdAt,
  })
  nextTick(scrollToBottom)
}

// 复用 notification store 的全局 SSE 连接，按 id 去重追加当前会话的新消息
function drainStore(): void {
  for (const m of notification.latestMessages) appendIfNew(m, 'user', 'user')
  for (const m of notification.latestAgentReplies) appendIfNew(m, 'assistant', 'human')
}

watch(() => notification.latestMessages.length, drainStore)
watch(() => notification.latestAgentReplies.length, drainStore)

async function sendReply() {
  const content = replyText.value.trim()
  if (!content || sending.value) return
  sending.value = true
  try {
    const msg = await request<Message>(
      'POST',
      `/api/admin/conversations/${route.params.id}/reply`,
      { content },
    )
    messages.value.push(msg)
    replyText.value = ''
    await nextTick()
    scrollToBottom()
    // 首次回复会自动接管，刷新状态
    if (conv.value && conv.value.status !== 'closed') {
      conv.value.status = 'taken_over' as ConversationStatus
    }
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    sending.value = false
  }
}

async function takeOver() {
  acting.value = true
  try {
    await request('POST', `/api/admin/conversations/${route.params.id}/takeover`)
    if (conv.value) conv.value.status = 'taken_over' as ConversationStatus
    pushToast('success', '已接管')
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    acting.value = false
  }
}

async function release() {
  acting.value = true
  try {
    await request('POST', `/api/admin/conversations/${route.params.id}/release`)
    if (conv.value) conv.value.status = 'active' as ConversationStatus
    pushToast('success', '已释放，AI 恢复自动回复')
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    acting.value = false
  }
}

function back() {
  // 优先用浏览器历史返回（保留列表页的筛选 query）
  if (window.history.length > 1) {
    router.back()
  } else {
    router.push('/conversations')
  }
}

onMounted(async () => {
  await fetchDetail()
  // 处理挂载前已到达 store 的实时消息（按 id 去重，已在列表中的不会重复追加）
  drainStore()
})
</script>

<template>
  <Layout>
    <div class="flex flex-col h-[calc(100vh-3.5rem-4rem)]">
      <!-- 顶部信息卡 -->
      <div class="flex items-center gap-4 mb-4">
        <button class="text-sm text-muted hover:text-ink" @click="back">← 返回会话列表</button>
        <div class="flex-1">
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-primary">客户会话</p>
          <h2 class="mt-1 text-xl font-semibold text-ink">跟进客户问题</h2>
        </div>
        <template v-if="conv">
          <StatusBadge :status="conv.status" type="conversation" />
          <button
            v-if="waitingForHuman"
            :disabled="acting"
            class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50"
            @click="takeOver"
          >
            {{ acting ? '处理中...' : '接管并回复' }}
          </button>
          <button
            v-else-if="humanHandling"
            :disabled="acting"
            class="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:border-danger hover:text-danger disabled:opacity-50"
            @click="release"
          >
            释放给 AI
          </button>
        </template>
      </div>
      <div v-if="loading" class="text-muted py-16 text-center">加载中...</div>

      <template v-else-if="conv">
        <div
          v-if="waitingForHuman"
          class="mb-4 rounded-xl border border-accent/30 bg-accent/10 px-4 py-3"
        >
          <div class="text-sm font-semibold text-ink">客户已请求人工客服</div>
          <p class="mt-1 text-xs text-muted">接管后 AI 会暂停，客户只会收到你的人工回复。点击右上角“接管并回复”即可开始处理。</p>
        </div>
        <!-- 会话信息 -->
        <div class="bg-bg rounded-lg border border-border p-4 mb-4 grid grid-cols-4 gap-4 text-sm">
          <div><span class="text-muted">访客 ID：</span><span class="font-mono text-xs">{{ conv.visitorId }}</span></div>
          <div>
            <span class="text-muted">来源站点：</span>{{ conv.site?.name || '-' }}
            <a
              v-if="hasSiteUrl(conv.site?.domain, conv.siteId)"
              :href="siteHref(conv.site?.domain, conv.siteId)"
              target="_blank"
              rel="noopener noreferrer"
              class="block text-xs text-primary underline underline-offset-2"
            >
              {{ siteDisplayUrl(conv.site?.domain, conv.siteId) }}
            </a>
          </div>
          <div><span class="text-muted">兴趣等级：</span>{{ interestLabels[conv.interestLevel] }}</div>
          <div><span class="text-muted">创建时间：</span>{{ fmtTime(conv.createdAt) }}</div>
        </div>

        <!-- 消息时间线 -->
        <div
          ref="messagesEl"
          class="flex-1 overflow-y-auto bg-bg rounded-lg border border-border p-6 flex flex-col gap-3"
        >
          <div v-if="messages.length === 0" class="text-center text-muted py-8 text-sm">暂无消息</div>
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="flex"
            :class="msg.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <div
              class="max-w-[65%] px-4 py-2.5 rounded-lg text-sm"
              :class="[
                msg.role === 'user'
                  ? 'bg-surface text-ink'
                  : msg.source === 'human'
                    ? 'bg-bg border-2 border-accent text-ink'
                    : 'bg-bg border border-border text-ink',
              ]"
            >
              <div class="text-xs text-muted mb-1">
                {{ msg.role === 'user' ? '访客' : msg.source === 'human' ? '人工' : 'AI' }}
                · {{ fmtTime(msg.createdAt) }}
              </div>
              <div class="whitespace-pre-wrap">{{ msg.content }}</div>
            </div>
          </div>
        </div>

        <!-- 底部回复 -->
        <div class="mt-4 flex gap-2">
          <textarea
            v-model="replyText"
            rows="2"
            :disabled="sending || conv.status === 'closed' || conv.status === 'transferred'"
            class="flex-1 px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none resize-none"
            :placeholder="conv.status === 'closed' ? '会话已关闭' : conv.status === 'transferred' ? '请先点击“接管并回复”' : '输入回复内容，Enter 发送，Shift+Enter 换行'"
            @keydown.enter.exact.prevent="sendReply"
          ></textarea>
          <button
            :disabled="sending || !replyText.trim() || conv.status === 'closed' || conv.status === 'transferred'"
            class="px-5 rounded bg-primary text-white font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
            @click="sendReply"
          >
            {{ sending ? '发送中...' : '发送' }}
          </button>
        </div>
      </template>
    </div>
  </Layout>
</template>
