const { app, BrowserWindow, ipcMain, shell } = require("electron")
const path = require("path")
const { spawn } = require("child_process")
const fs = require("fs")

if (process.platform === "win32") {
  app.commandLine.appendSwitch("no-sandbox")
}

const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
  process.exit(0)
}

let mainWindow = null
let currentProcess = null
let botStatus = {
  status: "idle",
  mode: "homologacao",
  started_at: null,
  logs_count: 0
}

function killCurrentProcess() {
  if (currentProcess) {
    try {
      if (process.platform === "win32" && currentProcess.pid) {
        spawn("taskkill", ["/pid", currentProcess.pid.toString(), "/T", "/F"])
      } else {
        currentProcess.kill("SIGKILL")
      }
    } catch {}
    currentProcess = null
  }
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
  if (customData.ai_base_url) merged["AI_BASE_URL"] = customData.ai_base_url
  if (customData.proeis_url) merged["PROEIS_URL"] = customData.proeis_url
  if (customData.proxy) merged["PROXY_SERVER"] = customData.proxy

  return merged
}

ipcMain.handle("bot:status", () => botStatus)

async function iniciarBot({ mode, clientData }) {
  if (currentProcess) {
    return { success: false, message: "Automação já em execução." }
  }

  const rootDir = getProjectRoot()
  const scriptPath = path.join(rootDir, "bot.py")
  const env = getMergedEnv(rootDir, clientData || {})

  env["MODO_HOMOLOGACAO"] = mode === "homologacao" ? "true" : "false"
  if (clientData && clientData.modo_visivel !== undefined) {
    env["MODO_VISIVEL"] = (clientData.modo_visivel === true || clientData.modo_visivel === "true") ? "true" : "false"
  }

  if (clientData) {
    if (clientData.document_type) env["TIPO_DOCUMENTO"] = clientData.document_type
    if (clientData.document) env["CPF"] = clientData.document
    if (clientData.password) env["SENHA"] = clientData.password
    if (clientData.convenio) env["CONVENIO"] = clientData.convenio
    if (clientData.preferred_events) env["EVENTOS_PREFERIDOS"] = clientData.preferred_events
    if (clientData.preferred_hours) env["HORARIOS_PREFERIDOS"] = clientData.preferred_hours
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
    if (clientData.gemini_api_key) env["GEMINI_API_KEY"] = clientData.gemini_api_key
    if (clientData.gemini_model) env["GEMINI_MODEL"] = clientData.gemini_model
    if (clientData.ai_base_url) env["AI_BASE_URL"] = clientData.ai_base_url
    if (clientData.proeis_url) env["PROEIS_URL"] = clientData.proeis_url
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
}

ipcMain.handle("bot:start", async (_event, { mode, clientData }) => {
  return iniciarBot({ mode, clientData })
})

ipcMain.handle("bot:consult", async (_event, { clientData }) => {
  if (currentProcess) {
    return { success: false, message: "Automação ou consulta já em execução." }
  }

  const rootDir = getProjectRoot()
  const scriptPath = path.join(rootDir, "consultar_vagas.py")
  const env = getMergedEnv(rootDir, clientData || {})

  if (clientData && clientData.modo_visivel !== undefined) {
    env["MODO_VISIVEL"] = (clientData.modo_visivel === true || clientData.modo_visivel === "true") ? "true" : "false"
  }

  if (clientData) {
    if (clientData.document_type) env["TIPO_DOCUMENTO"] = clientData.document_type
    if (clientData.document) env["CPF"] = clientData.document
    if (clientData.password) env["SENHA"] = clientData.password
    if (clientData.convenio) env["CONVENIO"] = clientData.convenio
    if (clientData.gemini_api_key) env["GEMINI_API_KEY"] = clientData.gemini_api_key
    if (clientData.gemini_model) env["GEMINI_MODEL"] = clientData.gemini_model
    if (clientData.ai_base_url) env["AI_BASE_URL"] = clientData.ai_base_url
    if (clientData.proeis_url) env["PROEIS_URL"] = clientData.proeis_url
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

ipcMain.handle("settings:test-ai", async (_event, { apiKey, model, baseUrl }) => {
  const key = (apiKey || "").trim()
  if (!key) {
    return { success: false, message: "informe a chave de api antes de testar" }
  }

  const rootDir = getProjectRoot()
  const env = getMergedEnv(rootDir)
  const url = (baseUrl || env["AI_BASE_URL"] || "https://9router.devsouza.online/v1").trim().replace(/\/+$/, "")
  const chosenModel = (model || env["GEMINI_MODEL"] || "antigravity99").trim()
  const target = url.endsWith("/chat/completions") ? url : `${url}/chat/completions`

  const samplePath = path.join(rootDir, "test_captcha.png")
  let b64 = ""
  if (fs.existsSync(samplePath)) {
    b64 = fs.readFileSync(samplePath).toString("base64")
  } else {
    b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PcxbfwAAAABJRU5ErkJggg=="
  }

  try {
    const resp = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: chosenModel,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Retorne estritamente apenas os 6 caracteres alfanumericos do captcha desta imagem, em maiusculo, sem espacos e sem pontuacao." },
              { type: "image_url", image_url: { url: `data:image/png;base64,${b64}` } }
            ]
          }
        ],
        temperature: 0.0,
        stream: false
      })
    })

    if (!resp.ok) {
      const body = await resp.text()
      return {
        success: false,
        message: `provedor retornou status ${resp.status}. endpoint: ${target} | modelo: ${chosenModel} | ${body.slice(0, 200)}`
      }
    }

    const data = await resp.json()
    const texto = data?.choices?.[0]?.message?.content || ""
    const limpo = texto.replace(/[^a-zA-Z0-9]/g, "").toUpperCase()
    const codigo = limpo.length >= 6 ? limpo.slice(0, 6) : ""

    if (codigo.length === 6) {
      return { success: true, message: `Conexão bem sucedida. Captcha resolvido: ${codigo}`, code: codigo }
    }

    return {
      success: false,
      message: `provedor respondeu, mas sem um código de 6 caracteres. modelo: ${chosenModel} | resposta: ${String(texto).slice(0, 120)}`
    }
  } catch (err) {
    return {
      success: false,
      message: `falha ao contatar o provedor: ${err.message} | endpoint: ${target}`
    }
  }
})

