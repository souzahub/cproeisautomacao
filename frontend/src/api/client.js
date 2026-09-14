export function getBaseUrl() {
  if (typeof window !== "undefined" && window.localStorage) {
    const custom = localStorage.getItem("server_url")
    if (custom && custom.trim()) {
      return custom.trim().replace(/\/+$/, "")
    }
  }
  if (typeof window !== "undefined" && window.electronAPI) {
    return "https://cprsautomacao.devsouza.online"
  }
  return ""
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
  login: (email, password) =>
    apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    }),
  getMe: () => apiRequest("/api/auth/me")
}

export const usersApi = {
  list: () => apiRequest("/api/users"),
  create: (data) =>
    apiRequest("/api/users", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  update: (id, data) =>
    apiRequest(`/api/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),
  delete: (id) =>
    apiRequest(`/api/users/${id}`, {
      method: "DELETE"
    })
}

export const clientsApi = {
  list: () => apiRequest("/api/clients"),
  get: (id) => apiRequest(`/api/clients/${id}`),
  create: (data) =>
    apiRequest("/api/clients", {
      method: "POST",
      body: JSON.stringify(data)
    }),
  update: (id, data) =>
    apiRequest(`/api/clients/${id}`, {
      method: "PUT",
      body: JSON.stringify(data)
    }),
  delete: (id) =>
    apiRequest(`/api/clients/${id}`, {
      method: "DELETE"
    })
}

export const settingsApi = {
  get: () => apiRequest("/api/settings"),
  update: (data) =>
    apiRequest("/api/settings", {
      method: "PUT",
      body: JSON.stringify(data)
    })
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
  getHistory: () => apiRequest("/api/bot/history"),
  clearHistory: () =>
    apiRequest("/api/bot/history", {
      method: "DELETE"
    })
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
