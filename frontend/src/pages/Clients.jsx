import React, { useState, useEffect } from "react"
import { clientsApi, usersApi } from "../api/client"
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
import { PasswordInput } from "../components/ui/password-input"
import { InfoTooltip } from "../components/ui/info-tooltip"
import { MaskedText, DocumentInput } from "../components/ui/masked-text"
import { ScheduleGuideModal } from "../components/ScheduleGuideModal"

const WEEKDAYS_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

function formatDateISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function getUpcomingScaleDates() {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sun, 1 = Mon, ..., 4 = Thu, 5 = Fri, 6 = Sat
  
  let daysUntilSunday = (7 - dayOfWeek) % 7
  if (daysUntilSunday === 0) {
    daysUntilSunday = 7
  }

  const startDate = new Date(today)
  startDate.setDate(today.getDate() + daysUntilSunday)
  
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6) // Domingo a Sábado (7 dias)
  
  return {
    start: formatDateISO(startDate),
    end: formatDateISO(endDate),
  }
}

function getNextNDaysDates(n) {
  const today = new Date()
  const startDate = new Date(today)
  const endDate = new Date(today)
  endDate.setDate(today.getDate() + (n - 1))
  return {
    start: formatDateISO(startDate),
    end: formatDateISO(endDate),
  }
}

function getDatesBreakdown(formData) {
  const dates = []
  if (formData.tipo_data === "intervalo" && formData.data_inicio && formData.data_fim) {
    try {
      const partsStart = formData.data_inicio.split("-")
      const partsEnd = formData.data_fim.split("-")
      if (partsStart.length === 3 && partsEnd.length === 3) {
        const start = new Date(Number(partsStart[0]), Number(partsStart[1]) - 1, Number(partsStart[2]))
        const end = new Date(Number(partsEnd[0]), Number(partsEnd[1]) - 1, Number(partsEnd[2]))
        
        let cur = new Date(start)
        let limit = 0
        while (cur <= end && limit < 45) {
          const y = cur.getFullYear()
          const m = String(cur.getMonth() + 1).padStart(2, "0")
          const d = String(cur.getDate()).padStart(2, "0")
          const weekday = WEEKDAYS_SHORT[cur.getDay()]
          dates.push({
            iso: `${y}-${m}-${d}`,
            br: `${d}/${m}`,
            fullBr: `${d}/${m}/${y}`,
            weekday,
            isWeekend: cur.getDay() === 0 || cur.getDay() === 6
          })
          cur.setDate(cur.getDate() + 1)
          limit++
        }
      }
    } catch {}
  } else {
    const startOffset = formData.days_forward_initial || 0
    const endOffset = Math.max(startOffset, formData.days_forward_max || 7)
    const today = new Date()
    for (let i = startOffset; i <= Math.min(endOffset, startOffset + 40); i++) {
      const cur = new Date(today)
      cur.setDate(today.getDate() + i)
      const y = cur.getFullYear()
      const m = String(cur.getMonth() + 1).padStart(2, "0")
      const d = String(cur.getDate()).padStart(2, "0")
      const weekday = WEEKDAYS_SHORT[cur.getDay()]
      dates.push({
        iso: `${y}-${m}-${d}`,
        br: `${d}/${m}`,
        fullBr: `${d}/${m}/${y}`,
        weekday,
        isWeekend: cur.getDay() === 0 || cur.getDay() === 6
      })
    }
  }
  return dates
}

function formatClientDateRule(c) {
  if (c.tipo_data === "intervalo" && c.data_inicio && c.data_fim) {
    try {
      const p1 = c.data_inicio.split("-")
      const p2 = c.data_fim.split("-")
      if (p1.length === 3 && p2.length === 3) {
        const d1 = new Date(Number(p1[0]), Number(p1[1]) - 1, Number(p1[2]))
        const d2 = new Date(Number(p2[0]), Number(p2[1]) - 1, Number(p2[2]))
        const w1 = WEEKDAYS_SHORT[d1.getDay()]
        const w2 = WEEKDAYS_SHORT[d2.getDay()]
        const diffDays = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1
        return `${p1[2]}/${p1[1]} (${w1}) a ${p2[2]}/${p2[1]} (${w2}) • ${diffDays} datas`
      }
    } catch {}
    return `${c.data_inicio} até ${c.data_fim}`
  }
  const diff = (c.days_forward_max || 7) - (c.days_forward_initial || 0) + 1
  return `+${c.days_forward_initial || 0} a ${c.days_forward_max || 7} dias (${diff} datas)`
}

