<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Layout from '../components/Layout.vue'
import EmptyState from '../components/EmptyState.vue'
import AppIcon from '../components/AppIcon.vue'
import { request } from '../api/client'
import { pushToast } from '../components/toast-bus'
import { useAuthStore } from '../stores/auth'
import type { AdminUser, AdminRole } from '../types'

const auth = useAuthStore()

const loading = ref(false)
const list = ref<AdminUser[]>([])

const creating = ref(false)
const editingId = ref<string | null>(null)
const saving = ref(false)
const confirmDeleteId = ref<string | null>(null)

const createForm = ref({
  username: '',
  password: '',
  role: 'staff' as AdminRole,
  name: '',
})

const editForm = ref({
  password: '',
  role: 'staff' as AdminRole,
  name: '',
})

const roleOptions: { value: AdminRole; label: string }[] = [
  { value: 'staff', label: '客服' },
  { value: 'admin', label: '管理员' },
]

async function fetchList() {
  loading.value = true
  try {
    const data = await request<AdminUser[]>('GET', '/api/admin/users')
    list.value = data
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    loading.value = false
  }
}

function openCreate() {
  createForm.value = { username: '', password: '', role: 'staff', name: '' }
  creating.value = true
}

async function submitCreate() {
  if (!createForm.value.username.trim() || !createForm.value.password.trim()) {
    pushToast('error', '请输入用户名和密码')
    return
  }
  saving.value = true
  try {
    await request('POST', '/api/admin/users', {
      username: createForm.value.username,
      password: createForm.value.password,
      role: createForm.value.role,
      name: createForm.value.name,
    })
    pushToast('success', '已新增账号')
    creating.value = false
    await fetchList()
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    saving.value = false
  }
}

function openEdit(u: AdminUser) {
  editingId.value = u.id
  editForm.value = { password: '', role: (u.role as AdminRole) || 'staff', name: u.name || '' }
  confirmDeleteId.value = null
}

function cancelEdit() {
  editingId.value = null
}

async function submitEdit(u: AdminUser) {
  saving.value = true
  try {
    const payload: Record<string, unknown> = {
      role: editForm.value.role,
      name: editForm.value.name,
    }
    if (editForm.value.password) {
      payload.password = editForm.value.password
    }
    await request('PATCH', `/api/admin/users/${u.id}`, payload)
    pushToast('success', '已更新')
    editingId.value = null
    await fetchList()
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    saving.value = false
  }
}

async function confirmDelete(u: AdminUser) {
  saving.value = true
  try {
    await request('DELETE', `/api/admin/users/${u.id}`)
    pushToast('success', '已删除')
    confirmDeleteId.value = null
    await fetchList()
  } catch (e) {
    pushToast('error', (e as Error).message)
  } finally {
    saving.value = false
  }
}

function fmtTime(t: string | undefined): string {
  if (!t) return '-'
  return new Date(t).toLocaleString('zh-CN')
}

function roleLabel(r: string): string {
  return r === 'admin' ? '管理员' : '客服'
}

onMounted(fetchList)
</script>

