"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useToast } from "@/components/admin/admin-toast"

/**
 * Global safety-net for expired admin sessions.
 *
 * Admin client components make ~100 direct `fetch("/api/admin/...")` calls and
 * none of them check for a 401 — an expiry mid-action previously surfaced as a
 * raw "Unauthorized" string (or silently did nothing). Rewriting every call
 * site would be invasive and easy to miss, so instead we patch `window.fetch`
 * once, inside the admin layout only.
 *
 * When any admin API responds 401 (session missing/expired) we run the same
 * flow as the inactivity watchdog: toast + cross-tab broadcast + redirect to
 * the login page with `?expired=1`.
 *
 * The public website never mounts this, so no other fetch is affected. The
 * patched fetch always falls through to the original implementation — the
 * response is returned untouched.
 */

const CROSS_TAB_KEY = "martpoint:admin:session-expired-at"

export function AdminFetchInterceptor() {
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const originalFetch = window.fetch
    let redirecting = false

    const wrappedFetch: typeof window.fetch = async (input, init) => {
      const response = await originalFetch(input, init)

      if (response.status === 401) {
        // Only react to admin API calls; ignore anything else on a 401.
        const url =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input instanceof Request
                ? input.url
                : ""
        const isAdminApi = url.includes("/api/admin/") && !url.includes("/api/admin/login")

        // The session heartbeat has its own handler; don't double-handle it.
        const isSessionEndpoint = url.includes("/api/admin/session")

        if (isAdminApi && !isSessionEndpoint && !redirecting) {
          redirecting = true
          try {
            localStorage.setItem(CROSS_TAB_KEY, String(Date.now()))
          } catch {
            // ignore
          }
          toast({
            title: "Session expired",
            description: "You were signed out after a period of inactivity. Please sign in again.",
            variant: "warning",
            duration: 6000,
          })
          router.push("/admin/login?expired=1")
          router.refresh()
        }
      }

      return response
    }

    window.fetch = wrappedFetch
    return () => {
      window.fetch = originalFetch
    }
  }, [router, toast])

  return null
}
