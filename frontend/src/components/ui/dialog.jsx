import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from "react"

const DialogContext = createContext(null)

export function Dialog({ open: controlledOpen, onOpenChange, children }) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen
  const [titleId, setTitleId] = useState("dialog-title")

  const handleOpenChange = useCallback((nextOpen) => {
    if (!isControlled) {
      setUncontrolledOpen(nextOpen)
    }
    if (onOpenChange) {
      onOpenChange(nextOpen)
    }
  }, [isControlled, onOpenChange])

  return (
    <DialogContext.Provider value={{ isOpen, setOpen: handleOpenChange, titleId, setTitleId }}>
      {children}
    </DialogContext.Provider>
  )
}

export function DialogTrigger({ render, children, asChild, ...props }) {
  const { setOpen } = useContext(DialogContext)

  if (render && React.isValidElement(render)) {
    return React.cloneElement(render, {
      ...props,
      onClick: (e) => {
        if (render.props.onClick) render.props.onClick(e)
        setOpen(true)
      },
      children: render.props.children || children
    })
  }

  return (
    <button type="button" onClick={() => setOpen(true)} {...props}>
      {children}
    </button>
  )
}

export function DialogContent({ children, className = "", style = {} }) {
  const { isOpen, setOpen, titleId } = useContext(DialogContext)
  const mouseDownTargetRef = useRef(null)
  const contentRef = useRef(null)
  const previousActiveElementRef = useRef(null)
  const setOpenRef = useRef(setOpen)
  setOpenRef.current = setOpen

  useEffect(() => {
    if (!isOpen) return

    previousActiveElementRef.current = document.activeElement

    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setOpenRef.current(false)
        return
      }

      if (e.key === "Tab" && contentRef.current) {
        const focusable = contentRef.current.querySelectorAll(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (focusable.length === 0) return

        const first = focusable[0]
        const last = focusable[focusable.length - 1]

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    // Focar no primeiro input quando o modal abre apenas se não houver foco ativo dentro
    const timer = setTimeout(() => {
      if (contentRef.current) {
        if (contentRef.current.contains(document.activeElement) && document.activeElement !== contentRef.current) {
          return
        }
        const autofocusElement = contentRef.current.querySelector("[autofocus]")
        if (autofocusElement) {
          autofocusElement.focus()
        } else {
          const firstInput = contentRef.current.querySelector(
            'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'
          )
          if (firstInput) {
            firstInput.focus()
          } else {
            const focusable = contentRef.current.querySelectorAll(
              'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
            if (focusable.length > 0) focusable[0].focus()
          }
        }
      }
    }, 50)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      clearTimeout(timer)
      if (previousActiveElementRef.current && previousActiveElementRef.current.focus) {
        previousActiveElementRef.current.focus()
      }
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: "var(--z-modal, 100)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        overflowY: "auto"
      }}
      onMouseDown={(e) => {
        mouseDownTargetRef.current = e.target
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && mouseDownTargetRef.current === e.currentTarget) {
          setOpen(false)
        }
      }}
    >
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`card ${className}`.trim()}
        style={{
          width: "100%",
          maxWidth: "480px",
          position: "relative",
          margin: "auto",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
          ...style,
          maxHeight: style.maxHeight || "calc(100vh - 32px)",
          overflowY: style.overflowY || "auto"
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-ghost"
          style={{
            position: "absolute",
            top: "14px",
            right: "14px",
            color: "var(--text-secondary)",
            padding: "6px",
            borderRadius: "var(--radius-pill)"
          }}
          aria-label="Fechar janela de diálogo"
          title="Fechar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
        {children}
      </div>
    </div>
  )
}

export function DialogHeader({ children, className = "", style = {} }) {
  return (
    <div style={{ marginBottom: "16px", ...style }} className={className}>
      {children}
    </div>
  )
}

export function DialogTitle({ id, children, className = "", style = {} }) {
  const { titleId } = useContext(DialogContext)
  return (
    <h3 id={id || titleId} className={`card-title ${className}`.trim()} style={{ fontSize: "16px", ...style }}>
      {children}
    </h3>
  )
}

export function DialogDescription({ children, className = "", style = {} }) {
  return (
    <p className={`card-desc ${className}`.trim()} style={{ marginTop: "4px", fontSize: "13px", ...style }}>
      {children}
    </p>
  )
}

export function DialogFooter({ children, className = "", style = {} }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: "10px",
        marginTop: "20px",
        paddingTop: "16px",
        borderTop: "1px solid var(--border-subtle)",
        ...style
      }}
      className={className}
    >
      {children}
    </div>
  )
}

export function DialogClose({ children, ...props }) {
  const { setOpen } = useContext(DialogContext)
  return (
    <button type="button" onClick={() => setOpen(false)} {...props}>
      {children}
    </button>
  )
}

