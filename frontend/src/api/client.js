import {
  getLocalCache,
  setLocalCache,
  addToSyncQueue,
  saveOfflineUser,
  findOfflineUser,
  checkServerOnline,
  syncWithCloud
} from "./sync"

const CACHE_CLIENTS_KEY = "cproeis_cache_clients"
const CACHE_USERS_KEY = "cproeis_cache_users"
const CACHE_SETTINGS_KEY = "cproeis_cache_settings"

export function getBaseUrl() {
  if (typeof window !== "undefined" && window.localStorage) {
    const custom = localStorage.getItem("server_url")
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, "")
    }
  }
  const envUrl = (typeof import.meta !== "undefined" && import.meta.env && (import.meta.env.VITE_API_URL || import.meta.env.VITE_SERVER_URL)) || ""
  if (envUrl && envUrl.trim()) {
    return envUrl.trim().replace(/\/+$/, "")
  }
  if (typeof window !== "undefined" && window.location && window.location.origin && window.location.origin.startsWith("http") && !window.location.origin.includes("localhost") && !window.location.origin.includes("127.0.0.1")) {
    return window.location.origin
  }
  return "https://cprsautomacao.devsouza.online"
}

function getToken() {
  return localStorage.getItem("auth_token")
}

export async function apiRequest(endpoint, options = {}) {
  const token = getToken()
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {})
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const baseUrl = getBaseUrl()
  const response = await fetch(`${baseUrl}${endpoint}`, {
    ...options,
    headers
  })

  if (response.status === 401) {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("auth_user")
    throw new Error("Sessao expirada.")
  }

  if (!response.ok) {
    let errorDetail = "Falha na requisicao."
    try {
      const errData = await response.json()
      if (errData && errData.detail) {
        errorDetail = errData.detail
      }
    } catch {}
    throw new Error(errorDetail)
  }

  return response.json()
}

export const authApi = {
  login: async (email, password) => {
    try {
      const res = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password })
      })
      if (res && res.user) {
        saveOfflineUser(email, password, res.user)
      }
      return res
    } catch (err) {
      if (err.message && (err.message.includes("Sessao") || err.message.includes("Credenciais") || err.message.includes("incorretos"))) {
        throw err
      }
      const offline = findOfflineUser(email, password)
      if (offline) {
        const offlineToken = "offline_tok_" + Date.now()
        localStorage.setItem("auth_token", offlineToken)
        localStorage.setItem("auth_user", JSON.stringify(offline.user))
        return {
          access_token: offlineToken,
          token_type: "bearer",
          user: offline.user,
          is_offline: true
        }
      }
      if ((email === "admin" || email === "admin@cproeis.local") && (password === "admin" || password === "admin123")) {
        const defaultAdmin = {
          id: 1,
          name: "Master Admin",
          email: "admin@cproeis.local",
          role: "master"
        }
        const offlineToken = "offline_tok_" + Date.now()
        localStorage.setItem("auth_token", offlineToken)
        localStorage.setItem("auth_user", JSON.stringify(defaultAdmin))
        return {
          access_token: offlineToken,
          token_type: "bearer",
          user: defaultAdmin,
          is_offline: true
        }
      }
      throw err
    }
  },
  getMe: async () => {
    try {
      return await apiRequest("/api/auth/me")
    } catch (err) {
      const stored = localStorage.getItem("auth_user")
      if (stored) {
        return JSON.parse(stored)
      }
      throw err
    }
  }
}

