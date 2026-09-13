import React, { useState } from "react"
import { authApi } from "../api/client"
import { PasswordInput } from "../components/ui/password-input"

export function Login({ onLoginSuccess, theme, onToggleTheme }) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    if (!email || !password) {
      setError("preencha email e senha para continuar")
      return
    }

    setLoading(true)
    try {
      const data = await authApi.login(email, password)
      localStorage.setItem("auth_token", data.access_token)
      localStorage.setItem("auth_user", JSON.stringify(data.user))
      onLoginSuccess(data.user)
    } catch (err) {
      setError(err.message || "credenciais invalidas")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-split-container">
      <div className="login-left-panel">
        <div className="login-box">
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="18" x="3" y="3" rx="2" />
                  <path d="m9 12 2 2 4-4" />
                </svg>
                <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)" }}>cproeis automação</span>
              </div>

              {onToggleTheme && (
                <button
                  type="button"
                  className="btn btn-ghost btn-icon"
                  onClick={onToggleTheme}
                  title={theme === "light" ? "Alternar para tema escuro" : "Alternar para tema claro"}
                  aria-label="Alternar tema"
                  style={{ width: "36px", height: "36px" }}
                >
                  {theme === "light" ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  )}
                </button>
              )}
            </div>
            <h1 className="login-title">entrar na sua conta</h1>
            <p className="login-desc">informe seus dados para acessar o painel administrativo</p>
          </div>

          {error && <div className="alert-error">{error}</div>}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="email">email</label>
              <input
                id="email"
                type="email"
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="exemplo@dominio.com"
                disabled={loading}
                autoFocus
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="password">senha</label>
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="sua senha"
                disabled={loading}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "12px" }}>
              <label className="form-checkbox-group" style={{ margin: 0 }}>
                <input
                  type="checkbox"
                  className="form-checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span className="form-label" style={{ cursor: "pointer" }}>lembrar de mim</span>
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: "100%", marginTop: "4px" }}
              disabled={loading}
            >
              {loading ? "entrando..." : "acessar painel"}
            </button>
          </form>
        </div>
      </div>

      <div className="login-right-panel">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <path d="m9 12 2 2 4-4" />
          </svg>
          <span style={{ fontSize: "14px", fontWeight: 600 }}>painel de controle operacional</span>
        </div>

        <div style={{ maxWidth: "420px", display: "flex", flexDirection: "column", gap: "20px" }}>
          <h2 style={{ fontSize: "28px", fontWeight: 700, lineHeight: 1.25 }}>
            gerenciamento ágil e automação contínua de processos
          </h2>
          <div style={{ borderLeft: "2px solid rgba(255, 255, 255, 0.3)", paddingLeft: "16px" }}>
            <p style={{ fontSize: "14px", lineHeight: 1.5, opacity: 0.9 }}>
              centralização completa de vagas, usuários, modo de homologação e logs de execução em tempo real.
            </p>
          </div>
        </div>

        <div style={{ fontSize: "12px", opacity: 0.75 }}>
          cproeis v1.0.0
        </div>
      </div>
    </div>
  )
}
