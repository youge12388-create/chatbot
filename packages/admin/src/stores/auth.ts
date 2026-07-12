import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AdminUser } from '../types'
import { request, clearTokenAndRedirect, getCachedUser, cacheUser } from '../api/client'

const TOKEN_KEY = 'admin_token'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const user = ref<AdminUser | null>(getCachedUser())

  const isLoggedIn = computed(() => !!token.value)

  async function login(username: string, password: string): Promise<void> {
    const data = await request<{ token: string; user: AdminUser }>(
      'POST',
      '/api/admin/login',
      { username, password },
    )
    token.value = data.token
    user.value = data.user
    localStorage.setItem(TOKEN_KEY, data.token)
    cacheUser(data.user)
  }

  async function fetchMe(): Promise<void> {
    try {
      const me = await request<AdminUser>('GET', '/api/admin/me')
      user.value = me
      cacheUser(me)
    } catch {
      logout()
    }
  }

  function logout(): void {
    token.value = null
    user.value = null
    localStorage.removeItem(TOKEN_KEY)
    cacheUser(null)
    clearTokenAndRedirect()
  }

  return { token, user, isLoggedIn, login, fetchMe, logout }
})
