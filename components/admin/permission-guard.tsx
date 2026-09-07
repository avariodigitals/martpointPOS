"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { hasPermission, type UserRole } from "@/lib/admin-types"

const pageMap: Record<string, string> = {
  "/admin": "dashboard",
  "/admin/leads": "leads",
  "/admin/quotations": "quotations",
  "/admin/customers": "customers",
  "/admin/businesses": "businesses",
  "/admin/seo": "seo",
  "/admin/blog": "blog",
  "/admin/faqs": "faqs",
  "/admin/tracker": "tracker",
  "/admin/analytics": "analytics",
  "/admin/settings": "settings",
  "/admin/users": "users",
  "/admin/finance": "finance",
  "/admin/partners": "partners",
  "/admin/tasks": "tasks",
  "/admin/reports": "analytics",
  "/admin/audit": "admin",
}

function matchPage(pathname: string): string | undefined {
  // Exact match first, then prefix match for dynamic routes.
  if (pageMap[pathname]) return pageMap[pathname]
  for (const [path, page] of Object.entries(pageMap)) {
    if (path !== "/admin" && pathname.startsWith(`${path}/`)) return page
  }
  return undefined
}

export function PermissionGuard({
  role,
  children,
}: {
  role: UserRole
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const page = matchPage(pathname)
    if (page && !hasPermission(role, page)) {
      router.replace("/admin")
    }
  }, [pathname, role, router])

  return <>{children}</>
}
