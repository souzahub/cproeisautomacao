import React, { createContext, useContext, useState, useEffect } from "react"

const DialogContext = createContext(null)

export function Dialog({ open: controlledOpen, onOpenChange, children }) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : uncontrolledOpen

  function handleOpenChange(nextOpen) {
    if (!isControlled) {
      setUncontrolledOpen(nextOpen)
    }
    if (onOpenChange) {
      onOpenChange(nextOpen)
    }
  }

  return (
    <DialogContext.Provider value={{ isOpen, setOpen: handleOpenChange }}>
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
  const { isOpen, setOpen } = useContext(DialogContext)

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && isOpen) {
        setOpen(false)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, setOpen])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        backgroundColor: "rgba(0, 0, 0, 0.65)"
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div
        className={`card ${className}`.trim()}
        style={{
          width: "100%",
          maxWidth: "480px",
          position: "relative",
          margin: 0,
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.3)",
          ...style
        }}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            color: "var(--text-secondary)",
            padding: "4px"
          }}
          aria-label="Fechar"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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

export function DialogTitle({ children, className = "", style = {} }) {
  return (
    <h3 className={`card-title ${className}`.trim()} style={{ fontSize: "16px", ...style }}>
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
