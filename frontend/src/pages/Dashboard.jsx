import React, { useState, useEffect, useRef } from "react"
import { Capacitor } from "@capacitor/core"
import { botApi, clientsApi, usersApi, settingsApi } from "../api/client"
import { consultVagasDirectNative, runAutomationDirectNative } from "../api/nativeProeis"
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

export function Dashboard({ user, onNavigateTab }) {
  const isMaster = user?.role === "master"
  const [statusInfo, setStatusInfo] = useState({
    status: "idle",
    mode: "homologacao",
    started_at: null,
    pid: null,
    logs_count: 0
  })
  const [selectedMode, setSelectedMode] = useState("homologacao")
  const manualModeRef = useRef(false)
  const [logs, setLogs] = useState([])
  const [history, setHistory] = useState([])
  const [clients, setClients] = useState([])
  const [usersList, setUsersList] = useState([])
  const [selectedClientId, setSelectedClientId] = useState("")
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
    } catch (err) {}
  }

  async function fetchUsers() {
    if (!isMaster) return
    try {
      const data = await usersApi.list()
      setUsersList(data || [])
    } catch (err) {}
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
    } catch (err) {}
  }

  async function fetchLogs() {
    try {
      const data = await botApi.getLogs(0)
      setLogs(data.logs || [])
    } catch (err) {}
  }

  async function fetchHistory() {
    try {
      const data = await botApi.getHistory()
      setHistory(data || [])
    } catch (err) {}
  }

  useEffect(() => {
    async function loadAll() {
      setInitialLoading(true)
      await Promise.all([fetchClients(), fetchUsers(), fetchStatus(), fetchLogs(), fetchHistory()])
      setInitialLoading(false)
    }
    loadAll()

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
          } catch {}
        }
      })
      return () => {
        if (unsubLog) unsubLog()
        if (unsubStatus) unsubStatus()
      }
    } else {
      const interval = setInterval(() => {
        fetchStatus()
        fetchLogs()
      }, 2500)
      return () => clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (logTerminalRef.current) {
      logTerminalRef.current.scrollTop = logTerminalRef.current.scrollHeight
    }
  }, [logs])

  function handleModeChange(mode) {
    manualModeRef.current = true
    setSelectedMode(mode)
  }

  function emitLocalLog(msg) {
    const timeStr = new Date().toTimeString().split(" ")[0]
    setLogs((prev) => [...prev, { timestamp: timeStr, message: String(msg).trim() }])
  }

  async function handleStart() {
    setErrorMsg("")
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
      } catch {}

      if (Capacitor.isNativePlatform()) {
        setLogs([])
        setStatusInfo((prev) => ({
          ...prev,
          status: "running",
          mode: selectedMode,
          started_at: new Date().toISOString().replace("T", " ").substring(0, 19)
        }))
        let settings = {}
        try {
          settings = await settingsApi.get()
        } catch {}
        const res = await runAutomationDirectNative(selectedMode, selectedClient, settings, emitLocalLog, () => false)
        const finalStatus = res.success ? "completed" : "error"
        setStatusInfo((prev) => ({ ...prev, status: finalStatus }))
        if (currentExecutionIdRef.current) {
          try {
            await botApi.updateExecution(currentExecutionIdRef.current, {
              status: finalStatus,
              finished_at: true
            })
            currentExecutionIdRef.current = null
          } catch {}
        }
        fetchHistory()
        return
      }

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
      } catch {}

      if (Capacitor.isNativePlatform()) {
        setLogs([])
        setStatusInfo((prev) => ({
          ...prev,
          status: "running",
          mode: "consulta",
          started_at: new Date().toISOString().replace("T", " ").substring(0, 19)
        }))
        let settings = {}
        try {
          settings = await settingsApi.get()
        } catch {}
        const res = await consultVagasDirectNative(selectedClient, settings, emitLocalLog)
        const finalStatus = res.success ? "completed" : "error"
        setStatusInfo((prev) => ({ ...prev, status: finalStatus }))
        if (currentExecutionIdRef.current) {
          try {
            await botApi.updateExecution(currentExecutionIdRef.current, {
              status: finalStatus,
              finished_at: true
            })
            currentExecutionIdRef.current = null
          } catch {}
        }
        fetchHistory()
        return
      }

      await botApi.consult(cId, selectedClient)
      await fetchStatus()
      if (!window.electronAPI) await fetchLogs()
    } catch (err) {
      setErrorMsg(err.message || "falha ao consultar vagas")
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
        } catch {}
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
    } catch {}
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
  const selectedClient = clients.find(c => String(c.id) === String(selectedClientId))

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

  function handleSelectClient(clientId) {
    setSelectedClientId(String(clientId))
    setClientSearchOpen(false)
    setClientSearchQuery("")
  }

  return (
    <div>
      {errorMsg && <div className="alert-error">{errorMsg}</div>}

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
              <span className="metric-label">registros de log</span>
              <span className="metric-value">
                {statusInfo.logs_count} linhas
              </span>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "16px 0", borderTop: "1px solid var(--border-subtle)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="form-label" style={{ fontWeight: 600, marginBottom: 0 }}>cliente para execução:</span>
            {isMaster && onNavigateTab && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onNavigateTab("clients")}
                style={{ fontSize: "12px", color: "var(--text-secondary)" }}
              >
                gerenciar todos os clientes
              </button>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "12px 14px",
              backgroundColor: "var(--bg-surface-elevated)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-sm)",
              flexWrap: "wrap"
            }}
          >
            {selectedClient ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: "220px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{selectedClient.name}</span>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>(<MaskedText text={selectedClient.document} />)</span>
                  <StatusBadge status={selectedClient.is_active ? "ativo" : "inativo"} />
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                  convênio: <strong style={{ color: "var(--text-primary)" }}>{selectedClient.convenio || "padrão"}</strong> | meta: <strong style={{ color: "var(--accent)" }}>{selectedClient.meta_vagas || 1} vaga(s)</strong>
                </div>
                <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                  período: <strong style={{ color: "var(--text-primary)" }}>
                    {selectedClient.tipo_data === "intervalo" && selectedClient.data_inicio && selectedClient.data_fim
                      ? `${selectedClient.data_inicio} até ${selectedClient.data_fim}`
                      : `+${selectedClient.days_forward_initial} a ${selectedClient.days_forward_max} dias`}
                  </strong> | eventos: <strong style={{ color: "var(--text-primary)" }}>{selectedClient.preferred_events || "todos"}</strong>
                </div>
              </div>
            ) : (
              <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                {!isMaster ? "nenhum perfil de cliente vinculado ao seu usuário" : "nenhum cliente selecionado"}
              </div>
            )}

            {isMaster && (
              <div style={{ display: "flex", gap: "8px" }}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setClientSearchOpen(true)}
                  disabled={isRunning || actionLoading}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}>
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  {selectedClient ? "trocar cliente" : "buscar cliente"}
                </Button>
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

          <div style={{ display: "flex", gap: "10px" }}>
            <Button
              variant="secondary"
              onClick={handleConsult}
              disabled={isRunning || actionLoading}
              loading={actionLoading && statusInfo.mode === "consulta"}
            >
              consultar vagas
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

      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">terminal de execução</h3>
            <p className="card-desc">logs detalhados das etapas de captcha, busca e pontuação</p>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleClearLogs}
            disabled={logs.length === 0}
          >
            limpar visualização
          </button>
        </div>

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
                {isMaster && <th style={{ width: "70px", textAlign: "right" }}>ações</th>}
              </tr>
            </thead>
            <tbody>
              {initialLoading ? (
                <>
                  <tr><td colSpan={isMaster ? 8 : 7}><Skeleton variant="row" /></td></tr>
                  <tr><td colSpan={isMaster ? 8 : 7}><Skeleton variant="row" /></td></tr>
                  <tr><td colSpan={isMaster ? 8 : 7}><Skeleton variant="row" /></td></tr>
                </>
              ) : filteredHistory.length === 0 ? (
                <tr>
                  <td colSpan={isMaster ? 8 : 7}>
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
