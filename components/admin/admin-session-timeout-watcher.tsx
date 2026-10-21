"use client"

import { PortalSessionTimeoutWatcher } from "@/components/shared/portal-session-timeout-watcher"

/**
 * Admin portal inactivity protection. The shared watcher refreshes only after
 * real interaction, so an abandoned tab cannot keep an admin session alive.
 */

export function AdminSessionTimeoutWatcher() {
  return <PortalSessionTimeoutWatcher endpoint="/api/admin/session" loginPath="/admin/login" storageKey="admin" />
}
