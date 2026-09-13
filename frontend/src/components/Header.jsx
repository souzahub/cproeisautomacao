import React, { useState, useEffect } from "react"

export function Header({ title, onToggleSidebar, sidebarCollapsed, theme, onToggleTheme, onLogout }) {
  const [serverOnline, setServerOnline] = useState(true)

  useEffect(() => {
    async function ping() {
      const serverUrl = localStorage.getItem("server_url") || "https://cprsautomacao.devsouza.online"
      try {
        const resp = await fetch(`${serverUrl}/api/health`, { method: "GET" })
        setServerOnline(resp.ok)
      } catch {
        setServerOnline(false)
      }
    }
    ping()
    const interval = setInterval(ping, 15000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header className="top-navbar">
      <div className="top-navbar-left">
        <button
          className="sidebar-toggle-btn"
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          aria-label="Alternar menu lateral"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>
        <h1 className="top-page-heading">{title}</h1>
      </div>

      <div className="top-navbar-actions">
        <span className={`badge-pill ${serverOnline ? "badge-success" : "badge-error"}`} style={{ fontSize: "11px" }}>
          {serverOnline ? "nuvem conectada" : "nuvem desconectada"}
        </span>

        <button
          className="theme-pill-btn"
          onClick={onToggleTheme}
        >
          {theme === "light" ? "tema escuro" : "tema claro"}
        </button>

        <button
          className="logout-pill-btn"
          onClick={onLogout}
          title="Encerrar sessão"
        >
          sair
        </button>
      </div>
    </header>
  )
}
