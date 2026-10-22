"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

interface PortalSessionTimeoutWatcherProps {
  endpoint: string
  loginPath: string
  storageKey: string
}

const HEARTBEAT_MIN_INTERVAL_MS = 60_000
const CHECK_INTERVAL_MS = 15_000
const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000

/**
 * Keeps a portal session alive only while the user is actually interacting.
 * A timer must not refresh an idle session: doing so would make an abandoned
 * browser tab stay authenticated indefinitely.
 */
export function PortalSessionTimeoutWatcher({ endpoint, loginPath, storageKey }: PortalSessionTimeoutWatcherProps) {
  const router = useRouter()

  useEffect(() => {
    let timeoutMs = DEFAULT_TIMEOUT_MS
    let lastActivityAt = Date.now()
    let lastHeartbeatAt = 0
    let activitySinceHeartbeat = true
    let redirecting = false

    const expiredKey = `martpoint:${storageKey}:session-expired-at`
    const activityKey = `martpoint:${storageKey}:last-activity-at`

    function readSharedActivityAt(): number {
      try {
        const shared = Number(localStorage.getItem(activityKey) || 0)
        return Number.isFinite(shared) ? shared : 0
      } catch {
        return 0
      }
    }

    function effectiveLastActivityAt(): number {
      return Math.max(lastActivityAt, readSharedActivityAt())
    }

    function redirectToLogin() {
      if (redirecting) return
      redirecting = true
      try {
        localStorage.setItem(expiredKey, String(Date.now()))
      } catch {
        // Per-tab redirect still works when storage is unavailable.
      }
      router.replace(`${loginPath}?expired=1`)
      router.refresh()
    }

    async function heartbeat(force = false) {
      const now = Date.now()
      if (now - effectiveLastActivityAt() >= timeoutMs) {
        redirectToLogin()
        return
      }
      if (!force && (!activitySinceHeartbeat || now - lastHeartbeatAt < HEARTBEAT_MIN_INTERVAL_MS)) return

      activitySinceHeartbeat = false
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          keepalive: true,
        })
        if (!response.ok) {
          if (response.status === 401) redirectToLogin()
          else activitySinceHeartbeat = true
          return
        }
        const data = await response.json().catch(() => null)
        if (typeof data?.timeoutMs === "number") timeoutMs = data.timeoutMs > 0 ? data.timeoutMs : Number.POSITIVE_INFINITY
        lastHeartbeatAt = Date.now()
      } catch {
        // A temporary network failure should not sign the user out. The next
        // real interaction will retry, while the server remains authoritative.
        activitySinceHeartbeat = true
      }
    }

    function markActivity() {
      const now = Date.now()
      lastActivityAt = now
      try {
        localStorage.setItem(activityKey, String(now))
      } catch {
        // The local tab remains protected when storage is unavailable.
      }
      activitySinceHeartbeat = true
      void heartbeat()
    }

    function checkIdleState() {
      if (document.visibilityState !== "visible") return
      if (Date.now() - effectiveLastActivityAt() >= timeoutMs) {
        redirectToLogin()
        return
      }
      // Only an interaction can make this heartbeat eligible. The interval is
      // a watchdog for expiry, not an automatic keep-alive.
      void heartbeat()
    }

    function onStorage(event: StorageEvent) {
      if (event.key !== expiredKey || !event.newValue) return
      // An idle tab must not sign out another tab that is actively being used.
      // The active tab will still redirect itself if the server rejects its
      // next heartbeat or API request.
      if (Date.now() - effectiveLastActivityAt() < timeoutMs) return
      redirectToLogin()
    }

    void heartbeat(true)
    const activityEvents: Array<keyof WindowEventMap> = [
      "pointerdown",
      "keydown",
      "touchstart",
      "scroll",
      "mousemove",
      "wheel",
      "input",
      "change",
      "focus",
    ]
    activityEvents.forEach((event) => window.addEventListener(event, markActivity, { passive: true }))
    const timer = window.setInterval(checkIdleState, CHECK_INTERVAL_MS)
    document.addEventListener("visibilitychange", checkIdleState)
    window.addEventListener("storage", onStorage)

    return () => {
      window.clearInterval(timer)
      activityEvents.forEach((event) => window.removeEventListener(event, markActivity))
      document.removeEventListener("visibilitychange", checkIdleState)
      window.removeEventListener("storage", onStorage)
    }
  }, [endpoint, loginPath, router, storageKey])

  return null
}
