import React, { useState, useEffect } from "react"
import { syncApi } from "../api/client"
import { getSyncQueue } from "../api/sync"
import { APP_VERSION } from "../version"

export function Sidebar({ currentTab, onSelectTab, user, onLogout, theme, onToggleTheme, collapsed, onToggleCollapse, mobileOpen, onCloseMobile }) {
  const isMaster = user && user.role === "master"
  const userInitial = (user?.name || user?.email || "U").charAt(0).toUpperCase()

  const [serverOnline, setServerOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  function updateQueueCount() {
    const queue = getSyncQueue()
    setPendingCount(queue.length)
  }

  useEffect(() => {
    async function ping() {
      const isOnline = await syncApi.checkOnline()
      setServerOnline(isOnline)
      updateQueueCount()
    }
    ping()
    const interval = setInterval(ping, 10000)

    function handleQueueUpdated() {
      updateQueueCount()
    }
    window.addEventListener("cproeis:sync-queue-updated", handleQueueUpdated)

    return () => {
      clearInterval(interval)
      window.removeEventListener("cproeis:sync-queue-updated", handleQueueUpdated)
    }
  }, [])

  async function handleSync() {
    if (syncing) return
    setSyncing(true)
    try {
      await syncApi.sync()
      setServerOnline(true)
      updateQueueCount()
    } catch (err) {
    } finally {
      setSyncing(false)
    }
  }

  function handleNavClick(tab) {
    onSelectTab(tab)
    if (onCloseMobile) {
      onCloseMobile()
    }
  }

  return (
    <>
      {mobileOpen && <div className="sidebar-overlay" onClick={onCloseMobile} />}

      <aside className={`app-sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
        <div className="sidebar-top">
          <div className="sidebar-brand-group">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span className="sidebar-brand-text">cproeis</span>
          </div>

          <button
            className="sidebar-toggle-btn"
            onClick={onToggleCollapse}
            title={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          >
            {collapsed ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            )}
          </button>
        </div>

        <nav className="sidebar-navigation">
          <button
            className={`sidebar-nav-btn ${currentTab === "dashboard" ? "active" : ""}`}
            onClick={() => handleNavClick("dashboard")}
            title="Painel de controle"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <rect width="7" height="9" x="3" y="3" rx="1" />
              <rect width="7" height="5" x="14" y="3" rx="1" />
              <rect width="7" height="9" x="14" y="12" rx="1" />
              <rect width="7" height="5" x="3" y="16" rx="1" />
            </svg>
            <span>painel</span>
          </button>

          {isMaster && (
            <button
              className={`sidebar-nav-btn ${currentTab === "clients" ? "active" : ""}`}
              onClick={() => handleNavClick("clients")}
              title="Gestão de clientes"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              <span>clientes</span>
            </button>
          )}

          {isMaster && (
            <button
              className={`sidebar-nav-btn ${currentTab === "settings" ? "active" : ""}`}
              onClick={() => handleNavClick("settings")}
              title="Configurações do sistema"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span>configurações</span>
            </button>
          )}

          {isMaster && (
            <button
              className={`sidebar-nav-btn ${currentTab === "users" ? "active" : ""}`}
              onClick={() => handleNavClick("users")}
              title="Gestão de operadores"
            >
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              <span>operadores</span>
            </button>
          )}

          <button
            className={`sidebar-nav-btn ${currentTab === "schedules" ? "active" : ""}`}
            onClick={() => handleNavClick("schedules")}
            title="Agendamentos automáticos"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <span>agendamentos</span>
          </button>

          <button
            className={`sidebar-nav-btn ${currentTab === "comprovantes" ? "active" : ""}`}
            onClick={() => handleNavClick("comprovantes")}
            title="Relatórios e vagas agendadas"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span>relatórios & vagas</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          {/* Ações Rápidas (Sync, Tema, Sair) */}
          <div className="sidebar-system-box">
            <div className="sidebar-actions-row">
              <button
                type="button"
                className={`sidebar-mini-action-btn ${syncing ? "is-syncing" : ""}`}
                onClick={handleSync}
                disabled={syncing}
                title={syncing ? "Sincronizando..." : pendingCount > 0 ? `Sincronizar (${pendingCount} pendentes)` : "Sincronizar com a nuvem"}
                aria-label="Sincronizar com a nuvem"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                </svg>
                {!collapsed && <span>sync{pendingCount > 0 ? ` (${pendingCount})` : ""}</span>}
              </button>

              <button
                type="button"
                className="sidebar-mini-action-btn"
                onClick={onToggleTheme}
                title={theme === "light" ? "Mudar para tema escuro" : "Mudar para tema claro"}
                aria-label="Alternar tema"
              >
                {theme === "light" ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                {!collapsed && <span>{theme === "light" ? "escuro" : "claro"}</span>}
              </button>

              <button
                type="button"
                className="sidebar-mini-action-btn sidebar-logout-btn"
                onClick={onLogout}
                title="Encerrar sessão"
                aria-label="Encerrar sessão"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                {!collapsed && <span>sair</span>}
              </button>
            </div>
          </div>

          <div className="user-profile-row" title={`${user?.name || user?.email} (${user?.role || "operador"}) • v${APP_VERSION}`}>
            <div className="user-avatar-circle">
              {userInitial}
            </div>
            <div className="user-meta-column">
              <span className="user-name-text">{user?.name || user?.email}</span>
              <span className="user-role-text">{user?.role === "master" ? "master admin" : "operador"} • v{APP_VERSION}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

