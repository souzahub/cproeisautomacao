const BASE_URL = typeof window !== "undefined" && window.location && window.location.protocol.startsWith("http")
  ? ""
  : (localStorage.getItem("server_url") || "https://cprsautomacao.devsouza.online")

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

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers
  })

  if (response.status === 401) {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("auth_user")
    window.location.href = "/"
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
  start: (mode, clientId = null, clientData = null) => {
    if (window.electronAPI) {
      return window.electronAPI.startBot(mode, clientData)
    }
    return apiRequest("/api/bot/start", {
      method: "POST",
      body: JSON.stringify({ mode, client_id: clientId })
    })
  },
  consult: (clientId = null, clientData = null) => {
    if (window.electronAPI) {
      return window.electronAPI.startConsult(clientData)
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
  getHistory: () => apiRequest("/api/bot/history"),
  clearHistory: () =>
    apiRequest("/api/bot/history", {
      method: "DELETE"
    })
}

export const comprovantesApi = {
  list: () => apiRequest("/api/comprovantes")
}
