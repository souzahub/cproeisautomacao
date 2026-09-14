const { app, BrowserWindow, ipcMain, shell } = require("electron")
const path = require("path")
const { spawn } = require("child_process")
const fs = require("fs")

if (process.platform === "win32") {
  app.commandLine.appendSwitch("no-sandbox")
}

let mainWindow = null
let currentProcess = null
let botStatus = {
  status: "idle",
  mode: "homologacao",
  started_at: null,
  logs_count: 0
}

setInterval(() => {}, 1000)

function getProjectRoot() {
  if (app.isPackaged) {
    const resourcesPath = path.join(process.resourcesPath, "app_engine")
    if (fs.existsSync(resourcesPath)) {
      return resourcesPath
    }
  }
  return path.resolve(__dirname, "../../")
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1024,
    minHeight: 680,
    title: "cproeis automação",
    icon: path.join(__dirname, "icon.ico"),
    backgroundColor: "#0d1117",
    show: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      allowRunningInsecureContent: true
    },
    autoHideMenuBar: true
  })

  const indexPath = path.resolve(__dirname, "..", "dist", "index.html")

  if (fs.existsSync(indexPath)) {
    mainWindow.loadFile(indexPath)
  } else {
    mainWindow.loadURL("http://localhost:5173")
  }

  mainWindow.show()
  mainWindow.focus()

  mainWindow.on("closed", () => {
    mainWindow = null
    if (currentProcess) {
      try {
        currentProcess.kill()
      } catch {}
    }
  })
}

function sendLog(message) {
  const now = new Date()
  const timeStr = now.toTimeString().split(" ")[0]
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("bot:log", {
      timestamp: timeStr,
      message: message.trim()
    })
  }
}

function updateStatus(newStatus) {
  botStatus = { ...botStatus, ...newStatus }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("bot:status-change", botStatus)
  }
}

function loadDotEnv(dir) {
  const envPath = path.join(dir, ".env")
  const result = {}
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, "utf-8")
      content.split("\n").forEach((line) => {
        const trimmed = line.trim()
        if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
          const idx = trimmed.indexOf("=")
          const k = trimmed.substring(0, idx).trim()
          let v = trimmed.substring(idx + 1).trim()
          if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1)
          }
          result[k] = v
        }
      })
    } catch {}
  }
  return result
}

function getMergedEnv(rootDir, customData = {}) {
  const fileEnv = loadDotEnv(rootDir)
  const cwdEnv = loadDotEnv(process.cwd())
  const appDataEnv = loadDotEnv(app.getPath("userData"))

  const merged = {
    ...process.env,
    ...fileEnv,
    ...cwdEnv,
    ...appDataEnv,
    PYTHONUNBUFFERED: "1"
  }

  if (customData.gemini_api_key) merged["GEMINI_API_KEY"] = customData.gemini_api_key
  if (customData.gemini_model) merged["GEMINI_MODEL"] = customData.gemini_model
  if (customData.proeis_url) merged["PROEIS_URL"] = customData.proeis_url

  return merged
}

ipcMain.handle("bot:status", () => botStatus)

ipcMain.handle("bot:start", async (_event, { mode, clientData }) => {
  if (currentProcess) {
    return { success: false, message: "Automação já em execução." }
  }

  const rootDir = getProjectRoot()
  const scriptPath = path.join(rootDir, "bot.py")
  const env = getMergedEnv(rootDir, clientData || {})

  env["MODO_HOMOLOGACAO"] = mode === "homologacao" ? "true" : "false"
  env["MODO_VISIVEL"] = "false"

  if (clientData) {
    if (clientData.document_type) env["TIPO_DOCUMENTO"] = clientData.document_type
    if (clientData.document) env["CPF"] = clientData.document
    if (clientData.password) env["SENHA"] = clientData.password
    if (clientData.convenio) env["CONVENIO"] = clientData.convenio
    if (clientData.preferred_events) env["EVENTOS_PREFERIDOS"] = clientData.preferred_events
    if (clientData.only_listed_events !== undefined) env["APENAS_EVENTOS_LISTADOS"] = clientData.only_listed_events ? "true" : "false"
    if (clientData.only_titular !== undefined) env["APENAS_TITULAR"] = clientData.only_titular ? "true" : "false"
    if (clientData.tipo_data) env["TIPO_DATA"] = clientData.tipo_data
    if (clientData.data_inicio) env["DATA_INICIO"] = clientData.data_inicio
    if (clientData.data_fim) env["DATA_FIM"] = clientData.data_fim
    if (clientData.meta_vagas) env["META_VAGAS"] = String(clientData.meta_vagas)
    if (clientData.days_forward_initial) env["DIAS_A_FRENTE_INICIAL"] = String(clientData.days_forward_initial)
    if (clientData.days_forward_max) env["DIAS_A_FRENTE_MAXIMO"] = String(clientData.days_forward_max)
    if (clientData.interval_seconds) env["INTERVALO_SEGUNDOS"] = String(clientData.interval_seconds)
    if (clientData.max_attempts) env["TENTATIVAS_MAXIMAS"] = String(clientData.max_attempts)
  }

  const now = new Date()
  const startedAt = now.toISOString().replace("T", " ").substring(0, 19)
  updateStatus({ status: "running", mode, started_at: startedAt, logs_count: 0 })

  const pythonCmd = process.platform === "win32" ? "python" : "python3"
  currentProcess = spawn(pythonCmd, [JSON.stringify(scriptPath)], {
    cwd: rootDir,
    env,
    shell: true
  })

  currentProcess.stdout.on("data", (data) => {
    const lines = data.toString("utf-8").split("\n")
    lines.forEach((line) => {
      if (line.trim()) sendLog(line)
    })
  })

  currentProcess.stderr.on("data", (data) => {
    const lines = data.toString("utf-8").split("\n")
    lines.forEach((line) => {
      if (line.trim()) sendLog(line)
    })
  })

  currentProcess.on("close", (code) => {
    currentProcess = null
    updateStatus({ status: code === 0 ? "completed" : "error" })
  })

  return { success: true }
})

