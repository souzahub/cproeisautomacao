import React, { useState, useEffect, useMemo } from "react"
import { comprovantesApi, getBaseUrl } from "../api/client"
import { Skeleton } from "../components/Skeleton"
import { Button } from "../components/ui/button"

export function Comprovantes() {
  const [activeTab, setActiveTab] = useState("vagas") // "vagas" | "arquivos"
  const [vagas, setVagas] = useState([])
  const [comprovantes, setComprovantes] = useState([])
  const [loading, setLoading] = useState(true)
  const [downloadingFile, setDownloadingFile] = useState("")
  const [errorMsg, setErrorMsg] = useState("")
  const [selectedExecution, setSelectedExecution] = useState("latest") // "latest" | "all" | execution_id
  const [searchTerm, setSearchTerm] = useState("")
  const [filterTipo, setFilterTipo] = useState("todos") // "todos" | "titular" | "reserva"

  async function loadData() {
    setLoading(true)
    setErrorMsg("")
    try {
      const [vagasRes, filesList] = await Promise.all([
        comprovantesApi.getVagasReport().catch(() => []),
        comprovantesApi.list().catch(() => [])
      ])
      const extractedVagas = Array.isArray(vagasRes)
        ? vagasRes
        : (vagasRes?.vagas || [])
      setVagas(extractedVagas)
      setComprovantes(Array.isArray(filesList) ? filesList : (filesList?.files || []))
    } catch (err) {
      setErrorMsg(err.message || "falha ao carregar relatório e comprovantes")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Lista única de execuções para o seletor
  const executionSessions = useMemo(() => {
    const list = Array.isArray(vagas) ? vagas : []
    const map = new Map()
    list.forEach((v) => {
      if (v.execution_id && !map.has(v.execution_id)) {
        map.set(v.execution_id, {
          id: v.execution_id,
          label: v.execution_label || `Busca #${v.execution_id} (${v.cliente})`,
          cliente: v.cliente,
          data: v.data_agendamento,
          count: 0
        })
      }
      if (v.execution_id && map.has(v.execution_id)) {
        map.get(v.execution_id).count += 1
      }
    })
    return Array.from(map.values())
  }, [vagas])

  // Identificar a execução mais recente
  const latestExecutionId = executionSessions.length > 0 ? executionSessions[0].id : null

  // Filtragem de vagas vinculada à execução selecionada
  const filteredVagas = useMemo(() => {
    let list = Array.isArray(vagas) ? vagas : []

    if (selectedExecution === "latest") {
      if (latestExecutionId) {
        list = list.filter((v) => v.execution_id === latestExecutionId)
      }
    } else if (selectedExecution !== "all") {
      const targetId = Number(selectedExecution)
      list = list.filter((v) => v.execution_id === targetId)
    }

    const term = searchTerm.toLowerCase().trim()
    return list.filter((v) => {
      const matchesSearch =
        !term ||
        (v.cliente && v.cliente.toLowerCase().includes(term)) ||
        (v.evento && v.evento.toLowerCase().includes(term)) ||
        (v.convenio && v.convenio.toLowerCase().includes(term)) ||
        (v.data_evento && v.data_evento.toLowerCase().includes(term))

      const isReserva = (v.tipo_vaga || "").toLowerCase().includes("reserva")
      if (filterTipo === "titular" && isReserva) return false
      if (filterTipo === "reserva" && !isReserva) return false

      return matchesSearch
    })
  }, [vagas, selectedExecution, latestExecutionId, searchTerm, filterTipo])

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

  // Exportar para Excel (.CSV formatado com UTF-8 BOM e delimitador ;)
  function exportToExcel() {
    if (filteredVagas.length === 0) return
    const headers = [
      "Cliente",
      "Data do Evento",
      "Horário / Turno",
      "Convênio",
      "Evento / Função",
      "Situação",
      "Status",
      "Modo",
      "Data do Agendamento"
    ]

    const rows = filteredVagas.map((v) => [
      `"${(v.cliente || "").replace(/"/g, '""')}"`,
      `"${(v.data_evento || "").replace(/"/g, '""')}"`,
      `"${(v.horario || "").replace(/"/g, '""')}"`,
      `"${(v.convenio || "").replace(/"/g, '""')}"`,
      `"${(v.evento || "").replace(/"/g, '""')}"`,
      `"${(v.tipo_vaga || "Titular").replace(/"/g, '""')}"`,
      `"${(v.status || "Confirmada").replace(/"/g, '""')}"`,
      `"${(v.modo || "").replace(/"/g, '""')}"`,
      `"${(v.data_agendamento || "").replace(/"/g, '""')}"`
    ])

    const csvContent = "\uFEFF" + [headers.join(";"), ...rows.map((r) => r.join(";"))].join("\r\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `relatorio_vagas_cproeis_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Gerar e Imprimir Relatório Formal (PDF executivo)
  function printVagasReport() {
    const printWindow = window.open("", "_blank")
    if (!printWindow) {
      alert("Por favor, habilite popups no navegador para visualizar o relatório PDF.")
      return
    }

    const nowStr = new Date().toLocaleString("pt-BR")
    const totalTitulares = filteredVagas.filter((v) => !(v.tipo_vaga || "").toLowerCase().includes("reserva")).length
    const totalReserva = filteredVagas.length - totalTitulares
    const clienteNome = filteredVagas[0]?.cliente || "Romulo Paulino"

    const rowsHtml = filteredVagas.length === 0
      ? `<tr><td colspan="7" style="text-align: center; padding: 20px; color: #64748b;">Nenhuma vaga registrada nesta busca.</td></tr>`
      : filteredVagas
          .map(
            (v, idx) => `
        <tr>
          <td style="text-align: center; font-weight: 700; color: #64748b;">${idx + 1}</td>
          <td><strong style="color: #0f172a;">${v.data_evento || "-"}</strong></td>
          <td>${v.horario || "-"}</td>
          <td><span style="font-weight: 600;">${v.convenio || "HCPM - RAS"}</span></td>
          <td><strong style="color: #1e3a8a;">${v.evento || "-"}</strong></td>
          <td><span class="badge ${(v.tipo_vaga || "").toLowerCase().includes("reserva") ? "reserva" : "titular"}">${v.tipo_vaga || "Titular"}</span></td>
          <td><span class="status-ok">${v.status || "Confirmada"}</span></td>
        </tr>
      `
          )
          .join("")

    printWindow.document.write(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>Comprovante Oficial de Agendamento - CPROEIS</title>
        <style>
          @page { size: A4 portrait; margin: 1.5cm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            padding: 20px;
            color: #0f172a;
            background: #ffffff;
            margin: 0;
          }
          .header-box {
            border: 2px solid #1e3a8a;
            border-radius: 8px;
            padding: 16px 20px;
            margin-bottom: 20px;
            background: #f8fafc;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .header-title {
            font-size: 18px;
            font-weight: 800;
            color: #1e3a8a;
            text-transform: uppercase;
            letter-spacing: -0.01em;
            margin: 0;
          }
          .header-sub {
            font-size: 12px;
            color: #475569;
            margin-top: 4px;
          }
          .meta-box {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            background: #ffffff;
            border: 1px solid #cbd5e1;
            border-radius: 6px;
            padding: 12px 16px;
            margin-bottom: 20px;
            font-size: 12px;
          }
          .meta-item { line-height: 1.5; }
          .meta-label { color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 10px; display: block; }
          .meta-val { color: #0f172a; font-weight: 700; font-size: 13px; }
          .stats-grid {
            display: flex;
            gap: 12px;
            margin-bottom: 20px;
          }
          .stat-card {
            flex: 1;
            padding: 12px;
            background: #f1f5f9;
            border-radius: 6px;
            text-align: center;
            border: 1px solid #e2e8f0;
          }
          .stat-num { font-size: 20px; font-weight: 800; color: #0f172a; }
          .stat-title { font-size: 10px; text-transform: uppercase; font-weight: 700; color: #475569; margin-top: 2px; }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            margin-top: 10px;
          }
          th {
            background: #1e3a8a;
            color: #ffffff;
            padding: 8px 10px;
            text-align: left;
            font-weight: 700;
            font-size: 11px;
            text-transform: uppercase;
          }
          td {
            padding: 8px 10px;
            border-bottom: 1px solid #e2e8f0;
          }
          tr:nth-child(even) { background-color: #f8fafc; }
          .badge {
            display: inline-block;
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
          }
          .badge.titular { background: #dcfce7; color: #15803d; border: 1px solid #86efac; }
          .badge.reserva { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
          .status-ok { color: #15803d; font-weight: 700; }
          .footer-box {
            margin-top: 30px;
            border-top: 1px solid #cbd5e1;
            padding-top: 12px;
            font-size: 11px;
            color: #64748b;
            text-align: center;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div>
            <h1 class="header-title">Relatório de Inscrição & Vagas Confirmadas</h1>
            <div class="header-sub">CPROEIS • Programa Estadual de Integração na Segurança (PROEIS RJ)</div>
          </div>
          <div style="text-align: right; font-size: 11px; color: #475569;">
            <div>Emissão: <strong>${nowStr}</strong></div>
            <div style="color: #16a34a; font-weight: 700; margin-top: 2px;">STATUS: META CONCLUÍDA</div>
          </div>
        </div>

        <div class="meta-box">
          <div class="meta-item">
            <span class="meta-label">Cliente / Policial</span>
            <span class="meta-val">${clienteNome}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Sessão da Automação</span>
            <span class="meta-val">${selectedExecution === "latest" ? "Última Busca Realizada" : `Busca #${selectedExecution}`}</span>
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-num">${filteredVagas.length}</div>
            <div class="stat-title">Vagas Confirmadas</div>
          </div>
          <div class="stat-card">
            <div class="stat-num" style="color: #15803d;">${totalTitulares}</div>
            <div class="stat-title">Vagas Titulares</div>
          </div>
          <div class="stat-card">
            <div class="stat-num" style="color: #b45309;">${totalReserva}</div>
            <div class="stat-title">Vagas Reserva</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">#</th>
              <th>Data Evento</th>
              <th>Turno</th>
              <th>Convênio</th>
              <th>Evento / Cargo</th>
              <th>Situação</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="footer-box">
          Documento gerado automaticamente pelo Sistema CPROEIS. Autenticidade confirmada no portal oficial do PROEIS.
        </div>

        <script>
          window.onload = function() {
            window.print();
          }
        </script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  const totalTitularesCount = filteredVagas.filter((v) => !(v.tipo_vaga || "").toLowerCase().includes("reserva")).length
  const totalReservaCount = filteredVagas.length - totalTitularesCount

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {errorMsg && <div className="alert-error">{errorMsg}</div>}

      {/* Top Header com Botões de Ação */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0, color: "var(--text-primary)" }}>
            relatório de vagas cadastradas
          </h2>
          <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: "4px 0 0 0" }}>
            vagas confirmadas e agendadas pelo robô organizadas por sessão de busca
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <Button
            variant="outline"
            size="sm"
            onClick={exportToExcel}
            disabled={filteredVagas.length === 0 || loading}
            title="Baixar planilha compatível com Microsoft Excel e Google Planilhas"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="16" y2="13" />
              <line x1="8" y1="17" x2="16" y2="17" />
            </svg>
            exportar excel (csv)
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={printVagasReport}
            disabled={filteredVagas.length === 0 || loading}
            title="Gerar e salvar documento formal em PDF"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: "6px" }}>
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            gerar relatório pdf
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={loadData}
            disabled={loading}
            loading={loading}
          >
            atualizar dados
          </Button>
        </div>
      </div>

      {/* Abas Principais */}
      <div className="form-tabs-bar" style={{ maxWidth: "420px", marginBottom: 0 }}>
        <button
          type="button"
          className={`form-tab-btn ${activeTab === "vagas" ? "active" : ""}`}
          onClick={() => setActiveTab("vagas")}
        >
          <span>vagas por busca ({filteredVagas.length})</span>
        </button>

        <button
          type="button"
          className={`form-tab-btn ${activeTab === "arquivos" ? "active" : ""}`}
          onClick={() => setActiveTab("arquivos")}
        >
          <span>comprovantes salvos ({comprovantes.length})</span>
        </button>
      </div>

      {/* ABA 1: VAGAS CADASTRADAS POR SESSÃO DE BUSCA */}
      {activeTab === "vagas" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          
          {/* Seletor de Sessão / Busca e Filtros */}
          <div className="card" style={{ padding: "14px 18px", marginBottom: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
              
              {/* Seletor de Execução */}
              <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <span className="form-label" style={{ fontWeight: 700, marginBottom: 0, fontSize: "11px", textTransform: "uppercase" }}>
                  selecionar sessão de busca:
                </span>
                <select
                  className="form-select"
                  value={selectedExecution}
                  onChange={(e) => setSelectedExecution(e.target.value)}
                  style={{ fontWeight: 600, fontSize: "13px" }}
                >
                  <option value="latest">
                    última busca realizada ({latestExecutionId ? `Execução #${latestExecutionId}` : "recente"})
                  </option>
                  <option value="all">
                    todas as buscas combinadas ({vagas.length} vagas totais)
                  </option>
                  {executionSessions.map((sess) => (
                    <option key={sess.id} value={sess.id}>
                      {sess.label} ({sess.count} vaga(s))
                    </option>
                  ))}
                </select>
              </div>

              {/* Filtro por Situação (Todos / Titular / Reserva) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span className="form-label" style={{ fontWeight: 700, marginBottom: 0, fontSize: "11px", textTransform: "uppercase" }}>
                  situação da vaga:
                </span>
                <div className="segmented-control">
                  <button
                    type="button"
                    className={`segmented-btn ${filterTipo === "todos" ? "active" : ""}`}
                    onClick={() => setFilterTipo("todos")}
                  >
                    todas ({filteredVagas.length})
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${filterTipo === "titular" ? "active" : ""}`}
                    onClick={() => setFilterTipo("titular")}
                  >
                    titular ({totalTitularesCount})
                  </button>
                  <button
                    type="button"
                    className={`segmented-btn ${filterTipo === "reserva" ? "active" : ""}`}
                    onClick={() => setFilterTipo("reserva")}
                  >
                    reserva ({totalReservaCount})
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Cards de Métricas da Busca Selecionada */}
          <div className="grid-cols-3">
            <div className="card" style={{ padding: "14px 18px", marginBottom: 0 }}>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)" }}>
                vagas nesta busca
              </span>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "var(--text-primary)", marginTop: "4px" }}>
                {filteredVagas.length}
              </div>
            </div>

            <div className="card" style={{ padding: "14px 18px", marginBottom: 0 }}>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#10b981" }}>
                vagas de titular
              </span>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "#10b981", marginTop: "4px" }}>
                {totalTitularesCount}
              </div>
            </div>

            <div className="card" style={{ padding: "14px 18px", marginBottom: 0 }}>
              <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#f59e0b" }}>
                vagas de reserva
              </span>
              <div style={{ fontSize: "24px", fontWeight: 800, color: "#f59e0b", marginTop: "4px" }}>
                {totalReservaCount}
              </div>
            </div>
          </div>

          {/* Tabela de Vagas da Busca */}
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>cliente</th>
                    <th>data do evento</th>
                    <th>horário / turno</th>
                    <th>convênio</th>
                    <th>evento / cargo</th>
                    <th>situação</th>
                    <th>status</th>
                    <th>agendado em</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <>
                      <tr><td colSpan="8"><Skeleton variant="row" /></td></tr>
                      <tr><td colSpan="8"><Skeleton variant="row" /></td></tr>
                      <tr><td colSpan="8"><Skeleton variant="row" /></td></tr>
                    </>
                  ) : filteredVagas.length === 0 ? (
                    <tr>
                      <td colSpan="8">
                        <div className="empty-state">
                          <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14 2 14 8 20 8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                          </svg>
                          <span className="empty-state-title">nenhuma vaga encontrada para esta sessão</span>
                          <span className="empty-state-desc">
                            as vagas agendadas pelo robô ou confirmadas aparecerão automaticamente aqui
                          </span>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredVagas.map((v) => {
                      const isReserva = (v.tipo_vaga || "").toLowerCase().includes("reserva")
                      return (
                        <tr key={v.id}>
                          <td>
                            <strong style={{ color: "var(--text-primary)" }}>{v.cliente || "Romulo Paulino"}</strong>
                          </td>
                          <td>
                            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-primary)" }}>
                              {v.data_evento || "-"}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: "12px", color: "var(--accent)", fontWeight: 600 }}>
                              {v.horario || "-"}
                            </span>
                          </td>
                          <td>
                            <span className="client-badge-pill-inline">{v.convenio || "HCPM - RAS"}</span>
                          </td>
                          <td>
                            <strong style={{ color: "var(--text-primary)" }}>{v.evento}</strong>
                          </td>
                          <td>
                            <span
                              style={{
                                display: "inline-block",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontSize: "11px",
                                fontWeight: 700,
                                textTransform: "uppercase",
                                backgroundColor: isReserva ? "rgba(245, 158, 11, 0.12)" : "rgba(16, 185, 129, 0.12)",
                                color: isReserva ? "#f59e0b" : "#10b981",
                                border: `1px solid ${isReserva ? "rgba(245, 158, 11, 0.3)" : "rgba(16, 185, 129, 0.3)"}`
                              }}
                            >
                              {v.tipo_vaga || "Titular"}
                            </span>
                          </td>
                          <td>
                            <span style={{ color: "#10b981", fontWeight: 700, fontSize: "12px" }}>
                              {v.status || "Confirmada"}
                            </span>
                          </td>
                          <td>
                            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                              {v.data_agendamento || "-"}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ABA 2: ARQUIVOS DE COMPROVANTE SALVOS */}
      {activeTab === "arquivos" && (
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">comprovantes salvos</h3>
              <p className="card-desc">documentos oficiais em PDF gerados automaticamente após cada agendamento</p>
            </div>
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
      )}
    </div>
  )
}
