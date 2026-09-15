import React from "react"

export function Button({
  variant = "default",
  size = "default",
  loading = false,
  disabled = false,
  className = "",
  children,
  ...props
}) {
  let baseClass = "btn"
  if (variant === "outline") baseClass += " btn-outline"
  else if (variant === "secondary") baseClass += " btn-secondary"
  else if (variant === "ghost") baseClass += " btn-ghost"
  else if (variant === "destructive" || variant === "danger") baseClass += " btn-danger"
  else baseClass += " btn-primary"

  if (size === "sm") baseClass += " btn-sm"
  if (size === "icon") baseClass += " btn-icon"

  return (
    <button
      className={`${baseClass} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading ? "true" : undefined}
      {...props}
    >
      {loading && (
        <svg
          className="btn-spinner"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      )}
      {children}
    </button>
  )
}