export function Clients() {
  const [clients, setClients] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [clientToDelete, setClientToDelete] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [notification, setNotification] = useState({ type: "", text: "" })
  const [guideOpen, setGuideOpen] = useState(false)

  // Novos controles de visualização, busca e filtro
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState("todos") // "todos" | "ativos" | "inativos"
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem("cproeis:clients_view_mode") || "cards"
  })

  function handleSetViewMode(mode) {
    setViewMode(mode)
    localStorage.setItem("cproeis:clients_view_mode", mode)
  }

  function getInitials(name) {
    if (!name) return "CL"
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  const initialFormState = {
    name: "",
    document_type: "CPF",
    document: "",
    password: "",
    system_user: "",
    system_password: "",
    convenio: "HCPM - RAS",
    preferred_events: "",
    preferred_hours: "",
    only_listed_events: false,
    only_titular: false,
    tipo_data: "dias_frente",
    data_inicio: "",
    data_fim: "",
    meta_vagas: 1,
    days_forward_initial: 6,
    days_forward_max: 7,
    interval_seconds: 6,
    max_attempts: 120,
    is_active: true,
    user_id: null
  }

  const [formData, setFormData] = useState(initialFormState)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formTab, setFormTab] = useState("dados")
  const [showSysAccess, setShowSysAccess] = useState(false)
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const [clientList, userList] = await Promise.all([
        clientsApi.list(),
        usersApi.list().catch(() => [])
      ])
      setClients(clientList || [])
      setUsers(userList || [])
    } catch (err) {
      setNotification({ type: "error", text: err.message || "falha ao carregar dados" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function handleOpenCreate() {
    setEditingClient(null)
    setFormData(initialFormState)
    setFieldErrors({})
    setFormTab("dados")
    setShowSysAccess(false)
    setShowAdvancedSettings(false)
    setDialogOpen(true)
  }

  function handleOpenEdit(client) {
    setEditingClient(client)
    setFieldErrors({})
    setFormTab("dados")
    setShowSysAccess(Boolean(client.system_user))
    setShowAdvancedSettings(false)
    setFormData({
      name: client.name,
      document_type: client.document_type || "CPF",
      document: client.document,
      password: client.password,
      system_user: client.system_user || "",
      system_password: "",
      convenio: client.convenio || "HCPM - RAS",
      preferred_events: client.preferred_events || "",
      preferred_hours: client.preferred_hours || "",
      only_listed_events: client.only_listed_events || false,
      only_titular: client.only_titular || false,
      tipo_data: client.tipo_data || "dias_frente",
      data_inicio: client.data_inicio || "",
      data_fim: client.data_fim || "",
      meta_vagas: client.meta_vagas !== undefined ? client.meta_vagas : 1,
      days_forward_initial: client.days_forward_initial || 6,
      days_forward_max: client.days_forward_max || 7,
      interval_seconds: client.interval_seconds || 6,
      max_attempts: client.max_attempts || 120,
      is_active: client.is_active !== undefined ? client.is_active : true,
      user_id: client.user_id !== undefined ? client.user_id : null
    })
    setDialogOpen(true)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = {}
    if (!formData.name?.trim()) errors.name = "informe o nome do cliente"
    if (!formData.document?.trim()) errors.document = "informe o número do documento"
    if (!formData.password?.trim()) errors.password = "informe a senha do portal"

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      if (errors.name || errors.document || errors.password) {
        setFormTab("dados")
      }
      setNotification({ type: "error", text: "preencha todos os campos obrigatórios destacados" })
      return
    }

    setFieldErrors({})
    setActionLoading(true)
    setNotification({ type: "", text: "" })
    try {
      if (editingClient) {
        await clientsApi.update(editingClient.id, formData)
        setNotification({ type: "info", text: "cliente atualizado" })
      } else {
        await clientsApi.create(formData)
        setNotification({ type: "info", text: "novo cliente cadastrado" })
      }
      setDialogOpen(false)
      await loadData()
    } catch (err) {
      setNotification({ type: "error", text: err.message || "falha ao salvar cliente" })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleConfirmDelete() {
    if (!clientToDelete) return
    setActionLoading(true)
    try {
      await clientsApi.delete(clientToDelete.id)
      setNotification({ type: "info", text: "cliente removido" })
      setClientToDelete(null)
      await loadData()
    } catch (err) {
      setNotification({ type: "error", text: err.message || "falha ao remover cliente" })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleToggleStatus(client) {
    setActionLoading(true)
    try {
      await clientsApi.update(client.id, { is_active: !client.is_active })
      await loadData()
    } catch (err) {
      setNotification({ type: "error", text: err.message || "falha ao alterar status" })
    } finally {
      setActionLoading(false)
    }
  }

  // Filtragem de clientes
  const filteredClients = clients.filter((c) => {
    if (statusFilter === "ativos" && !c.is_active) return false
    if (statusFilter === "inativos" && c.is_active) return false

    if (!searchTerm.trim()) return true
    const term = searchTerm.toLowerCase().trim()
    const nameMatch = (c.name || "").toLowerCase().includes(term)
    const docMatch = (c.document || "").toLowerCase().includes(term)
    const userMatch = (c.system_user || "").toLowerCase().includes(term)
    const convMatch = (c.convenio || "").toLowerCase().includes(term)
    const eventMatch = (c.preferred_events || "").toLowerCase().includes(term)
    return nameMatch || docMatch || userMatch || convMatch || eventMatch
  })

  const totalCount = clients.length
  const activeCount = clients.filter((c) => c.is_active).length
  const inactiveCount = clients.filter((c) => !c.is_active).length

  return (
    <div className="clients-page-container">
      {notification.text && (
        <div className={notification.type === "error" ? "alert-error" : "alert-info"}>
          {notification.text}
        </div>
      )}

      <div className="card clients-main-card">
        {/* Cabeçalho da Gestão de Clientes */}
        <div className="card-header clients-header">
          <div className="clients-header-info">
            <h3 className="card-title">gestão de clientes e perfis</h3>
            <p className="card-desc">cadastre múltiplos clientes com suas credenciais, período e preferências individuais</p>
          </div>

          <div className="clients-header-actions">
            <Button
              type="button"
              variant="outline"
              onClick={() => setGuideOpen(true)}
              style={{ gap: "6px" }}
              title="Guia explicativo sobre a escala de quinta, turnos e metas"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <span>como funciona a escala</span>
            </Button>

            <Button onClick={handleOpenCreate} className="btn-create-client">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>cadastrar novo cliente</span>
            </Button>
          </div>
        </div>

        {/* Barra de Ferramentas: Busca, Filtros e Alternador de Modo de Visualização */}
        <div className="clients-toolbar">
          <div className="clients-search-box">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              className="clients-search-input"
              placeholder="buscar por nome, cpf, convênio ou operador..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="clear-search-btn"
                onClick={() => setSearchTerm("")}
                title="limpar busca"
              >
                ✕
              </button>
            )}
          </div>

          <div className="clients-toolbar-controls">
            {/* Filtros de Status em Chips */}
            <div className="status-filter-pills">
              <button
                type="button"
                className={`status-filter-btn ${statusFilter === "todos" ? "active" : ""}`}
                onClick={() => setStatusFilter("todos")}
              >
                todos <span className="pill-count">{totalCount}</span>
              </button>
              <button
                type="button"
                className={`status-filter-btn ${statusFilter === "ativos" ? "active" : ""}`}
                onClick={() => setStatusFilter("ativos")}
              >
                ativos <span className="pill-count count-active">{activeCount}</span>
              </button>
              <button
                type="button"
                className={`status-filter-btn ${statusFilter === "inativos" ? "active" : ""}`}
                onClick={() => setStatusFilter("inativos")}
              >
                inativos <span className="pill-count count-inactive">{inactiveCount}</span>
              </button>
            </div>

            {/* Alternador de Visualização (Modo Cards / Modo Lista) */}
            <div className="view-mode-toggle" title="alternar modo de visualização">
              <button
                type="button"
                className={`view-mode-btn ${viewMode === "cards" ? "active" : ""}`}
                onClick={() => handleSetViewMode("cards")}
                aria-label="visualização em cards"
                title="Modo Cards (Grid responsivo)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                </svg>
                <span className="view-mode-label">cards</span>
              </button>

              <button
                type="button"
                className={`view-mode-btn ${viewMode === "list" ? "active" : ""}`}
                onClick={() => handleSetViewMode("list")}
                aria-label="visualização em lista"
                title="Modo Lista (Tabela)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
                <span className="view-mode-label">lista</span>
              </button>
            </div>
          </div>
        </div>

        {/* Conteúdo Principal: Modo Cards ou Modo Lista */}
        {loading ? (
          viewMode === "cards" ? (
            <div className="clients-grid">
              <div className="client-card"><Skeleton variant="row" /></div>
              <div className="client-card"><Skeleton variant="row" /></div>
              <div className="client-card"><Skeleton variant="row" /></div>
            </div>
          ) : (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>cliente</th>
                    <th>documento</th>
                    <th>operador</th>
                    <th>convênio</th>
                    <th>eventos</th>
                    <th>período & meta</th>
                    <th>status</th>
                    <th>ações</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td colSpan="8"><Skeleton variant="row" /></td></tr>
                  <tr><td colSpan="8"><Skeleton variant="row" /></td></tr>
                  <tr><td colSpan="8"><Skeleton variant="row" /></td></tr>
                </tbody>
              </table>
            </div>
          )
        ) : filteredClients.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            <span className="empty-state-title">
              {clients.length === 0 ? "nenhum cliente cadastrado" : "nenhum cliente encontrado com os filtros atuais"}
            </span>
            <span className="empty-state-desc">
              {clients.length === 0
                ? "cadastre clientes para vincular credenciais e preferências individuais de agendamento"
                : "tente buscar por outro termo ou limpar os filtros de status"}
            </span>
            {clients.length === 0 ? (
              <Button size="sm" onClick={handleOpenCreate} style={{ marginTop: "8px" }}>
                cadastrar primeiro cliente
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setSearchTerm(""); setStatusFilter("todos"); }}
                style={{ marginTop: "8px" }}
              >
                limpar filtros
              </Button>
            )}
          </div>
        ) : viewMode === "cards" ? (
          /* ================= MODO CARDS (GRID RESPONSIVO) ================= */
          <div className="clients-grid">
            {filteredClients.map((c) => (
              <div key={c.id} className={`client-card ${c.is_active ? "is-active" : "is-inactive"}`}>
                {/* Header do Card com Avatar, Nome e Status */}
                <div className="client-card-header">
                  <div className="client-identity">
                    <div className={`client-avatar-badge ${c.is_active ? "avatar-active" : "avatar-inactive"}`}>
                      {getInitials(c.name)}
                    </div>
                    <div className="client-name-group">
                      <h4 className="client-card-name" title={c.name}>{c.name}</h4>
                      <span className="client-card-operator">
                        {c.system_user ? `operador: ${c.system_user}` : "acesso apenas master"}
                      </span>
                    </div>
                  </div>

                  <div className="client-status-wrapper">
                    <StatusBadge status={c.is_active ? "ativo" : "inativo"} />
                  </div>
                </div>

                {/* Corpo do Card com Especificações em Mini Grid */}
                <div className="client-card-body">
                  <div className="client-info-grid">
                    <div className="client-info-row">
                      <span className="client-info-label">documento:</span>
                      <span className="client-info-val"><MaskedText text={c.document} /> ({c.document_type || "CPF"})</span>
                    </div>

                    <div className="client-info-row">
                      <span className="client-info-label">convênio:</span>
                      <span className="client-badge-pill-inline">{c.convenio || "padrão"}</span>
                    </div>

                    <div className="client-info-row">
                      <span className="client-info-label">regra de busca:</span>
                      <span className="client-info-val" style={{ fontWeight: 500 }}>
                        {formatClientDateRule(c)}
                      </span>
                    </div>

                    <div className="client-info-row">
                      <span className="client-info-label">meta & intervalo:</span>
                      <span className="client-info-val">
                        <strong>{c.meta_vagas || 1} vaga(s)</strong> • ciclo de {c.interval_seconds || 6}s ({c.max_attempts || 120} tent.)
                      </span>
                    </div>
                  </div>

                  {/* Eventos Preferidos, Horários e Tags */}
                  <div className="client-card-events">
                    <span className="client-events-title">eventos prioritários:</span>
                    <p className="client-events-text" title={c.preferred_events || "todos os eventos"}>
                      {c.preferred_events || "todos os eventos permitidos"}
                    </p>
                    {c.preferred_hours && (
                      <p className="client-events-text" style={{ fontSize: "11px", color: "var(--accent)", marginTop: "2px", fontWeight: 600 }} title={`Horários: ${c.preferred_hours}`}>
                        turno: {c.preferred_hours}
                      </p>
                    )}
                    <div className="client-tags-row">
                      {c.only_listed_events && (
                        <span className="client-tag-badge tag-warning" title="Apenas eventos listados">
                          apenas listados
                        </span>
                      )}
                      {c.only_titular && (
                        <span className="client-tag-badge tag-info" title="Apenas vagas de titular (descarta reserva)">
                          apenas titular
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer do Card com Botões de Ação */}
                <div className="client-card-footer">
                  <Button
                    variant="outline"
                    size="sm"
                    className="card-action-btn"
                    onClick={() => handleOpenEdit(c)}
                    disabled={actionLoading}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                    <span>editar</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="card-action-btn"
                    onClick={() => handleToggleStatus(c)}
                    disabled={actionLoading}
                  >
                    {c.is_active ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="6" y="4" width="4" height="16" />
                          <rect x="14" y="4" width="4" height="16" />
                        </svg>
                        <span>desativar</span>
                      </>
                    ) : (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polygon points="5 3 19 12 5 21 5 3" />
                        </svg>
                        <span>ativar</span>
                      </>
                    )}
                  </Button>

                  <Button
                    variant="destructive"
                    size="sm"
                    className="card-action-btn"
                    onClick={() => setClientToDelete(c)}
                    disabled={actionLoading}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                    <span>remover</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* ================= MODO LISTA (TABELA APRIMORADA) ================= */
          <div className="table-container">
            <table className="clients-table-modern">
              <thead>
                <tr>
                  <th>cliente</th>
                  <th>documento</th>
                  <th>operador</th>
                  <th>convênio</th>
                  <th>eventos & horários</th>
                  <th>período & meta</th>
                  <th>status</th>
                  <th style={{ textAlign: "right" }}>ações</th>
                </tr>
              </thead>
              <tbody>
                {filteredClients.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="table-client-cell">
                        <div className="table-client-avatar">
                          {getInitials(c.name)}
                        </div>
                        <div className="table-client-info">
                          <span className="table-client-name">{c.name}</span>
                          <span className="table-client-doc-mini">{c.document_type || "CPF"}</span>
                        </div>
                      </div>
                    </td>
                    <td><MaskedText text={c.document} /></td>
                    <td>
                      {c.system_user ? (
                        <span className="table-user-badge">
                          {c.system_user}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>master</span>
                      )}
                    </td>
                    <td>
                      <span className="client-badge-pill-inline">{c.convenio || "padrão"}</span>
                    </td>
                    <td style={{ maxWidth: "200px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span className="table-events-cell" title={c.preferred_events || "todos"}>
                          {c.preferred_events || "todos"}
                        </span>
                        {c.preferred_hours && (
                          <span style={{ fontSize: "11px", color: "var(--accent)", fontWeight: 600 }} title={`Horários: ${c.preferred_hours}`}>
                            turno: {c.preferred_hours}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ lineHeight: 1.3 }}>
                        <span style={{ fontWeight: 500, display: "block" }}>{formatClientDateRule(c)}</span>
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginTop: "2px" }}>
                          meta: <strong style={{ color: "var(--text-primary)" }}>{c.meta_vagas || 1} vaga(s)</strong> ({c.interval_seconds}s)
                        </span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={c.is_active ? "ativo" : "inativo"} />
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <div className="table-actions-group">
                        <button
                          type="button"
                          className="table-action-icon-btn edit-btn"
                          onClick={() => handleOpenEdit(c)}
                          disabled={actionLoading}
                          title="editar cliente"
                          aria-label="editar cliente"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>

                        <button
                          type="button"
                          className={`table-action-icon-btn ${c.is_active ? "pause-btn" : "play-btn"}`}
                          onClick={() => handleToggleStatus(c)}
                          disabled={actionLoading}
                          title={c.is_active ? "desativar cliente" : "ativar cliente"}
                          aria-label={c.is_active ? "desativar cliente" : "ativar cliente"}
                        >
                          {c.is_active ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="6" y="4" width="4" height="16" />
                              <rect x="14" y="4" width="4" height="16" />
                            </svg>
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="5 3 19 12 5 21 5 3" />
                            </svg>
                          )}
                        </button>

                        <button
                          type="button"
                          className="table-action-icon-btn delete-btn"
                          onClick={() => setClientToDelete(c)}
                          disabled={actionLoading}
                          title="remover cliente"
                          aria-label="remover cliente"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent style={{ maxWidth: "620px" }}>
          <DialogHeader>
            <DialogTitle>
              {editingClient ? "editar dados do cliente" : "cadastrar novo cliente"}
            </DialogTitle>
            <DialogDescription>
              configure os dados de acesso ao portal, período de busca e credenciais de login
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            {/* Barra de Abas do Formulário */}
            <div className="form-tabs-bar">
              <button
                type="button"
                className={`form-tab-btn ${formTab === "dados" ? "active" : ""} ${fieldErrors.name || fieldErrors.document || fieldErrors.password ? "has-error" : ""}`}
                onClick={() => setFormTab("dados")}
              >
                <span className="form-tab-num">1</span>
                <span>dados & login</span>
              </button>

              <button
                type="button"
                className={`form-tab-btn ${formTab === "eventos" ? "active" : ""}`}
                onClick={() => setFormTab("eventos")}
              >
                <span className="form-tab-num">2</span>
                <span>convênio & eventos</span>
              </button>

              <button
                type="button"
                className={`form-tab-btn ${formTab === "escala" ? "active" : ""}`}
                onClick={() => setFormTab("escala")}
              >
                <span className="form-tab-num">3</span>
                <span>escala & agendamento</span>
              </button>
            </div>

            {/* ABA 1: DADOS & LOGIN */}
            {formTab === "dados" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="cli_name">nome do cliente *</label>
                  <input
                    id="cli_name"
                    className={`form-input ${fieldErrors.name ? "input-error" : ""}`}
                    value={formData.name}
                    onChange={(e) => {
                      setFormData({ ...formData, name: e.target.value })
                      if (fieldErrors.name) setFieldErrors({ ...fieldErrors, name: null })
                    }}
                    placeholder="ex: Dr. Lucas"
                    disabled={actionLoading}
                    aria-invalid={fieldErrors.name ? "true" : undefined}
                    autoFocus
                  />
                  {fieldErrors.name && <span className="field-error-message">{fieldErrors.name}</span>}
                </div>

                <div className="grid-cols-2">
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="cli_doc_type">tipo documento</label>
                    <select
                      id="cli_doc_type"
                      className="form-select"
                      value={formData.document_type}
                      onChange={(e) => setFormData({ ...formData, document_type: e.target.value })}
                      disabled={actionLoading}
                    >
                      <option value="CPF">CPF</option>
                      <option value="RG">RG</option>
                    </select>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" htmlFor="cli_doc">número documento *</label>
                    <DocumentInput
                      id="cli_doc"
                      value={formData.document}
                      onChange={(e) => {
                        setFormData({ ...formData, document: e.target.value })
                        if (fieldErrors.document) setFieldErrors({ ...fieldErrors, document: null })
                      }}
                      placeholder="000.000.000-00"
                      error={!!fieldErrors.document}
                      disabled={actionLoading}
                    />
                    {fieldErrors.document && <span className="field-error-message">{fieldErrors.document}</span>}
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="cli_pass">senha do portal proeis *</label>
                  <PasswordInput
                    id="cli_pass"
                    value={formData.password}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value })
                      if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: null })
                    }}
                    placeholder="senha do portal proeis"
                    error={!!fieldErrors.password}
                    disabled={actionLoading}
                  />
                  {fieldErrors.password && <span className="field-error-message">{fieldErrors.password}</span>}
                </div>

                {/* Seção Retrátil (+ / -) para Acesso ao Sistema */}
                <div className={`form-collapsible-card ${showSysAccess ? "open" : ""}`} style={{ marginTop: "4px" }}>
                  <button
                    type="button"
                    className="form-collapsible-toggle"
                    onClick={() => setShowSysAccess(!showSysAccess)}
                  >
                    <div className="form-collapsible-title-wrap">
                      <span className="form-collapsible-icon-btn">{showSysAccess ? "−" : "+"}</span>
                      <span className="form-collapsible-title">acesso do cliente ao sistema web / app</span>
                      {formData.system_user && !showSysAccess && (
                        <span className="form-collapsible-badge">login: {formData.system_user}</span>
                      )}
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                      {showSysAccess ? "ocultar" : "configurar login próprio"}
                    </span>
                  </button>

                  {showSysAccess && (
                    <div className="form-collapsible-body">
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                        <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                          permite que o cliente acesse o sistema web/app para ver e gerenciar suas próprias vagas:
                        </span>
                        <InfoTooltip
                          title="login do cliente"
                          text="defina o usuário e a senha para que este cliente possa entrar no sistema web/app e operar exclusivamente suas vagas."
                        />
                      </div>
                      <div className="grid-cols-2">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" htmlFor="cli_sys_user">usuário / login de acesso</label>
                          <input
                            id="cli_sys_user"
                            className="form-input"
                            value={formData.system_user}
                            onChange={(e) => setFormData({ ...formData, system_user: e.target.value })}
                            placeholder="ex: lucas_med ou CPF"
                            disabled={actionLoading}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" htmlFor="cli_sys_pass">
                            {editingClient ? "alterar senha no sistema" : "senha de acesso ao sistema"}
                          </label>
                          <PasswordInput
                            id="cli_sys_pass"
                            value={formData.system_password}
                            onChange={(e) => setFormData({ ...formData, system_password: e.target.value })}
                            placeholder={editingClient ? "deixe vazio para manter" : "senha para o cliente entrar"}
                            disabled={actionLoading}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ABA 2: CONVÊNIO & EVENTOS */}
            {formTab === "eventos" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="cli_conv">convênio alvo</label>
                  <input
                    id="cli_conv"
                    className="form-input"
                    value={formData.convenio}
                    onChange={(e) => setFormData({ ...formData, convenio: e.target.value })}
                    placeholder="ex: HCPM - RAS"
                    disabled={actionLoading}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="cli_events">eventos preferidos (separados por vírgula)</label>
                  <input
                    id="cli_events"
                    className="form-input"
                    value={formData.preferred_events}
                    onChange={(e) => setFormData({ ...formData, preferred_events: e.target.value })}
                    placeholder="ENFERMAGEM CIRURGIA GERAL, UPE APOIO"
                    disabled={actionLoading}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", flexWrap: "wrap", gap: "6px" }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <label className="form-label" htmlFor="cli_hours" style={{ marginBottom: 0 }}>
                        horários / turnos do sistema (opcional)
                      </label>
                      <InfoTooltip
                        title="turnos do sistema"
                        text="o sistema possui 2 turnos principais: 07 às 19 (diurno) e 19 às 07 (noturno). Escolha um dos botões ou digite o horário desejado."
                        example="clique em '07 às 19' para focar apenas no turno diurno, ou '19 às 07' para o turno noturno."
                      />
                    </div>
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="date-preset-btn"
                        style={{ padding: "3px 8px", fontSize: "11px" }}
                        onClick={() => {
                          setFormData({ ...formData, preferred_hours: "07 às 19" })
                        }}
                        title="Focar no turno diurno (07:00 às 19:00)"
                      >
                        07 às 19
                      </button>
                      <button
                        type="button"
                        className="date-preset-btn"
                        style={{ padding: "3px 8px", fontSize: "11px" }}
                        onClick={() => {
                          setFormData({ ...formData, preferred_hours: "19 às 07" })
                        }}
                        title="Focar no turno noturno (19:00 às 07:00)"
                      >
                        19 às 07
                      </button>
                      <button
                        type="button"
                        className="date-preset-btn"
                        style={{ padding: "3px 8px", fontSize: "11px" }}
                        onClick={() => {
                          setFormData({ ...formData, preferred_hours: "" })
                        }}
                        title="Aceitar qualquer horário/turno"
                      >
                        qualquer turno
                      </button>
                    </div>
                  </div>
                  <input
                    id="cli_hours"
                    className="form-input"
                    value={formData.preferred_hours}
                    onChange={(e) => setFormData({ ...formData, preferred_hours: e.target.value })}
                    placeholder="ex: 07 às 19, 19 às 07, 07:00, 19:00"
                    disabled={actionLoading}
                  />
                </div>

                <div style={{ display: "flex", gap: "20px", marginTop: "4px", flexWrap: "wrap", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <label className="form-checkbox-group" style={{ marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        className="form-checkbox"
                        checked={formData.only_listed_events}
                        onChange={(e) => setFormData({ ...formData, only_listed_events: e.target.checked })}
                        disabled={actionLoading}
                      />
                      <span className="form-label" style={{ cursor: "pointer" }}>apenas eventos listados</span>
                    </label>
                    <InfoTooltip
                      title="apenas eventos listados"
                      text="se marcado, o robô só se inscreve estritamente nos eventos informados no campo de eventos preferidos e ignora os demais."
                      example="se digitou 'cirurgia', ele ignora vagas de 'apoio' ou 'guarda'."
                    />
                  </div>

                  <div style={{ display: "flex", alignItems: "center" }}>
                    <label className="form-checkbox-group" style={{ marginBottom: 0 }}>
                      <input
                        type="checkbox"
                        className="form-checkbox"
                        checked={formData.only_titular}
                        onChange={(e) => setFormData({ ...formData, only_titular: e.target.checked })}
                        disabled={actionLoading}
                      />
                      <span className="form-label" style={{ cursor: "pointer" }}>apenas titulares</span>
                    </label>
                    <InfoTooltip
                      title="apenas titulares"
                      text="se marcado, o robô só agenda vagas de titular direto da escala e descarta vagas de cadastro de reserva."
                      example="se a vaga estiver identificada como reserva, o robô não fará o agendamento."
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ABA 3: ESCALA & AGENDAMENTO */}
            {formTab === "escala" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ padding: "12px", backgroundColor: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                    <div style={{ display: "flex", alignItems: "center" }}>
                      <span className="form-label" style={{ fontWeight: 600, marginBottom: 0 }}>regra de datas:</span>
                      <button
                        type="button"
                        onClick={() => setGuideOpen(true)}
                        style={{
                          fontSize: "11px",
                          color: "var(--accent)",
                          background: "transparent",
                          border: "none",
                          cursor: "pointer",
                          textDecoration: "underline",
                          marginLeft: "6px"
                        }}
                        title="Abrir guia explicativo completo"
                      >
                        (como funciona?)
                      </button>
                    </div>
                    <div className="segmented-control">
                      <button
                        type="button"
                        className={`segmented-btn ${formData.tipo_data === "dias_frente" ? "active" : ""}`}
                        onClick={() => setFormData({ ...formData, tipo_data: "dias_frente" })}
                        disabled={actionLoading}
                      >
                        dias à frente
                      </button>
                      <button
                        type="button"
                        className={`segmented-btn ${formData.tipo_data === "intervalo" ? "active" : ""}`}
                        onClick={() => setFormData({ ...formData, tipo_data: "intervalo" })}
                        disabled={actionLoading}
                      >
                        período de datas
                      </button>
                    </div>
                  </div>

                  {/* Atalhos Rápidos */}
                  <div className="date-presets-row">
                    <button
                      type="button"
                      className="date-preset-btn"
                      onClick={() => {
                        const { start, end } = getUpcomingScaleDates()
                        setFormData({ ...formData, tipo_data: "intervalo", data_inicio: start, data_fim: end })
                      }}
                      title="Preencher com os 7 dias da próxima escala (Domingo a Sábado)"
                    >
                      próxima escala (dom a sáb)
                    </button>
                    <button
                      type="button"
                      className="date-preset-btn"
                      onClick={() => {
                        const { start, end } = getNextNDaysDates(7)
                        setFormData({ ...formData, tipo_data: "intervalo", data_inicio: start, data_fim: end })
                      }}
                      title="Preencher com os próximos 7 dias corridos"
                    >
                      7 dias
                    </button>
                    <button
                      type="button"
                      className="date-preset-btn"
                      onClick={() => {
                        const { start, end } = getNextNDaysDates(14)
                        setFormData({ ...formData, tipo_data: "intervalo", data_inicio: start, data_fim: end })
                      }}
                      title="Preencher com os próximos 14 dias corridos (2 semanas)"
                    >
                      14 dias
                    </button>
                  </div>

                  {formData.tipo_data === "intervalo" ? (
                    <div className="grid-cols-2">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" htmlFor="cli_dt_ini">data inicial</label>
                        <input
                          id="cli_dt_ini"
                          type="date"
                          className="form-input"
                          value={formData.data_inicio}
                          onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                          disabled={actionLoading}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" htmlFor="cli_dt_fim">data final</label>
                        <input
                          id="cli_dt_fim"
                          type="date"
                          className="form-input"
                          value={formData.data_fim}
                          onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                          disabled={actionLoading}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid-cols-2">
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" htmlFor="cli_dias_ini">dias inicial (a partir de hoje)</label>
                        <input
                          id="cli_dias_ini"
                          type="number"
                          className="form-input"
                          value={formData.days_forward_initial}
                          onChange={(e) => setFormData({ ...formData, days_forward_initial: parseInt(e.target.value) || 0 })}
                          disabled={actionLoading}
                        />
                      </div>
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" htmlFor="cli_dias_max">dias máximo</label>
                        <input
                          id="cli_dias_max"
                          type="number"
                          className="form-input"
                          value={formData.days_forward_max}
                          onChange={(e) => setFormData({ ...formData, days_forward_max: parseInt(e.target.value) || 0 })}
                          disabled={actionLoading}
                        />
                      </div>
                    </div>
                  )}

                  {/* Descritor Interativo de Datas Selecionadas */}
                  {(() => {
                    const datesBreakdown = getDatesBreakdown(formData)
                    if (datesBreakdown.length === 0) return null
                    return (
                      <div className="date-preview-box">
                        <div className="date-preview-header">
                          <span>{datesBreakdown.length} data(s) no ciclo de busca (1 por dia):</span>
                        </div>
                        <div className="date-chips-grid">
                          {datesBreakdown.map((item, idx) => (
                            <span
                              key={idx}
                              className={`date-chip ${item.isWeekend ? "is-weekend" : ""}`}
                              title={`Data: ${item.fullBr} (${item.weekday})`}
                            >
                              <span className="date-chip-weekday">{item.weekday}</span>
                              <span className="date-chip-day">{item.br}</span>
                            </span>
                          ))}
                        </div>
                        <p className="date-preview-hint">
                          O robô busca 1 vaga por dia nessas datas em ordem rotativa. Ao agendar uma vaga em uma data, avança para as próximas até alcançar a meta de <strong>{formData.meta_vagas || 1} vaga(s)</strong>.
                        </p>
                      </div>
                    )
                  })()}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <label className="form-label" htmlFor="cli_meta" style={{ marginBottom: 0 }}>meta de vagas</label>
                    <InfoTooltip
                      title="meta de vagas"
                      text="número máximo de vagas que o robô agendará no total. Ele continua pesquisando as datas do período até atingir esse limite."
                      example="se a meta for 15 e aparecerem 7 datas disponíveis com vagas no período, o robô cadastrará as 7 com sucesso."
                    />
                  </div>
                  <input
                    id="cli_meta"
                    type="number"
                    min="1"
                    className="form-input"
                    style={{ marginTop: "4px" }}
                    value={formData.meta_vagas}
                    onChange={(e) => setFormData({ ...formData, meta_vagas: parseInt(e.target.value) || 1 })}
                    disabled={actionLoading}
                    placeholder="ex: 5"
                  />
                </div>

                {/* Seção Retrátil (+ / -) para Ajustes Avançados */}
                <div className={`form-collapsible-card ${showAdvancedSettings ? "open" : ""}`} style={{ marginBottom: 0 }}>
                  <button
                    type="button"
                    className="form-collapsible-toggle"
                    onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
                  >
                    <div className="form-collapsible-title-wrap">
                      <span className="form-collapsible-icon-btn">{showAdvancedSettings ? "−" : "+"}</span>
                      <span className="form-collapsible-title">ajustes avançados (intervalo & tentativas)</span>
                      {!showAdvancedSettings && (
                        <span className="form-collapsible-badge">{formData.interval_seconds}s • {formData.max_attempts} tentativas</span>
                      )}
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
                      {showAdvancedSettings ? "ocultar" : "personalizar"}
                    </span>
                  </button>

                  {showAdvancedSettings && (
                    <div className="form-collapsible-body">
                      <div className="grid-cols-2">
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" htmlFor="cli_interval">intervalo entre buscas (s)</label>
                          <input
                            id="cli_interval"
                            type="number"
                            className="form-input"
                            value={formData.interval_seconds}
                            onChange={(e) => setFormData({ ...formData, interval_seconds: parseInt(e.target.value) || 1 })}
                            disabled={actionLoading}
                          />
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <div style={{ display: "flex", alignItems: "center" }}>
                            <label className="form-label" htmlFor="cli_attempts" style={{ marginBottom: 0 }}>limite de tentativas</label>
                            <InfoTooltip
                              title="tentativas"
                              text="quantidade de ciclos que o robô executará antes de finalizar a busca."
                              example="para um período de 14 dias, 30 tentativas dão aproximadamente 2 voltas completas em todos os dias."
                            />
                          </div>
                          <input
                            id="cli_attempts"
                            type="number"
                            className="form-input"
                            style={{ marginTop: "4px" }}
                            value={formData.max_attempts}
                            onChange={(e) => setFormData({ ...formData, max_attempts: parseInt(e.target.value) || 1 })}
                            disabled={actionLoading}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <DialogFooter style={{ marginTop: "16px" }}>
              <div className="tab-nav-footer">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={actionLoading}
                >
                  cancelar
                </Button>

                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  {formTab === "dados" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFormTab("eventos")}
                    >
                      próximo: eventos →
                    </Button>
                  )}
                  {formTab === "eventos" && (
                    <>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setFormTab("dados")}
                      >
                        ← voltar
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setFormTab("escala")}
                      >
                        próximo: escala →
                      </Button>
                    </>
                  )}
                  {formTab === "escala" && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setFormTab("eventos")}
                    >
                      ← voltar
                    </Button>
                  )}

                  <Button
                    type="submit"
                    disabled={actionLoading}
                  >
                    {actionLoading ? "salvando..." : editingClient ? "atualizar cliente" : "salvar cliente"}
                  </Button>
                </div>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!clientToDelete} onOpenChange={(open) => !open && setClientToDelete(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>remover cliente</AlertDialogTitle>
            <AlertDialogDescription>
              deseja remover o perfil de {clientToDelete?.name}? todas as preferências salvas deste cliente serão excluídas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setClientToDelete(null)}>
              cancelar
            </AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={handleConfirmDelete}>
              confirmar remoção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ScheduleGuideModal open={guideOpen} onOpenChange={setGuideOpen} />
    </div>
  )
}
