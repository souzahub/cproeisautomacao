import React, { useState, useEffect } from "react"
import { usersApi } from "../api/client"
import { StatusBadge } from "../components/StatusBadge"
import { Skeleton } from "../components/Skeleton"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog"
import {
  AlertDialog,
  AlertDialogTrigger,
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

export function Users({ currentUser }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [userToDelete, setUserToDelete] = useState(null)
  const [newUser, setNewUser] = useState({
    email: "",
    name: "",
    password: "",
    role: "operador"
  })
  const [editUserData, setEditUserData] = useState({
    id: null,
    email: "",
    name: "",
    password: "",
    role: "operador"
  })
  const [fieldErrors, setFieldErrors] = useState({})
  const [actionLoading, setActionLoading] = useState(false)
  const [notification, setNotification] = useState({ type: "", text: "" })

  async function loadUsers() {
    setLoading(true)
    try {
      const list = await usersApi.list()
      setUsers(list)
    } catch (err) {
      setNotification({ type: "error", text: err.message || "falha ao carregar lista de usuários" })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  function handleOpenCreate() {
    setNewUser({ email: "", name: "", password: "", role: "operador" })
    setFieldErrors({})
    setDialogOpen(true)
  }

  function handleOpenEdit(user) {
    setEditUserData({
      id: user.id,
      email: user.email || "",
      name: user.name || "",
      password: "",
      role: user.role || "operador"
    })
    setFieldErrors({})
    setEditDialogOpen(true)
  }

  async function handleCreateUser(e) {
    e.preventDefault()
    const errors = {}
    if (!newUser.email?.trim()) errors.email = "informe o usuário/e-mail de acesso"
    if (!newUser.password?.trim()) errors.password = "informe a senha de acesso"

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      setNotification({ type: "error", text: "preencha todos os campos destacados" })
      return
    }

    setFieldErrors({})
    setActionLoading(true)
    setNotification({ type: "", text: "" })
    try {
      await usersApi.create(newUser)
      setNewUser({ email: "", name: "", password: "", role: "operador" })
      setDialogOpen(false)
      setNotification({ type: "info", text: "novo usuário cadastrado" })
      await loadUsers()
    } catch (err) {
      setNotification({ type: "error", text: err.message || "falha ao criar usuário" })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleUpdateUser(e) {
    e.preventDefault()
    if (!editUserData.email) {
      setNotification({ type: "error", text: "o nome de usuário/login é obrigatório" })
      return
    }

    setActionLoading(true)
    setNotification({ type: "", text: "" })
    try {
      const payload = {
        name: editUserData.name,
        email: editUserData.email,
        role: editUserData.role
      }
      if (editUserData.password && editUserData.password.trim()) {
        payload.password = editUserData.password.trim()
      }
      const updated = await usersApi.update(editUserData.id, payload)
      if (currentUser && editUserData.id === currentUser.id) {
        localStorage.setItem("auth_user", JSON.stringify(updated))
      }
      setEditDialogOpen(false)
      setNotification({ type: "info", text: "usuário atualizado" })
      await loadUsers()
    } catch (err) {
      setNotification({ type: "error", text: err.message || "falha ao atualizar usuário" })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleToggleActive(user) {
    setActionLoading(true)
    try {
      await usersApi.update(user.id, { is_active: !user.is_active })
      await loadUsers()
    } catch (err) {
      setNotification({ type: "error", text: err.message || "falha ao alterar status" })
    } finally {
      setActionLoading(false)
    }
  }

  async function confirmDeleteUser() {
    if (!userToDelete) return
    setActionLoading(true)
    try {
      await usersApi.delete(userToDelete.id)
      setNotification({ type: "info", text: "usuário removido" })
      setUserToDelete(null)
      await loadUsers()
    } catch (err) {
      setNotification({ type: "error", text: err.message || "falha ao remover usuário" })
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
            <h3 className="card-title">gerenciamento de acessos</h3>
            <p className="card-desc">cadastre novos operadores, altere senhas ou permissões do sistema</p>
          </div>

          <Button onClick={() => setDialogOpen(true)}>
            cadastrar novo usuário
          </Button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>id</th>
                <th>nome</th>
                <th>usuário / login</th>
                <th>permissão</th>
                <th>status</th>
                <th>ações</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  <tr><td colSpan="6"><Skeleton variant="row" /></td></tr>
                  <tr><td colSpan="6"><Skeleton variant="row" /></td></tr>
                  <tr><td colSpan="6"><Skeleton variant="row" /></td></tr>
                </>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state">
                      <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                        <circle cx="12" cy="7" r="4" />
                      </svg>
                      <span className="empty-state-title">nenhum operador cadastrado</span>
                      <span className="empty-state-desc">cadastre novos operadores ou administradores para gerenciar os acessos à plataforma</span>
                      <Button size="sm" onClick={() => setDialogOpen(true)} style={{ marginTop: "8px" }}>
                        cadastrar primeiro usuário
                      </Button>
                    </div>
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>#{u.id}</td>
                    <td>{u.name || "-"}</td>
                    <td style={{ fontWeight: 500 }}>{u.email}</td>
                    <td>{u.role === "master" ? "administrador master" : "operador"}</td>
                    <td>
                      <StatusBadge status={u.is_active ? "ativo" : "inativo"} />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenEdit(u)}
                          disabled={actionLoading}
                        >
                          editar
                        </Button>

                        {u.id !== currentUser.id && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleActive(u)}
                              disabled={actionLoading}
                            >
                              {u.is_active ? "desativar" : "ativar"}
                            </Button>

                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => setUserToDelete(u)}
                              disabled={actionLoading}
                            >
                              remover
                            </Button>
                          </>
                        )}
                        {u.id === currentUser.id && (
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "4px" }}>sua conta</span>
                        )}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>cadastrar novo usuário</DialogTitle>
            <DialogDescription>
              preencha os dados do novo operador ou administrador
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateUser}>
            <div className="form-group">
              <label className="form-label" htmlFor="user_name">nome</label>
              <input
                id="user_name"
                className="form-input"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                placeholder="nome completo"
                disabled={actionLoading}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="user_email">usuário / login *</label>
              <input
                id="user_email"
                type="text"
                className={`form-input ${fieldErrors.email ? "input-error" : ""}`}
                value={newUser.email}
                onChange={(e) => {
                  setNewUser({ ...newUser, email: e.target.value })
                  if (fieldErrors.email) setFieldErrors({ ...fieldErrors, email: null })
                }}
                placeholder="ex: operador1 ou email"
                disabled={actionLoading}
                aria-invalid={fieldErrors.email ? "true" : undefined}
              />
              {fieldErrors.email && <span className="field-error-message">{fieldErrors.email}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="user_password">senha *</label>
              <PasswordInput
                id="user_password"
                value={newUser.password}
                onChange={(e) => {
                  setNewUser({ ...newUser, password: e.target.value })
                  if (fieldErrors.password) setFieldErrors({ ...fieldErrors, password: null })
                }}
                placeholder="senha de acesso"
                error={!!fieldErrors.password}
                disabled={actionLoading}
              />
              {fieldErrors.password && <span className="field-error-message">{fieldErrors.password}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="user_role">nível de permissão</label>
              <select
                id="user_role"
                className="form-select"
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                disabled={actionLoading}
              >
                <option value="operador">operador (executa bot e consulta vagas)</option>
                <option value="master">administrador master (controle total)</option>
              </select>
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
                loading={actionLoading}
              >
                salvar cadastro
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>editar usuário</DialogTitle>
            <DialogDescription>
              atualize o nome, usuário/login ou altere a senha de acesso
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUpdateUser}>
            <div className="form-group">
              <label className="form-label" htmlFor="edit_user_name">nome</label>
              <input
                id="edit_user_name"
                className="form-input"
                value={editUserData.name}
                onChange={(e) => setEditUserData({ ...editUserData, name: e.target.value })}
                placeholder="nome completo"
                disabled={actionLoading}
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit_user_email">usuário / login</label>
              <input
                id="edit_user_email"
                type="text"
                className="form-input"
                value={editUserData.email}
                onChange={(e) => setEditUserData({ ...editUserData, email: e.target.value })}
                placeholder="usuário de acesso"
                disabled={actionLoading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit_user_password">alterar senha (opcional)</label>
              <PasswordInput
                id="edit_user_password"
                value={editUserData.password}
                onChange={(e) => setEditUserData({ ...editUserData, password: e.target.value })}
                placeholder="deixe vazio para manter a senha atual"
                disabled={actionLoading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit_user_role">nível de permissão</label>
              <select
                id="edit_user_role"
                className="form-select"
                value={editUserData.role}
                onChange={(e) => setEditUserData({ ...editUserData, role: e.target.value })}
                disabled={actionLoading || editUserData.id === currentUser.id}
              >
                <option value="operador">operador (executa bot e consulta vagas)</option>
                <option value="master">administrador master (controle total)</option>
              </select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
                disabled={actionLoading}
              >
                cancelar
              </Button>
              <Button
                type="submit"
                disabled={actionLoading}
              >
                {actionLoading ? "salvando..." : "salvar alterações"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>remover usuário</AlertDialogTitle>
            <AlertDialogDescription>
              deseja remover o acesso de {userToDelete?.email}? esta ação não poderá ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setUserToDelete(null)}>
              cancelar
            </AlertDialogCancel>
            <AlertDialogAction variant="danger" onClick={confirmDeleteUser}>
              confirmar remoção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
