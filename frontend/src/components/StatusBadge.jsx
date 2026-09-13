import React from "react"

export function StatusBadge({ status }) {
  const norm = (status || "").toLowerCase()
  let className = "badge-pill badge-idle"
  let label = "ocioso"

  if (norm === "running" || norm === "em execução") {
    className = "badge-pill badge-running"
    label = "em execução"
  } else if (norm === "homologacao" || norm === "homologação") {
    className = "badge-pill badge-homologacao"
    label = "homologação"
  } else if (norm === "producao" || norm === "produção") {
    className = "badge-pill badge-producao"
    label = "produção"
  } else if (norm === "consulta") {
    className = "badge-pill badge-homologacao"
    label = "consulta"
  } else if (norm === "completed" || norm === "concluído" || norm === "ativo") {
    className = "badge-pill badge-success"
    label = norm === "ativo" ? "ativo" : "concluído"
  } else if (norm === "error" || norm === "erro" || norm === "inativo") {
    className = "badge-pill badge-error"
    label = norm === "inativo" ? "inativo" : "erro"
  } else if (norm === "stopped" || norm === "interrompido") {
    className = "badge-pill badge-idle"
    label = "interrompido"
  }

  return <span className={className}>{label}</span>
}

