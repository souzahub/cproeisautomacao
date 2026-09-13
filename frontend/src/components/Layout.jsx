import React, { useState, useEffect } from "react"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"
import { Dashboard } from "../pages/Dashboard"
import { Clients } from "../pages/Clients"
import { Settings } from "../pages/Settings"
import { Users } from "../pages/Users"
import { Comprovantes } from "../pages/Comprovantes"

export function Layout({ user, onLogout, theme, onToggleTheme }) {
  const [currentTab, setCurrentTab] = useState("dashboard")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("sidebar_collapsed") === "true"
  })
  const [mobileOpen, setMobileOpen] = useState(false)

  function toggleSidebar() {
    if (window.innerWidth <= 860) {
      setMobileOpen(!mobileOpen)
    } else {
      setSidebarCollapsed((prev) => {
        const next = !prev
        localStorage.setItem("sidebar_collapsed", next ? "true" : "false")
        return next
      })
    }
  }

  const titles = {
    dashboard: "painel de controle",
    clients: "gestão de clientes",
    settings: "configurações do sistema",
    users: "gestão de operadores",
    comprovantes: "comprovantes de agendamento"
  }

  return (
    <div className="app-wrapper">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        user={user}
        onLogout={onLogout}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="main-view-container">
        <Header
          title={titles[currentTab] || "painel"}
          onToggleSidebar={toggleSidebar}
          sidebarCollapsed={sidebarCollapsed}
          theme={theme}
          onToggleTheme={onToggleTheme}
          onLogout={onLogout}
        />

        <main className="main-scroll-content">
          {currentTab === "dashboard" && <Dashboard user={user} onNavigateTab={setCurrentTab} />}
          {currentTab === "clients" && <Clients />}
          {currentTab === "settings" && <Settings />}
          {currentTab === "users" && <Users currentUser={user} />}
          {currentTab === "comprovantes" && <Comprovantes />}
        </main>
      </div>
    </div>
  )
}
