"use client"

import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Building2,
  Users,
  FileCheck,
  FileText,
  FolderOpen,
  Target,
  Share2,
  Briefcase,
  GraduationCap,
  Award,
  BadgeCheck,
  Palette,
  Wallet,
  FileQuestion,
  ClipboardList,
  LifeBuoy,
  type LucideIcon,
} from "lucide-react"
import { PortalMobileNav } from "@/components/shared/portal-mobile-nav"
import { PortalSidebar } from "@/components/shared/portal-sidebar"
import { partnerUserHasPermission, type PartnerUserRole, type PartnerOrgCapability, type PartnerPermission } from "@/lib/partner-permissions"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  permission?: string
  capabilities?: PartnerOrgCapability[]
}

const navItems: NavItem[] = [
  { href: "/partner", label: "Dashboard", icon: LayoutDashboard },
  { href: "/partner/leads", label: "Leads", icon: Target, permission: "leads:view", capabilities: ["SALES", "REFERRALS", "IMPLEMENTATION", "CUSTOMER_ONBOARDING"] },
  { href: "/partner/referrals", label: "Referrals", icon: Share2, permission: "leads:view", capabilities: ["REFERRALS"] },
  { href: "/partner/quotes", label: "Quotes", icon: FileQuestion, permission: "quotes:request_own", capabilities: ["SALES", "REFERRALS"] },
  { href: "/partner/work-orders", label: "Work Orders", icon: ClipboardList, permission: "workorders:view_own", capabilities: ["IMPLEMENTATION", "CUSTOMER_ONBOARDING"] },
  { href: "/partner/commissions", label: "Earnings", icon: Wallet, permission: "commissions:view_own" },
  { href: "/partner/customers", label: "Customers", icon: Briefcase, permission: "customers:view_assigned" },
  { href: "/partner/profile", label: "Profile", icon: Building2, permission: "partner:profile:view" },
  { href: "/partner/team", label: "Team", icon: Users, permission: "partner:users:view" },
  { href: "/partner/compliance", label: "Compliance", icon: FileCheck, permission: "partner:compliance:view" },
  { href: "/partner/documents", label: "Documents", icon: FileText, permission: "partner:resources:view" },
  { href: "/partner/training", label: "Training", icon: GraduationCap, permission: "partner:resources:view" },
  { href: "/partner/certification", label: "Certification", icon: Award, permission: "partner:resources:view" },
  { href: "/partner/assessments", label: "Assessments", icon: ClipboardList, permission: "partner:resources:view" },
  { href: "/partner/branded-materials", label: "Branded Materials", icon: Palette, permission: "partner:resources:view" },
  { href: "/partner/badge-kit", label: "Badge Kit", icon: BadgeCheck, permission: "partner:resources:view" },
  { href: "/partner/resources", label: "Resources", icon: FolderOpen, permission: "partner:resources:view" },
  { href: "/partner/support", label: "Support Tickets", icon: LifeBuoy, permission: "partner:support:create" },
]

// Primary destinations shown in the mobile bottom quick menu (filtered by permissions below).
const QUICK_HREFS = ["/partner", "/partner/leads", "/partner/quotes", "/partner/commissions", "/partner/support"]

export function PartnerSidebarNav({
  partnerName,
  partnerId,
  userName,
  userRole,
  capabilities,
}: {
  partnerName: string
  partnerId: string
  userName: string
  userRole: PartnerUserRole
  capabilities: PartnerOrgCapability[]
}) {
  const pathname = usePathname()
  const router = useRouter()

  const visibleItems = navItems.filter((item) => {
    if (item.permission && !partnerUserHasPermission(userRole, item.permission as PartnerPermission)) return false
    if (item.capabilities && !item.capabilities.some((c) => capabilities.includes(c))) return false
    return true
  })

  const quickItems = visibleItems.filter((item) => QUICK_HREFS.includes(item.href))

  const handleLogout = async () => {
    await fetch("/api/partner/logout", { method: "POST" })
    router.push("/partner/login")
    router.refresh()
  }

  return (
    <>
      <PortalMobileNav
        title="Partner Portal"
        subtitle={partnerName}
        userName={userName}
        quickItems={quickItems}
        sections={[{ items: visibleItems }]}
        isItemActive={(href) => pathname === href}
        onLogout={handleLogout}
        logoutLabel="Logout"
      />

      <PortalSidebar
        title="Partner Portal"
        subtitle={partnerName}
        meta={[partnerId]}
        sections={[{ items: visibleItems }]}
        userName={userName}
        userMeta={userRole.replace("PARTNER_", "")}
        footerNote={capabilities.length > 0 ? capabilities.join(" · ") : undefined}
        onLogout={handleLogout}
        logoutLabel="Logout"
        storageKey="partner-nav"
        isItemActive={(href) => pathname === href}
      />
    </>
  )
}
