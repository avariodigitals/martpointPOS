"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"

export type PartnerTrackEvent =
  | "directory_click"
  | "profile_view"
  | "verify_lookup"
  | "website_click"
  | "phone_click"
  | "email_click"
  | "sales_cta_click"

/** Fire-and-forget tracking beacon to /api/partners/track. */
export function trackPartnerEvent(
  partnerId: string,
  event: PartnerTrackEvent,
  meta?: Record<string, unknown>
) {
  try {
    const payload = JSON.stringify({ partnerId, event, meta })
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon("/api/partners/track", new Blob([payload], { type: "application/json" }))
    } else {
      fetch("/api/partners/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {})
    }
  } catch {
    /* tracking must never break the page */
  }
}

/** Fires a single event on mount (e.g. profile_view / verify_lookup). */
export function TrackPartnerEvent({
  partnerId,
  event,
  meta,
}: {
  partnerId: string
  event: PartnerTrackEvent
  meta?: Record<string, unknown>
}) {
  const pathname = usePathname()
  useEffect(() => {
    trackPartnerEvent(partnerId, event, { ...meta, path: pathname })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partnerId, event, pathname])
  return null
}
