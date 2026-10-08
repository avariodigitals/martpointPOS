"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/admin/admin-toast"

/**
 * Server-side inactivity watchdog for the admin portal ONLY.
 *
 * This component mounts inside the admin protected layout and periodically
 * refreshes the session's `lastActive` timestamp so that an idle admin is
 * signed out after the globally-configured `ADMIN_SESSION_TIMEOUT_MINUTES`.
 *
 * When the session HAS expired we must make that obvious instead of silently
 * bouncing the user to a blank login page (the previous behaviour). So we:
 *   1. show a toast explaining what happened,
 *   2. broadcast to any other open admin tabs (so they sign out together),
 *   3. redirect to /admin/login?expired=1 so the reason survives the navigation.
 *
 * The public website never mounts this component, so non-admin users are
 * completely unaffected.
 */

const SIGNED_OUT_EVENT = "martpoint:admin:session-expired"
const CROSS_TAB_KEY = "martpoint:admin:session-expired-at"

export function AdminSessionTimeoutWatcher() {
  const router = useRouter()
  const { toast } = useToast()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const redirectingRef = useRef(false)

  useEffect(() => {
    function goToLogin(reason: "expired" | "other-tab") {
      if (redirectingRef.current) return
      redirectingRef.current = true
      window.dispatchEvent(new Event(SIGNED_OUT_EVENT))
      router.push("/admin/login?expired=1")
      router.refresh()
      // The toast is best-effort; the login page also shows a persistent banner
      // so the message is never lost even if this render is unmounted.
      if (reason === "other-tab") {
        toast({
          title: "Signed out in another tab",
          description: "You were signed out in another tab. Please sign in again.",
          variant: "warning",
          duration: 6000,
        })
      } else {
        toast({
          title: "Session expired",
          description: "You were signed out after a period of inactivity. Please sign in again.",
          variant: "warning",
          duration: 6000,
        })
      }
    }

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
          try {
            // Tell other tabs too (read in the storage listener below).
            localStorage.setItem(CROSS_TAB_KEY, String(Date.now()))
          } catch {
            // localStorage unavailable — per-tab handling still works.
          }
          goToLogin("expired")
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

    // Re-check immediately when the user returns to the tab. Without this, an
    // admin who leaves a tab idle and comes back could interact with a dead
    // session for up to ~7.5 minutes before the next scheduled ping.
    function onVisibility() {
      if (document.visibilityState === "visible") void heartbeat()
    }

    // Another tab detected the expiry — sign out here too.
    function onStorage(e: StorageEvent) {
      if (e.key === CROSS_TAB_KEY && e.newValue) goToLogin("other-tab")
    }

    // Kick off immediately, then it self-schedules.
    void heartbeat()
    document.addEventListener("visibilitychange", onVisibility)
    window.addEventListener("storage", onStorage)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      document.removeEventListener("visibilitychange", onVisibility)
      window.removeEventListener("storage", onStorage)
    }
  }, [router, toast])

  return null
}
