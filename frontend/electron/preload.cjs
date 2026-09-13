const { contextBridge, ipcRenderer } = require("electron")

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  startBot: (mode, clientData) => ipcRenderer.invoke("bot:start", { mode, clientData }),
  startConsult: (clientData) => ipcRenderer.invoke("bot:consult", { clientData }),
  stopBot: () => ipcRenderer.invoke("bot:stop"),
  getStatus: () => ipcRenderer.invoke("bot:status"),
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
