import React, { useState } from "react"

export function maskDocument(doc) {
  if (!doc) return ""
  const clean = String(doc).trim()
  if (clean.length === 14 && clean.includes(".")) {
    const parts = clean.split("-")
    return `***.***.${parts[0].split(".")[2] || "***"}-${parts[1] || "**"}`
  }
  if (clean.length > 5) {
    return clean.substring(0, 3) + "*".repeat(Math.max(0, clean.length - 5)) + clean.substring(clean.length - 2)
  }
  return "***"
}

export function MaskedText({ text, defaultVisible = false, className = "", style = {} }) {
  const [visible, setVisible] = useState(defaultVisible)

  if (!text) return <span style={style}>-</span>

  return (
    <span
      className={`masked-text-container ${className}`.trim()}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        fontFamily: "var(--font-mono, inherit)",
        ...style
      }}
    >
      <span>{visible ? text : maskDocument(text)}</span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setVisible(!visible)
        }}
        title={visible ? "ocultar documento" : "exibir documento"}
        aria-label={visible ? "ocultar documento" : "exibir documento"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-secondary)",
          padding: "2px",
          borderRadius: "var(--radius-sm)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          verticalAlign: "middle"
        }}
      >
        {visible ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </span>
  )
}

export function DocumentInput({
  id,
  value,
  onChange,
  placeholder = "000.000.000-00",
  disabled = false,
  error = false,
  className = "",
  ...props
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="password-input-wrapper">
      <input
        id={id}
        type={visible ? "text" : "password"}
        className={`form-input ${error ? "input-error" : ""} ${className}`.trim()}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={error ? "true" : undefined}
        {...props}
      />
      <button
        type="button"
        className="password-toggle-btn"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? "Ocultar documento" : "Exibir documento"}
        title={visible ? "Ocultar documento" : "Exibir documento"}
        disabled={disabled}
      >
        {visible ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  )
}
