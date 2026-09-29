/**
 * Fire a GA4 event via gtag() if the Google tag is loaded.
 * The tag is only injected after analytics consent, so calls made
 * before consent silently no-op — no extra consent checks needed here.
 */
export function gaEvent(name: string, params: Record<string, string | number | boolean> = {}) {
  if (typeof window === "undefined") return
  const gtag = (window as { gtag?: (...args: unknown[]) => void }).gtag
  if (typeof gtag === "function") {
    gtag("event", name, params)
  }
}

/**
 * Fire a TikTok Pixel standard event (e.g. "SubmitForm", "ClickButton").
 * The pixel only loads after marketing consent, so calls before that
 * silently no-op.
 */
export function ttqEvent(name: string, params: Record<string, string | number | boolean> = {}) {
  if (typeof window === "undefined") return
  const ttq = (window as { ttq?: { track?: (event: string, params?: Record<string, string | number | boolean>) => void } }).ttq
  if (ttq && typeof ttq.track === "function") {
    ttq.track(name, params)
  }
}
