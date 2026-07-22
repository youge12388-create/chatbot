<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { useNotificationStore } from '../stores/notification'
import { useSiteStore } from '../stores/site'
import { pushToast } from './toast-bus'
import { siteDisplayUrl, siteUrlInfo } from '../utils/site'
import AppIcon, { type IconName } from './AppIcon.vue'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const notification = useNotificationStore()
const siteStore = useSiteStore()

const title = computed(() => (route.meta.title as string) || '')
const siteMenuOpen = ref(false)
const sidebarCollapsed = ref(false)
const notificationPanelOpen = ref(false)
const siteNotifications = computed(() => [...notification.latestMessages]
  .filter((message) => message.siteId === siteStore.selectedSiteId)
  .reverse())
const currentSiteUrl = computed(() => siteUrlInfo(
  siteStore.currentSite?.domain,
  siteStore.currentSite?.id,
))

interface MenuItem {
  to: string
  label: string
  index: string
  icon: IconName
  adminOnly?: boolean
}

const menus: MenuItem[] = [
  { to: '/leads', label: '线索管理', index: '01', icon: 'target' },
  { to: '/conversations', label: '会话', index: '02', icon: 'chat' },
  { to: '/faqs', label: 'FAQ', index: '03', icon: 'help' },
  { to: '/sites', label: '站点配置', index: '04', icon: 'settings' },
  { to: '/users', label: '账号管理', index: '05', icon: 'users', adminOnly: true },
]

const visibleMenus = computed(() =>
  menus.filter((menu) => !menu.adminOnly || auth.user?.role === 'admin'),
)

const unreadDisplay = computed(() =>
  notification.unreadCount > 99 ? '99+' : String(notification.unreadCount),
)

function isActive(to: string): boolean {
  return route.path === to || route.path.startsWith(to + '/')
}

function siteNumber(siteId: string): string {
  return String(siteStore.sites.findIndex((site) => site.id === siteId) + 1).padStart(2, '0')
}

function selectSite(siteId: string): void {
  siteMenuOpen.value = false
  siteStore.selectSite(siteId)
  void notification.syncSite(siteId)
  if (route.name === 'conversation-detail') router.push('/conversations')
  if (route.name === 'lead-detail') router.push('/leads')
}

function closeSiteMenu(event: FocusEvent): void {
  const container = event.currentTarget as HTMLElement
  if (!container.contains(event.relatedTarget as Node | null)) siteMenuOpen.value = false
}

function toggleNotifications(): void {
  notificationPanelOpen.value = !notificationPanelOpen.value
}

function openNotification(conversationId: string): void {
  notification.markConversationRead(conversationId)
  notificationPanelOpen.value = false
  router.push(`/conversations/${conversationId}`)
}

function notificationTime(value: string): string {
  return new Date(value).toLocaleString('zh-CN')
}

function onLogout(): void {
  auth.logout()
  router.push('/login')
}

onMounted(async () => {
  if (auth.isLoggedIn && !auth.user) auth.fetchMe()
  try {
    await siteStore.loadSites()
  } catch (error) {
    pushToast('error', (error as Error).message)
  }
  notification.connect()
})
</script>

