"use client"

import { ErrorRecovery } from "@/components/admin/error-recovery"

/**
 * Error boundary for the whole admin area.
 *
 * Catches render/navigation failures (most commonly a stale client bundle after
 * a Vercel redeploy, which surfaces as "Application error") and recovers
 * gracefully instead of leaving the user on a dead page.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorRecovery error={error} reset={reset} />
}