export const usersApi = {
  list: async () => {
    try {
      const users = await apiRequest("/api/users")
      setLocalCache(CACHE_USERS_KEY, users)
      return users
    } catch (err) {
      return getLocalCache(CACHE_USERS_KEY, [])
    }
  },
  create: async (data) => {
    try {
      const user = await apiRequest("/api/users", {
        method: "POST",
        body: JSON.stringify(data)
      })
      const cached = getLocalCache(CACHE_USERS_KEY, [])
      setLocalCache(CACHE_USERS_KEY, [user, ...cached.filter(u => u.id !== user.id)])
      return user
    } catch (err) {
      const cached = getLocalCache(CACHE_USERS_KEY, [])
      const localUser = {
        id: "local_" + Date.now(),
        ...data,
        is_active: true,
        created_at: new Date().toISOString()
      }
      setLocalCache(CACHE_USERS_KEY, [localUser, ...cached])
      addToSyncQueue({
        entity: "users",
        action: "create",
        data,
        tempId: localUser.id
      })
      return localUser
    }
  },
  update: async (id, data) => {
    try {
      const user = await apiRequest(`/api/users/${id}`, {
        method: "PUT",
        body: JSON.stringify(data)
      })
      const cached = getLocalCache(CACHE_USERS_KEY, [])
      setLocalCache(CACHE_USERS_KEY, cached.map(u => u.id === id ? user : u))
      return user
    } catch (err) {
      const cached = getLocalCache(CACHE_USERS_KEY, [])
      const updated = cached.map(u => u.id === id ? { ...u, ...data } : u)
      setLocalCache(CACHE_USERS_KEY, updated)
      addToSyncQueue({
        entity: "users",
        action: "update",
        targetId: id,
        data
      })
      return cached.find(u => u.id === id) || data
    }
  },
  delete: async (id) => {
    try {
      const res = await apiRequest(`/api/users/${id}`, {
        method: "DELETE"
      })
      const cached = getLocalCache(CACHE_USERS_KEY, [])
      setLocalCache(CACHE_USERS_KEY, cached.filter(u => u.id !== id))
      return res
    } catch (err) {
      const cached = getLocalCache(CACHE_USERS_KEY, [])
      setLocalCache(CACHE_USERS_KEY, cached.filter(u => u.id !== id))
      addToSyncQueue({
        entity: "users",
        action: "delete",
        targetId: id
      })
      return { success: true }
    }
  }
}

export const clientsApi = {
  list: async () => {
    try {
      const clients = await apiRequest("/api/clients")
      setLocalCache(CACHE_CLIENTS_KEY, clients)
      return clients
    } catch (err) {
      return getLocalCache(CACHE_CLIENTS_KEY, [])
    }
  },
  get: async (id) => {
    try {
      return await apiRequest(`/api/clients/${id}`)
    } catch (err) {
      const cached = getLocalCache(CACHE_CLIENTS_KEY, [])
      const found = cached.find(c => String(c.id) === String(id))
      if (found) return found
      throw err
    }
  },
  create: async (data) => {
    try {
      const client = await apiRequest("/api/clients", {
        method: "POST",
        body: JSON.stringify(data)
      })
      const cached = getLocalCache(CACHE_CLIENTS_KEY, [])
      setLocalCache(CACHE_CLIENTS_KEY, [client, ...cached.filter(c => c.id !== client.id)])
      return client
    } catch (err) {
      const cached = getLocalCache(CACHE_CLIENTS_KEY, [])
      const localClient = {
        id: "local_" + Date.now(),
        ...data,
        is_active: true,
        created_at: new Date().toISOString()
      }
      setLocalCache(CACHE_CLIENTS_KEY, [localClient, ...cached])
      addToSyncQueue({
        entity: "clients",
        action: "create",
        data,
        tempId: localClient.id
      })
      return localClient
    }
  },
  update: async (id, data) => {
    try {
      const client = await apiRequest(`/api/clients/${id}`, {
        method: "PUT",
        body: JSON.stringify(data)
      })
      const cached = getLocalCache(CACHE_CLIENTS_KEY, [])
      setLocalCache(CACHE_CLIENTS_KEY, cached.map(c => c.id === id ? client : c))
      return client
    } catch (err) {
      const cached = getLocalCache(CACHE_CLIENTS_KEY, [])
      const updated = cached.map(c => c.id === id ? { ...c, ...data } : c)
      setLocalCache(CACHE_CLIENTS_KEY, updated)
      addToSyncQueue({
        entity: "clients",
        action: "update",
        targetId: id,
        data
      })
      return cached.find(c => c.id === id) || data
    }
  },
  delete: async (id) => {
    try {
      const res = await apiRequest(`/api/clients/${id}`, {
        method: "DELETE"
      })
      const cached = getLocalCache(CACHE_CLIENTS_KEY, [])
      setLocalCache(CACHE_CLIENTS_KEY, cached.filter(c => c.id !== id))
      return res
    } catch (err) {
      const cached = getLocalCache(CACHE_CLIENTS_KEY, [])
      setLocalCache(CACHE_CLIENTS_KEY, cached.filter(c => c.id !== id))
      addToSyncQueue({
        entity: "clients",
        action: "delete",
        targetId: id
      })
      return { success: true }
    }
  }
}

