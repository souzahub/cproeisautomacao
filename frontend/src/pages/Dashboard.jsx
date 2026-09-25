import React, { useState, useEffect, useRef } from "react"
import { Capacitor } from "@capacitor/core"
import { botApi, clientsApi, usersApi, settingsApi, comprovantesApi, schedulesApi } from "../api/client"
import { printExecutionSummary } from "../utils/printSummary"
import { StatusBadge } from "../components/StatusBadge"
import { Skeleton } from "../components/Skeleton"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "../components/ui/alert-dialog"
import { Button } from "../components/ui/button"
import { MaskedText } from "../components/ui/masked-text"

// o robo roda no app do computador (python + playwright, ip brasileiro).
// no celular o painel e so de consulta: dados, status e logs.
const isCelular = Capacitor.isNativePlatform()

export function Dashboard({ user, onNavigateTab }) {
  const isMaster = user?.role === "master"
  const [statusInfo, setStatusInfo] = useState({
    status: "idle",
    mode: "homologacao",
    started_at: null,
    pid: null,
    logs_count: 0
  })
  // define o ritmo do polling na web/celular: rapido so durante a execucao
  const pollRapido = statusInfo.status === "running"
  const [schedules, setSchedules] = useState([])
  const [selectedMode, setSelectedMode] = useState("homologacao")
  const manualModeRef = useRef(false)
  const [logs, setLogs] = useState([])
  const [history, setHistory] = useState([])
  const [clients, setClients] = useState([])
  const [usersList, setUsersList] = useState([])
  const [selectedClientId, setSelectedClientId] = useState("")
  const selectedClient = clients.find((c) => String(c.id) === String(selectedClientId)) || null
  const [clientSearchOpen, setClientSearchOpen] = useState(false)
  const [clientSearchQuery, setClientSearchQuery] = useState("")
  const [initialLoading, setInitialLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [confirmClearOpen, setConfirmClearOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)
  const [historyFilterUser, setHistoryFilterUser] = useState("")
  const [historyFilterClient, setHistoryFilterClient] = useState("")
  const [historyFilterStatus, setHistoryFilterStatus] = useState("todos")
  const [historyFilterMode, setHistoryFilterMode] = useState("todos")
  const [historySearchQuery, setHistorySearchQuery] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [sendingWhatsappId, setSendingWhatsappId] = useState(null)
  const [whatsappFeedback, setWhatsappFeedback] = useState(null)
  const logTerminalRef = useRef(null)

  const currentExecutionIdRef = useRef(null)

  async function fetchClients() {
    try {
      const data = await clientsApi.list()
      const clientList = data || []
      setClients(clientList)
      if (clientList.length > 0) {
        setSelectedClientId((prev) => {
          if (prev && clientList.some(c => c.id === Number(prev))) return prev
          return String(clientList[0].id)
        })
      }
    } catch (err) { }
  }

  async function fetchUsers() {
    if (!isMaster) return
    try {
      const data = await usersApi.list()
      setUsersList(data || [])
    } catch (err) { }
  }

  async function fetchStatus() {
    try {
      const data = await botApi.getStatus()
      setStatusInfo(data)
      if (data.status === "running" && (data.mode === "homologacao" || data.mode === "producao")) {
        setSelectedMode(data.mode)
      } else if (!manualModeRef.current && (data.mode === "homologacao" || data.mode === "producao")) {
        setSelectedMode(data.mode)
      }
    } catch (err) { }
  }

  async function fetchSchedules() {
    try {
      const data = await schedulesApi.list()
      setSchedules(data || [])
    } catch (err) { }
  }

  async function fetchLogs() {
    try {
      const data = await botApi.getLogs(0)
      setLogs(data.logs || [])
    } catch (err) { }
  }

  async function fetchHistory() {
    try {
      const data = await botApi.getHistory()
      setHistory(data || [])
    } catch (err) { }
  }

  useEffect(() => {
    async function loadAll() {
      setInitialLoading(true)
      try {
        const [,, statusData] = await Promise.all([
          fetchClients(),
          fetchUsers(),
          botApi.getStatus().catch(() => ({ status: "idle" })),
          fetchHistory(),
          fetchSchedules()
        ])
        if (statusData) {
          setStatusInfo(statusData)
          if (statusData.status === "running" || dashboardTab === "logs") {
            await fetchLogs()
          } else {
            setLogs([])
          }
        }
      } catch {}
      setInitialLoading(false)
    }
    loadAll()

    function handlePullRefresh(e) {
      if (!e.detail || e.detail.tab === "dashboard") {
        fetchClients()
        fetchStatus()
        fetchHistory()
        fetchSchedules()
      }
    }
    window.addEventListener("cproeis:refresh-view", handlePullRefresh)

    if (window.electronAPI) {
      const unsubLog = window.electronAPI.onLog((logObj) => {
        setLogs((prev) => [...prev, logObj])
      })
      const unsubStatus = window.electronAPI.onStatusChange(async (newStatus) => {
        setStatusInfo((prev) => ({ ...prev, ...newStatus }))
        if (newStatus.status && newStatus.status !== "running" && currentExecutionIdRef.current) {
          try {
            await botApi.updateExecution(currentExecutionIdRef.current, {
              status: newStatus.status,
              finished_at: true
            })
            currentExecutionIdRef.current = null
            fetchHistory()
          } catch { }
        }
      })
      return () => {
        window.removeEventListener("cproeis:refresh-view", handlePullRefresh)
        if (unsubLog) unsubLog()
        if (unsubStatus) unsubStatus()
      }
    } else {
      // com o robo parado nao ha log novo para buscar: basta olhar o status
      // de vez em quando. so durante a execucao vale consultar de 2,5 em 2,5s.
      const interval = setInterval(() => {
        fetchStatus()
        if (pollRapido) fetchLogs()
      }, pollRapido ? 2500 : 30000)
      return () => {
        window.removeEventListener("cproeis:refresh-view", handlePullRefresh)
        clearInterval(interval)
      }
    }
  }, [pollRapido])

  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight
    }
  }, [logs])

  const executionProgress = React.useMemo(() => {
    let currentCycle = 0
    let totalCycles = selectedClient?.max_attempts || 60
    let currentVagas = 0
    let metaVagas = selectedClient?.meta_vagas || 1
    let currentDate = ""

    for (let i = logs.length - 1; i >= 0; i--) {
      const msg = logs[i].message || ""

      // Match: (7/7) ou (7/7 vagas agendadas) ou Progresso: 7/7
      const vagaMatch = msg.match(/(?:Progresso:\s*|\()(\d+)\/(\d+)(?:\s+vagas|\)|\s+identificada)/i)
      if (vagaMatch && !currentVagas) {
        currentVagas = parseInt(vagaMatch[1], 10)
        metaVagas = parseInt(vagaMatch[2], 10)
      }

      // Match: Busca finalizada: 7 de 7 vaga(s) ou Meta de 7 vaga(s) atingida
      const finalMatch = msg.match(/Busca finalizada:\s*(\d+)\s+de\s+(\d+)/i)
      if (finalMatch && !currentVagas) {
        currentVagas = parseInt(finalMatch[1], 10)
        metaVagas = parseInt(finalMatch[2], 10)
      }

      const metaAtingidaMatch = msg.match(/Meta de\s*(\d+)\s*vaga\(s\)\s*atingida/i)
      if (metaAtingidaMatch && !currentVagas) {
        currentVagas = parseInt(metaAtingidaMatch[1], 10)
        metaVagas = parseInt(metaAtingidaMatch[1], 10)
      }

      // Match: Ciclo 43/60
      const cycleMatch = msg.match(/Ciclo\s+(\d+)\/(\d+)/i)
      if (cycleMatch && !currentCycle) {
        currentCycle = parseInt(cycleMatch[1], 10)
        totalCycles = parseInt(cycleMatch[2], 10)
      }

      // Match: Data: 17/09/2026
      const dataMatch = msg.match(/Data:\s*(\d{2}\/\d{2}\/\d{4})/i)
      if (dataMatch && !currentDate) {
        currentDate = dataMatch[1]
      }
    }

    const percentCycles = totalCycles > 0 ? Math.min(100, Math.round((currentCycle / totalCycles) * 100)) : 0
    const percentVagas = metaVagas > 0 ? Math.min(100, Math.round((currentVagas / metaVagas) * 100)) : 0

    return {
      currentCycle,
      totalCycles,
      currentVagas,
      metaVagas,
      currentDate,
      percentCycles,
      percentVagas,
      hasCycles: currentCycle > 0
    }
  }, [logs, selectedClient])

  function handleModeChange(mode) {
    manualModeRef.current = true
    setSelectedMode(mode)
  }

  async function handleStart() {
    setErrorMsg("")

    if (isCelular) {
      setErrorMsg("a automação roda no app do computador. pelo celular você acompanha os dados e os logs.")
      return
    }

    setActionLoading(true)
    try {
      const cId = selectedClientId ? Number(selectedClientId) : null
      try {
        const execRec = await botApi.recordExecution({
          mode: selectedMode,
          client_name: selectedClient?.name || "padrão",
          status: "running"
        })
        if (execRec && execRec.id) {
          currentExecutionIdRef.current = execRec.id
        }
        fetchHistory()
      } catch { }

      await botApi.start(selectedMode, cId, selectedClient)
      await fetchStatus()
      if (!window.electronAPI) await fetchLogs()
    } catch (err) {
      setErrorMsg(err.message || "falha ao iniciar automação")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleConsult() {
    setErrorMsg("")

    if (isCelular) {
      setErrorMsg("a consulta roda no app do computador. pelo celular você acompanha os dados e os logs.")
      return
    }

    setActionLoading(true)
    try {
      const cId = selectedClientId ? Number(selectedClientId) : null
      try {
        const execRec = await botApi.recordExecution({
          mode: "consulta",
          client_name: selectedClient?.name || "padrão",
          status: "running"
        })
        if (execRec && execRec.id) {
          currentExecutionIdRef.current = execRec.id
        }
        fetchHistory()
      } catch { }

      await botApi.consult(cId, selectedClient)
      await fetchStatus()
      if (!window.electronAPI) await fetchLogs()
    } catch (err) {
      setErrorMsg(err.message || "falha ao consultar minhas vagas")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleStop() {
    setErrorMsg("")
    setActionLoading(true)
    try {
      if (currentExecutionIdRef.current) {
        try {
          await botApi.updateExecution(currentExecutionIdRef.current, {
            status: "stopped",
            finished_at: true
          })
          currentExecutionIdRef.current = null
        } catch { }
      }
      await botApi.stop()
      await fetchStatus()
      await fetchHistory()
    } catch (err) {
      setErrorMsg(err.message || "falha ao interromper automação")
    } finally {
      setActionLoading(false)
    }
  }

  async function handleClearHistory() {
    try {
      await botApi.clearHistory()
      setHistory([])
      setConfirmClearOpen(false)
    } catch (err) {
      setErrorMsg(err.message || "falha ao limpar histórico")
    }
  }

  async function handleClearLogs() {
    setLogs([])
    try {
      await botApi.clearLogs()
    } catch { }
  }

  async function handleDeleteHistoryItem(id) {
    try {
      await botApi.deleteHistoryItem(id)
      setHistory((prev) => prev.filter((item) => item.id !== id))
      setItemToDelete(null)
    } catch (err) {
      setErrorMsg(err.message || "falha ao remover registro do histórico")
    }
  }

  async function handleSendWhatsapp(item) {
    setSendingWhatsappId(item.id)
    setWhatsappFeedback(null)
    try {
      const res = await botApi.sendWhatsapp(item.id)
      if (res && res.success) {
        setWhatsappFeedback({ type: "success", text: `notificação enviada para ${res.destinatarios?.join(", ") || "destinatários"}` })
      } else {
        setWhatsappFeedback({ type: "error", text: res?.message || "falha ao enviar notificação" })
      }
    } catch (err) {
      setWhatsappFeedback({ type: "error", text: err.message || "erro ao conectar com a evolution api" })
    } finally {
      setSendingWhatsappId(null)
    }
  }

  async function handlePrintExecutionSummary(targetExecution = null) {
    try {
      let reportData = null
      try {
        reportData = await comprovantesApi.getVagasReport()
      } catch { }

      const allVagas = Array.isArray(reportData)
        ? reportData
        : (reportData?.vagas || [])

      let filtered = allVagas

      if (targetExecution && targetExecution.id) {
        filtered = allVagas.filter((v) => Number(v.execution_id) === Number(targetExecution.id))
      } else if (!targetExecution) {
        if (reportData?.executions && reportData.executions.length > 0) {
          const latestId = reportData.executions[0].id
          const byExec = allVagas.filter((v) => Number(v.execution_id) === Number(latestId))
          if (byExec.length > 0) filtered = byExec
        }
      }

      const activeClient = targetExecution
        ? (clients.find((c) => c.name === targetExecution.client_name) || { name: targetExecution.client_name })
        : selectedClient

      const targetLogs = targetExecution && targetExecution.logs
        ? (typeof targetExecution.logs === "string" ? targetExecution.logs.split("\n") : targetExecution.logs)
        : logs

      printExecutionSummary({
        client: activeClient,
        status: targetExecution ? targetExecution.status : statusInfo.status,
        mode: targetExecution ? targetExecution.mode : selectedMode,
        startedAt: targetExecution ? (targetExecution.started_at ? new Date(targetExecution.started_at).toLocaleString("pt-BR") : "-") : (statusInfo.started_at || "-"),
        finishedAt: targetExecution ? (targetExecution.finished_at ? new Date(targetExecution.finished_at).toLocaleString("pt-BR") : "-") : null,
        totalCycles: executionProgress.totalCycles || (selectedClient?.max_attempts || 60),
        currentCycle: executionProgress.currentCycle || 1,
        metaVagas: executionProgress.metaVagas || (selectedClient?.meta_vagas || 1),
        vagas: filtered,
        logs: targetLogs
      })
    } catch (err) {
      console.error("Erro ao imprimir resumo:", err)
    }
  }

  const filteredHistory = history.filter((item) => {
    if (historyFilterStatus !== "todos" && item.status !== historyFilterStatus) return false
    if (historyFilterMode !== "todos" && item.mode !== historyFilterMode) return false
    if (historyFilterUser && !item.triggered_by?.toLowerCase().includes(historyFilterUser.toLowerCase())) return false
    if (historyFilterClient && !item.client_name?.toLowerCase().includes(historyFilterClient.toLowerCase())) return false
    if (historySearchQuery) {
      const q = historySearchQuery.toLowerCase().trim()
      const matchId = String(item.id).includes(q)
      const matchClient = item.client_name?.toLowerCase().includes(q)
      const matchUser = item.triggered_by?.toLowerCase().includes(q)
      const matchMode = item.mode?.toLowerCase().includes(q)
      const matchStatus = item.status?.toLowerCase().includes(q)
      if (!matchId && !matchClient && !matchUser && !matchMode && !matchStatus) return false
    }
    return true
  })

  const isRunning = statusInfo.status === "running"

  // qual agendamento ativo dispara primeiro, varrendo os proximos 7 dias.
  // 0 = segunda, mesma convencao usada no backend.
  const proximoAgendamento = (() => {
    const ativos = schedules.filter((s) => s.is_active)
    if (ativos.length === 0) return null

    const agora = new Date()
    const DIAS_CURTOS = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]
    let melhor = null

    for (const s of ativos) {
      const dias = String(s.dias_semana || "").split(",").map((d) => parseInt(d.trim(), 10)).filter((d) => !isNaN(d))
      const [h, m] = String(s.hora || "08:00").split(":").map((v) => parseInt(v, 10))
      if (isNaN(h) || isNaN(m)) continue

      for (let offset = 0; offset < 8; offset++) {
        const alvo = new Date(agora)
        alvo.setDate(agora.getDate() + offset)
        alvo.setHours(h, m, 0, 0)
        if (alvo <= agora) continue

        // getDay(): 0 = domingo. converte para 0 = segunda.
        const diaSemana = (alvo.getDay() + 6) % 7
        if (!dias.includes(diaSemana)) continue

        if (!melhor || alvo < melhor.quando) {
          const prefixo = offset === 0 ? "hoje" : offset === 1 ? "amanhã" : DIAS_CURTOS[diaSemana]
          melhor = {
            quando: alvo,
            texto: `${prefixo} às ${s.hora}`,
            nome: s.name || "agendamento"
          }
        }
        break
      }
    }

    return melhor
  })()

  const filteredClients = clients.filter((c) => {
    const q = clientSearchQuery.toLowerCase().trim()
    if (!q) return true
    return (
      (c.name && c.name.toLowerCase().includes(q)) ||
      (c.document && c.document.toLowerCase().includes(q)) ||
      (c.convenio && c.convenio.toLowerCase().includes(q)) ||
      (c.preferred_events && c.preferred_events.toLowerCase().includes(q))
    )
  })

  const [dashboardTab, setDashboardTab] = useState(() => {
    return localStorage.getItem("cproeis:dashboard_tab") || "automacao"
  })

  function handleSetDashboardTab(tab) {
    setDashboardTab(tab)
    localStorage.setItem("cproeis:dashboard_tab", tab)
    if (tab === "logs" && logs.length === 0) {
      fetchLogs()
    }
  }

  function handleSelectClient(clientId) {
    setSelectedClientId(String(clientId))
    setClientSearchOpen(false)
    setClientSearchQuery("")
  }

  return (
    <div className="dashboard-container">
      {errorMsg && <div className="alert-error">{errorMsg}</div>}

      {/* Barra de Abas do Dashboard */}
      <div className="dashboard-tabs-bar">
        <button
          type="button"
          className={`dashboard-tab-btn ${dashboardTab === "automacao" ? "active" : ""}`}
          onClick={() => handleSetDashboardTab("automacao")}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          <span>automação</span>
          {isRunning && <span className="tab-running-dot" title="robô em execução" />}
        </button>

        <button
          type="button"
          className={`dashboard-tab-btn ${dashboardTab === "logs" ? "active" : ""}`}
          onClick={() => handleSetDashboardTab("logs")}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          <span>terminal de logs</span>
          {logs.length > 0 && <span className="tab-count-pill">{logs.length}</span>}
        </button>

        <button
          type="button"
          className={`dashboard-tab-btn ${dashboardTab === "historico" ? "active" : ""}`}
          onClick={() => handleSetDashboardTab("historico")}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>histórico</span>
          {history.length > 0 && <span className="tab-count-pill">{history.length}</span>}
        </button>
      </div>

      {dashboardTab === "automacao" && (
        <>
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">controle de automação</h3>
                <p className="card-desc">selecione o modo e execute os ciclos de agendamento</p>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <StatusBadge status={statusInfo.mode} />
                <StatusBadge status={statusInfo.status} />
              </div>
            </div>

            {initialLoading ? (
              <div className="grid-cols-4" style={{ marginBottom: "20px" }}>
                <Skeleton variant="card" />
                <Skeleton variant="card" />
                <Skeleton variant="card" />
                <Skeleton variant="card" />
              </div>
            ) : (
              <div className="grid-cols-4" style={{ marginBottom: "20px" }}>
                <div className="metric-card">
                  <span className="metric-label">status do robô</span>
                  <div style={{ marginTop: "4px" }}><StatusBadge status={statusInfo.status} /></div>
                </div>

                <div className="metric-card">
                  <span className="metric-label">modo selecionado</span>
                  <div style={{ marginTop: "4px" }}><StatusBadge status={selectedMode} /></div>
                </div>

                <div className="metric-card">
                  <span className="metric-label">último início</span>
                  <span className="metric-value">
                    {statusInfo.started_at || "nenhuma execução"}
                  </span>
                </div>

                <div className="metric-card">
                  <span className="metric-label">próximo agendamento</span>
                  <span className="metric-value">
                    {proximoAgendamento ? proximoAgendamento.texto : "nenhum ativo"}
                  </span>
                  {proximoAgendamento && (
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      {proximoAgendamento.nome}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Progresso de Tentativas e Vagas (se em execução) */}
            {executionProgress.hasCycles && (
              <div style={{
                padding: "12px 16px",
                backgroundColor: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                marginBottom: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--accent)" }}>
                      tentativa atual: {executionProgress.currentCycle} de {executionProgress.totalCycles} ({executionProgress.percentCycles}%)
                    </span>
                    {executionProgress.currentDate && (
                      <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                        • data pesquisada: <strong>{executionProgress.currentDate}</strong>
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: "#10b981" }}>
                    meta: {executionProgress.currentVagas} de {executionProgress.metaVagas} vaga(s) agendada(s)
                  </span>
                </div>
                <div style={{ width: "100%", height: "6px", backgroundColor: "var(--border-subtle)", borderRadius: "3px", overflow: "hidden" }}>
                  <div style={{
                    width: `${executionProgress.percentCycles}%`,
                    height: "100%",
                    backgroundColor: "var(--accent)",
                    transition: "width 0.3s ease"
                  }} />
                </div>
              </div>
            )}

            {/* Banner de Término / Conclusão de Busca com Botão de Imprimir Resumo */}
            {!isRunning && (statusInfo.status === "completed" || statusInfo.status === "stopped" || executionProgress.currentVagas > 0) && (
              <div style={{
                padding: "16px 20px",
                backgroundColor: "rgba(16, 185, 129, 0.08)",
                border: "1px solid rgba(16, 185, 129, 0.3)",
                borderRadius: "var(--radius-sm)",
                marginBottom: "20px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "12px"
              }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 800, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.02em" }}>
                      busca finalizada
                    </span>
                    <StatusBadge status={statusInfo.status} />
                  </div>
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                    {executionProgress.currentVagas > 0
                      ? `Foram confirmadas ${executionProgress.currentVagas} vaga(s) de uma meta de ${executionProgress.metaVagas} no ciclo ${executionProgress.currentCycle || 1}/${executionProgress.totalCycles || 60}.`
                      : `Execução concluída. Você pode emitir o resumo oficial ou consultar o histórico.`}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => handlePrintExecutionSummary()}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      fontWeight: 700,
                      borderColor: "#10b981",
                      color: "var(--text-primary)",
                      padding: "6px 14px"
                    }}
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="6 9 6 2 18 2 18 9"></polyline>
                      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                      <rect x="6" y="14" width="12" height="8"></rect>
                    </svg>
                    imprimir resumo da busca
                  </button>

                  {onNavigateTab && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => onNavigateTab("comprovantes")}
                      style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 14px" }}
                    >
                      ver relatório e comprovantes →
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="dashboard-exec-client-section">
              <div className="dashboard-exec-client-header">
                <span className="form-label" style={{ fontWeight: 600, marginBottom: 0 }}>cliente para execução:</span>
                {isMaster && onNavigateTab && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => onNavigateTab("clients")}
                    style={{ fontSize: "12px", color: "var(--accent)", padding: "2px 6px" }}
                  >
                    gerenciar todos os clientes →
                  </button>
                )}
              </div>

              <div className="dashboard-exec-client-card">
                {selectedClient ? (
                  <div className="dashboard-exec-client-content">
                    <div className="dashboard-exec-client-top">
                      <div className="dashboard-exec-client-title-row">
                        <span className="dashboard-exec-client-name">{selectedClient.name}</span>
                        <span className="dashboard-exec-doc-badge">
                          <MaskedText text={selectedClient.document} />
                        </span>
                        <StatusBadge status={selectedClient.is_active ? "ativo" : "inativo"} />
                        {selectedClient.user_id === 1 || selectedClient.name === "Master Admin" ? (
                          <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "var(--radius-pill)", backgroundColor: "rgba(37, 99, 235, 0.12)", color: "var(--accent)" }}>
                            perfil master
                          </span>
                        ) : selectedClient.system_user ? (
                          <span style={{ fontSize: "11px", fontWeight: 500, padding: "2px 8px", borderRadius: "var(--radius-pill)", backgroundColor: "var(--bg-surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
                            operador: {selectedClient.system_user}
                          </span>
                        ) : null}
                      </div>

                      {isMaster && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="dashboard-exec-change-btn"
                          onClick={() => setClientSearchOpen(true)}
                          disabled={isRunning || actionLoading}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="11" cy="11" r="8" />
                            <line x1="21" y1="21" x2="16.65" y2="16.65" />
                          </svg>
                          <span>trocar cliente</span>
                        </Button>
                      )}
                    </div>

                    <div className="dashboard-exec-client-meta">
                      <div className="dashboard-exec-meta-item">
                        <span className="meta-label">convênio:</span>
                        <span className="meta-val"><strong>{selectedClient.convenio || "padrão"}</strong></span>
                      </div>
                      <div className="dashboard-exec-meta-item">
                        <span className="meta-label">meta:</span>
                        <span className="meta-val"><strong style={{ color: "var(--accent)" }}>{selectedClient.meta_vagas || 1} vaga(s)</strong></span>
                      </div>
                      <div className="dashboard-exec-meta-item">
                        <span className="meta-label">período:</span>
                        <span className="meta-val">
                          <strong>
                            {selectedClient.tipo_data === "intervalo" && selectedClient.data_inicio && selectedClient.data_fim
                              ? `${selectedClient.data_inicio} até ${selectedClient.data_fim}`
                              : `+${selectedClient.days_forward_initial} a ${selectedClient.days_forward_max} dias`}
                          </strong>
                        </span>
                      </div>
                      <div className="dashboard-exec-meta-item meta-full-width">
                        <span className="meta-label">eventos:</span>
                        <span className="meta-val">
                          <strong>{selectedClient.preferred_events || "todos os eventos"}</strong>
                          {selectedClient.preferred_hours && (
                            <span style={{ marginLeft: "8px", color: "var(--accent)" }}>
                              (turno: {selectedClient.preferred_hours})
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="dashboard-exec-empty">
                    <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                      {!isMaster ? "nenhum perfil de cliente vinculado ao seu usuário" : "nenhum cliente selecionado"}
                    </span>
                    {isMaster && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setClientSearchOpen(true)}
                        disabled={isRunning || actionLoading}
                      >
                        selecionar cliente
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "16px", paddingTop: "16px", borderTop: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span className="form-label" style={{ fontWeight: 600 }}>modo de operação:</span>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={`segmented-btn ${selectedMode === "homologacao" ? "active" : ""}`}
                    onClick={() => handleModeChange("homologacao")}
                    disabled={isRunning || actionLoading}
                  >
                    homologação (teste seguro)
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${selectedMode === "producao" ? "active" : ""}`}
                    onClick={() => handleModeChange("producao")}
                    disabled={isRunning || actionLoading}
                  >
                    produção (inscrição real)
                  </button>
                </div>
              </div>

              {isCelular ? (
                <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  a automação roda no app do computador — aqui você acompanha os dados e os logs
                </span>
              ) : (
                <div style={{ display: "flex", gap: "10px" }}>
                  <Button
                    variant="secondary"
                    onClick={handleConsult}
                    disabled={isRunning || actionLoading}
                    loading={actionLoading && statusInfo.mode === "consulta"}
                  >
                    minhas vagas
                  </Button>

                  {!isRunning ? (
                    <Button
                      variant="primary"
                      onClick={handleStart}
                      disabled={actionLoading}
                      loading={actionLoading && statusInfo.mode !== "consulta"}
                    >
                      iniciar automação
                    </Button>
                  ) : (
                    <Button
                      variant="destructive"
                      onClick={handleStop}
                      disabled={actionLoading}
                      loading={actionLoading}
                    >
                      interromper automação
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">andamento das etapas</h3>
                <p className="card-desc">acompanhamento em tempo real de cada fase do ciclo da automação</p>
              </div>
              <StatusBadge status={statusInfo.status} />
            </div>

            {initialLoading ? (
              <div className="grid-cols-4">
                <Skeleton variant="card" />
                <Skeleton variant="card" />
                <Skeleton variant="card" />
                <Skeleton variant="card" />
              </div>
            ) : (
              (() => {
                const allText = logs.map((l) => (l.message || "").toLowerCase()).join(" ")
                let s1 = { state: "pendente", label: "pendente" }
                let s2 = { state: "pendente", label: "pendente" }
                let s3 = { state: "pendente", label: "pendente" }
                let s4 = { state: "pendente", label: "pendente" }

                if (isRunning) {
                  s1 = { state: "active", label: "autenticando..." }
                  if (allText.includes("login realizado") || allText.includes("tela de inscricao") || allText.includes("selecionando convenio")) {
                    s1 = { state: "completed", label: "autenticado" }
                    s2 = { state: "active", label: "aplicando filtros..." }
                  }
                  if (allText.includes("captcha da busca") || allText.includes("consultando data") || allText.includes("vaga compativel") || allText.includes("nenhuma vaga") || allText.includes("vagas encontradas")) {
                    s2 = { state: "completed", label: "filtros aplicados" }
                    s3 = { state: "active", label: "varrendo tabela..." }
                  }
                  if (allText.includes("inscricao confirmada") || allText.includes("vaga selecionada") || allText.includes("meta atingida") || allText.includes("vagas agendadas")) {
                    s3 = { state: "completed", label: "vagas avaliadas" }
                    s4 = { state: "active", label: "processando..." }
                  }
                } else if (statusInfo.status === "completed") {
                  s1 = { state: "completed", label: "concluído" }
                  s2 = { state: "completed", label: "concluído" }
                  s3 = { state: "completed", label: "concluído" }
                  s4 = { state: "completed", label: "finalizado" }
                } else if (statusInfo.status === "error") {
                  if (allText.includes("falha no login") || allText.includes("captcha")) {
                    s1 = { state: "error", label: "falha no login" }
                  } else {
                    s1 = { state: "completed", label: "concluído" }
                    s2 = { state: "error", label: "falha na busca" }
                  }
                }

                return (
                  <div className="grid-cols-4">
                    <div className={`step-card ${s1.state}`}>
                      <div className="step-top">
                        <span className="step-number">etapa 01</span>
                        <StatusBadge status={s1.label} />
                      </div>
                      <span className="step-title">autenticação e captcha</span>
                      <span className="step-desc">login seguro no portal do proeis</span>
                      {s1.state === "active" && <div className="step-progress-indicator" />}
                    </div>

                    <div className={`step-card ${s2.state}`}>
                      <div className="step-top">
                        <span className="step-number">etapa 02</span>
                        <StatusBadge status={s2.label} />
                      </div>
                      <span className="step-title">filtros e convênio</span>
                      <span className="step-desc">seleção de período e captcha de busca</span>
                      {s2.state === "active" && <div className="step-progress-indicator" />}
                    </div>

                    <div className={`step-card ${s3.state}`}>
                      <div className="step-top">
                        <span className="step-number">etapa 03</span>
                        <StatusBadge status={s3.label} />
                      </div>
                      <span className="step-title">varredura de vagas</span>
                      <span className="step-desc">leitura da tabela e regras de prioridade</span>
                      {s3.state === "active" && <div className="step-progress-indicator" />}
                    </div>

                    <div className={`step-card ${s4.state}`}>
                      <div className="step-top">
                        <span className="step-number">etapa 04</span>
                        <StatusBadge status={s4.label} />
                      </div>
                      <span className="step-title">agendamento e meta</span>
                      <span className="step-desc">confirmação de vaga e registro de ciclo</span>
                      {s4.state === "active" && <div className="step-progress-indicator" />}
                    </div>
                  </div>
                )
              })()
            )}
          </div>
        </>
      )}

      {dashboardTab === "logs" && (
        <div className="card">
          <div className="card-header">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <h3 className="card-title" style={{ margin: 0 }}>terminal de execução</h3>

                {/* Badge Dinâmica de Progresso de Tentativas */}
                {executionProgress.hasCycles ? (
                  <div style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "3px 10px",
                    borderRadius: "var(--radius-sm)",
                    backgroundColor: "rgba(37, 99, 235, 0.1)",
                    border: "1px solid rgba(37, 99, 235, 0.3)",
                    fontSize: "12px",
                    fontWeight: 700
                  }}>
                    <span style={{ color: "var(--accent)" }}>
                      tentativas: {executionProgress.currentCycle} / {executionProgress.totalCycles}
                    </span>
                    <span style={{ color: "var(--border-subtle)" }}>|</span>
                    <span style={{ color: "#10b981" }}>
                      meta: {executionProgress.currentVagas} / {executionProgress.metaVagas} vaga(s)
                    </span>
                    {executionProgress.currentDate && (
                      <>
                        <span style={{ color: "var(--border-subtle)" }}>|</span>
                        <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>
                          data: {executionProgress.currentDate}
                        </span>
                      </>
                    )}
                  </div>
                ) : isRunning ? (
                  <span style={{ fontSize: "11px", color: "var(--accent)", padding: "2px 8px", backgroundColor: "rgba(37, 99, 235, 0.1)", borderRadius: "var(--radius-sm)" }}>
                    iniciando ciclo 1 / {selectedClient?.max_attempts || 60}...
                  </span>
                ) : null}
              </div>
              <p className="card-desc" style={{ marginTop: "4px" }}>
                logs detalhados em tempo real das etapas de captcha, busca e agendamento
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <StatusBadge status={statusInfo.status} />
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handlePrintExecutionSummary()}
                style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
                title="imprimir resumo da execução atual"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 6 2 18 2 18 9"></polyline>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                  <rect x="6" y="14" width="12" height="8"></rect>
                </svg>
                imprimir resumo
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleClearLogs}
                disabled={logs.length === 0}
              >
                limpar visualização
              </button>
            </div>
          </div>

          {/* Barra de Progresso Visual das Tentativas */}
          {executionProgress.hasCycles && (
            <div style={{
              padding: "8px 12px",
              backgroundColor: "var(--bg-main)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              marginBottom: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "6px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", fontWeight: 600 }}>
                <span>
                  Progresso das Tentativas: <strong style={{ color: "var(--accent)" }}>{executionProgress.currentCycle}</strong> / <strong>{executionProgress.totalCycles}</strong> ({executionProgress.percentCycles}%)
                </span>
                <span>
                  Vagas Confirmadas: <strong style={{ color: "#10b981" }}>{executionProgress.currentVagas}</strong> / <strong>{executionProgress.metaVagas} vaga(s)</strong>
                </span>
              </div>
              <div style={{ width: "100%", height: "5px", backgroundColor: "var(--border-subtle)", borderRadius: "3px", overflow: "hidden" }}>
                <div style={{
                  width: `${executionProgress.percentCycles}%`,
                  height: "100%",
                  backgroundColor: "var(--accent)",
                  transition: "width 0.3s ease"
                }} />
              </div>
            </div>
          )}

          {initialLoading ? (
            <Skeleton height="360px" />
          ) : (
            <div className="terminal-box" ref={logTerminalRef} role="log" aria-live="polite" tabIndex={0} aria-label="Terminal de logs da automação">
              {logs.length === 0 ? (
                <div style={{ color: "var(--text-muted)", fontStyle: "italic", padding: "8px 0" }}>
                  aguardando inicialização da automação...
                </div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="terminal-line">
                    <span className="terminal-time">[{log.timestamp}]</span>
                    <span>{log.message}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {dashboardTab === "historico" && (
        <div className="card">
          <div className="card-header">
            <div>
              <h3 className="card-title">histórico de execuções</h3>
              <p className="card-desc">
                {isMaster ? "resumo completo de todas as execuções registradas no sistema" : "resumo das suas atividades e execuções registradas"}
              </p>
            </div>

            {isMaster && history.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmClearOpen(true)}
              >
                limpar histórico
              </Button>
            )}
          </div>

        {isMaster && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", marginBottom: "16px", padding: "12px", backgroundColor: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)" }}>
            <div style={{ flex: "1 1 180px", minWidth: "160px" }}>
              <input
                type="text"
                className="form-input"
                style={{ padding: "6px 10px", fontSize: "12px" }}
                placeholder="buscar no histórico..."
                aria-label="Buscar no histórico"
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
              />
            </div>

            <div style={{ minWidth: "140px" }}>
              <select
                className="form-select"
                style={{ padding: "6px 10px", fontSize: "12px" }}
                aria-label="Filtrar por usuário"
                value={historyFilterUser}
                onChange={(e) => setHistoryFilterUser(e.target.value)}
              >
                <option value="">todos usuários</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.email}>{u.name || u.email}</option>
                ))}
              </select>
            </div>

            <div style={{ minWidth: "140px" }}>
              <select
                className="form-select"
                style={{ padding: "6px 10px", fontSize: "12px" }}
                aria-label="Filtrar por cliente"
                value={historyFilterClient}
                onChange={(e) => setHistoryFilterClient(e.target.value)}
              >
                <option value="">todos clientes</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>

            <div style={{ minWidth: "120px" }}>
              <select
                className="form-select"
                style={{ padding: "6px 10px", fontSize: "12px" }}
                aria-label="Filtrar por status"
                value={historyFilterStatus}
                onChange={(e) => setHistoryFilterStatus(e.target.value)}
              >
                <option value="todos">todos status</option>
                <option value="completed">concluído</option>
                <option value="error">erro</option>
                <option value="running">executando</option>
                <option value="stopped">interrompido</option>
              </select>
            </div>

            <div style={{ minWidth: "120px" }}>
              <select
                className="form-select"
                style={{ padding: "6px 10px", fontSize: "12px" }}
                aria-label="Filtrar por modo de operação"
                value={historyFilterMode}
                onChange={(e) => setHistoryFilterMode(e.target.value)}
              >
                <option value="todos">todos modos</option>
                <option value="homologacao">homologação</option>
                <option value="producao">produção</option>
                <option value="consulta">consulta</option>
              </select>
            </div>

            {(historySearchQuery || historyFilterUser || historyFilterClient || historyFilterStatus !== "todos" || historyFilterMode !== "todos") && (
              <Button
                variant="ghost"
                size="sm"
                style={{ fontSize: "11px", padding: "6px 10px" }}
                onClick={() => {
                  setHistorySearchQuery("")
                  setHistoryFilterUser("")
                  setHistoryFilterClient("")
                  setHistoryFilterStatus("todos")
                  setHistoryFilterMode("todos")
                }}
              >
                limpar filtros
              </Button>
            )}
          </div>
        )}

        {whatsappFeedback && (
          <div style={{
            padding: "8px 12px",
            marginBottom: "12px",
            borderRadius: "var(--radius-sm)",
            fontSize: "12px",
            backgroundColor: whatsappFeedback.type === "success" ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
            color: whatsappFeedback.type === "success" ? "var(--color-success, #16a34a)" : "var(--color-destructive, #dc2626)",
            border: `1px solid ${whatsappFeedback.type === "success" ? "rgba(16, 185, 129, 0.2)" : "rgba(239, 68, 68, 0.2)"}`
          }}>
            {whatsappFeedback.text}
          </div>
        )}

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>id</th>
                <th>cliente</th>
                <th>modo</th>
                <th>status</th>
                <th>iniciado por</th>
                <th>início</th>
                <th>término</th>
                <th style={{ width: "210px", textAlign: "center" }}>ações</th>
                {isMaster && <th style={{ width: "70px", textAlign: "right" }}>excluir</th>}
              </tr>
            </thead>
            <tbody>
              {initialLoading ? (
                <>
                  <tr><td colSpan={isMaster ? 9 : 8}><Skeleton variant="row" /></td></tr>
                  <tr><td colSpan={isMaster ? 9 : 8}><Skeleton variant="row" /></td></tr>
                  <tr><td colSpan={isMaster ? 9 : 8}><Skeleton variant="row" /></td></tr>
                </>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={isMaster ? 9 : 8}>
                    <div className="empty-state">
                      <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <span className="empty-state-title">nenhum registro no histórico</span>
                      <span className="empty-state-desc">os ciclos de automação e consultas aparecerão aqui quando executados</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredHistory.map((item) => (
                  <tr key={item.id}>
                    <td style={{ fontWeight: 600 }}>#{item.id}</td>
                    <td>{item.client_name || "padrão"}</td>
                    <td><StatusBadge status={item.mode} /></td>
                    <td><StatusBadge status={item.status} /></td>
                    <td>{item.triggered_by || "sistema"}</td>
                    <td>{item.started_at ? new Date(item.started_at).toLocaleString("pt-BR") : "-"}</td>
                    <td>{item.finished_at ? new Date(item.finished_at).toLocaleString("pt-BR") : "-"}</td>
                    <td style={{ textAlign: "center" }}>
                      <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "3px 8px", fontSize: "11px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          onClick={() => handlePrintExecutionSummary(item)}
                          title="imprimir resumo desta execução"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 6 2 18 2 18 9"></polyline>
                            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                            <rect x="6" y="14" width="12" height="8"></rect>
                          </svg>
                          imprimir resumo
                        </button>
                        <Button
                          variant="outline"
                          size="sm"
                          style={{ padding: "3px 8px", fontSize: "11px" }}
                          onClick={() => handleSendWhatsapp(item)}
                          disabled={sendingWhatsappId === item.id}
                          loading={sendingWhatsappId === item.id}
                          title="enviar comprovante por whatsapp"
                        >
                          {sendingWhatsappId === item.id ? "enviando..." : "whatsapp"}
                        </Button>
                      </div>
                    </td>
                    {isMaster && (
                      <td style={{ textAlign: "right" }}>
                        <Button
                          variant="destructive"
                          size="sm"
                          style={{ padding: "3px 8px", fontSize: "11px" }}
                          onClick={() => setItemToDelete(item)}
                          title="remover registro do histórico"
                        >
                          remover
                        </Button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <Dialog open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
        <DialogContent style={{ maxWidth: "560px" }}>
          <DialogHeader>
            <DialogTitle>selecionar cliente para automação</DialogTitle>
            <DialogDescription>
              pesquise e selecione o cliente que terá suas credenciais e regras utilizadas
            </DialogDescription>
          </DialogHeader>

          <div style={{ marginBottom: "16px" }}>
            <div style={{ position: "relative" }}>
              <input
                type="text"
                className="form-input"
                placeholder="buscar por nome, cpf ou convênio..."
                value={clientSearchQuery}
                onChange={(e) => setClientSearchQuery(e.target.value)}
                autoFocus
                style={{ paddingLeft: "36px" }}
              />
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-muted)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "320px", overflowY: "auto", paddingRight: "4px" }}>
            {filteredClients.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "28px 16px" }}>
                {clientSearchQuery ? `nenhum cliente encontrado para "${clientSearchQuery}"` : "nenhum cliente cadastrado"}
              </div>
            ) : (
              filteredClients.map((c) => {
                const isSelected = String(c.id) === String(selectedClientId)
                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectClient(c.id)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      padding: "10px 12px",
                      borderRadius: "var(--radius-sm)",
                      border: isSelected ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
                      backgroundColor: isSelected ? "var(--bg-surface-elevated)" : "transparent",
                      cursor: "pointer",
                      transition: "background-color 0.15s ease, border-color 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</span>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>(<MaskedText text={c.document} />)</span>
                        <StatusBadge status={c.is_active ? "ativo" : "inativo"} />
                        {c.user_id === 1 || c.name === "Master Admin" ? (
                          <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "var(--radius-pill)", backgroundColor: "rgba(37, 99, 235, 0.12)", color: "var(--accent)" }}>
                            master
                          </span>
                        ) : c.system_user ? (
                          <span style={{ fontSize: "10px", fontWeight: 500, padding: "1px 6px", borderRadius: "var(--radius-pill)", backgroundColor: "var(--bg-surface-elevated)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}>
                            operador: {c.system_user}
                          </span>
                        ) : null}
                      </div>
                      {isSelected && (
                        <span style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 600 }}>
                          selecionado
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                      convênio: <strong style={{ color: "var(--text-primary)" }}>{c.convenio || "padrão"}</strong> | meta: <strong style={{ color: "var(--accent)" }}>{c.meta_vagas || 1} vaga(s)</strong>
                    </div>
                    <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                      período: {c.tipo_data === "intervalo" && c.data_inicio && c.data_fim ? `${c.data_inicio} até ${c.data_fim}` : `+${c.days_forward_initial} a ${c.days_forward_max}d`}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <DialogFooter>
            {isMaster && onNavigateTab && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setClientSearchOpen(false)
                  onNavigateTab("clients")
                }}
              >
                cadastrar / gerenciar clientes
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => setClientSearchOpen(false)}
            >
              fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmClearOpen} onOpenChange={setConfirmClearOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>limpar histórico de execuções</AlertDialogTitle>
            <AlertDialogDescription>
              deseja remover todo o histórico registrado de execuções do sistema? esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmClearOpen(false)}>
              cancelar
            </AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={handleClearHistory}>
              confirmar limpeza
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!itemToDelete} onOpenChange={(open) => !open && setItemToDelete(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>remover registro de execução</AlertDialogTitle>
            <AlertDialogDescription>
              deseja remover a execução #{itemToDelete?.id} ({itemToDelete?.client_name || "padrão"}) do histórico? esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setItemToDelete(null)}>
              cancelar
            </AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={() => handleDeleteHistoryItem(itemToDelete?.id)}>
              confirmar remoção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
