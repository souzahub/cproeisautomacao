import React, { useState, useEffect } from "react"
import { settingsApi, getBaseUrl, syncApi } from "../api/client"
import { getSyncQueue, clearSyncQueue, getLastSyncTime } from "../api/sync"
import { Skeleton } from "../components/Skeleton"
import { PasswordInput } from "../components/ui/password-input"
import { InfoTooltip } from "../components/ui/info-tooltip"
import { DocumentInput } from "../components/ui/masked-text"

export function Settings() {
  const [formData, setFormData] = useState({
    PROEIS_URL: "",
    TIPO_DOCUMENTO: "CPF",
    CPF: "",
    SENHA: "",
    CONVENIO: "",
    EVENTOS_PREFERIDOS: "",
    APENAS_EVENTOS_LISTADOS: false,
    APENAS_TITULAR: false,
    DIAS_A_FRENTE_INICIAL: 6,
    DIAS_A_FRENTE_MAXIMO: 7,
    INTERVALO_SEGUNDOS: 6,
    TENTATIVAS_MAXIMAS: 120,
    MODO_VISIVEL: false,
    MODO_HOMOLOGACAO: true,
    GEMINI_MODEL: "gemini-3.7-flash",
    GEMINI_API_KEY: ""
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notification, setNotification] = useState({ type: "", text: "" })
  const [serverUrl, setServerUrl] = useState(() => getBaseUrl())
  const [serverStatus, setServerStatus] = useState("verificando")
  const [serverLatency, setServerLatency] = useState(null)
  const [testingServer, setTestingServer] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [pendingQueue, setPendingQueue] = useState([])
  const [lastSync, setLastSync] = useState(getLastSyncTime())

  async function checkServerConnection(urlToCheck) {
    const target = urlToCheck || serverUrl
    const start = Date.now()
    try {
      const resp = await fetch(`${target}/api/health`, { method: "GET" })
      if (resp.ok) {
        setServerLatency(Date.now() - start)
        setServerStatus("online")
      } else {
        setServerStatus("offline")
        setServerLatency(null)
      }
    } catch {
      setServerStatus("offline")
      setServerLatency(null)
    }
  }

  useEffect(() => {
    function updateQueue() {
      setPendingQueue(getSyncQueue())
      setLastSync(getLastSyncTime())
    }

    async function loadSettings() {
      setLoading(true)
      try {
        const data = await settingsApi.get()
        setFormData(data)
      } catch (err) {
        setNotification({ type: "error", text: err.message || "falha ao carregar configurações" })
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
    checkServerConnection()
    updateQueue()

    function handleQueueEvent() {
      updateQueue()
    }
    window.addEventListener("cproeis:sync-queue-updated", handleQueueEvent)
    return () => window.removeEventListener("cproeis:sync-queue-updated", handleQueueEvent)
  }, [])

  async function handleTestServer() {
    setTestingServer(true)
    const normalized = (serverUrl || "").trim().replace(/\/+$/, "")
    setServerUrl(normalized)
    await checkServerConnection(normalized)
    localStorage.setItem("server_url", normalized)
    setTestingServer(false)
  }

  function handleResetServerUrl() {
    const defaultUrl = (typeof import.meta !== "undefined" && import.meta.env && (import.meta.env.VITE_API_URL || import.meta.env.VITE_SERVER_URL)) || ""
    setServerUrl(defaultUrl)
    localStorage.setItem("server_url", defaultUrl)
    checkServerConnection(defaultUrl)
  }

  async function handleSyncNow() {
    if (syncing) return
    setSyncing(true)
    setNotification({ type: "", text: "" })
    try {
      const result = await syncApi.sync()
      setPendingQueue(getSyncQueue())
      setLastSync(result.lastSync)
      setServerStatus("online")
      setNotification({ type: "info", text: `${result.syncedCount} itens sincronizados com a nuvem` })
    } catch (err) {
      setNotification({ type: "error", text: err.message || "falha ao sincronizar com a nuvem" })
    } finally {
      setSyncing(false)
    }
  }

  function handleClearQueue() {
    clearSyncQueue()
    setPendingQueue([])
    setNotification({ type: "info", text: "fila de sincronização local limpa" })
  }

  function handleChange(field, value) {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSaving(true)
    setNotification({ type: "", text: "" })
    try {
      const normalized = (serverUrl || "").trim().replace(/\/+$/, "")
      localStorage.setItem("server_url", normalized)
      const updated = await settingsApi.update(formData)
      setFormData(updated)
      setNotification({ type: "info", text: "configurações atualizadas" })
    } catch (err) {
      setNotification({ type: "error", text: err.message || "falha ao salvar configurações" })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="content-body">
      {notification.text && (
        <div className={notification.type === "error" ? "alert-error" : "alert-info"}>
          {notification.text}
        </div>
      )}

      <div className="card" style={{ marginBottom: "20px" }}>
        <div className="card-header">
          <div>
            <h3 className="card-title">conexão com o servidor e redundância</h3>
            <p className="card-desc">endereço da api na nuvem e sincronização de dados locais offline</p>
          </div>
          <span className={`badge-pill ${serverStatus === "online" ? "badge-success" : serverStatus === "verificando" ? "badge-homologacao" : "badge-error"}`}>
            {serverStatus === "online" ? "servidor online" : serverStatus === "verificando" ? "verificando..." : "servidor offline"}
          </span>
        </div>

        <div className="grid-cols-2" style={{ alignItems: "flex-end", gap: "16px", marginBottom: "16px" }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" htmlFor="server_url">endereço da api</label>
            <input
              id="server_url"
              className="form-input"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="https://cprsautomacao.devsouza.online"
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", minHeight: "42px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleTestServer}
              disabled={testingServer}
            >
              {testingServer ? "testando..." : "testar e salvar endereço"}
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleResetServerUrl}
              title="restaurar endereço original da nuvem"
            >
              restaurar padrão
            </button>

            {serverLatency !== null && (
              <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                latência: <strong style={{ color: "var(--text-primary)" }}>{serverLatency} ms</strong>
              </span>
            )}
          </div>
        </div>

        <div style={{ padding: "12px 16px", backgroundColor: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>
              redundância offline e sincronização
            </span>
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              {pendingQueue.length > 0
                ? `${pendingQueue.length} alterações salvas localmente aguardando sincronização com a nuvem`
                : "todos os dados locais estão sincronizados com a nuvem"}
              {lastSync ? ` (última: ${new Date(lastSync).toLocaleString("pt-BR")})` : ""}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSyncNow}
              disabled={syncing}
            >
              {syncing ? "sincronizando..." : "sincronizar agora com a nuvem"}
            </button>
            {pendingQueue.length > 0 && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleClearQueue}
                title="descartar alterações locais pendentes"
              >
                limpar fila
              </button>
            )}
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: "20px" }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">credenciais do portal</h3>
              <p className="card-desc">endereço do sistema e dados para autenticação automática</p>
            </div>
          </div>

          {loading ? (
            <div className="grid-cols-2">
              <div><Skeleton variant="text" count={2} height="36px" /></div>
              <div><Skeleton variant="text" count={2} height="36px" /></div>
            </div>
          ) : (
            <div className="grid-cols-2">
              <div className="form-group">
                <label className="form-label" htmlFor="portal_url">endereço web do portal</label>
                <input
                  id="portal_url"
                  className="form-input"
                  value={formData.PROEIS_URL}
                  onChange={(e) => handleChange("PROEIS_URL", e.target.value)}
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="tipo_doc">tipo de documento</label>
                <select
                  id="tipo_doc"
                  className="form-select"
                  value={formData.TIPO_DOCUMENTO}
                  onChange={(e) => handleChange("TIPO_DOCUMENTO", e.target.value)}
                  disabled={saving}
                >
                  <option value="CPF">CPF</option>
                  <option value="RG">RG</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="cpf">número do documento</label>
                <DocumentInput
                  id="cpf"
                  value={formData.CPF}
                  onChange={(e) => handleChange("CPF", e.target.value)}
                  placeholder="000.000.000-00"
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="senha">senha de acesso</label>
                <PasswordInput
                  id="senha"
                  value={formData.SENHA}
                  onChange={(e) => handleChange("SENHA", e.target.value)}
                  placeholder="deixe em branco se não quiser alterar"
                  disabled={saving}
                />
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ marginBottom: "20px" }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">parâmetros de busca e filtros</h3>
              <p className="card-desc">especifique o convênio, eventos de interesse e regras de priorização</p>
            </div>
          </div>

          {loading ? (
            <div><Skeleton variant="text" count={3} height="36px" /></div>
          ) : (
            <>
              <div className="form-group">
                <label className="form-label" htmlFor="convenio">convênio alvo</label>
                <input
                  id="convenio"
                  className="form-input"
                  value={formData.CONVENIO}
                  onChange={(e) => handleChange("CONVENIO", e.target.value)}
                  placeholder="exemplo: HCPM - RAS"
                  disabled={saving}
                />
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="eventos">eventos preferidos (separados por vírgula)</label>
                <input
                  id="eventos"
                  className="form-input"
                  value={formData.EVENTOS_PREFERIDOS}
                  onChange={(e) => handleChange("EVENTOS_PREFERIDOS", e.target.value)}
                  placeholder="ENFERMAGEM CIRURGIA GERAL, UPE APOIO"
                  disabled={saving}
                />
              </div>

              <div style={{ display: "flex", gap: "24px", marginTop: "12px", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <label className="form-checkbox-group" style={{ marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      className="form-checkbox"
                      checked={formData.APENAS_EVENTOS_LISTADOS}
                      onChange={(e) => handleChange("APENAS_EVENTOS_LISTADOS", e.target.checked)}
                      disabled={saving}
                    />
                    <span className="form-label" style={{ cursor: "pointer" }}>apenas eventos listados</span>
                  </label>
                  <InfoTooltip
                    title="apenas eventos listados"
                    text="se marcado, o robô só se inscreve estritamente nos eventos informados no campo de eventos preferidos e ignora os demais."
                    example="se digitou 'cirurgia', ele ignora vagas de 'apoio' ou 'guarda'."
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center" }}>
                  <label className="form-checkbox-group" style={{ marginBottom: 0 }}>
                    <input
                      type="checkbox"
                      className="form-checkbox"
                      checked={formData.APENAS_TITULAR}
                      onChange={(e) => handleChange("APENAS_TITULAR", e.target.checked)}
                      disabled={saving}
                    />
                    <span className="form-label" style={{ cursor: "pointer" }}>apenas vagas titulares (descartar reserva)</span>
                  </label>
                  <InfoTooltip
                    title="apenas titulares"
                    text="se marcado, o robô só agenda vagas de titular direto da escala e descarta vagas de cadastro de reserva."
                    example="se a vaga estiver identificada como reserva, o robô não fará o agendamento."
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <div className="card" style={{ marginBottom: "20px" }}>
          <div className="card-header">
            <div>
              <h3 className="card-title">ciclos, limites e inteligência artificial</h3>
              <p className="card-desc">ajuste temporizadores, modo de teste e credenciais de visão computacional</p>
            </div>
          </div>

          {loading ? (
            <div className="grid-cols-4">
              <Skeleton variant="card" />
              <Skeleton variant="card" />
              <Skeleton variant="card" />
              <Skeleton variant="card" />
            </div>
          ) : (
            <>
              <div style={{ padding: "12px", backgroundColor: "var(--bg-surface-elevated)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", marginBottom: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span className="form-label" style={{ fontWeight: 600, marginBottom: 0 }}>regra de datas padrão:</span>
                  <div className="segmented-control">
                    <button
                      type="button"
                      className={`segmented-btn ${formData.TIPO_DATA === "dias_frente" ? "active" : ""}`}
                      onClick={() => handleChange("TIPO_DATA", "dias_frente")}
                      disabled={saving}
                    >
                      dias à frente
                    </button>
                    <button
                      type="button"
                      className={`segmented-btn ${formData.TIPO_DATA === "intervalo" ? "active" : ""}`}
                      onClick={() => handleChange("TIPO_DATA", "intervalo")}
                      disabled={saving}
                    >
                      período de datas
                    </button>
                  </div>
                </div>

                {formData.TIPO_DATA === "intervalo" ? (
                  <div className="grid-cols-2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="data_ini">data inicial</label>
                      <input
                        id="data_ini"
                        type="date"
                        className="form-input"
                        value={formData.DATA_INICIO || ""}
                        onChange={(e) => handleChange("DATA_INICIO", e.target.value)}
                        disabled={saving}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="data_fim">data final</label>
                      <input
                        id="data_fim"
                        type="date"
                        className="form-input"
                        value={formData.DATA_FIM || ""}
                        onChange={(e) => handleChange("DATA_FIM", e.target.value)}
                        disabled={saving}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid-cols-2">
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="dias_ini">dias à frente inicial</label>
                      <input
                        id="dias_ini"
                        type="number"
                        className="form-input"
                        value={formData.DIAS_A_FRENTE_INICIAL}
                        onChange={(e) => handleChange("DIAS_A_FRENTE_INICIAL", parseInt(e.target.value) || 0)}
                        disabled={saving}
                      />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label" htmlFor="dias_max">dias à frente máximo</label>
                      <input
                        id="dias_max"
                        type="number"
                        className="form-input"
                        value={formData.DIAS_A_FRENTE_MAXIMO}
                        onChange={(e) => handleChange("DIAS_A_FRENTE_MAXIMO", parseInt(e.target.value) || 0)}
                        disabled={saving}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="grid-cols-3" style={{ marginBottom: "16px" }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="meta_vagas">meta de vagas padrão</label>
                  <input
                    id="meta_vagas"
                    type="number"
                    min="1"
                    className="form-input"
                    value={formData.META_VAGAS || 1}
                    onChange={(e) => handleChange("META_VAGAS", parseInt(e.target.value) || 1)}
                    disabled={saving}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="intervalo">intervalo (segundos)</label>
                  <input
                    id="intervalo"
                    type="number"
                    className="form-input"
                    value={formData.INTERVALO_SEGUNDOS}
                    onChange={(e) => handleChange("INTERVALO_SEGUNDOS", parseInt(e.target.value) || 1)}
                    disabled={saving}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="tentativas">tentativas máximas</label>
                  <input
                    id="tentativas"
                    type="number"
                    className="form-input"
                    value={formData.TENTATIVAS_MAXIMAS}
                    onChange={(e) => handleChange("TENTATIVAS_MAXIMAS", parseInt(e.target.value) || 1)}
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="grid-cols-2" style={{ marginBottom: "16px" }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="gemini_model">modelo do gemini para captcha</label>
                  <input
                    id="gemini_model"
                    className="form-input"
                    value={formData.GEMINI_MODEL}
                    onChange={(e) => handleChange("GEMINI_MODEL", e.target.value)}
                    disabled={saving}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="gemini_key">chave de api do gemini</label>
                  <PasswordInput
                    id="gemini_key"
                    value={formData.GEMINI_API_KEY}
                    onChange={(e) => handleChange("GEMINI_API_KEY", e.target.value)}
                    placeholder="chave opcional para backup do OCR local"
                    disabled={saving}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "24px" }}>
                <label className="form-checkbox-group">
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    checked={formData.MODO_HOMOLOGACAO}
                    onChange={(e) => handleChange("MODO_HOMOLOGACAO", e.target.checked)}
                    disabled={saving}
                  />
                  <span className="form-label" style={{ cursor: "pointer" }}>modo homologação padrão (não confirma agendamento real)</span>
                </label>

                <label className="form-checkbox-group">
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    checked={formData.MODO_VISIVEL}
                    onChange={(e) => handleChange("MODO_VISIVEL", e.target.checked)}
                    disabled={saving}
                  />
                  <span className="form-label" style={{ cursor: "pointer" }}>abrir janela visível do navegador (modo local)</span>
                </label>
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={saving || loading}
          >
            {saving ? "salvando..." : "salvar configurações"}
          </button>
        </div>
      </form>
    </div>
  )
}
