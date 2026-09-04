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
  Handshake,
  Building2,
  Ticket,
  Activity,
  Shield,
  ClipboardList,
  Command,
} from "lucide-react"
import { LogoutButton } from "./logout-button"
import { hasPermission, type UserRole } from "@/lib/admin-types"

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  page: string
  section?: string
}

const navItems: NavItem[] = [
  // CONTROL CENTRE
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, page: "dashboard", section: "Control Centre" },
  { href: "/admin/tasks", label: "Action Centre", icon: ClipboardList, page: "tasks", section: "Control Centre" },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, page: "analytics", section: "Control Centre" },
  { href: "/admin/audit", label: "Audit Logs", icon: Command, page: "admin", section: "Control Centre" },

  // SALES
  { href: "/admin/leads", label: "Leads", icon: Funnel, page: "leads", section: "Sales" },

  // CUSTOMERS
  { href: "/admin/customers", label: "Customers", icon: Users, page: "customers", section: "Customers" },
  { href: "/admin/businesses", label: "Businesses", icon: Building2, page: "businesses", section: "Customers" },
  { href: "/admin/onboarding", label: "Onboarding", icon: ClipboardCheck, page: "onboarding", section: "Customers" },
  { href: "/admin/customer-success", label: "Customer Success", icon: Activity, page: "customer_success", section: "Customers" },
  { href: "/admin/support", label: "Support", icon: Ticket, page: "support", section: "Customers" },

  // PARTNERS
  { href: "/admin/partners", label: "Partners", icon: Handshake, page: "partners", section: "Partners" },
  { href: "/admin/partners/applications", label: "Applications", icon: FileText, page: "partners", section: "Partners" },
  { href: "/admin/partners/leads", label: "Partner Leads", icon: Funnel, page: "partners", section: "Partners" },
  { href: "/admin/compliance", label: "Compliance", icon: Shield, page: "compliance", section: "Partners" },

  // FINANCE
  { href: "/admin/finance", label: "Finance", icon: Landmark, page: "finance", section: "Finance" },

  // OPERATIONS
  { href: "/admin/incidents", label: "Incidents", icon: Shield, page: "support", section: "Operations" },

  // CONTENT
  { href: "/admin/seo", label: "SEO", icon: Search, page: "seo", section: "Content" },
  { href: "/admin/blog", label: "Blog", icon: FileText, page: "blog", section: "Content" },
  { href: "/admin/faqs", label: "FAQs", icon: HelpCircle, page: "faqs", section: "Content" },
  { href: "/admin/tracker", label: "Tracker", icon: MousePointerClick, page: "tracker", section: "Content" },
  { href: "/admin/tracker/referrers", label: "Traffic Sources", icon: Globe, page: "tracker", section: "Content" },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, page: "analytics", section: "Content" },

  // ADMINISTRATION
  { href: "/admin/settings", label: "Settings", icon: Settings, page: "settings", section: "Administration" },
  { href: "/admin/users", label: "Team Members", icon: Users, page: "users", section: "Administration" },
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

  const grouped = visibleItems.reduce<Record<string, NavItem[]>>((acc, item) => {
    const section = item.section || "Other"
    if (!acc[section]) acc[section] = []
    acc[section].push(item)
    return acc
  }, {})

  return (
    <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/10 bg-[#0A0F1C] text-white">
      <div className="p-6">
        <h1 className="text-xl font-bold text-white">MartPoint Control Centre</h1>
        <p className="text-xs text-gray-400 mt-1">Operational source of truth</p>
      </div>

      <nav className="px-4 pb-2 space-y-6">
        {Object.entries(grouped).map(([section, items]) => (
          <div key={section}>
            <p className="px-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{section}</p>
            <div className="space-y-1">
              {items.map((item) => {
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
            </div>
          </div>
        ))}
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
