import React, { useState, useEffect } from "react"
import { schedulesApi, clientsApi } from "../api/client"
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

// 0 = segunda (mesma convencao do CronTrigger do backend)
const DIAS = [
  { valor: "0", curto: "seg", nome: "segunda" },
  { valor: "1", curto: "ter", nome: "terça" },
  { valor: "2", curto: "qua", nome: "quarta" },
  { valor: "3", curto: "qui", nome: "quinta" },
  { valor: "4", curto: "sex", nome: "sexta" },
  { valor: "5", curto: "sáb", nome: "sábado" },
  { valor: "6", curto: "dom", nome: "domingo" },
]

const PRESET_SEMANA = "0,1,2,3,4"
const PRESET_TODOS = "0,1,2,3,4,5,6"

function formatarDias(csv) {
  const partes = (csv || "").split(",").map((d) => d.trim()).filter(Boolean)
  if (partes.length === 0) return "nenhum dia"
  if (partes.length === 7) return "todos os dias"
  const ordenados = [...partes].sort()
  if (ordenados.join(",") === PRESET_SEMANA) return "seg a sex"
  return ordenados
    .map((v) => DIAS.find((d) => d.valor === v)?.curto || v)
    .join(", ")
}

function formatarDataHora(iso) {
  if (!iso) return "nunca executado"
  try {
    const d = new Date(iso.endsWith("Z") ? iso : iso + "Z")
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
  } catch {
    return iso
  }
}

const formInicial = {
  name: "",
  client_id: null,
  hora: "08:00",
  dias_semana: PRESET_SEMANA,
  mode: "homologacao",
  is_active: true,
}

