import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { request } from '../api/client'
import type { Site } from '../types'

const STORAGE_KEY = 'admin_selected_site_id'

export const useSiteStore = defineStore('site', () => {
  const sites = ref<Site[]>([])
  const loading = ref(false)
  const loaded = ref(false)
  const selectedSiteId = ref(localStorage.getItem(STORAGE_KEY) || '')
  let pendingLoad: Promise<Site[]> | null = null

  const currentSite = computed(
    () => sites.value.find((site) => site.id === selectedSiteId.value) || null,
  )

  function selectSite(siteId: string): void {
    if (!siteId || (loaded.value && !sites.value.some((site) => site.id === siteId))) return
    selectedSiteId.value = siteId
    localStorage.setItem(STORAGE_KEY, siteId)
  }

  async function loadSites(force = false): Promise<Site[]> {
    if (loaded.value && !force) return sites.value
    if (pendingLoad) return pendingLoad

    loading.value = true
    pendingLoad = request<Site[]>('GET', '/api/admin/sites')

    try {
      sites.value = await pendingLoad
      loaded.value = true

      if (!sites.value.some((site) => site.id === selectedSiteId.value)) {
        const firstSiteId = sites.value[0]?.id || ''
        selectedSiteId.value = firstSiteId
        if (firstSiteId) localStorage.setItem(STORAGE_KEY, firstSiteId)
        else localStorage.removeItem(STORAGE_KEY)
      }

      return sites.value
    } finally {
      loading.value = false
      pendingLoad = null
    }
  }

  return {
    sites,
    loading,
    selectedSiteId,
    currentSite,
    selectSite,
    loadSites,
  }
})