ipcMain.handle("bot:consult", async (_event, { clientData }) => {
  if (currentProcess) {
    return { success: false, message: "Automação ou consulta já em execução." }
  }

  const rootDir = getProjectRoot()
  const scriptPath = path.join(rootDir, "consultar_vagas.py")
  const env = getMergedEnv(rootDir, clientData || {})

  env["MODO_VISIVEL"] = "false"

  if (clientData) {
    if (clientData.document_type) env["TIPO_DOCUMENTO"] = clientData.document_type
    if (clientData.document) env["CPF"] = clientData.document
    if (clientData.password) env["SENHA"] = clientData.password
    if (clientData.convenio) env["CONVENIO"] = clientData.convenio
  }

  const now = new Date()
  const startedAt = now.toISOString().replace("T", " ").substring(0, 19)
  updateStatus({ status: "running", mode: "consulta", started_at: startedAt, logs_count: 0 })

  const pythonCmd = process.platform === "win32" ? "python" : "python3"
  currentProcess = spawn(pythonCmd, [JSON.stringify(scriptPath)], {
    cwd: rootDir,
    env,
    shell: true
  })

  currentProcess.stdout.on("data", (data) => {
    const lines = data.toString("utf-8").split("\n")
    lines.forEach((line) => {
      if (line.trim()) sendLog(line)
    })
  })

  currentProcess.stderr.on("data", (data) => {
    const lines = data.toString("utf-8").split("\n")
    lines.forEach((line) => {
      if (line.trim()) sendLog(line)
    })
  })

  currentProcess.on("close", (code) => {
    currentProcess = null
    updateStatus({ status: code === 0 ? "completed" : "error" })
  })

  return { success: true }
})

ipcMain.handle("comprovantes:list", async () => {
  const rootDir = getProjectRoot()
  const compDir = path.join(rootDir, "comprovantes")
  const results = []
  if (fs.existsSync(compDir)) {
    const entries = fs.readdirSync(compDir)
    entries.forEach((file) => {
      if (file.toLowerCase().endsWith(".pdf")) {
        const fullPath = path.join(compDir, file)
        const stat = fs.statSync(fullPath)
        const dateStr = new Date(stat.mtime).toISOString().replace("T", " ").substring(0, 19)
        results.push({
          name: file,
          size_bytes: stat.size,
          modified_at: dateStr,
          local_path: fullPath,
          download_url: `/api/comprovantes/${file}`,
          is_local: true
        })
      }
    })
  }
  results.sort((a, b) => (a.modified_at < b.modified_at ? 1 : -1))
  return results
})

ipcMain.handle("comprovantes:open", async (_event, filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    shell.openPath(filePath)
    return { success: true }
  }
  const rootDir = getProjectRoot()
  const fallback = path.join(rootDir, "comprovantes", filePath)
  if (fs.existsSync(fallback)) {
    shell.openPath(fallback)
    return { success: true }
  }
  return { success: false }
})

ipcMain.handle("bot:stop", async () => {
  if (currentProcess) {
    try {
      currentProcess.kill()
    } catch {}
    currentProcess = null
    updateStatus({ status: "stopped" })
  }
  return { success: true }
})

app.whenReady().then(() => {
  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})
