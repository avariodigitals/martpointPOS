"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { hasPermission, type UserRole } from "@/lib/admin-types"

const pageMap: Record<string, string> = {
  "/admin": "dashboard",
  "/admin/leads": "leads",
  "/admin/seo": "seo",
  "/admin/blog": "blog",
  "/admin/faqs": "faqs",
  "/admin/tracker": "tracker",
  "/admin/analytics": "analytics",
  "/admin/settings": "settings",
  "/admin/users": "users",
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
    const page = pageMap[pathname]
    if (page && !hasPermission(role, page)) {
      router.replace("/admin")
    }
  }, [pathname, role, router])

  return <>{children}</>
}