<template>
  <div class="admin-shell" :class="{ 'admin-shell--collapsed': sidebarCollapsed }">
    <aside class="sidebar">
      <div class="brand-lockup">
        <div class="brand-mark"><AppIcon name="grid" :size="22" :stroke-width="2.2" /></div>
        <div class="brand-copy">
          <strong>运营后台</strong>
          <span>Workspace</span>
        </div>
      </div>

      <div class="sidebar-heading">
        <AppIcon name="grid" :size="18" />
        <span>站点工作台</span>
      </div>

      <div
        class="site-context"
        @focusout="closeSiteMenu"
        @keydown.esc.stop="siteMenuOpen = false"
      >
        <div class="eyebrow">当前站点</div>
        <button
          type="button"
          class="site-selector"
          :disabled="siteStore.loading || siteStore.sites.length === 0"
          aria-haspopup="listbox"
          :aria-expanded="siteMenuOpen"
          @click="siteMenuOpen = !siteMenuOpen"
        >
          <span class="site-index">{{ siteStore.currentSite ? siteNumber(siteStore.currentSite.id) : '--' }}</span>
          <span class="site-selector-copy">
            <strong>{{ siteStore.loading ? '加载站点…' : (siteStore.currentSite?.name || '暂无可用站点') }}</strong>
            <small>{{ currentSiteUrl.display }}</small>
          </span>
          <AppIcon name="chevron" :size="16" :class="{ 'rotate-180': siteMenuOpen }" />
        </button>
        <div v-if="siteMenuOpen" role="listbox" class="site-menu">
          <button
            v-for="site in siteStore.sites"
            :key="site.id"
            type="button"
            role="option"
            :aria-selected="site.id === siteStore.selectedSiteId"
            class="site-menu-option"
            :class="{ 'site-menu-option--active': site.id === siteStore.selectedSiteId }"
            @click="selectSite(site.id)"
          >
            <span class="site-index">{{ siteNumber(site.id) }}</span>
            <span>
              <strong>{{ site.name }}</strong>
              <small>{{ siteDisplayUrl(site.domain, site.id) }}</small>
            </span>
          </button>
        </div>
        <a
          v-if="siteStore.currentSite && currentSiteUrl.configured"
          :href="currentSiteUrl.href || undefined"
          target="_blank"
          rel="noopener noreferrer"
          class="site-open-link"
        >
          打开网站 <AppIcon name="external" :size="14" />
        </a>
        <router-link v-else-if="siteStore.currentSite" to="/sites" class="site-open-link">
          配置网站地址 <AppIcon name="settings" :size="14" />
        </router-link>
      </div>

      <nav class="primary-nav" aria-label="主导航">
        <router-link
          v-for="menu in visibleMenus"
          :key="menu.to"
          :to="menu.to"
          class="nav-item"
          :class="{ 'nav-item--active': isActive(menu.to) }"
        >
          <span class="nav-item-index">{{ menu.index }}</span>
          <AppIcon :name="menu.icon" :size="19" />
          <span class="nav-item-label">{{ menu.label }}</span>
        </router-link>
      </nav>

      <button type="button" class="collapse-button" @click="sidebarCollapsed = !sidebarCollapsed">
        <AppIcon name="arrow-left" :size="18" />
        <span>收起导航</span>
      </button>
    </aside>

    <section class="workspace">
      <header class="topbar">
        <div class="topbar-heading">
          <h1>{{ title }}</h1>
          <span v-if="siteStore.currentSite" class="topbar-site">
            <AppIcon name="globe" :size="15" />
            {{ siteStore.currentSite.name }} · {{ siteDisplayUrl(siteStore.currentSite.domain, siteStore.currentSite.id) }}
          </span>
        </div>
        <div class="topbar-actions">
          <div class="notification-wrap">
            <button type="button" class="icon-button notification-button" aria-label="消息通知" :aria-expanded="notificationPanelOpen" @click="toggleNotifications">
              <AppIcon name="bell" :size="20" />
              <span v-if="notification.hasUnread" class="notification-badge">{{ unreadDisplay }}</span>
            </button>
            <div v-if="notificationPanelOpen" class="notification-panel" role="dialog" aria-label="消息通知">
              <div class="notification-panel__header">
                <strong>未读消息</strong>
                <span>{{ siteNotifications.length }} 条</span>
              </div>
              <div v-if="siteNotifications.length === 0" class="notification-panel__empty">当前站点暂无未读消息</div>
              <button
                v-for="message in siteNotifications"
                :key="message.id"
                type="button"
                class="notification-item"
                @click="openNotification(message.conversationId)"
              >
                <span class="notification-item__dot"></span>
                <span class="notification-item__body">
                  <span class="notification-item__title">访客会话 · {{ message.conversationId.slice(-4).toUpperCase() }}</span>
                  <span class="notification-item__content">{{ message.content }}</span>
                  <span class="notification-item__time">{{ notificationTime(message.createdAt) }}</span>
                </span>
              </button>
            </div>
          </div>
          <span class="topbar-divider"></span>
          <div class="user-chip">
            <span class="avatar">{{ (auth.user?.name || auth.user?.username || '?').charAt(0).toUpperCase() }}</span>
            <span class="user-copy">
              <strong>{{ auth.user?.name || auth.user?.username || '未登录' }}</strong>
              <small>{{ auth.user?.role === 'admin' ? '管理员' : '客服' }}</small>
            </span>
          </div>
          <span class="topbar-divider"></span>
          <button type="button" class="logout-button" @click="onLogout">
            <AppIcon name="logout" :size="18" />
            <span>退出</span>
          </button>
        </div>
      </header>

      <main class="page-content">
        <slot />
      </main>
    </section>
  </div>
</template>