<template>
  <Layout>
    <div class="page-toolbar">
      <span class="text-sm text-muted">仅管理员可管理账号</span>
      <div class="flex-1"></div>
      <button
        class="btn btn-primary"
        @click="openCreate"
      >
        <AppIcon name="plus" :size="16" />
        新增账号
      </button>
    </div>

    <!-- 新增表单 -->
    <div v-if="creating" class="panel p-4 mb-3">
      <div class="grid grid-cols-4 gap-3">
        <input v-model="createForm.username" type="text" placeholder="用户名" class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none" />
        <input v-model="createForm.password" type="password" placeholder="密码" class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none" />
        <select v-model="createForm.role" class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none">
          <option v-for="r in roleOptions" :key="r.value" :value="r.value">{{ r.label }}</option>
        </select>
        <input v-model="createForm.name" type="text" placeholder="姓名" class="px-3 py-2 rounded border border-border bg-bg focus:border-primary focus:outline-none" />
      </div>
      <div class="flex justify-end gap-2 mt-3">
        <button class="px-3 py-1.5 rounded border border-border text-sm hover:bg-surface" @click="creating = false">取消</button>
        <button :disabled="saving" class="px-3 py-1.5 rounded bg-primary text-white text-sm hover:bg-primary-hover disabled:opacity-50" @click="submitCreate">保存</button>
      </div>
    </div>

    <!-- 列表 -->
    <div class="panel overflow-hidden">
      <table class="table-base">
        <thead>
          <tr class="bg-surface text-muted text-left">
            <th class="px-4 py-3 font-medium">用户名</th>
            <th class="px-4 py-3 font-medium">角色</th>
            <th class="px-4 py-3 font-medium">姓名</th>
            <th class="px-4 py-3 font-medium">创建时间</th>
            <th class="px-4 py-3 font-medium text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <template v-if="loading">
            <tr v-for="i in 4" :key="`sk-${i}`" class="border-t border-border">
              <td v-for="j in 5" :key="j" class="px-4 py-3"><div class="h-4 bg-surface rounded animate-pulse"></div></td>
            </tr>
          </template>
          <template v-else>
            <tr
              v-for="u in list"
              :key="u.id"
              class="border-t border-border hover:bg-surface/60"
            >
              <!-- 编辑态 -->
              <template v-if="editingId === u.id">
                <td class="px-4 py-3 text-ink">{{ u.username }}</td>
                <td class="px-4 py-3">
                  <select v-model="editForm.role" class="px-2 py-1.5 rounded border border-border bg-bg focus:border-primary focus:outline-none">
                    <option v-for="r in roleOptions" :key="r.value" :value="r.value">{{ r.label }}</option>
                  </select>
                </td>
                <td class="px-4 py-3">
                  <input v-model="editForm.name" type="text" placeholder="姓名" class="px-2 py-1.5 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full" />
                </td>
                <td class="px-4 py-3">
                  <input v-model="editForm.password" type="password" placeholder="留空不改密码" class="px-2 py-1.5 rounded border border-border bg-bg focus:border-primary focus:outline-none w-full" />
                </td>
                <td class="px-4 py-3 text-right">
                  <button class="text-primary hover:underline mr-3" :disabled="saving" @click="submitEdit(u)">保存</button>
                  <button class="text-muted hover:underline" @click="cancelEdit">取消</button>
                </td>
              </template>
              <!-- 删除确认态 -->
              <template v-else-if="confirmDeleteId === u.id">
                <td class="px-4 py-3 text-danger" colspan="4">确认删除账号 {{ u.username }}？此操作不可恢复</td>
                <td class="px-4 py-3 text-right">
                  <button class="text-danger hover:underline mr-3" :disabled="saving" @click="confirmDelete(u)">确认删除</button>
                  <button class="text-muted hover:underline" @click="confirmDeleteId = null">取消</button>
                </td>
              </template>
              <!-- 正常态 -->
              <template v-else>
                <td class="px-4 py-3 text-ink">
                  {{ u.username }}
                  <span v-if="u.id === auth.user?.id" class="text-xs text-muted ml-1">(我)</span>
                </td>
                <td class="px-4 py-3 text-muted">{{ roleLabel(u.role) }}</td>
                <td class="px-4 py-3 text-muted">{{ u.name || '-' }}</td>
                <td class="px-4 py-3 text-muted">{{ fmtTime(u.createdAt) }}</td>
                <td class="px-4 py-3 text-right">
                  <button class="text-primary hover:underline mr-3" @click="openEdit(u)">编辑</button>
                  <button
                    v-if="u.id !== auth.user?.id"
                    class="text-danger hover:underline"
                    @click="confirmDeleteId = u.id"
                  >删除</button>
                  <span v-else class="text-xs text-muted">-</span>
                </td>
              </template>
            </tr>
          </template>
        </tbody>
      </table>
      <EmptyState v-if="!loading && list.length === 0" message="暂无账号" icon="users" />
    </div>
  </Layout>
</template>
