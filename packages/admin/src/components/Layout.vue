<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useNotificationStore } from '../stores/notification'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const notification = useNotificationStore()

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
  icon: string
  adminOnly?: boolean
}

const menus: MenuItem[] = [
  { to: '/leads', label: '线索', icon: '◆' },
  { to: '/conversations', label: '会话', icon: '●' },
  { to: '/sites', label: '站点', icon: '◼' },
  { to: '/faqs', label: 'FAQ', icon: '◇' },
  { to: '/users', label: '账号管理', icon: '◉', adminOnly: true },
]

const visibleMenus = computed(() =>
  menus.filter((m) => !m.adminOnly || auth.user?.role === 'admin'),
)

function isActive(to: string): boolean {
  return route.path === to || route.path.startsWith(to + '/')
}

async function onLogout() {
  auth.logout()
  router.push('/login')
}

onMounted(() => {
  if (auth.isLoggedIn && !auth.user) {
    auth.fetchMe()
  }
  // 幂等：已连接则 no-op；不在 onUnmounted 断开以保持页面切换时 SSE 常驻
  notification.connect()
})
</script>

<template>
  <div class="flex h-screen bg-bg">
    <!-- 左侧导航 -->
    <aside class="w-[220px] shrink-0 bg-surface-2 border-r border-border flex flex-col">
      <div class="h-14 flex items-center px-5 border-b border-border">
        <span class="text-[15px] font-semibold text-ink tracking-tight">运营后台</span>
      </div>
      <nav class="flex-1 py-3">
        <router-link
          v-for="m in visibleMenus"
          :key="m.to"
          :to="m.to"
          class="relative flex items-center gap-3 px-5 py-2 text-sm transition-colors duration-150"
          :class="
            isActive(m.to)
              ? 'text-primary font-medium bg-primary-soft'
              : 'text-ink-2 hover:text-ink hover:bg-surface'
          "
        >
          <!-- 当前项左侧色条 -->
          <span
            v-if="isActive(m.to)"
            class="absolute left-0 top-0 bottom-0 w-[3px] bg-primary"
          ></span>
          <span class="text-xs w-4 text-center opacity-60">{{ m.icon }}</span>
          <span>{{ m.label }}</span>
        </router-link>
      </nav>
    </aside>

    <!-- 主区域 -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- 顶栏 -->
      <header class="h-14 shrink-0 bg-bg border-b border-border flex items-center justify-between px-8 sticky top-0 z-10">
        <h1 class="text-base font-semibold text-ink">{{ title }}</h1>
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
