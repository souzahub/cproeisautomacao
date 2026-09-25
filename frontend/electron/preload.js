const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  startBot: (mode, clientData) => ipcRenderer.invoke("bot:start", { mode, clientData }),
  startConsult: (clientData) => ipcRenderer.invoke("bot:consult", { clientData }),
  stopBot: () => ipcRenderer.invoke("bot:stop"),
  getStatus: () => ipcRenderer.invoke("bot:status"),
  clearLogs: () => ipcRenderer.invoke("bot:clear-logs"),
  testAi: (apiKey, model, baseUrl) => ipcRenderer.invoke("settings:test-ai", { apiKey, model, baseUrl }),
  configurarAgenda: (baseUrl, token) => ipcRenderer.invoke("agenda:configurar", { baseUrl, token }),
  listComprovantes: () => ipcRenderer.invoke("comprovantes:list"),
  openComprovante: (filePath) => ipcRenderer.invoke("comprovantes:open", filePath),
  deleteComprovante: (filePath) => ipcRenderer.invoke("comprovantes:delete", filePath),
  onLog: (callback) => {
    const subscription = (_event, value) => callback(value)
    ipcRenderer.on("bot:log", subscription)
    return () => ipcRenderer.removeListener("bot:log", subscription)
  },
  onStatusChange: (callback) => {
    const subscription = (_event, value) => callback(value)
    ipcRenderer.on("bot:status-change", subscription)
    return () => ipcRenderer.removeListener("bot:status-change", subscription)
  }
})
