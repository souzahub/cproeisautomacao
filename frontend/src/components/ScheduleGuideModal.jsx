import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog"
import { Button } from "./ui/button"

export function ScheduleGuideModal({ open, onOpenChange }) {
  const [activeTopic, setActiveTopic] = useState("escala")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent style={{ maxWidth: "680px", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        <DialogHeader>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: "rgba(37, 99, 235, 0.12)",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <div>
              <DialogTitle style={{ fontSize: "17px", fontWeight: 700 }}>
                Guia de Regras & Agendamento CPROEIS
              </DialogTitle>
              <DialogDescription style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                Entenda o funcionamento de abertura da escala, turnos e metas de vagas
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Menu de Tópicos do Guia */}
        <div style={{
          display: "flex",
          gap: "6px",
          padding: "4px",
          backgroundColor: "var(--bg-main)",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border-subtle)",
          overflowX: "auto",
          marginBottom: "12px",
          flexShrink: 0
        }}>
          <button
            type="button"
            className={`date-preset-btn ${activeTopic === "escala" ? "active" : ""}`}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              backgroundColor: activeTopic === "escala" ? "var(--accent)" : "transparent",
              color: activeTopic === "escala" ? "#ffffff" : "var(--text-secondary)",
              borderColor: activeTopic === "escala" ? "var(--accent)" : "transparent"
            }}
            onClick={() => setActiveTopic("escala")}
          >
            Escala de Quinta (7 Dias)
          </button>

          <button
            type="button"
            className={`date-preset-btn ${activeTopic === "meta" ? "active" : ""}`}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              backgroundColor: activeTopic === "meta" ? "var(--accent)" : "transparent",
              color: activeTopic === "meta" ? "#ffffff" : "var(--text-secondary)",
              borderColor: activeTopic === "meta" ? "var(--accent)" : "transparent"
            }}
            onClick={() => setActiveTopic("meta")}
          >
            Meta de Vagas
          </button>

          <button
            type="button"
            className={`date-preset-btn ${activeTopic === "turnos" ? "active" : ""}`}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              backgroundColor: activeTopic === "turnos" ? "var(--accent)" : "transparent",
              color: activeTopic === "turnos" ? "#ffffff" : "var(--text-secondary)",
              borderColor: activeTopic === "turnos" ? "var(--accent)" : "transparent"
            }}
            onClick={() => setActiveTopic("turnos")}
          >
            Turnos (07h / 19h)
          </button>

          <button
            type="button"
            className={`date-preset-btn ${activeTopic === "ciclos" ? "active" : ""}`}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              backgroundColor: activeTopic === "ciclos" ? "var(--accent)" : "transparent",
              color: activeTopic === "ciclos" ? "#ffffff" : "var(--text-secondary)",
              borderColor: activeTopic === "ciclos" ? "var(--accent)" : "transparent"
            }}
            onClick={() => setActiveTopic("ciclos")}
          >
            Ciclos & Tentativas
          </button>
        </div>

        {/* Conteúdo Dinâmico por Tópico */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: "4px" }}>
          {activeTopic === "escala" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{
                padding: "14px",
                backgroundColor: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)"
              }}>
                <h4 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
                  Como funciona a abertura de Quinta-feira?
                </h4>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "10px" }}>
                  Toda <strong>quinta-feira</strong>, o portal do PROEIS abre a escala completa dos <strong>7 dias da semana seguinte</strong>, iniciando no <strong>domingo</strong> e indo até o <strong>sábado</strong>.
                </p>
                
                <div style={{
                  padding: "10px",
                  backgroundColor: "var(--bg-main)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-sm)",
                  marginBottom: "10px"
                }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)", textTransform: "uppercase", display: "block", marginBottom: "4px" }}>
                    Atalho em 1 Clique no Sistema:
                  </span>
                  <p style={{ fontSize: "12px", color: "var(--text-primary)", margin: 0 }}>
                    Ao clicar no botão <strong>próxima escala (dom a sáb)</strong> no cadastro do cliente, o sistema preenche automaticamente a data inicial (próximo domingo) e data final (sábado), cobrindo exatamente os 7 dias abertos.
                  </p>
                </div>

                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  <span className="date-chip is-weekend"><span className="date-chip-weekday">DOM</span> <span className="date-chip-day">+3 dias</span></span>
                  <span className="date-chip"><span className="date-chip-weekday">SEG</span> <span className="date-chip-day">+4 dias</span></span>
                  <span className="date-chip"><span className="date-chip-weekday">TER</span> <span className="date-chip-day">+5 dias</span></span>
                  <span className="date-chip"><span className="date-chip-weekday">QUA</span> <span className="date-chip-day">+6 dias</span></span>
                  <span className="date-chip"><span className="date-chip-weekday">QUI</span> <span className="date-chip-day">+7 dias</span></span>
                  <span className="date-chip"><span className="date-chip-weekday">SEX</span> <span className="date-chip-day">+8 dias</span></span>
                  <span className="date-chip is-weekend"><span className="date-chip-weekday">SÁB</span> <span className="date-chip-day">+9 dias</span></span>
                </div>
              </div>
            </div>
          )}

          {activeTopic === "meta" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{
                padding: "14px",
                backgroundColor: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)"
              }}>
                <h4 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
                  Meta de Vagas vs Vagas Disponíveis
                </h4>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "10px" }}>
                  A <strong>meta de vagas</strong> atua como um <strong>teto máximo de segurança</strong>. O robô sempre cadastra <strong>1 vaga por dia</strong> que encontrar disponível até bater essa meta.
                </p>

                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                  marginBottom: "10px"
                }}>
                  <div style={{ padding: "10px", backgroundColor: "rgba(16, 185, 129, 0.08)", border: "1px solid rgba(16, 185, 129, 0.3)", borderRadius: "var(--radius-sm)" }}>
                    <strong style={{ color: "#10b981", fontSize: "12px", display: "block", marginBottom: "4px" }}>
                      Cenário A (Meta 15 / 7 Datas)
                    </strong>
                    <span style={{ fontSize: "12px", color: "var(--text-primary)" }}>
                      Se a meta for <strong>15</strong> e o portal abrir <strong>7 datas</strong> com vagas, o robô <strong>cadastrará todas as 7 vagas</strong> com sucesso!
                    </span>
                  </div>

                  <div style={{ padding: "10px", backgroundColor: "rgba(59, 130, 246, 0.08)", border: "1px solid rgba(59, 130, 246, 0.3)", borderRadius: "var(--radius-sm)" }}>
                    <strong style={{ color: "var(--accent)", fontSize: "12px", display: "block", marginBottom: "4px" }}>
                      Cenário B (Meta 5 / 7 Datas)
                    </strong>
                    <span style={{ fontSize: "12px", color: "var(--text-primary)" }}>
                      Se a meta for <strong>5</strong> e existirem 7 datas, o robô agenda <strong>5 vagas</strong> e para imediatamente para não ultrapassar seu limite.
                    </span>
                  </div>
                </div>

                <p style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic", margin: 0 }}>
                  Nota: Se quiser que o cliente pegue todas as vagas que abrirem na semana, defina uma meta mais alta (como 15).
                </p>
              </div>
            </div>
          )}

          {activeTopic === "turnos" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{
                padding: "14px",
                backgroundColor: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)"
              }}>
                <h4 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
                  Os Dois Turnos Oficiais do Sistema
                </h4>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "10px" }}>
                  O PROEIS opera fundamentalmente em dois turnos de 12 horas. No cadastro do cliente você conta com botões rápidos:
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "10px" }}>
                  <div style={{ padding: "8px 12px", backgroundColor: "var(--bg-main)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)" }}>
                    <strong style={{ fontSize: "12px", color: "var(--text-primary)" }}>Turno Diurno (07 às 19):</strong>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginTop: "2px" }}>
                      Foca exclusivamente nas escalas que iniciam às 07:00 da manhã.
                    </span>
                  </div>

                  <div style={{ padding: "8px 12px", backgroundColor: "var(--bg-main)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)" }}>
                    <strong style={{ fontSize: "12px", color: "var(--text-primary)" }}>Turno Noturno (19 às 07):</strong>
                    <span style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginTop: "2px" }}>
                      Foca exclusivamente nas escalas que iniciam às 19:00 da noite.
                    </span>
                  </div>
                </div>

                <div style={{ padding: "8px 12px", backgroundColor: "rgba(37, 99, 235, 0.08)", border: "1px solid rgba(37, 99, 235, 0.2)", borderRadius: "var(--radius-sm)" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-primary)" }}>
                    <strong>Exemplo do cliente:</strong> Se ele disser <em>"Tenta marcar dia 26 às 07h"</em>, basta selecionar a data <strong>26/09/2026</strong> e clicar no botão <strong>07 às 19</strong>.
                  </span>
                </div>
              </div>
            </div>
          )}

          {activeTopic === "ciclos" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{
                padding: "14px",
                backgroundColor: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)"
              }}>
                <h4 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>
                  Varredura em Ciclos Rotativos
                </h4>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: "10px" }}>
                  O robô nunca fica travado em um único dia. Ele pesquisa as datas cadastradas em <strong>ciclos rotativos</strong>:
                </p>

                <ol style={{ paddingLeft: "20px", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: "10px" }}>
                  <li>O robô consulta a <strong>Data 1 (ex: Domingo)</strong>. Se achar vaga do evento/horário, agenda e soma +1.</li>
                  <li>Aguardando o intervalo (ex: <strong>6 segundos</strong>), ele avança automaticamente para a <strong>Data 2 (ex: Segunda)</strong>.</li>
                  <li>Ele repete o processo dia a dia até passar por todas as 7 datas do período.</li>
                  <li>Ao terminar a 7ª data, ele recomeça do Domingo (iniciando uma nova volta) até esgotar as <strong>tentativas máximas</strong> ou <strong>atingir a meta de vagas</strong>.</li>
                </ol>

                <div style={{ padding: "8px 12px", backgroundColor: "var(--bg-main)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-primary)" }}>
                    <strong>Tentativas Recomendadas:</strong> Para um período de 7 dias, configurar entre <strong>60 e 120 tentativas</strong> dá entre 8 e 17 voltas completas para capturar vagas que abrirem mais tarde.
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter style={{ marginTop: "16px", flexShrink: 0 }}>
          <Button
            type="button"
            variant="default"
            onClick={() => onOpenChange(false)}
          >
            entendi, fechar guia
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
