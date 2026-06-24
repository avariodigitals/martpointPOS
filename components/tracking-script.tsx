"use client"

import { useEffect } from "react"

export function TrackingScript() {
  useEffect(() => {
    // Track clicks on links and buttons
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const el = target.closest("a, button") as HTMLElement | null
      if (!el) return

      // Skip admin routes and internal navigation
      const href = el.getAttribute("href") || ""
      if (href.startsWith("/admin")) return

      const text = el.textContent?.trim() || el.getAttribute("aria-label") || "Unknown"
      if (!text) return

      // Use sendBeacon for reliable tracking even on navigation
      const data = JSON.stringify({
        text,
        href: href || window.location.pathname,
        pagePath: window.location.pathname,
      })

      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/track", new Blob([data], { type: "application/json" }))
        } else {
          fetch("/api/track", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: data,
            keepalive: true,
          })
        }
      } catch {
        // silently ignore tracking errors
      }
    }

    document.addEventListener("click", handleClick)
    return () => document.removeEventListener("click", handleClick)
  }, [])

  return null
}
