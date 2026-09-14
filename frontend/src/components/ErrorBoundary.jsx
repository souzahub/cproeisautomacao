import React from "react"

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {}

  handleReload = () => {
    window.location.reload()
  }

  handleResetAuth = () => {
    localStorage.removeItem("auth_token")
    localStorage.removeItem("auth_user")
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          backgroundColor: "var(--bg-main)"
        }}>
          <div style={{
            maxWidth: "480px",
            width: "100%",
            backgroundColor: "var(--bg-surface)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            padding: "28px"
          }}>
            <h2 style={{ fontSize: "18px", fontWeight: 600, color: "var(--text-primary)", marginBottom: "8px" }}>
              erro inesperado na visualização
            </h2>
            <p style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "20px" }}>
              ocorreu uma falha ao renderizar os componentes. recarregue a página para restaurar o painel.
            </p>
            {this.state.error && (
              <pre style={{
                fontSize: "12px",
                fontFamily: "var(--font-mono)",
                backgroundColor: "var(--bg-input)",
                padding: "12px",
                borderRadius: "var(--radius-sm)",
                color: "var(--status-error)",
                marginBottom: "20px",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all"
              }}>
                {this.state.error.message || String(this.state.error)}
              </pre>
            )}
            <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={this.handleResetAuth}
              >
                sair para o login
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={this.handleReload}
              >
                recarregar painel
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
