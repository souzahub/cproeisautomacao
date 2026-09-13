import React from "react"

export function Button({ variant = "default", size = "default", className = "", children, ...props }) {
  let baseClass = "btn"
  if (variant === "outline" || variant === "secondary") baseClass += " btn-secondary"
  else if (variant === "destructive" || variant === "danger") baseClass += " btn-danger"
  else baseClass += " btn-primary"

  if (size === "sm") baseClass += " btn-sm"

  return (
    <button className={`${baseClass} ${className}`.trim()} {...props}>
      {children}
    </button>
  )
}
