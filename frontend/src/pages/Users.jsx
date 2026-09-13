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
  const [userToDelete, setUserToDelete] = useState(null)
  const [newUser, setNewUser] = useState({
    email: "",
    name: "",
    password: "",
    role: "operador"
  })
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

  async function handleCreateUser(e) {
    e.preventDefault()
    if (!newUser.email || !newUser.password) {
      setNotification({ type: "error", text: "preencha email e senha" })
      return
    }

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
            <p className="card-desc">cadastre novos operadores ou altere permissões do sistema</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger render={<Button>cadastrar novo usuário</Button>} />
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
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="user_email">email</label>
                  <input
                    id="user_email"
                    type="email"
                    className="form-input"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="operador@exemplo.com"
                    disabled={actionLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="user_password">senha</label>
                  <PasswordInput
                    id="user_password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="senha de acesso"
                    disabled={actionLoading}
                  />
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
                    disabled={actionLoading}
                  >
                    {actionLoading ? "salvando..." : "salvar cadastro"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>id</th>
                <th>nome</th>
                <th>email</th>
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
                  <td colSpan="6" style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                    nenhum usuário cadastrado
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>#{u.id}</td>
                    <td>{u.name || "-"}</td>
                    <td>{u.email}</td>
                    <td>{u.role === "master" ? "administrador master" : "operador"}</td>
                    <td>
                      <StatusBadge status={u.is_active ? "ativo" : "inativo"} />
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: "8px" }}>
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
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>conta atual</span>
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
