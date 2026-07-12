<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const title = computed(() => (route.meta.title as string) || '')

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
})
</script>

<template>
  <div class="flex h-screen bg-surface">
    <!-- 左侧导航 -->
    <aside class="w-[240px] shrink-0 bg-bg border-r border-border flex flex-col">
      <div class="h-14 flex items-center px-5 border-b border-border">
        <span class="text-base font-semibold text-ink">运营后台</span>
      </div>
      <nav class="flex-1 py-3">
        <router-link
          v-for="m in visibleMenus"
          :key="m.to"
          :to="m.to"
          class="flex items-center gap-3 px-5 py-2.5 text-sm transition-colors border-l-2"
          :class="
            isActive(m.to)
              ? 'border-primary text-primary bg-primary/5 font-medium'
              : 'border-transparent text-muted hover:text-ink hover:bg-surface'
          "
        >
          <span class="text-xs w-4 text-center opacity-70">{{ m.icon }}</span>
          <span>{{ m.label }}</span>
        </router-link>
      </nav>
    </aside>

    <!-- 主区域 -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- 顶栏 -->
      <header class="h-14 shrink-0 bg-bg border-b border-border flex items-center justify-between px-8">
        <h1 class="text-base font-semibold text-ink">{{ title }}</h1>
        <div class="flex items-center gap-4 text-sm">
          <span class="text-muted">
            {{ auth.user?.name || auth.user?.username || '未登录' }}
            <span v-if="auth.user?.role" class="ml-1 text-xs text-muted/70">
              ({{ auth.user.role === 'admin' ? '管理员' : '客服' }})
            </span>
          </span>
          <button
            class="px-3 py-1.5 rounded border border-border text-muted hover:text-danger hover:border-danger/50 transition-colors"
            @click="onLogout"
          >
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
