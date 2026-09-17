import React, { useState, useEffect } from "react"
import { authApi, getBaseUrl } from "./api/client"
import { syncWithCloud } from "./api/sync"
import { Login } from "./pages/Login"
import { Layout } from "./components/Layout"
import { Skeleton } from "./components/Skeleton"

export function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem("app_theme") || "dark"
    } catch {
      return "dark"
    }
  })

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme)
    try {
      localStorage.setItem("app_theme", theme)
    } catch {}
  }, [theme])

  function toggleTheme() {
    setTheme((prev) => (prev === "light" ? "dark" : "light"))
  }

  // no desktop os agendamentos disparam aqui na maquina (ip brasileiro),
  // entao o electron precisa saber o servidor e o token para consultar
  // os vencidos. sem usuario logado, o relogio fica desligado.
  useEffect(() => {
    if (typeof window === "undefined" || !window.electronAPI || !window.electronAPI.configurarAgenda) {
      return
    }
    try {
      const token = user ? localStorage.getItem("auth_token") : ""
      window.electronAPI.configurarAgenda(getBaseUrl(), token || "")
    } catch {}
  }, [user])

  useEffect(() => {
    async function checkAuth() {
      const token = localStorage.getItem("auth_token")
      if (!token) {
        setLoading(false)
        return
      }

      try {
        const userData = await authApi.getMe()
        setUser(userData)
      } catch (err) {
        localStorage.removeItem("auth_token")
        localStorage.removeItem("auth_user")
      } finally {
        setLoading(false)
      }
    }
    checkAuth()

    function handleOnline() {
      const token = localStorage.getItem("auth_token")
      if (token) {
        syncWithCloud(token).catch(() => {})
      }
    }
    window.addEventListener("online", handleOnline)
    return () => window.removeEventListener("online", handleOnline)
  }, [])

  function handleLogout() {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("auth_user")
    setUser(null)
  }

  if (loading) {
    return (
      <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
        <Skeleton variant="title" style={{ marginBottom: "20px" }} />
        <Skeleton variant="card" count={3} style={{ marginBottom: "16px" }} />
      </div>
    )
  }

  if (!user) {
    return <Login onLoginSuccess={setUser} theme={theme} onToggleTheme={toggleTheme} />
  }

  return <Layout user={user} onLogout={handleLogout} theme={theme} onToggleTheme={toggleTheme} />
}
