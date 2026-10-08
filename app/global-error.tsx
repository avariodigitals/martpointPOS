"use client"

import { ErrorRecovery } from "@/components/admin/error-recovery"

/**
 * Root-level error boundary. Replaces Next.js's bare "Application error" screen
 * when an error escapes every nested boundary (including the root layout).
 *
 * Kept minimal on purpose: a global error boundary must render its own <html>
 * and <body>, and cannot rely on app providers or global CSS being applied.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <ErrorRecovery error={error} reset={reset} global />
      </body>
    </html>
  )
}
