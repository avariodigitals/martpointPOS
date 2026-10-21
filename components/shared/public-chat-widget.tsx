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
  if (!mounted || pathname === "/admin" || pathname?.startsWith("/admin/")) return null
  
  // Use the environment-defined business ID for the public site to ensure 
  // the configuration is resolved correctly on the backend.
  const businessId = process.env.NEXT_PUBLIC_AZERA_BUSINESS_ID || "martpoint-support"

  return <AzeraChatWidget businessId={businessId} />
}
