/**
 * Utilitário de Impressão de Relatório / Resumo Executivo CPROEIS
 */

/**
 * Analisador de Logs para extrair vagas confirmadas ou identificadas
 */
export function parseVagasFromLogs(logs, defaultClient = null, defaultMode = "homologacao") {
  const extracted = []
  if (!logs || logs.length === 0) return extracted

  let currentData = ""
  let currentTurno = "-"
  let currentConvenio = defaultClient?.convenio || "HCPM - RAS"
  const currentCliente = defaultClient?.name || "Romulo Paulino"

  // 1º passo: capturar dados globais da busca
  for (const item of logs) {
    const text = typeof item === "string" ? item : (item?.message || "")
    const dMatch = text.match(/(?:Data:\s*|data:\s*|pesquisada:\s*)(\d{2}\/\d{2}\/\d{4})/i)
    if (dMatch && !currentData) {
      currentData = dMatch[1]
    }
    const convMatch = text.match(/Conv[eê]nio:\s*([^|\n]+)/i)
    if (convMatch) {
      currentConvenio = convMatch[1].trim()
    }
  }

  // 2º passo: varrer cada linha para encontrar vagas
  let idCounter = 1
  for (let i = 0; i < logs.length; i++) {
    const text = typeof logs[i] === "string" ? logs[i] : (logs[i]?.message || "")
    if (!text) continue

    const clean = text.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*/, "").trim()

    const dMatch = clean.match(/Data:\s*(\d{2}\/\d{2}\/\d{4})/i)
    if (dMatch) currentData = dMatch[1]

    const isCompativel = /Vaga\s+compat[ií]vel/i.test(clean)
    const isInscricao = /Inscri[cç][aã]o\s+confirmada/i.test(clean)
    const isVagaIdentificada = /Vaga\s+identificada/i.test(clean)
    const isVagaSelecionada = /Vaga\s+selecionada/i.test(clean)
    const isConfirmada = /confirmada/i.test(clean) && clean.includes(":")

    if (isCompativel || isInscricao || isVagaIdentificada || isVagaSelecionada || isConfirmada) {
      // Ignorar mensagens que são apenas informativos de ciclo ou status geral
      if (clean.includes("Busca finalizada") || clean.includes("Meta de") || clean.includes("Execucao finalizada")) {
        continue
      }

      let nomeEvento = ""
      if (clean.includes("identificada:")) {
        nomeEvento = clean.split("identificada:")[1].trim()
      } else if (clean.includes("agendadas):")) {
        nomeEvento = clean.split("agendadas):")[1].trim()
      } else if (clean.includes("confirmada:")) {
        nomeEvento = clean.split("confirmada:")[1].trim()
      } else if (clean.includes("selecionada:")) {
        nomeEvento = clean.split("selecionada:")[1].trim()
      } else if (clean.includes("):")) {
        nomeEvento = clean.split("):")[1].trim()
      } else if (clean.includes(":")) {
        const parts = clean.split(":")
        nomeEvento = parts.slice(1).join(":").trim()
      } else {
        nomeEvento = clean
      }

      nomeEvento = nomeEvento
        .replace(/^\[.*?\]\s*/, "")
        .replace(/^[0-9:]+\s*/, "")
        .replace(/\(teste.*?\)/i, "")
        .trim()

      if (!nomeEvento || nomeEvento.length < 3) continue

      const isReserva = clean.toLowerCase().includes("reserva") || nomeEvento.toLowerCase().includes("reserva")
      const isHomolog = clean.toUpperCase().includes("[HOMOLOGACAO]") || defaultMode === "homologacao"

      const jaExiste = extracted.some((v) => v.evento === nomeEvento && (v.data_evento === currentData || !currentData))
      if (!jaExiste) {
        extracted.push({
          id: `v-log-${idCounter++}`,
          cliente: currentCliente,
          evento: nomeEvento,
          convenio: currentConvenio,
          data_evento: currentData || new Date().toLocaleDateString("pt-BR"),
          horario: currentTurno !== "-" ? currentTurno : (nomeEvento.includes("07") && nomeEvento.includes("19") ? "07 às 19" : "-"),
          tipo_vaga: isReserva ? "Reserva" : "Titular",
          status: isHomolog ? "Confirmada (Homologação)" : "Confirmada",
          modo: defaultMode,
          data_agendamento: new Date().toLocaleDateString("pt-BR")
        })
      }
    }
  }

  return extracted
}

