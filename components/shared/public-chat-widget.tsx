"use client"

import { useSyncExternalStore } from "react"
import { usePathname } from "next/navigation"
import { AzeraChatWidget } from "@/components/shared/azera-chat-widget"

/** The visitor widget belongs to public customer-facing pages, never staff portals. */
export function PublicChatWidget() {
  const pathname = usePathname()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  // Do not render during SSR/hydration or anywhere in the protected admin shell.
  // This prevents the fixed visitor launcher from flashing over the sidebar.
  if (!mounted || pathname === "/admin" || pathname?.startsWith("/admin/")) return null
  return <AzeraChatWidget businessId="martpoint-support" />
}
