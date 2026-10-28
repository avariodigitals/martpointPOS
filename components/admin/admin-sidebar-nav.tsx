"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { PortalMobileNav } from "@/components/shared/portal-mobile-nav"
import { PortalSidebar } from "@/components/shared/portal-sidebar"
import type { UserRole } from "@/lib/admin-types"
import { getAdminNavigation, activeAdminHref } from "@/lib/admin-navigation"

// Primary destinations shown in the mobile bottom quick menu (filtered by permission below).
const QUICK_HREFS = ["/admin", "/admin/tasks", "/admin/reports"]
const QUICK_LABELS: Record<string, string> = { "/admin/tasks": "Actions" }

export function AdminSidebarNav({ userName, userRole }: { userName: string; userRole: UserRole }) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" })
    router.push("/admin/login")
    router.refresh()
  }

  const { visibleItems, sections } = getAdminNavigation(userRole)
  const quickItems = QUICK_HREFS.flatMap((href) => {
    const item = visibleItems.find((item) => item.href === href)
    return item ? [{ href: item.href, label: QUICK_LABELS[item.href] ?? item.label, icon: item.icon }] : []
  })
  const search = useSearchParams()
  const activeHref = activeAdminHref(visibleItems, pathname, search)
  const isItemActive = (href: string) => href === activeHref

  return (
    <>
      <PortalMobileNav
        title="MartPoint Control Centre"
        subtitle="Operational source of truth"
        userName={userName}
        quickItems={quickItems}
        sections={sections}
        accordion
        isItemActive={isItemActive}
        onLogout={handleLogout}
        logoutLabel="Logout"
        profileHref="/admin/profile"
      />

      <PortalSidebar
        title="MartPoint Control Centre"
        subtitle="Operational source of truth"
        sections={sections}
        userName={userName}
        onLogout={handleLogout}
        logoutLabel="Logout"
        storageKey="admin-nav"
        accordion
        isItemActive={isItemActive}
        showFooterUser={false}
      />
    </>
  )
}
