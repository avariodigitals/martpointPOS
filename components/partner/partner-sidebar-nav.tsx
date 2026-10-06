"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Building2,
  Users,
  FileCheck,
  FileText,
  FolderOpen,
  LogOut,
  Target,
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

      <aside className="hidden md:flex md:flex-col md:w-64 border-r border-white/10 bg-[#0A0F1C] text-white">
        <div className="p-6">
          <h1 className="text-lg font-bold text-white">Partner Portal</h1>
          <p className="text-xs text-gray-400 mt-1 truncate">{partnerName}</p>
          <p className="text-[10px] text-gray-500 font-mono mt-0.5">{partnerId}</p>
        </div>

        <nav className="px-4 pb-2 space-y-1">
          {visibleItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-retail text-white"
                    : "text-gray-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="px-4 pb-4 mt-auto">
          <div className="pt-4 border-t border-white/10">
            <div className="mb-3 px-3">
              <p className="text-xs font-medium text-white">{userName}</p>
              <p className="text-[11px] text-gray-400 uppercase tracking-wider">{userRole.replace("PARTNER_", "")}</p>
              {capabilities.length > 0 && (
                <p className="text-[10px] text-gray-500 mt-1">{capabilities.join(" · ")}</p>
              )}
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-400 hover:text-white hover:bg-white/10 transition-colors w-full"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
