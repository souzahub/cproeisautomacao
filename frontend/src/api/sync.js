import { getBaseUrl } from "./client"

const CACHE_CLIENTS_KEY = "cproeis_cache_clients"
const CACHE_USERS_KEY = "cproeis_cache_users"
const CACHE_SETTINGS_KEY = "cproeis_cache_settings"
const SYNC_QUEUE_KEY = "cproeis_sync_queue"
const LAST_SYNC_KEY = "cproeis_last_sync"
const OFFLINE_AUTH_KEY = "cproeis_offline_auth"

export function getLocalCache(key, defaultValue = null) {
  try {
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : defaultValue
  } catch {
    return defaultValue
  }
}

export function setLocalCache(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {}
}

export function getSyncQueue() {
  return getLocalCache(SYNC_QUEUE_KEY, [])
}

export function addToSyncQueue(item) {
  const queue = getSyncQueue()
  queue.push({
    id: "sync_" + Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    createdAt: new Date().toISOString(),
    ...item
  })
  setLocalCache(SYNC_QUEUE_KEY, queue)
  window.dispatchEvent(new CustomEvent("cproeis:sync-queue-updated"))
}

export function clearSyncQueue() {
  setLocalCache(SYNC_QUEUE_KEY, [])
  window.dispatchEvent(new CustomEvent("cproeis:sync-queue-updated"))
}

export function getLastSyncTime() {
  return localStorage.getItem(LAST_SYNC_KEY) || null
}

export function setLastSyncTime() {
  const now = new Date().toISOString()
  localStorage.setItem(LAST_SYNC_KEY, now)
  return now
}

export function saveOfflineUser(email, password, userData) {
  const list = getLocalCache(OFFLINE_AUTH_KEY, [])
  const existingIdx = list.findIndex(u => u.email.toLowerCase() === email.toLowerCase())
  const record = {
    email: email.toLowerCase(),
    password,
    user: userData,
    savedAt: new Date().toISOString()
  }
  if (existingIdx >= 0) {
    list[existingIdx] = record
  } else {
    list.push(record)
  }
  setLocalCache(OFFLINE_AUTH_KEY, list)
}

export function findOfflineUser(email, password) {
  const list = getLocalCache(OFFLINE_AUTH_KEY, [])
  return list.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password)
}

export async function checkServerOnline() {
  const baseUrl = getBaseUrl()
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 4000)
    const resp = await fetch(`${baseUrl}/api/health`, {
      method: "GET",
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return resp.ok
  } catch {
    return false
  }
}

export async function syncWithCloud(token) {
  const baseUrl = getBaseUrl()
  const isOnline = await checkServerOnline()
  if (!isOnline) {
    throw new Error("servidor na nuvem offline ou inacessível no momento")
  }

  const queue = getSyncQueue()
  const remainingQueue = []
  let syncedItemsCount = 0

  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }

  for (const item of queue) {
    try {
      if (item.entity === "clients") {
        if (item.action === "create") {
          const resp = await fetch(`${baseUrl}/api/clients`, {
            method: "POST",
            headers,
            body: JSON.stringify(item.data)
          })
          if (!resp.ok) throw new Error("falha ao enviar cliente")
          syncedItemsCount++
        } else if (item.action === "update") {
          const resp = await fetch(`${baseUrl}/api/clients/${item.targetId}`, {
            method: "PUT",
            headers,
            body: JSON.stringify(item.data)
          })
          if (!resp.ok) throw new Error("falha ao atualizar cliente")
          syncedItemsCount++
        } else if (item.action === "delete") {
          const resp = await fetch(`${baseUrl}/api/clients/${item.targetId}`, {
            method: "DELETE",
            headers
          })
          if (!resp.ok && resp.status !== 404) throw new Error("falha ao remover cliente")
          syncedItemsCount++
        }
      } else if (item.entity === "users") {
        if (item.action === "create") {
          const resp = await fetch(`${baseUrl}/api/users`, {
            method: "POST",
            headers,
            body: JSON.stringify(item.data)
          })
          if (!resp.ok) throw new Error("falha ao criar usuário")
          syncedItemsCount++
        } else if (item.action === "update") {
          const resp = await fetch(`${baseUrl}/api/users/${item.targetId}`, {
            method: "PUT",
            headers,
            body: JSON.stringify(item.data)
          })
          if (!resp.ok) throw new Error("falha ao atualizar usuário")
          syncedItemsCount++
        } else if (item.action === "delete") {
          const resp = await fetch(`${baseUrl}/api/users/${item.targetId}`, {
            method: "DELETE",
            headers
          })
          if (!resp.ok && resp.status !== 404) throw new Error("falha ao remover usuário")
          syncedItemsCount++
        }
      } else if (item.entity === "settings") {
        if (item.action === "update") {
          const resp = await fetch(`${baseUrl}/api/settings`, {
            method: "PUT",
            headers,
            body: JSON.stringify(item.data)
          })
          if (!resp.ok) throw new Error("falha ao enviar configurações")
          syncedItemsCount++
        }
      }
    } catch {
      remainingQueue.push(item)
    }
  }

  setLocalCache(SYNC_QUEUE_KEY, remainingQueue)
  window.dispatchEvent(new CustomEvent("cproeis:sync-queue-updated"))

  try {
    const clientsResp = await fetch(`${baseUrl}/api/clients`, { headers })
    if (clientsResp.ok) {
      const freshClients = await clientsResp.json()
      setLocalCache(CACHE_CLIENTS_KEY, freshClients)
    }
  } catch {}

  try {
    const usersResp = await fetch(`${baseUrl}/api/users`, { headers })
    if (usersResp.ok) {
      const freshUsers = await usersResp.json()
      setLocalCache(CACHE_USERS_KEY, freshUsers)
    }
  } catch {}

  try {
    const settingsResp = await fetch(`${baseUrl}/api/settings`, { headers })
    if (settingsResp.ok) {
      const freshSettings = await settingsResp.json()
      setLocalCache(CACHE_SETTINGS_KEY, freshSettings)
    }
  } catch {}

  const lastSync = setLastSyncTime()

  return {
    success: true,
    syncedCount: syncedItemsCount,
    pendingCount: remainingQueue.length,
    lastSync
  }
}
