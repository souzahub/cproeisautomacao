import React from "react"

export function Skeleton({ variant = "text", width, height, count = 1, style = {} }) {
  const items = Array.from({ length: count }, (_, i) => i)

  return (
    <>
      {items.map((key) => {
        let className = "skeleton"
        if (variant === "title") className += " skeleton-title"
        else if (variant === "card") className += " skeleton-card"
        else if (variant === "row") className += " skeleton-row"
        else className += " skeleton-text"

        const customStyle = {
          ...style,
          ...(width ? { width } : {}),
          ...(height ? { height } : {})
        }

        return <div key={key} className={className} style={customStyle} />
      })}
    </>
  )
}
