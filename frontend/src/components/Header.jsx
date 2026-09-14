import React, { useState, useEffect } from "react"
import { syncApi } from "../api/client"
import { getSyncQueue } from "../api/sync"

export function Header({ title, onToggleSidebar, sidebarCollapsed, theme, onToggleTheme, onLogout }) {
  const [serverOnline, setServerOnline] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncMsg, setSyncMsg] = useState(null)

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
    setSyncMsg(null)
    try {
      const result = await syncApi.sync()
      setServerOnline(true)
      updateQueueCount()
      setSyncMsg(`${result.syncedCount} itens sincronizados`)
      setTimeout(() => setSyncMsg(null), 3000)
    } catch (err) {
      setSyncMsg(err.message || "falha na sincronização")
      setTimeout(() => setSyncMsg(null), 3000)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <header className="top-navbar">
      <div className="top-navbar-left">
        <button
          className="sidebar-toggle-btn"
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? "expandir menu lateral" : "recolher menu lateral"}
          aria-label="alternar menu lateral"
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
        <span className={`badge-pill ${serverOnline ? "badge-success" : "badge-homologacao"}`} style={{ fontSize: "11px" }}>
          {serverOnline ? "nuvem conectada" : "modo offline"}
        </span>

        <button
          type="button"
          className="btn btn-secondary"
          style={{ padding: "5px 12px", fontSize: "11px", height: "auto" }}
          onClick={handleSync}
          disabled={syncing}
          title="sincronizar dados salvos localmente com a nuvem"
        >
          {syncing ? "sincronizando..." : pendingCount > 0 ? `sincronizar nuvem (${pendingCount})` : "sincronizar nuvem"}
        </button>

        {syncMsg && (
          <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            {syncMsg}
          </span>
        )}

        <button
          className="theme-pill-btn"
          onClick={onToggleTheme}
        >
          {theme === "light" ? "tema escuro" : "tema claro"}
        </button>

        <button
          className="logout-pill-btn"
          onClick={onLogout}
          title="encerrar sessão"
        >
          sair
        </button>
      </div>
    </header>
  )
}
