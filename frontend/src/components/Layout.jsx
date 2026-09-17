import React, { useState, useEffect, useRef } from "react"
import { App as CapApp } from "@capacitor/app"
import { Sidebar } from "./Sidebar"
import { Header } from "./Header"
import { BottomNav } from "./BottomNav"
import { PullToRefresh } from "./PullToRefresh"
import { Dashboard } from "../pages/Dashboard"
import { Clients } from "../pages/Clients"
import { Settings } from "../pages/Settings"
import { Users } from "../pages/Users"
import { Comprovantes } from "../pages/Comprovantes"
import { Schedules } from "../pages/Schedules"

export function Layout({ user, onLogout, theme, onToggleTheme }) {
  const isMaster = user && user.role === "master"
  const [currentTab, setCurrentTab] = useState("dashboard")
  const [tabHistory, setTabHistory] = useState(["dashboard"])
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("sidebar_collapsed") === "true"
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const lastBackPressRef = useRef(0)
  const [toastMessage, setToastMessage] = useState("")

  function handleSelectTab(tab) {
    if (tab === currentTab) return
    setTabHistory((prev) => [...prev, tab])
    setCurrentTab(tab)
    if (mobileOpen) setMobileOpen(false)
  }

  useEffect(() => {
    if (!isMaster && (currentTab === "clients" || currentTab === "settings" || currentTab === "users")) {
      setCurrentTab("dashboard")
      setTabHistory(["dashboard"])
    }
  }, [isMaster, currentTab])

  useEffect(() => {
    let handlerPromise = null
    try {
      handlerPromise = CapApp.addListener("backButton", () => {
        if (mobileOpen) {
          setMobileOpen(false)
          return
        }

        const openModals = document.querySelectorAll("[data-state='open'], .dialog-overlay, .modal-open")
        if (openModals.length > 0) {
          const closeBtn = document.querySelector("[data-state='open'] button[aria-label='Close'], [data-state='open'] .dialog-close")
          if (closeBtn) {
            closeBtn.click()
            return
          }
        }

        if (tabHistory.length > 1) {
          const newHistory = [...tabHistory]
          newHistory.pop()
          const prevTab = newHistory[newHistory.length - 1]
          setTabHistory(newHistory)
          setCurrentTab(prevTab || "dashboard")
          return
        }

        if (currentTab !== "dashboard") {
          setCurrentTab("dashboard")
          setTabHistory(["dashboard"])
          return
        }

        const now = Date.now()
        if (now - lastBackPressRef.current < 2000) {
          CapApp.exitApp()
        } else {
          lastBackPressRef.current = now
          setToastMessage("pressione novamente para sair")
          setTimeout(() => setToastMessage(""), 2000)
        }
      })
    } catch {}

    return () => {
      if (handlerPromise && typeof handlerPromise.then === "function") {
        handlerPromise
          .then((handle) => {
            if (handle && typeof handle.remove === "function") {
              handle.remove()
            }
          })
          .catch(() => {})
      }
    }
  }, [mobileOpen, tabHistory, currentTab])

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

  async function handleGlobalRefresh() {
    window.dispatchEvent(new CustomEvent("cproeis:refresh-view", { detail: { tab: currentTab } }))
    await new Promise((r) => setTimeout(r, 600))
  }

  const titles = {
    dashboard: "painel de controle",
    clients: "gestão de clientes",
    settings: "configurações do sistema",
    users: "gestão de operadores",
    comprovantes: "comprovantes de agendamento",
    schedules: "agendamentos automáticos"
  }

  return (
    <div className="app-wrapper">
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        user={user}
        onLogout={onLogout}
        theme={theme}
        onToggleTheme={onToggleTheme}
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
          user={user}
        />

        <PullToRefresh onRefresh={handleGlobalRefresh}>
          <main className="main-scroll-content">
            {currentTab === "dashboard" && <Dashboard user={user} onNavigateTab={handleSelectTab} />}
            {currentTab === "clients" && <Clients />}
            {currentTab === "settings" && <Settings />}
            {currentTab === "users" && <Users currentUser={user} />}
            {currentTab === "comprovantes" && <Comprovantes />}
            {currentTab === "schedules" && <Schedules />}
          </main>
        </PullToRefresh>

        <BottomNav
          currentTab={currentTab}
          onSelectTab={handleSelectTab}
          user={user}
          onLogout={onLogout}
        />

        {toastMessage && (
          <div className="app-toast-back">
            {toastMessage}
          </div>
        )}
      </div>
    </div>
  )
}
