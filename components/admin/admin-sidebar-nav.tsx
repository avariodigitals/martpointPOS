"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Settings,
  BarChart3,
  Search,
  FileText,
  MousePointerClick,
  HelpCircle,
  Users,
  Funnel,
  Landmark,
  Globe,
  ClipboardCheck,
} from "lucide-react"
import { LogoutButton } from "./logout-button"
import { hasPermission, type UserRole } from "@/lib/admin-types"

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  page: string
}

const navItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, page: "dashboard" },
  { href: "/admin/leads", label: "Leads", icon: Funnel, page: "leads" },
  { href: "/admin/onboarding", label: "Onboarding", icon: ClipboardCheck, page: "onboarding" },
  { href: "/admin/finance", label: "Finance", icon: Landmark, page: "finance" },
  { href: "/admin/seo", label: "SEO", icon: Search, page: "seo" },
  { href: "/admin/blog", label: "Blog", icon: FileText, page: "blog" },
  { href: "/admin/faqs", label: "FAQs", icon: HelpCircle, page: "faqs" },
  { href: "/admin/tracker", label: "Tracker", icon: MousePointerClick, page: "tracker" },
  { href: "/admin/tracker/referrers", label: "Traffic Sources", icon: Globe, page: "tracker" },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, page: "analytics" },
  { href: "/admin/settings", label: "Settings", icon: Settings, page: "settings" },
  { href: "/admin/users", label: "Team Members", icon: Users, page: "users" },
]

export function AdminSidebarNav({
  userName,
  userRole,
}: {
  userName: string
  userRole: UserRole
}) {
  const pathname = usePathname()

  const visibleItems = navItems.filter((item) => hasPermission(userRole, item.page))

  return (
    <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 bg-[#0A0F1C] text-white">
      <div className="p-6">
        <h1 className="text-xl font-bold text-white">MartPoint Admin</h1>
        <p className="text-xs text-gray-400 mt-1">Manage your site</p>
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

      <div className="px-4 pb-4">
        <div className="pt-4 border-t border-white/10">
          <div className="mb-3 px-3">
            <p className="text-xs font-medium text-white">{userName}</p>
            <p className="text-[11px] text-gray-400 uppercase tracking-wider">{userRole}</p>
          </div>
          <LogoutButton />
        </div>
      </div>
    </aside>
  )
}
