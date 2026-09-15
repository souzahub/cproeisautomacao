import React, { useState, useEffect } from "react"
import { comprovantesApi, getBaseUrl } from "../api/client"
import { Skeleton } from "../components/Skeleton"
import { Button } from "../components/ui/button"

export function Comprovantes() {
  const [comprovantes, setComprovantes] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloadingFile, setDownloadingFile] = useState("")
  const [errorMsg, setErrorMsg] = useState("")

  async function loadComprovantes() {
    setLoading(true)
    try {
      const list = await comprovantesApi.list()
      setComprovantes(list)
    } catch (err) {
      setErrorMsg(err.message || "falha ao carregar lista de comprovantes")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadComprovantes()
  }, [])

  function formatBytes(bytes) {
    if (!bytes) return "0 B"
    const k = 1024
    const sizes = ["B", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i]
  }

  async function handleOpenOrDownload(item) {
    if (item.is_local && window.electronAPI && window.electronAPI.openComprovante) {
      const res = await window.electronAPI.openComprovante(item.local_path || item.name)
      if (res && res.success) return
    }

    setDownloadingFile(item.name)
    setErrorMsg("")
    try {
      const token = localStorage.getItem("auth_token")
      const headers = {}
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }

      const baseUrl = getBaseUrl()
      const response = await fetch(`${baseUrl}/api/comprovantes/${encodeURIComponent(item.name)}`, {
        headers
      })

      if (!response.ok) {
        throw new Error("falha ao baixar o arquivo")
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = item.name
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(downloadUrl)
    } catch (err) {
      setErrorMsg(err.message || "erro ao processar download")
    } finally {
      setDownloadingFile("")
    }
  }

  return (
    <div>
      {errorMsg && <div className="alert-error">{errorMsg}</div>}

      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">comprovantes salvos</h3>
            <p className="card-desc">documentos em PDF gerados automaticamente após cada agendamento</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadComprovantes}
            disabled={loading}
            loading={loading}
          >
            atualizar lista
          </Button>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>nome do arquivo</th>
                <th>tamanho</th>
                <th>data de geração</th>
                <th>ação</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <>
                  <tr><td colSpan="4"><Skeleton variant="row" /></td></tr>
                  <tr><td colSpan="4"><Skeleton variant="row" /></td></tr>
                  <tr><td colSpan="4"><Skeleton variant="row" /></td></tr>
                </>
              ) : comprovantes.length === 0 ? (
                <tr>
                  <td colSpan="4">
                    <div className="empty-state">
                      <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                      <span className="empty-state-title">nenhum comprovante gerado</span>
                      <span className="empty-state-desc">os comprovantes oficiais em PDF serão armazenados automaticamente quando as vagas forem agendadas</span>
                    </div>
                  </td>
                </tr>
              ) : (
                comprovantes.map((item) => (
                  <tr key={item.name}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>{item.name}</td>
                    <td>{formatBytes(item.size_bytes)}</td>
                    <td>{item.modified_at}</td>
                    <td>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleOpenOrDownload(item)}
                        disabled={downloadingFile === item.name}
                        loading={downloadingFile === item.name}
                      >
                        {item.is_local ? "abrir PDF" : "baixar PDF"}
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}