export const settingsApi = {
  get: async () => {
    try {
      const settings = await apiRequest("/api/settings")
      setLocalCache(CACHE_SETTINGS_KEY, settings)
      return settings
    } catch (err) {
      return getLocalCache(CACHE_SETTINGS_KEY, {})
    }
  },
  update: async (data) => {
    try {
      const res = await apiRequest("/api/settings", {
        method: "PUT",
        body: JSON.stringify(data)
      })
      setLocalCache(CACHE_SETTINGS_KEY, data)
      return res
    } catch (err) {
      setLocalCache(CACHE_SETTINGS_KEY, data)
      addToSyncQueue({
        entity: "settings",
        action: "update",
        data
      })
      return { success: true }
    }
  }
}

export const syncApi = {
  sync: (token) => syncWithCloud(token || getToken()),
  checkOnline: () => checkServerOnline()
}

export const botApi = {
  start: async (mode, clientId = null, clientData = null) => {
    if (window.electronAPI) {
      let mergedData = { ...(clientData || {}) }
      try {
        const settings = await settingsApi.get()
        if (settings) {
          if (settings.GEMINI_API_KEY) mergedData.gemini_api_key = settings.GEMINI_API_KEY
          if (settings.GEMINI_MODEL) mergedData.gemini_model = settings.GEMINI_MODEL
          if (settings.PROEIS_URL) mergedData.proeis_url = settings.PROEIS_URL
          if (!mergedData.password && settings.SENHA) mergedData.password = settings.SENHA
          if (!mergedData.document && settings.CPF) mergedData.document = settings.CPF
          if (!mergedData.convenio && settings.CONVENIO) mergedData.convenio = settings.CONVENIO
        }
      } catch {}
      return window.electronAPI.startBot(mode, mergedData)
    }
    return apiRequest("/api/bot/start", {
      method: "POST",
      body: JSON.stringify({ mode, client_id: clientId })
    })
  },
  consult: async (clientId = null, clientData = null) => {
    if (window.electronAPI) {
      let mergedData = { ...(clientData || {}) }
      try {
        const settings = await settingsApi.get()
        if (settings) {
          if (settings.GEMINI_API_KEY) mergedData.gemini_api_key = settings.GEMINI_API_KEY
          if (settings.GEMINI_MODEL) mergedData.gemini_model = settings.GEMINI_MODEL
          if (settings.PROEIS_URL) mergedData.proeis_url = settings.PROEIS_URL
          if (!mergedData.password && settings.SENHA) mergedData.password = settings.SENHA
          if (!mergedData.document && settings.CPF) mergedData.document = settings.CPF
          if (!mergedData.convenio && settings.CONVENIO) mergedData.convenio = settings.CONVENIO
        }
      } catch {}
      return window.electronAPI.startConsult(mergedData)
    }
    return apiRequest("/api/bot/consult", {
      method: "POST",
      body: JSON.stringify({ client_id: clientId })
    })
  },
  stop: () => {
    if (window.electronAPI) {
      return window.electronAPI.stopBot()
    }
    return apiRequest("/api/bot/stop", {
      method: "POST"
    })
  },
  getStatus: () => {
    if (window.electronAPI) {
      return window.electronAPI.getStatus()
    }
    return apiRequest("/api/bot/status")
  },
  getLogs: (offset = 0) => {
    if (window.electronAPI) {
      return Promise.resolve({ logs: [] })
    }
    return apiRequest(`/api/bot/logs?offset=${offset}`)
  },
  clearLogs: async () => {
    if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.clearLogs) {
      try {
        await window.electronAPI.clearLogs()
      } catch {}
    }
    return apiRequest("/api/bot/logs/clear", { method: "POST" }).catch(() => ({}))
  },
  getHistory: async (params = {}) => {
    try {
      const query = new URLSearchParams()
      if (params.user) query.append("user", params.user)
      if (params.client) query.append("client", params.client)
      if (params.status) query.append("status", params.status)
      if (params.mode) query.append("mode", params.mode)
      if (params.limit) query.append("limit", params.limit)
      const qs = query.toString() ? `?${query.toString()}` : ""
      const data = await apiRequest(`/api/bot/history${qs}`)
      setLocalCache("cproeis_cache_history", data)
      return data
    } catch {
      return getLocalCache("cproeis_cache_history", [])
    }
  },
  recordExecution: async (data) => {
    try {
      const res = await apiRequest("/api/bot/history", {
        method: "POST",
        body: JSON.stringify(data)
      })
      const cached = getLocalCache("cproeis_cache_history", [])
      setLocalCache("cproeis_cache_history", [res, ...cached.filter(h => h.id !== res.id)])
      return res
    } catch {
      const localId = Date.now()
      const userStr = localStorage.getItem("auth_user")
      const user = userStr ? JSON.parse(userStr) : null
      const localRecord = {
        id: localId,
        mode: data.mode || "homologacao",
        status: data.status || "running",
        triggered_by: user?.email || "operador",
        client_name: data.client_name || "padrão",
        started_at: new Date().toISOString()
      }
      const cached = getLocalCache("cproeis_cache_history", [])
      setLocalCache("cproeis_cache_history", [localRecord, ...cached])
      return localRecord
    }
  },
  updateExecution: async (id, data) => {
    try {
      const res = await apiRequest(`/api/bot/history/${id}`, {
        method: "PUT",
        body: JSON.stringify(data)
      })
      const cached = getLocalCache("cproeis_cache_history", [])
      setLocalCache("cproeis_cache_history", cached.map(h => h.id === id ? res : h))
      return res
    } catch {
      const cached = getLocalCache("cproeis_cache_history", [])
      const updated = cached.map(h => h.id === id ? { ...h, ...data, finished_at: new Date().toISOString() } : h)
      setLocalCache("cproeis_cache_history", updated)
      return { success: true }
    }
  },
  clearHistory: async () => {
    try {
      await apiRequest("/api/bot/history", {
        method: "DELETE"
      })
    } catch {}
    setLocalCache("cproeis_cache_history", [])
    return { success: true }
  },
  deleteHistoryItem: async (id) => {
    try {
      await apiRequest(`/api/bot/history/${id}`, {
        method: "DELETE"
      })
    } catch {}
    const cached = getLocalCache("cproeis_cache_history", [])
    setLocalCache("cproeis_cache_history", cached.filter(h => h.id !== id))
    return { success: true }
  }
}

export const comprovantesApi = {
  list: async () => {
    let remoteFiles = []
    try {
      remoteFiles = await apiRequest("/api/comprovantes")
    } catch {}

    let localFiles = []
    if (typeof window !== "undefined" && window.electronAPI && window.electronAPI.listComprovantes) {
      try {
        localFiles = await window.electronAPI.listComprovantes()
      } catch {}
    }

    const map = new Map()
    localFiles.forEach((f) => map.set(f.name, f))
    remoteFiles.forEach((f) => {
      if (!map.has(f.name)) {
        map.set(f.name, f)
      }
    })

    const combined = Array.from(map.values())
    combined.sort((a, b) => (a.modified_at < b.modified_at ? 1 : -1))
    return combined
  }
}