ipcMain.handle("bot:clear-logs", async () => {
  botLogs = []
  if (mainWindow) {
    mainWindow.webContents.send("bot:status-change", { logs_count: 0 })
  }
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

ipcMain.handle("comprovantes:delete", async (_event, filePath) => {
  const rootDir = getProjectRoot()
  const cleanName = path.basename(filePath)
  const targetPath = path.join(rootDir, "comprovantes", cleanName)
  if (fs.existsSync(targetPath)) {
    try {
      fs.unlinkSync(targetPath)
      return { success: true }
    } catch {
      return { success: false }
    }
  }
  return { success: false }
})


ipcMain.handle("bot:stop", async () => {
  killCurrentProcess()
  updateStatus({ status: "stopped" })
  return { success: true }
})

// ---------------------------------------------------------------------------
// agendamentos
//
// o robo precisa rodar daqui (ip brasileiro), nao na vps (ip dos eua).
// entao quem dispara e este relogio: a cada tique perguntamos ao servidor
// quais agendamentos venceram e executamos localmente.
// ---------------------------------------------------------------------------

const AGENDA_INTERVALO_MS = 30 * 1000

let agendaTimer = null
let agendaConfig = { baseUrl: "", token: "" }
let agendaOcupada = false

function agendaLog(message) {
  sendLog(`[agendamento] ${message}`)
}

async function agendaFetch(caminho, options = {}) {
  const { baseUrl, token } = agendaConfig
  if (!baseUrl || !token) return null

  const resp = await fetch(`${baseUrl}${caminho}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  })

  if (!resp.ok) {
    throw new Error(`status ${resp.status}`)
  }
  return resp.json()
}

async function reportarResultado(scheduleId, resultado) {
  try {
    await agendaFetch(`/api/schedules/${scheduleId}/resultado`, {
      method: "POST",
      body: JSON.stringify({ resultado })
    })
  } catch {
    // o resultado e informativo; se falhar nao vale travar o app
  }
}

async function verificarAgendamentos() {
  // uma rodada por vez: se a anterior ainda esta subindo o bot, espera o proximo tique
  if (agendaOcupada) return
  agendaOcupada = true

  try {
    const vencidos = await agendaFetch("/api/schedules/due")
    if (!Array.isArray(vencidos) || vencidos.length === 0) return

    for (const item of vencidos) {
      const nome = item.name || `agendamento ${item.id}`

      // nunca interrompe execucao em andamento: apenas registra e segue
      if (currentProcess || botStatus.status === "running") {
        agendaLog(`'${nome}' pulado (bot em execucao)`)
        await reportarResultado(item.id, "pulado: bot ja em execucao")
        continue
      }

      let clientData = null
      if (item.client_id) {
        try {
          clientData = await agendaFetch(`/api/clients/${item.client_id}`)
        } catch {
          agendaLog(`'${nome}' falhou: nao consegui carregar o cliente`)
          await reportarResultado(item.id, "erro: cliente nao encontrado")
          continue
        }
      }

      const atraso = item.atraso_min > 0 ? ` (${item.atraso_min} min de atraso)` : ""
      agendaLog(`iniciando '${nome}' em modo ${item.mode}${atraso}`)

      try {
        const res = await iniciarBot({ mode: item.mode, clientData })
        if (res && res.success) {
          await reportarResultado(item.id, `executado pelo desktop em modo ${item.mode}`)
        } else {
          const msg = (res && res.message) || "falha ao iniciar"
          agendaLog(`'${nome}': ${msg}`)
          await reportarResultado(item.id, msg)
        }
      } catch (err) {
        agendaLog(`'${nome}' erro: ${err.message}`)
        await reportarResultado(item.id, `erro: ${err.message}`)
      }

      // um bot por vez; o resto volta no proximo tique
      break
    }
  } catch {
    // servidor fora do ar ou token expirado: tenta de novo no proximo tique,
    // sem poluir o log do usuario a cada 30s
  } finally {
    agendaOcupada = false
  }
}

function pararAgenda() {
  if (agendaTimer) {
    clearInterval(agendaTimer)
    agendaTimer = null
  }
}

ipcMain.handle("agenda:configurar", async (_event, { baseUrl, token }) => {
  agendaConfig = {
    baseUrl: (baseUrl || "").replace(/\/+$/, ""),
    token: token || ""
  }

  pararAgenda()

  // sem token (logout) o relogio fica desligado
  if (!agendaConfig.baseUrl || !agendaConfig.token) {
    return { success: true, ativo: false }
  }

  agendaTimer = setInterval(verificarAgendamentos, AGENDA_INTERVALO_MS)
  verificarAgendamentos()
  return { success: true, ativo: true }
})

app.whenReady().then(() => {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  createWindow()

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on("before-quit", () => {
  pararAgenda()
  killCurrentProcess()
})

app.on("window-all-closed", () => {
  pararAgenda()
  killCurrentProcess()
  if (process.platform !== "darwin") {
    app.quit()
  }
})
