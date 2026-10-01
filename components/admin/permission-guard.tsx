"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { hasPermission, type UserRole } from "@/lib/admin-types"

const pageMap: Record<string, string> = {
  "/admin": "dashboard",
  "/admin/leads": "leads",
  "/admin/quotations": "quotations",
  "/admin/customers": "customers",
  "/admin/whatsapp": "customers",
  "/admin/businesses": "businesses",
  "/admin/seo": "seo",
  "/admin/blog": "blog",
  "/admin/faqs": "faqs",
  "/admin/tracker": "tracker",
  "/admin/analytics": "analytics",
  "/admin/settings": "settings",
  "/admin/integrations": "integrations",
  "/admin/users": "users",
  "/admin/finance": "finance",
  "/admin/partners": "partners",
  "/admin/tasks": "tasks",
  "/admin/reports": "analytics",
  "/admin/audit": "admin",
  "/admin/marketing": "marketing",
  "/admin/careers": "careers.dashboard.view",
  "/admin/careers/vacancies": "careers.vacancies.view",
  "/admin/careers/applications": "careers.applications.view",
  "/admin/careers/talent-pool": "careers.talent_pool.view",
  "/admin/careers/assessments": "careers.assessments.manage",
  "/admin/careers/deployments": "careers.deployments.view",
  "/admin/careers/role-templates": "careers.role_templates.view",
  "/admin/careers/commissions": "careers.commissions.view",
  "/admin/careers/pipeline": "careers.performance.view",
  "/admin/careers/performance": "careers.performance.view",
  "/admin/careers/reports": "careers.dashboard.view",
  "/admin/careers/settings": "careers.settings.manage",
  "/admin/creators": "creator.view",
  "/admin/creators/applications": "creator.view",
  "/admin/creators/creators": "creator.view",
  "/admin/creators/interviews": "creator.interview.manage",
  "/admin/creators/challenges": "creator.challenge.manage",
  "/admin/creators/submissions": "creator.submission.review",
  "/admin/creators/leaderboard": "creator.view",
  "/admin/creators/rewards": "creator.reward.manage",
  "/admin/creators/learning": "creator.learning.manage",
  "/admin/creators/kit": "creator.learning.manage",
  "/admin/creators/reports": "creator.report.view",
  "/admin/creators/settings": "creator.settings.manage",
}

function matchPage(pathname: string): string | undefined {
  // Exact match first, then longest-prefix match for dynamic routes.
  if (pageMap[pathname]) return pageMap[pathname]
  let best: string | undefined
  let bestLen = 0
  for (const [path, page] of Object.entries(pageMap)) {
    if (path !== "/admin" && pathname.startsWith(`${path}/`) && path.length > bestLen) {
      best = page
      bestLen = path.length
    }
  }
  return best
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