export function Schedules() {
  const [schedules, setSchedules] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [notification, setNotification] = useState({ type: "", text: "" })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [toDelete, setToDelete] = useState(null)
  const [formData, setFormData] = useState(formInicial)
  const [fieldErrors, setFieldErrors] = useState({})

  async function loadData() {
    setLoading(true)
    try {
      const [lista, clientList] = await Promise.all([
        schedulesApi.list(),
        clientsApi.list().catch(() => []),
      ])
      setSchedules(lista || [])
      setClients(clientList || [])
    } catch (err) {
      setNotification({ type: "error", text: err.message || "falha ao carregar agendamentos" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  function handleOpenCreate() {
    setEditing(null)
    setFormData(formInicial)
    setFieldErrors({})
    setDialogOpen(true)
  }

  function handleOpenEdit(s) {
    setEditing(s)
    setFieldErrors({})
    setFormData({
      name: s.name || "",
      client_id: s.client_id !== undefined ? s.client_id : null,
      hora: s.hora || "08:00",
      dias_semana: s.dias_semana || PRESET_SEMANA,
      mode: s.mode || "homologacao",
      is_active: s.is_active !== undefined ? s.is_active : true,
    })
    setDialogOpen(true)
  }

  function toggleDia(valor) {
    const atuais = (formData.dias_semana || "").split(",").map((d) => d.trim()).filter(Boolean)
    const novos = atuais.includes(valor)
      ? atuais.filter((d) => d !== valor)
      : [...atuais, valor]
    novos.sort()
    setFormData({ ...formData, dias_semana: novos.join(",") })
    if (fieldErrors.dias_semana) setFieldErrors({ ...fieldErrors, dias_semana: null })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const errors = {}
    if (!formData.hora?.trim()) errors.hora = "informe o horário"
    if (!(formData.dias_semana || "").trim()) errors.dias_semana = "selecione ao menos um dia"

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setNotification({ type: "error", text: "preencha os campos destacados" })
      return
    }

    setFieldErrors({})
    setActionLoading(true)
    setNotification({ type: "", text: "" })
    try {
      const payload = {
        ...formData,
        name: formData.name?.trim() || "Agendamento",
        client_id: formData.client_id ? Number(formData.client_id) : null,
      }
      if (editing) {
        await schedulesApi.update(editing.id, payload)
        setNotification({ type: "info", text: "agendamento atualizado" })
      } else {
        await schedulesApi.create(payload)
        setNotification({ type: "info", text: "agendamento criado" })
      }
      setDialogOpen(false)
      await loadData()
    } catch (err) {
      setNotification({ type: "error", text: err.message || "falha ao salvar agendamento" })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleToggle(s) {
    setActionLoading(true)
    try {
      await schedulesApi.toggle(s.id)
      await loadData()
    } catch (err) {
      setNotification({ type: "error", text: err.message || "falha ao alterar status" })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleConfirmDelete() {
    if (!toDelete) return
    setActionLoading(true)
    try {
      await schedulesApi.delete(toDelete.id)
      setNotification({ type: "info", text: "agendamento removido" })
      setToDelete(null)
      await loadData()
    } catch (err) {
      setNotification({ type: "error", text: err.message || "falha ao remover agendamento" })
    } finally {
      setActionLoading(false)
    }
  }

  function nomeCliente(clientId) {
    if (!clientId) return "cliente padrão"
    const c = clients.find((x) => String(x.id) === String(clientId))
    return c ? c.name : `cliente #${clientId}`
  }

  const diasSelecionados = (formData.dias_semana || "").split(",").map((d) => d.trim()).filter(Boolean)

  return (
    <div className="clients-page-container">
      {notification.text && (
        <div className={notification.type === "error" ? "alert-error" : "alert-info"}>
          {notification.text}
        </div>
      )}

      <div className="card clients-main-card">
        <div className="card-header clients-header">
          <div className="clients-header-info">
            <h3 className="card-title">agendamentos automáticos</h3>
            <p className="card-desc">
              defina dias e horários fixos para o robô iniciar sozinho — a execução acontece no app do computador, com ele aberto
            </p>
          </div>

          <div className="clients-header-actions">
            <Button onClick={handleOpenCreate} className="btn-create-client">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>novo agendamento</span>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="clients-grid">
            <div className="client-card"><Skeleton variant="row" /></div>
            <div className="client-card"><Skeleton variant="row" /></div>
          </div>
        ) : schedules.length === 0 ? (
          <div className="empty-state">
            <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span className="empty-state-title">nenhum agendamento criado</span>
            <span className="empty-state-desc">
              crie um agendamento para o robô buscar vagas sozinho em horários fixos, sem precisar apertar iniciar
            </span>
            <Button size="sm" onClick={handleOpenCreate} style={{ marginTop: "8px" }}>
              criar primeiro agendamento
            </Button>
          </div>
        ) : (
          <div className="clients-grid">
            {schedules.map((s) => (
              <div key={s.id} className={`client-card ${s.is_active ? "is-active" : "is-inactive"}`}>
                <div className="client-card-header">
                  <div className="client-identity">
                    <div className={`client-avatar-badge ${s.is_active ? "avatar-active" : "avatar-inactive"}`}>
                      {(s.hora || "00:00").split(":")[0]}
                    </div>
                    <div className="client-name-group">
                      <h4 className="client-card-name" title={s.name}>{s.name || "Agendamento"}</h4>
                      <span className="client-card-operator">
                        {s.hora} • {formatarDias(s.dias_semana)}
                      </span>
                    </div>
                  </div>

                  <div className="client-status-wrapper">
                    <StatusBadge status={s.is_active ? "ativo" : "inativo"} />
                  </div>
                </div>

                <div className="client-card-body">
                  <div className="client-info-grid">
                    <div className="client-info-row">
                      <span className="client-info-label">cliente:</span>
                      <span className="client-info-val">{nomeCliente(s.client_id)}</span>
                    </div>

                    <div className="client-info-row">
                      <span className="client-info-label">modo:</span>
                      <span
                        className={`client-tag-badge ${s.mode === "producao" ? "tag-warning" : "tag-info"}`}
                        title={s.mode === "producao" ? "agenda vagas de verdade" : "apenas simula, não confirma vagas"}
                      >
                        {s.mode === "producao" ? "produção" : "homologação"}
                      </span>
                    </div>

                    <div className="client-info-row">
                      <span className="client-info-label">última execução:</span>
                      <span className="client-info-val">{formatarDataHora(s.last_run_at)}</span>
                    </div>

                    {s.last_result && (
                      <div className="client-info-row">
                        <span className="client-info-label">resultado:</span>
                        <span className="client-info-val" title={s.last_result}>{s.last_result}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="client-card-footer">
                  <Button
                    variant="outline"
                    size="sm"
                    className="card-action-btn"
                    onClick={() => handleOpenEdit(s)}
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
                    onClick={() => handleToggle(s)}
                    disabled={actionLoading}
                  >
                    {s.is_active ? (
                      <>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="6" y="4" width="4" height="16" />
                          <rect x="14" y="4" width="4" height="16" />
                        </svg>
                        <span>pausar</span>
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
                    onClick={() => setToDelete(s)}
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
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent style={{ maxWidth: "540px" }}>
          <DialogHeader>
            <DialogTitle>
              {editing ? "editar agendamento" : "novo agendamento automático"}
            </DialogTitle>
            <DialogDescription>
              o robô iniciará sozinho nos dias e no horário escolhidos, pelo app do computador
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="ag_name">nome do agendamento</label>
                <input
                  id="ag_name"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ex: busca da manhã"
                  disabled={actionLoading}
                  autoFocus
                />
              </div>

              <div className="grid-cols-2">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="ag_hora">horário *</label>
                  <input
                    id="ag_hora"
                    type="time"
                    className={`form-input ${fieldErrors.hora ? "input-error" : ""}`}
                    value={formData.hora}
                    onChange={(e) => {
                      setFormData({ ...formData, hora: e.target.value })
                      if (fieldErrors.hora) setFieldErrors({ ...fieldErrors, hora: null })
                    }}
                    disabled={actionLoading}
                  />
                  {fieldErrors.hora && <span className="field-error-message">{fieldErrors.hora}</span>}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" htmlFor="ag_client">cliente</label>
                  <select
                    id="ag_client"
                    className="form-select"
                    value={formData.client_id === null || formData.client_id === undefined ? "" : String(formData.client_id)}
                    onChange={(e) => setFormData({ ...formData, client_id: e.target.value ? Number(e.target.value) : null })}
                    disabled={actionLoading}
                  >
                    <option value="">cliente padrão</option>
                    {clients.map((c) => (
                      <option key={c.id} value={String(c.id)}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px", flexWrap: "wrap", gap: "6px" }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>dias da semana *</label>
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="date-preset-btn"
                      style={{ padding: "3px 8px", fontSize: "11px" }}
                      onClick={() => setFormData({ ...formData, dias_semana: PRESET_SEMANA })}
                    >
                      seg a sex
                    </button>
                    <button
                      type="button"
                      className="date-preset-btn"
                      style={{ padding: "3px 8px", fontSize: "11px" }}
                      onClick={() => setFormData({ ...formData, dias_semana: PRESET_TODOS })}
                    >
                      todos os dias
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {DIAS.map((d) => {
                    const marcado = diasSelecionados.includes(d.valor)
                    return (
                      <button
                        key={d.valor}
                        type="button"
                        className={`segmented-btn ${marcado ? "active" : ""}`}
                        onClick={() => toggleDia(d.valor)}
                        disabled={actionLoading}
                        title={d.nome}
                        style={{ minWidth: "48px" }}
                      >
                        {d.curto}
                      </button>
                    )
                  })}
                </div>
                {fieldErrors.dias_semana && <span className="field-error-message">{fieldErrors.dias_semana}</span>}
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label" htmlFor="ag_mode">modo de execução</label>
                <select
                  id="ag_mode"
                  className="form-select"
                  value={formData.mode}
                  onChange={(e) => setFormData({ ...formData, mode: e.target.value })}
                  disabled={actionLoading}
                >
                  <option value="homologacao">homologação (apenas simula)</option>
                  <option value="producao">produção (agenda de verdade)</option>
                </select>
              </div>

              {formData.mode === "producao" && (
                <div className="alert-error" style={{ marginBottom: 0 }}>
                  atenção: em produção o robô agenda vagas de verdade sem ninguém acompanhando.
                  confirme os dados do cliente antes de ativar.
                </div>
              )}

              <label className="form-checkbox-group" style={{ marginBottom: 0 }}>
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  disabled={actionLoading}
                />
                <span className="form-label" style={{ cursor: "pointer" }}>agendamento ativo</span>
              </label>

              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                o robô roda no app do computador, então ele precisa estar aberto no horário marcado.
                se o computador estiver desligado, o agendamento ainda roda ao abrir o app — desde que
                o atraso seja de até 30 minutos.
              </p>

              <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                se o robô já estiver rodando na hora marcada, este agendamento é pulado e registrado —
                nunca interrompe uma execução em andamento.
              </p>
            </div>

            <DialogFooter style={{ marginTop: "16px" }}>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={actionLoading}
              >
                cancelar
              </Button>
              <Button type="submit" disabled={actionLoading}>
                {actionLoading ? "salvando..." : editing ? "atualizar agendamento" : "criar agendamento"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>remover agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              deseja remover "{toDelete?.name}"? o robô deixará de iniciar sozinho nesse horário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setToDelete(null)}>
              cancelar
            </AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={handleConfirmDelete}>
              confirmar remoção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
