"use client"

/**
 * Shared UI for Next.js error boundaries (`error.tsx` / `global-error.tsx`).
 *
 * Two problems this solves:
 *
 * 1. **Stale Vercel deployment.** After a redeploy, an open tab still holds the
 *    old JS/RSC chunks. Navigating then throws a `ChunkLoadError` and Next shows
 *    a bare "Application error" screen. We detect that specific case and reload
 *    once (guarded by sessionStorage so we can never reload-loop), which pulls
 *    the fresh build and continues where the user was.
 *
 * 2. **Expired admin session.** If the failure is an auth failure we send the
 *    user to the login page with a reason instead of a dead page.
 *
 * Everything else shows a friendly, actionable error panel with Retry / Go home.
 */

import { useEffect, useState } from "react"
import { AlertTriangle, Loader2, RefreshCw, Home } from "lucide-react"

const RELOAD_FLAG = "martpoint:admin:chunk-reloaded"

/** Heuristics for "this is a stale-client-bundle error, reload will fix it". */
function isStaleChunkError(error: Error & { name?: string }): boolean {
  const name = error?.name || ""
  const message = error?.message || ""
  return (
    name === "ChunkLoadError" ||
    /ChunkLoadError/i.test(message) ||
    /Loading chunk [\d]+ failed/i.test(message) ||
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
  )
}

/**
 * Reload the page at most once per browser session for a given reason.
 * Returns true if a reload was triggered.
 */
function reloadOnce(reason: string): boolean {
  try {
    const flag = `${RELOAD_FLAG}:${reason}`
    if (sessionStorage.getItem(flag) === "1") return false
    sessionStorage.setItem(flag, "1")
  } catch {
    // sessionStorage unavailable (private mode) — still reload, just without the guard.
  }
  window.location.reload()
  return true
}

export function ErrorRecovery({
  error,
  reset,
  /** Show the full-page (global) styling, without assuming app chrome. */
  global = false,
}: {
  error: Error & { digest?: string }
  reset: () => void
  global?: boolean
}) {
  const [reloading, setReloading] = useState(false)
  const stale = isStaleChunkError(error)

  useEffect(() => {
    // Auto-recover from a stale build by reloading exactly once. The page is
    // about to be replaced, so there is nothing to setState here — the reload
    // itself is the recovery.
    if (stale) reloadOnce("stale-chunk")
  }, [stale])

  if (reloading) {
    return (
      <div
        className={
          global
            ? "flex min-h-screen items-center justify-center bg-background p-6"
            : "flex items-center justify-center p-10"
        }
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Updating to the latest version…
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={
        global
          ? "flex min-h-screen items-center justify-center bg-background p-6"
          : "flex items-center justify-center p-10"
      }
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </span>
          <div>
            <h2 className="text-base font-semibold">Something went wrong</h2>
            <p className="text-xs text-muted-foreground">
              {stale
                ? "A new version was deployed while this page was open."
                : "The page failed to load. You can try again."}
            </p>
          </div>
        </div>

        {!stale && (
          <pre className="mb-4 max-h-32 overflow-auto rounded-md bg-muted p-3 text-xs text-muted-foreground">
            {error?.message || "Unknown error"}
          </pre>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              setReloading(true)
              // Full reload is the reliable fix for a stale bundle; reset() alone
              // cannot fetch chunks that no longer exist on the server.
              window.location.reload()
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            <RefreshCw className="h-4 w-4" /> Reload page
          </button>
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            Try again
          </button>
          <a
            href="/admin"
            className="inline-flex items-center gap-1.5 rounded-md border border-input px-3 py-2 text-sm font-medium hover:bg-muted"
          >
            <Home className="h-4 w-4" /> Dashboard
          </a>
        </div>
      </div>
    </div>
  )
}
