"use client"

import { useEffect } from "react"

/* Captures ?ref=MP-xxxxx creator tracking links, plus UTMs, and hands them to
 * /api/creator/track which records the click and sets the attribution cookie.
 * First-touch wins: an existing cookie is not overwritten unless a new ref
 * param is present. */
export function CreatorRefCapture() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const ref = params.get("ref")
    if (!ref || !/^MP-\d{1,6}$/i.test(ref)) return
    const sub = params.get("s")
    const trackKey = `${ref.toUpperCase()}:${sub ?? ""}`
    try {
      if (sessionStorage.getItem("mp_ref_tracked") === trackKey) return
      sessionStorage.setItem("mp_ref_tracked", trackKey)
    } catch { /* private mode */ }

    fetch("/api/creator/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: ref.toUpperCase(),
        s: sub && /^sub_[a-z0-9]{8,24}$/i.test(sub) ? sub : null,
        utmSource: params.get("utm_source"),
        utmMedium: params.get("utm_medium"),
        utmCampaign: params.get("utm_campaign"),
        utmContent: params.get("utm_content"),
        pagePath: window.location.pathname,
        referrer: document.referrer || null,
      }),
      keepalive: true,
    }).catch(() => {})
  }, [])

  return null
}
