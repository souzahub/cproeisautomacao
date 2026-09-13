import React, { useState, useRef, useEffect } from "react"

export function InfoTooltip({ title, text, example }) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  return (
    <span
      className="info-tooltip-wrapper"
      ref={wrapperRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="info-tooltip-trigger"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((prev) => !prev)
        }}
        aria-label="Informações e exemplos"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      </button>

      {open && (
        <span className="info-tooltip-box" role="tooltip">
          {title && <span className="info-tooltip-title">{title}</span>}
          <span className="info-tooltip-text">{text}</span>
          {example && (
            <span className="info-tooltip-example">
              <strong style={{ color: "var(--text-primary)" }}>exemplo:</strong> {example}
            </span>
          )}
        </span>
      )}
    </span>
  )
}
