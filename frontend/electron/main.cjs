const { app, BrowserWindow, ipcMain } = require("electron")
const path = require("path")
const { spawn } = require("child_process")
const fs = require("fs")

let mainWindow = null
let currentProcess = null
let botStatus = {
  status: "idle",
  mode: "homologacao",
  started_at: null,
  logs_count: 0
}

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
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false
    },
    autoHideMenuBar: true
  })

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "../dist/index.html"))
  } else {
    const devDist = path.join(__dirname, "../dist/index.html")
    if (fs.existsSync(devDist)) {
      mainWindow.loadFile(devDist)
    } else {
      mainWindow.loadURL("http://localhost:5173")
    }
  }

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

ipcMain.handle("bot:status", () => botStatus)

ipcMain.handle("bot:start", async (_event, { mode, clientData }) => {
  if (currentProcess) {
    return { success: false, message: "Automação já em execução." }
  }

  const rootDir = getProjectRoot()
  const scriptPath = path.join(rootDir, "bot.py")

  const env = { ...process.env, PYTHONUNBUFFERED: "1" }
  env["MODO_HOMOLOGACAO"] = mode === "homologacao" ? "true" : "false"
  env["MODO_VISIVEL"] = "false"

  if (clientData) {
    env["TIPO_DOCUMENTO"] = clientData.document_type || "CPF"
    env["CPF"] = clientData.document || ""
    env["SENHA"] = clientData.password || ""
    env["CONVENIO"] = clientData.convenio || ""
    env["EVENTOS_PREFERIDOS"] = clientData.preferred_events || ""
    env["APENAS_EVENTOS_LISTADOS"] = clientData.only_listed_events ? "true" : "false"
    env["APENAS_TITULAR"] = clientData.only_titular ? "true" : "false"
    env["TIPO_DATA"] = clientData.tipo_data || "dias_frente"
    env["DATA_INICIO"] = clientData.data_inicio || ""
    env["DATA_FIM"] = clientData.data_fim || ""
    env["META_VAGAS"] = String(clientData.meta_vagas || 1)
    env["DIAS_A_FRENTE_INICIAL"] = String(clientData.days_forward_initial || 6)
    env["DIAS_A_FRENTE_MAXIMO"] = String(clientData.days_forward_max || 7)
    env["INTERVALO_SEGUNDOS"] = String(clientData.interval_seconds || 6)
    env["TENTATIVAS_MAXIMAS"] = String(clientData.max_attempts || 120)
  }

  const now = new Date()
  const startedAt = now.toISOString().replace("T", " ").substring(0, 19)
  updateStatus({ status: "running", mode, started_at: startedAt, logs_count: 0 })

  const pythonCmd = process.platform === "win32" ? "python" : "python3"
  currentProcess = spawn(pythonCmd, [scriptPath], {
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

  const env = { ...process.env, PYTHONUNBUFFERED: "1" }
  env["MODO_VISIVEL"] = "false"

  if (clientData) {
    env["TIPO_DOCUMENTO"] = clientData.document_type || "CPF"
    env["CPF"] = clientData.document || ""
    env["SENHA"] = clientData.password || ""
    env["CONVENIO"] = clientData.convenio || ""
  }

  const now = new Date()
  const startedAt = now.toISOString().replace("T", " ").substring(0, 19)
  updateStatus({ status: "running", mode: "consulta", started_at: startedAt, logs_count: 0 })

  const pythonCmd = process.platform === "win32" ? "python" : "python3"
  currentProcess = spawn(pythonCmd, [scriptPath], {
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
