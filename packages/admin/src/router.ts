import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  { path: '/', redirect: '/leads' },
  { path: '/login', name: 'login', component: () => import('./views/Login.vue') },
  {
    path: '/leads',
    name: 'leads',
    component: () => import('./views/Leads.vue'),
    meta: { requiresAuth: true, title: '线索管理' },
  },
  {
    path: '/leads/:id',
    name: 'lead-detail',
    component: () => import('./views/LeadDetail.vue'),
    meta: { requiresAuth: true, title: '线索详情' },
  },
  {
    path: '/conversations',
    name: 'conversations',
    component: () => import('./views/Conversations.vue'),
    meta: { requiresAuth: true, title: '会话管理' },
  },
  {
    path: '/conversations/:id',
    name: 'conversation-detail',
    component: () => import('./views/ConversationDetail.vue'),
    meta: { requiresAuth: true, title: '会话详情' },
  },
  {
    path: '/sites',
    name: 'sites',
    component: () => import('./views/Sites.vue'),
    meta: { requiresAuth: true, title: '站点管理' },
  },
  {
    path: '/faqs',
    name: 'faqs',
    component: () => import('./views/Faqs.vue'),
    meta: { requiresAuth: true, title: '常见问题' },
  },
  {
    path: '/users',
    name: 'users',
    component: () => import('./views/Users.vue'),
    meta: { requiresAuth: true, title: '账号管理' },
  },
]

const router = createRouter({
  history: createWebHistory('/admin/'),
  routes,
})

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('admin_token')
  if (to.meta.requiresAuth && !token) {
    next('/login')
    return
  }
  if (to.path === '/login' && token) {
    next('/leads')
    return
  }
  next()
})

export default router
