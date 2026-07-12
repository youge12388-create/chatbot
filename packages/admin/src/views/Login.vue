<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import { pushToast } from '../components/toast-bus'

const router = useRouter()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const loading = ref(false)

async function onSubmit() {
  if (!username.value || !password.value) {
    pushToast('error', '请输入用户名和密码')
    return
  }
  loading.value = true
  try {
    await auth.login(username.value, password.value)
    router.push('/leads')
  } catch {
    pushToast('error', '账号或密码错误')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-surface px-4">
    <div class="w-full max-w-sm bg-bg rounded-lg border border-border shadow-sm p-8">
      <h1 class="text-xl font-semibold text-ink text-center mb-8">运营后台登录</h1>
      <form class="flex flex-col gap-4" @submit.prevent="onSubmit">
        <div class="flex flex-col gap-1.5">
          <label class="text-sm text-muted">用户名</label>
          <input
            v-model="username"
            type="text"
            autocomplete="username"
            class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none transition-colors"
            placeholder="请输入用户名"
          />
        </div>
        <div class="flex flex-col gap-1.5">
          <label class="text-sm text-muted">密码</label>
          <input
            v-model="password"
            type="password"
            autocomplete="current-password"
            class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none transition-colors"
            placeholder="请输入密码"
          />
        </div>
        <button
          type="submit"
          :disabled="loading"
          class="mt-2 py-2.5 rounded bg-primary text-white font-medium hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {{ loading ? '登录中...' : '登录' }}
        </button>
      </form>
    </div>
  </div>
</template>
