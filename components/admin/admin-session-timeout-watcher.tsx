"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"

/**
 * Server-side inactivity watchdog for the admin portal ONLY.
 *
 * This component mounts inside the admin protected layout and periodically
 * refreshes the session's `lastActive` timestamp so that an idle admin is
 * signed out after the globally-configured `ADMIN_SESSION_TIMEOUT_MINUTES`.
 *
 * The public website never mounts this component, so non-admin users are
 * completely unaffected.
 */

const SIGNED_OUT_EVENT = "martpoint:admin:session-expired"

export function AdminSessionTimeoutWatcher() {
  const router = useRouter()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const redirectingRef = useRef(false)

  useEffect(() => {
    async function heartbeat() {
      try {
        const res = await fetch("/api/admin/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })

        if (res.ok) {
          const data = await res.json().catch(() => null)
          const timeoutMs = data?.timeoutMs
          if (typeof timeoutMs === "number" && timeoutMs > 0) {
            // Ping again halfway through the timeout window.
            schedule(Math.min(timeoutMs, 15 * 60 * 1000) / 2)
          }
          return
        }

        if (res.status === 401) {
          handleExpired()
          return
        }
      } catch {
        // Network blip — keep the current timer; the server still enforces expiry.
      }
    }

    function schedule(delayMs: number) {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        void heartbeat()
      }, Math.max(delayMs, 10_000))
    }

    function handleExpired() {
      if (redirectingRef.current) return
      redirectingRef.current = true
      window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
      router.push("/admin/login")
      router.refresh()
    }

    // Kick off immediately, then it self-schedules.
    void heartbeat()

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [router])

  return null
}
