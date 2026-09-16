import React, { useState, useRef } from "react"

export function PullToRefresh({ onRefresh, children }) {
  const [pullY, setPullY] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const startYRef = useRef(0)
  const threshold = 65

  function handleTouchStart(e) {
    if (isRefreshing) return
    if (window.scrollY <= 0 || document.documentElement.scrollTop <= 0) {
      startYRef.current = e.touches[0].clientY
    } else {
      startYRef.current = 0
    }
  }

  function handleTouchMove(e) {
    if (!startYRef.current || isRefreshing) return
    const currentY = e.touches[0].clientY
    const diff = currentY - startYRef.current

    if (diff > 0 && (window.scrollY <= 0 || document.documentElement.scrollTop <= 0)) {
      const dampened = Math.min(diff * 0.45, 80)
      setPullY(dampened)
    } else {
      setPullY(0)
    }
  }

  async function handleTouchEnd() {
    if (!startYRef.current || isRefreshing) return
    startYRef.current = 0

    if (pullY >= threshold) {
      setIsRefreshing(true)
      setPullY(42)
      try {
        if (onRefresh) {
          await onRefresh()
        }
      } catch {}
      setTimeout(() => {
        setIsRefreshing(false)
        setPullY(0)
      }, 400)
    } else {
      setPullY(0)
    }
  }

  return (
    <div
      className="pull-to-refresh-wrapper"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {pullY > 0 && (
        <div
          className="pull-to-refresh-indicator"
          style={{
            height: `${pullY}px`,
            opacity: pullY > 10 ? 1 : 0,
            transition: isRefreshing || pullY === 0 ? "all 0.25s ease" : "none"
          }}
        >
          {isRefreshing ? (
            <div className="pull-to-refresh-content">
              <span className="spinner-mini" />
              <span>atualizando dados...</span>
            </div>
          ) : pullY >= threshold ? (
            <span>solte para atualizar</span>
          ) : (
            <span>deslize para atualizar</span>
          )}
        </div>
      )}
      {children}
    </div>
  )
}

