<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useNotificationStore } from '../stores/notification'
import { useSiteStore } from '../stores/site'
import { pushToast } from './toast-bus'
import { siteDisplayUrl, siteUrlInfo } from '../utils/site'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const notification = useNotificationStore()
const siteStore = useSiteStore()

const title = computed(() => (route.meta.title as string) || '')
const siteMenuOpen = ref(false)
const currentSiteUrl = computed(() => siteUrlInfo(
  siteStore.currentSite?.domain,
  siteStore.currentSite?.id,
))

function siteNumber(siteId: string): string {
  return String(siteStore.sites.findIndex((site) => site.id === siteId) + 1).padStart(2, '0')
}

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

function selectSite(siteId: string): void {
  siteMenuOpen.value = false
  siteStore.selectSite(siteId)

  if (route.name === 'conversation-detail') {
    router.push('/conversations')
  } else if (route.name === 'lead-detail') {
    router.push('/leads')
  }
}

function closeSiteMenu(event: FocusEvent): void {
  const container = event.currentTarget as HTMLElement
  if (!container.contains(event.relatedTarget as Node | null)) {
    siteMenuOpen.value = false
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
    <aside class="w-[288px] shrink-0 bg-surface border-r border-border flex flex-col">
      <div class="px-5 py-4 border-b border-border">
        <p class="text-[11px] font-semibold tracking-[0.16em] text-primary uppercase">运营后台</p>
        <p class="mt-1 text-lg font-semibold tracking-tight text-ink">站点工作台</p>
      </div>
      <div
        class="relative px-4 py-4 border-b border-border bg-bg"
        @focusout="closeSiteMenu"
        @keydown.esc.stop="siteMenuOpen = false"
      >
        <p class="mb-2 text-[11px] font-semibold tracking-wide text-muted">当前站点</p>
        <button
          type="button"
          class="w-full min-h-[68px] grid grid-cols-[32px_minmax(0,1fr)_12px] items-center gap-3 border border-border bg-bg px-3 py-2.5 text-left hover:border-ink-3 focus:border-primary focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="siteStore.loading || siteStore.sites.length === 0"
          aria-haspopup="listbox"
          :aria-expanded="siteMenuOpen"
          @click="siteMenuOpen = !siteMenuOpen"
        >
          <span class="text-[11px] tabular-nums text-primary">
            {{ siteStore.currentSite ? siteNumber(siteStore.currentSite.id) : '--' }}
          </span>
          <span class="min-w-0">
            <span class="block truncate text-sm font-semibold text-ink">
              {{ siteStore.loading ? '加载站点...' : (siteStore.currentSite?.name || '暂无可用站点') }}
            </span>
            <span
              class="mt-1 block truncate text-xs"
              :class="currentSiteUrl.configured ? 'text-muted' : 'text-ink-3'"
            >
              {{ currentSiteUrl.display }}
            </span>
          </span>
          <span
            class="h-2 w-2 border-b border-r border-ink-3 transition-transform"
            :class="siteMenuOpen ? 'rotate-[225deg]' : 'rotate-45'"
            aria-hidden="true"
          ></span>
        </button>

        <div
          v-if="siteMenuOpen"
          role="listbox"
          aria-label="切换当前站点"
          class="absolute left-4 right-4 top-[112px] z-30 border border-border bg-bg shadow-[0_12px_30px_rgba(15,23,42,0.12)]"
        >
          <button
            v-for="site in siteStore.sites"
            :key="site.id"
            type="button"
            role="option"
            :aria-selected="site.id === siteStore.selectedSiteId"
            class="grid w-full grid-cols-[32px_minmax(0,1fr)] gap-3 border-b border-border px-3 py-3 text-left last:border-b-0 hover:bg-surface-2 focus:bg-primary-soft focus:outline-none"
            :class="site.id === siteStore.selectedSiteId ? 'bg-primary-soft' : 'bg-bg'"
            @click="selectSite(site.id)"
          >
            <span class="pt-0.5 text-[11px] tabular-nums text-primary">{{ siteNumber(site.id) }}</span>
            <span class="min-w-0">
              <span class="block truncate text-sm font-medium text-ink">{{ site.name }}</span>
              <span class="mt-0.5 block truncate text-xs text-muted">
                {{ siteDisplayUrl(site.domain, site.id) }}
              </span>
            </span>
          </button>
        </div>

        <a
          v-if="siteStore.currentSite && currentSiteUrl.configured"
          :href="currentSiteUrl.href || undefined"
          target="_blank"
          rel="noopener noreferrer"
          class="mt-2 inline-block text-xs text-primary underline underline-offset-2"
        >
          打开网站
        </a>
        <router-link
          v-else-if="siteStore.currentSite"
          to="/sites"
          class="mt-2 inline-block text-xs text-primary underline underline-offset-2"
        >
          去配置网址
        </router-link>
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
