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

export function Clients() {
  const [clients, setClients] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [clientToDelete, setClientToDelete] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [notification, setNotification] = useState({ type: "", text: "" })

  const initialFormState = {
    name: "",
    document_type: "CPF",
    document: "",
    password: "",
    system_user: "",
    system_password: "",
    convenio: "HCPM - RAS",
    preferred_events: "",
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
    setDialogOpen(true)
  }

  function handleOpenEdit(client) {
    setEditingClient(client)
    setFormData({
      name: client.name,
      document_type: client.document_type || "CPF",
      document: client.document,
      password: client.password,
      system_user: client.system_user || "",
      system_password: "",
      convenio: client.convenio || "HCPM - RAS",
      preferred_events: client.preferred_events || "",
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
    if (!formData.name || !formData.document || !formData.password) {
      setNotification({ type: "error", text: "preencha nome, documento e senha" })
      return
    }

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

  return (
    <div>
      {notification.text && (
        <div className={notification.type === "error" ? "alert-error" : "alert-info"}>
          {notification.text}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">gestão de clientes e perfis</h3>
            <p className="card-desc">cadastre múltiplos clientes com suas credenciais, período e preferências individuais</p>
          </div>

          <Button onClick={handleOpenCreate}>
            cadastrar novo cliente
          </Button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>nome</th>
                <th>documento</th>
                <th>login no sistema</th>
                <th>convênio</th>
                <th>eventos prioritários</th>
                <th>período / meta de vagas</th>
                <th>status</th>
                <th>ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  <tr><td colSpan="8"><Skeleton variant="row" /></td></tr>
                  <tr><td colSpan="8"><Skeleton variant="row" /></td></tr>
                  <tr><td colSpan="8"><Skeleton variant="row" /></td></tr>
                </>
              ) : clients.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                    nenhum cliente cadastrado no momento
                  </td>
                </tr>
              ) : (
                clients.map((c) => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td><MaskedText text={c.document} /></td>
                    <td>
                      {c.system_user ? (
                        <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                          {c.system_user}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>apenas master</span>
                      )}
                    </td>
                    <td>{c.convenio || "padrão"}</td>
                    <td style={{ maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.preferred_events || "todos"}
                    </td>
                    <td>
                      <div>
                        {c.tipo_data === "intervalo" && c.data_inicio && c.data_fim ? (
                          <span style={{ fontWeight: 500 }}>{c.data_inicio} até {c.data_fim}</span>
                        ) : (
                          <span>+{c.days_forward_initial} a {c.days_forward_max}d</span>
                        )}
                        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                          meta: <strong style={{ color: "var(--text-primary)" }}>{c.meta_vagas || 1} vaga(s)</strong> ({c.interval_seconds}s)
                        </div>
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={c.is_active ? "ativo" : "inativo"} />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(c)}
                          disabled={actionLoading}
                        >
                          editar
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStatus(c)}
                          disabled={actionLoading}
                        >
                          {c.is_active ? "desativar" : "ativar"}
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => setClientToDelete(c)}
                          disabled={actionLoading}
                        >
                          remover
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
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
            <div className="grid-cols-3" style={{ marginBottom: "12px" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="cli_name">nome do cliente</label>
                <input
                  id="cli_name"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="ex: Dr. Lucas"
                  disabled={actionLoading}
                  autoFocus
                />
              </div>

              <div className="form-group">
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

              <div className="form-group">
                <label className="form-label" htmlFor="cli_doc">número documento</label>
                <DocumentInput
                  id="cli_doc"
                  value={formData.document}
                  onChange={(e) => setFormData({ ...formData, document: e.target.value })}
                  placeholder="000.000.000-00"
                  disabled={actionLoading}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: "12px" }}>
              <label className="form-label" htmlFor="cli_pass">senha do portal proeis</label>
              <PasswordInput
                id="cli_pass"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="senha do portal proeis"
                disabled={actionLoading}
              />
            </div>

            <div style={{ padding: "12px", backgroundColor: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                <span className="form-label" style={{ fontWeight: 600, marginBottom: 0 }}>acesso do cliente ao sistema</span>
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

            <div className="form-group" style={{ marginBottom: "12px" }}>
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

            <div className="form-group" style={{ marginBottom: "12px" }}>
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

            <div style={{ display: "flex", gap: "20px", marginBottom: "16px", flexWrap: "wrap", alignItems: "center" }}>
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

            <div style={{ padding: "12px", backgroundColor: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span className="form-label" style={{ fontWeight: 600, marginBottom: 0 }}>regra de datas pesquisadas:</span>
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
            </div>

            <div className="grid-cols-3" style={{ marginBottom: "16px" }}>
              <div className="form-group">
                <label className="form-label" htmlFor="cli_meta">meta de vagas</label>
                <input
                  id="cli_meta"
                  type="number"
                  min="1"
                  className="form-input"
                  value={formData.meta_vagas}
                  onChange={(e) => setFormData({ ...formData, meta_vagas: parseInt(e.target.value) || 1 })}
                  disabled={actionLoading}
                  placeholder="ex: 5"
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="cli_interval">intervalo (s)</label>
                <input
                  id="cli_interval"
                  type="number"
                  className="form-input"
                  value={formData.interval_seconds}
                  onChange={(e) => setFormData({ ...formData, interval_seconds: parseInt(e.target.value) || 1 })}
                  disabled={actionLoading}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="cli_attempts">tentativas</label>
                <input
                  id="cli_attempts"
                  type="number"
                  className="form-input"
                  value={formData.max_attempts}
                  onChange={(e) => setFormData({ ...formData, max_attempts: parseInt(e.target.value) || 1 })}
                  disabled={actionLoading}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={actionLoading}
              >
                cancelar
              </Button>
              <Button
                type="submit"
                disabled={actionLoading}
              >
                {actionLoading ? "salvando..." : editingClient ? "atualizar cliente" : "salvar cliente"}
              </Button>
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
    </div>
  )
}
