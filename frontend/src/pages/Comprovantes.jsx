import React, { useState, useEffect } from "react"
import { comprovantesApi } from "../api/client"
import { Skeleton } from "../components/Skeleton"

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

  async function handleDownload(filename) {
    setDownloadingFile(filename)
    setErrorMsg("")
    try {
      const token = localStorage.getItem("auth_token")
      const headers = {}
      if (token) {
        headers["Authorization"] = `Bearer ${token}`
      }

      const response = await fetch(`/api/comprovantes/${encodeURIComponent(filename)}`, {
        headers
      })

      if (!response.ok) {
        throw new Error("falha ao baixar o arquivo")
      }

      const blob = await response.blob()
      const downloadUrl = window.URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = downloadUrl
      link.download = filename
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
    <div className="content-body">
      {errorMsg && <div className="alert-error">{errorMsg}</div>}

      <div className="card">
        <div className="card-header">
          <div>
            <h3 className="card-title">comprovantes salvos</h3>
            <p className="card-desc">documentos em PDF gerados automaticamente após cada agendamento</p>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={loadComprovantes}
            disabled={loading}
          >
            atualizar lista
          </button>
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
                  <td colSpan="4" style={{ textAlign: "center", color: "var(--text-muted)", padding: "20px" }}>
                    nenhum comprovante gerado até o momento
                  </td>
                </tr>
              ) : (
                comprovantes.map((item) => (
                  <tr key={item.name}>
                    <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px" }}>{item.name}</td>
                    <td>{formatBytes(item.size_bytes)}</td>
                    <td>{item.modified_at}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDownload(item.name)}
                        disabled={downloadingFile === item.name}
                      >
                        {downloadingFile === item.name ? "baixando..." : "baixar PDF"}
                      </button>
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

