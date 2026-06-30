"use client"

import { useEffect } from "react"

const CTA_PATHS = [
  "/pricing",
  "/book-demo",
  "/request-quote",
  "/contact",
  "/martpoint-retail",
  "/martpoint-erp",
  "/about",
  "/blog",
]

/** Global throttle: max 1 tracking request per 15 seconds */
let lastTrackTime = 0
const TRACK_COOLDOWN_MS = 15000

function isBot(): boolean {
  if (typeof navigator === "undefined") return true
  const ua = navigator.userAgent.toLowerCase()
  return /bot|crawler|spider|scraper|curl|wget|phantomjs|headless/.test(ua)
}

function isImportantCta(el: HTMLElement): boolean {
  // Skip admin pages entirely
  if (window.location.pathname.startsWith("/admin")) return false

  const href = el.getAttribute("href") || ""
  if (href.startsWith("/admin")) return false

  // Only track external links (WhatsApp, social, outbound)
  if (href.startsWith("http")) return true

  // Only track specific high-value CTA paths — skip general internal navigation
  if (CTA_PATHS.some((p) => href === p || href.startsWith(p + "/"))) return true

  // Track elements explicitly marked
  if (el.dataset.track === "cta") return true

  // Track buttons inside forms (lead capture)
  if (el.closest("form") && el.tagName === "BUTTON") return true

  // Track download/demo buttons by text
  const text = el.textContent?.trim().toLowerCase() || ""
  const ctaKeywords = ["demo", "quote", "contact", "get started", "buy now", "subscribe", "download", "try free", "sign up"]
  if (ctaKeywords.some((kw) => text.includes(kw))) return true

  return false
}

function getCtaKey(el: HTMLElement): string {
  const text = el.textContent?.trim().slice(0, 50) || ""
  const href = el.getAttribute("href") || window.location.pathname
  return `${text}::${href}`
}

export function TrackingScript() {
  useEffect(() => {
    // Skip entirely for bots / headless browsers
    if (isBot()) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const el = target.closest("a, button") as HTMLElement | null
      if (!el) return

      if (!isImportantCta(el)) return

      // Global time throttle: max 1 request per 15s across the whole session
      const now = Date.now()
      if (now - lastTrackTime < TRACK_COOLDOWN_MS) return
      lastTrackTime = now

      // Session-level dedupe: each unique CTA once per session
      const key = `tracked_${getCtaKey(el)}`
      try {
        if (sessionStorage.getItem(key)) return
        sessionStorage.setItem(key, "1")
      } catch {
        // sessionStorage might be unavailable
      }

      const text = el.textContent?.trim() || el.getAttribute("aria-label") || "Unknown"
      const href = el.getAttribute("href") || window.location.pathname

      const data = JSON.stringify({
        text: text.slice(0, 100),
        href,
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
