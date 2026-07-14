<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useNotificationStore } from '../stores/notification'
import { useSiteStore } from '../stores/site'
import { pushToast } from './toast-bus'
import { siteDisplayUrl, siteHref } from '../utils/site'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const notification = useNotificationStore()
const siteStore = useSiteStore()

const title = computed(() => (route.meta.title as string) || '')

const unreadDisplay = computed(() =>
  notification.unreadCount > 99 ? '99+' : String(notification.unreadCount),
)

function goConversations() {
  router.push('/conversations')
}

interface MenuItem {
  to: string
  label: string
  index: string
  adminOnly?: boolean
}

const menus: MenuItem[] = [
  { to: '/leads', label: '线索', index: '01' },
  { to: '/conversations', label: '会话', index: '02' },
  { to: '/faqs', label: 'FAQ', index: '03' },
  { to: '/sites', label: '站点配置', index: '04' },
  { to: '/users', label: '账号管理', index: '05', adminOnly: true },
]

const visibleMenus = computed(() =>
  menus.filter((m) => !m.adminOnly || auth.user?.role === 'admin'),
)

function isActive(to: string): boolean {
  return route.path === to || route.path.startsWith(to + '/')
}

function onSiteChange(event: Event): void {
  const siteId = (event.target as HTMLSelectElement).value
  siteStore.selectSite(siteId)

  if (route.name === 'conversation-detail') {
    router.push('/conversations')
  } else if (route.name === 'lead-detail') {
    router.push('/leads')
  }
}

async function onLogout() {
  auth.logout()
  router.push('/login')
}

onMounted(async () => {
  if (auth.isLoggedIn && !auth.user) {
    auth.fetchMe()
  }
  try {
    await siteStore.loadSites()
  } catch (e) {
    pushToast('error', (e as Error).message)
  }
  // 幂等：已连接则 no-op；不在 onUnmounted 断开以保持页面切换时 SSE 常驻
  notification.connect()
})
</script>

<template>
  <div class="flex h-screen bg-bg">
    <!-- 左上角固定为全局站点上下文，页面内容随选择同步切换 -->
    <aside class="w-[260px] shrink-0 bg-surface border-r border-border flex flex-col">
      <div class="px-5 py-4 border-b border-border">
        <p class="text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">运营后台</p>
        <p class="mt-1 text-lg font-semibold tracking-tight text-ink">站点工作台</p>
      </div>
      <div class="px-4 py-4 border-b border-border bg-bg">
        <label class="block mb-2 text-[11px] font-semibold tracking-wide text-muted">当前站点</label>
        <select
          :value="siteStore.selectedSiteId"
          class="select font-medium"
          :disabled="siteStore.loading || siteStore.sites.length === 0"
          @change="onSiteChange"
        >
          <option v-if="siteStore.loading" value="">加载站点...</option>
          <option v-for="s in siteStore.sites" :key="s.id" :value="s.id">
            {{ s.name }} — {{ siteDisplayUrl(s.domain) }}
          </option>
        </select>
        <a
          v-if="siteStore.currentSite"
          :href="siteHref(siteStore.currentSite.domain)"
          target="_blank"
          rel="noopener noreferrer"
          class="block mt-2 text-xs text-primary underline underline-offset-2 truncate"
        >
          {{ siteDisplayUrl(siteStore.currentSite.domain) }}
        </a>
        <p v-else class="mt-2 text-xs text-muted">暂无可用站点</p>
      </div>
      <nav class="flex-1 py-4 px-3">
        <router-link
          v-for="m in visibleMenus"
          :key="m.to"
          :to="m.to"
          class="flex items-center px-3 py-2.5 border-l-2 text-sm transition-colors duration-150"
          :class="
            isActive(m.to)
              ? 'text-primary font-semibold bg-primary-soft border-primary'
              : 'text-ink-2 border-transparent hover:text-ink hover:bg-surface-2'
          "
        >
          <span class="w-7 text-[10px] tabular-nums opacity-60">{{ m.index }}</span>
          <span>{{ m.label }}</span>
        </router-link>
      </nav>
    </aside>

    <!-- 主区域 -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- 顶栏使用 1px 网格线维持站点与页面标题的上下文关系 -->
      <header class="h-14 shrink-0 bg-bg border-b border-border flex items-center justify-between px-8 sticky top-0 z-10">
        <div class="flex items-center gap-3 min-w-0">
          <h1 class="text-base font-semibold text-ink shrink-0">{{ title }}</h1>
          <span v-if="siteStore.currentSite" class="h-4 w-px bg-border"></span>
          <span v-if="siteStore.currentSite" class="text-xs text-muted truncate">
            {{ siteStore.currentSite.name }} · {{ siteDisplayUrl(siteStore.currentSite.domain) }}
          </span>
        </div>
        <div class="flex items-center gap-4 text-sm">
          <button
            v-if="notification.hasUnread"
            class="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-danger text-white text-[11px] leading-none font-semibold hover:opacity-85 transition-opacity"
            :title="`未读消息 ${notification.unreadCount} 条`"
            @click="goConversations"
          >
            {{ unreadDisplay }}
          </button>
          <div class="flex items-center gap-2 text-ink-2">
            <span class="w-7 h-7 rounded-full bg-primary-soft text-primary flex items-center justify-center text-xs font-semibold">
              {{ (auth.user?.name || auth.user?.username || '?').charAt(0).toUpperCase() }}
            </span>
            <span>
              {{ auth.user?.name || auth.user?.username || '未登录' }}
              <span v-if="auth.user?.role" class="ml-1 text-xs text-muted">
                {{ auth.user.role === 'admin' ? '管理员' : '客服' }}
              </span>
            </span>
          </div>
          <button class="btn btn-sm" @click="onLogout">
            登出
          </button>
        </div>
      </header>

      <!-- 内容区 -->
      <main class="flex-1 overflow-auto p-8">
        <slot />
      </main>
    </div>
  </div>
</template>