export function printExecutionSummary({
  client = null,
  status = "completed",
  mode = "homologacao",
  startedAt = null,
  finishedAt = null,
  totalCycles = 60,
  currentCycle = 1,
  metaVagas = 1,
  vagas = [],
  logs = []
}) {
  const printWindow = window.open("", "_blank")
  if (!printWindow) {
    alert("Por favor, habilite popups no navegador para visualizar a impressão do resumo.")
    return
  }

  // Se a lista de vagas vier vazia, extrai automaticamente dos logs da execução
  let finalVagas = Array.isArray(vagas) ? [...vagas] : []
  if (finalVagas.length === 0 && logs && logs.length > 0) {
    finalVagas = parseVagasFromLogs(logs, client, mode)
  }

  const nowStr = new Date().toLocaleString("pt-BR")
  const clientName = client?.name || (finalVagas[0]?.cliente) || "Romulo Paulino"
  const clientDoc = client?.document || "-"
  const clientConvenio = client?.convenio || (finalVagas[0]?.convenio) || "HCPM - RAS"

  const totalTitulares = finalVagas.filter((v) => !(v.tipo_vaga || "").toLowerCase().includes("reserva")).length
  const totalReserva = finalVagas.length - totalTitulares
  const totalConfirmadas = finalVagas.length

  const statusLabel = status === "completed"
    ? "Concluído com Sucesso"
    : status === "stopped"
    ? "Interrompido pelo Usuário"
    : status === "error"
    ? "Encerrado com Erro"
    : "Finalizado"

  const statusBg = status === "completed" ? "#ecfdf5" : status === "error" ? "#fef2f2" : "#f1f5f9"
  const statusColor = status === "completed" ? "#065f46" : status === "error" ? "#991b1b" : "#334155"

  const rowsHtml = finalVagas.length === 0
    ? `<tr><td colspan="7" style="text-align: center; padding: 24px; color: #64748b;">Nenhuma vaga específica confirmada nesta execução.</td></tr>`
    : finalVagas.map((v, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0; background: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="text-align: center; font-weight: 700; color: #64748b; padding: 10px 8px;">${idx + 1}</td>
          <td style="padding: 10px 8px;"><strong style="color: #0f172a;">${v.data_evento || "-"}</strong></td>
          <td style="padding: 10px 8px; color: #334155;">${v.horario || "-"}</td>
          <td style="padding: 10px 8px; font-weight: 600; color: #1e293b;">${v.convenio || clientConvenio}</td>
          <td style="padding: 10px 8px;"><strong style="color: #1e3a8a;">${v.evento || "-"}</strong></td>
          <td style="padding: 10px 8px; text-align: center;">
            <span style="
              display: inline-block;
              padding: 3px 8px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: 700;
              background: ${(v.tipo_vaga || "").toLowerCase().includes("reserva") ? "#fffbeb" : "#eff6ff"};
              color: ${(v.tipo_vaga || "").toLowerCase().includes("reserva") ? "#b45309" : "#1d4ed8"};
              border: 1px solid ${(v.tipo_vaga || "").toLowerCase().includes("reserva") ? "#fde68a" : "#bfdbfe"};
            ">
              ${v.tipo_vaga || "Titular"}
            </span>
          </td>
          <td style="padding: 10px 8px; text-align: center;">
            <span style="
              display: inline-block;
              padding: 3px 8px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: 700;
              background: #ecfdf5;
              color: #065f46;
              border: 1px solid #a7f3d0;
            ">
              ${v.status || "Confirmada"}
            </span>
          </td>
        </tr>
      `).join("")

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <title>Resumo de Conclusão da Busca - CPROEIS</title>
      <style>
        @page { size: A4 portrait; margin: 1.2cm; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
          padding: 15px;
          color: #0f172a;
          background: #ffffff;
          margin: 0;
          font-size: 12px;
          line-height: 1.4;
        }
        .header-box {
          border: 2px solid #1e3a8a;
          border-radius: 8px;
          padding: 14px 18px;
          margin-bottom: 16px;
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
          margin: 0;
          letter-spacing: -0.01em;
        }
        .header-sub {
          font-size: 11px;
          color: #475569;
          margin-top: 3px;
        }
        .status-pill {
          padding: 6px 14px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          background: ${statusBg};
          color: ${statusColor};
          border: 1px solid ${statusColor}33;
        }
        .meta-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          padding: 12px 14px;
          margin-bottom: 16px;
        }
        .meta-item { line-height: 1.4; }
        .meta-label { color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 9px; display: block; }
        .meta-val { color: #0f172a; font-weight: 700; font-size: 12px; }
        .stats-grid {
          display: flex;
          gap: 10px;
          margin-bottom: 16px;
        }
        .stat-card {
          flex: 1;
          padding: 10px 12px;
          background: #f8fafc;
          border-radius: 6px;
          text-align: center;
          border: 1px solid #e2e8f0;
        }
        .stat-num { font-size: 22px; font-weight: 800; color: #0f172a; }
        .stat-title { font-size: 9px; text-transform: uppercase; font-weight: 700; color: #475569; margin-top: 2px; }
        .section-title {
          font-size: 12px;
          font-weight: 800;
          color: #1e3a8a;
          text-transform: uppercase;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 2px solid #e2e8f0;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 18px;
        }
        th {
          background: #1e3a8a;
          color: #ffffff;
          font-size: 10px;
          text-transform: uppercase;
          font-weight: 700;
          padding: 8px;
          text-align: left;
        }
        .footer-note {
          margin-top: 20px;
          padding-top: 10px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          color: #64748b;
        }
        .no-print-bar {
          background: #1e293b;
          color: #ffffff;
          padding: 10px 16px;
          margin: -15px -15px 15px -15px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .btn-print {
          background: #2563eb;
          color: #ffffff;
          border: none;
          padding: 6px 14px;
          border-radius: 4px;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
        }
        @media print {
          .no-print-bar { display: none !important; }
          body { padding: 0 !important; }
        }
      </style>
    </head>
    <body>
      <div class="no-print-bar">
        <span>Resumo Oficial de Execução CPROEIS</span>
        <button class="btn-print" onclick="window.print()">Imprimir / Salvar PDF</button>
      </div>

      <div class="header-box">
        <div>
          <h1 class="header-title">CPROEIS • Resumo de Conclusão da Busca</h1>
          <div class="header-sub">Relatório consolidado de agendamento automático de vagas</div>
        </div>
        <div class="status-pill">${statusLabel}</div>
      </div>

      <div class="meta-grid">
        <div class="meta-item">
          <span class="meta-label">Cliente Titular</span>
          <span class="meta-val">${clientName}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Documento / Matrícula</span>
          <span class="meta-val">${clientDoc}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Convênio</span>
          <span class="meta-val">${clientConvenio}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Modo Operacional</span>
          <span class="meta-val" style="color: ${mode === "producao" ? "#dc2626" : "#2563eb"};">${mode === "producao" ? "PRODUÇÃO (Real)" : "HOMOLOGAÇÃO (Teste)"}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Tentativas Executadas</span>
          <span class="meta-val">${currentCycle} de ${totalCycles} ciclos</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Início da Busca</span>
          <span class="meta-val">${startedAt || "-"}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Emissão do Relatório</span>
          <span class="meta-val">${nowStr}</span>
        </div>
        <div class="meta-item">
          <span class="meta-label">Meta Definida</span>
          <span class="meta-val">${metaVagas} vaga(s)</span>
        </div>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-num" style="color: #1e3a8a;">${totalConfirmadas}</div>
          <div class="stat-title">Total Vagas Confirmadas</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" style="color: #059669;">${totalTitulares}</div>
          <div class="stat-title">Vagas Titulares</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" style="color: #d97706;">${totalReserva}</div>
          <div class="stat-title">Vagas Reservas</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" style="color: ${totalConfirmadas >= metaVagas ? '#059669' : '#d97706'};">
            ${metaVagas > 0 ? Math.min(100, Math.round((totalConfirmadas / metaVagas) * 100)) : 100}%
          </div>
          <div class="stat-title">Meta Atingida</div>
        </div>
      </div>

      <div class="section-title">Detalhamento das Vagas Agendadas (${totalConfirmadas})</div>
      <table>
        <thead>
          <tr>
            <th style="width: 35px; text-align: center;">#</th>
            <th style="width: 110px;">Data do Evento</th>
            <th style="width: 90px;">Turno / Horário</th>
            <th style="width: 110px;">Convênio</th>
            <th>Cargo / Evento</th>
            <th style="width: 80px; text-align: center;">Situação</th>
            <th style="width: 90px; text-align: center;">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>

      <div class="footer-note">
        <div>Sistema de Automação CPROEIS • Processamento automatizado de vagas</div>
        <div>Página 1 de 1 • Emitido em ${nowStr}</div>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() { window.print(); }, 400);
        }
      </script>
    </body>
    </html>
  `)
  printWindow.document.close()
}
