import React, { createContext, useContext, useState, useEffect } from "react"
import { Button } from "./button"

const AlertDialogContext = createContext(null)

export function AlertDialog({ open: controlledOpen, onOpenChange, children }) {
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
    <AlertDialogContext.Provider value={{ isOpen, setOpen: handleOpenChange }}>
      {children}
    </AlertDialogContext.Provider>
  )
}

export function AlertDialogTrigger({ render, children, asChild, ...props }) {
  const { setOpen } = useContext(AlertDialogContext)

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

export function AlertDialogContent({ size = "default", children, className = "", style = {} }) {
  const { isOpen, setOpen } = useContext(AlertDialogContext)
  const mouseDownTargetRef = React.useRef(null)

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

  const maxWidth = size === "sm" ? "400px" : "500px"

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 110,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        backgroundColor: "rgba(0, 0, 0, 0.7)",
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
        className={`card ${className}`.trim()}
        style={{
          width: "100%",
          maxWidth,
          position: "relative",
          margin: "auto",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.4)",
          ...style,
          maxHeight: style.maxHeight || "calc(100vh - 32px)",
          overflowY: style.overflowY || "auto"
        }}
      >
        {children}
      </div>
    </div>
  )
}

export function AlertDialogHeader({ children, className = "", style = {} }) {
  return (
    <div style={{ marginBottom: "16px", ...style }} className={className}>
      {children}
    </div>
  )
}

export function AlertDialogTitle({ children, className = "", style = {} }) {
  return (
    <h3 className={`card-title ${className}`.trim()} style={{ fontSize: "16px", ...style }}>
      {children}
    </h3>
  )
}

export function AlertDialogDescription({ children, className = "", style = {} }) {
  return (
    <p className={`card-desc ${className}`.trim()} style={{ marginTop: "6px", fontSize: "13px", lineHeight: 1.5, ...style }}>
      {children}
    </p>
  )
}

export function AlertDialogFooter({ children, className = "", style = {} }) {
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

export function AlertDialogCancel({ children = "cancelar", onClick, ...props }) {
  const { setOpen } = useContext(AlertDialogContext)

  return (
    <Button
      variant="outline"
      onClick={(e) => {
        if (onClick) onClick(e)
        setOpen(false)
      }}
      {...props}
    >
      {children}
    </Button>
  )
}

export function AlertDialogAction({ children = "confirmar", onClick, variant = "primary", ...props }) {
  const { setOpen } = useContext(AlertDialogContext)

  return (
    <Button
      variant={variant}
      onClick={(e) => {
        if (onClick) onClick(e)
        setOpen(false)
      }}
      {...props}
    >
      {children}
    </Button>
  )
}
