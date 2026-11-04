"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { hasGrowthWorkspaceAccess } from "@/lib/admin-navigation"
import { hasPermission, type UserRole } from "@/lib/admin-types"
import { useToast } from "@/components/admin/admin-toast"

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
  "/admin/approvals": "approvals",
  "/admin/partners": "partners",
  "/admin/partners/quotes": "partner_quotes",
  "/admin/tasks": "tasks",
  "/admin/mailbox": "mailbox",
  "/admin/reports": "analytics",
  "/admin/audit": "admin",
  "/admin/marketing": "marketing",
  "/admin/communications": "marketing",
  "/admin/communications/sms": "marketing",
  "/admin/communications/email": "marketing",
  "/admin/communications/whatsapp": "marketing",
  "/admin/communications/automation": "marketing",
  "/admin/growth": "growth_workspace",
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
  "/admin/creators/kit": "creator.resource.manage",
  "/admin/creators/guides": "creator.learning.manage",
  "/admin/creators/faqs": "creator.learning.manage",
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
  const { toast } = useToast()
  const lastDeniedPath = useRef("")
  const [overrides, setOverrides] = useState<Record<string, "allow" | "deny"> | null>(null)
  const [permissionsLoaded, setPermissionsLoaded] = useState(false)
  const page = matchPage(pathname)
  useEffect(() => {
    let active = true
    setPermissionsLoaded(false)
    fetch("/api/admin/my-permissions").then((response) => response.ok ? response.json() : null).then((data) => {
      if (!active) return
      setOverrides(data?.overrides || {})
      setPermissionsLoaded(true)
    }).catch(() => {
      if (!active) return
      setOverrides({})
      setPermissionsLoaded(true)
    })
    return () => { active = false }
  }, [pathname])
  const roleAllowed = page === "growth_workspace" ? hasGrowthWorkspaceAccess(role) : !page || hasPermission(role, page)
  const override = page ? overrides?.[page] : undefined
  const allowed = permissionsLoaded && (override === "allow" ? true : override === "deny" ? false : roleAllowed)

  useEffect(() => {
    if (permissionsLoaded && !allowed) {
      if (lastDeniedPath.current !== pathname) {
        lastDeniedPath.current = pathname
        toast({ title: "Unauthorized", description: "You do not have access to this page. Ask an Admin if you need access.", variant: "error" })
      }
      router.replace("/admin")
    } else {
      lastDeniedPath.current = ""
    }
  }, [allowed, permissionsLoaded, pathname, router, toast])

  return allowed ? <>{children}</> : null
}
