"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Settings,
  Radio,
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
  Mail,
  Route,
  Receipt,
  Wallet,
  TrendingUp,
  Tag,
  Package,
  Palette,
  UserPlus,
  Download,
  Calendar as CalendarIcon,
  MessageCircle,
  Megaphone,
  Ban,
  BookOpen,
  Scale,
  ArrowLeftRight,
  Briefcase,
  UserCheck,
  MapPin,
  ChevronDown,
  Trophy,
  Video,
  CalendarClock,
  GraduationCap,
  FolderOpen,
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
  { href: "/admin/calendar", label: "Calendar", icon: CalendarIcon, page: "leads", section: "Sales" },
  { href: "/admin/quotations", label: "Quotations", icon: FileText, page: "quotations", section: "Sales" },

  // CUSTOMERS
  { href: "/admin/customers", label: "Customers", icon: Users, page: "customers", section: "Customers" },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle, page: "customers", section: "Customers" },
  { href: "/admin/businesses", label: "Businesses", icon: Building2, page: "businesses", section: "Customers" },
  { href: "/admin/onboarding", label: "Onboarding", icon: ClipboardCheck, page: "onboarding", section: "Customers" },
  { href: "/admin/customer-success", label: "Customer Success", icon: Activity, page: "customer_success", section: "Customers" },
  { href: "/admin/support", label: "Support", icon: Ticket, page: "support", section: "Customers" },

  // PARTNERS
  { href: "/admin/partners", label: "Partners", icon: Handshake, page: "partners", section: "Partners" },
  { href: "/admin/partners/applications", label: "Applications", icon: FileText, page: "partners", section: "Partners" },
  { href: "/admin/partners/leads", label: "Partner Leads", icon: Funnel, page: "partners", section: "Partners" },
  { href: "/admin/partners/prospects", label: "Partner Prospects", icon: UserPlus, page: "partners", section: "Partners" },
  { href: "/admin/partners/payout-requests", label: "Payout Requests", icon: Wallet, page: "finance", section: "Partners" },
  { href: "/admin/partners/branding-requests", label: "Branding Requests", icon: Palette, page: "partners", section: "Partners" },
  { href: "/admin/partners/resources", label: "Partner Resources", icon: BookOpen, page: "partners", section: "Partners" },
  { href: "/admin/compliance", label: "Compliance", icon: Shield, page: "compliance", section: "Partners" },

  // FINANCE
  { href: "/admin/finance", label: "Finance", icon: Landmark, page: "finance", section: "Finance" },
  { href: "/admin/finance/accounts", label: "Accounts", icon: ArrowLeftRight, page: "finance", section: "Finance" },
  { href: "/admin/finance/chart-of-accounts", label: "Chart of Accounts", icon: Scale, page: "finance", section: "Finance" },
  { href: "/admin/finance/invoices", label: "Invoices", icon: Receipt, page: "finance", section: "Finance" },
  { href: "/admin/finance/catalog", label: "Catalog", icon: Package, page: "finance", section: "Finance" },
  { href: "/admin/finance/transactions?type=expense", label: "Expenses", icon: Wallet, page: "finance", section: "Finance" },
  { href: "/admin/finance/transactions?type=income", label: "Income", icon: TrendingUp, page: "finance", section: "Finance" },
  { href: "/admin/finance/categories", label: "Categories", icon: Tag, page: "finance", section: "Finance" },

  // OPERATIONS
  { href: "/admin/incidents", label: "Incidents", icon: Shield, page: "support", section: "Operations" },
  { href: "/admin/status", label: "Status Page", icon: Activity, page: "status", section: "Operations" },

  // CAREERS
  { href: "/admin/careers", label: "Careers", icon: Briefcase, page: "careers.dashboard.view", section: "Careers" },
  { href: "/admin/careers/vacancies", label: "Vacancies", icon: FileText, page: "careers.vacancies.view", section: "Careers" },
  { href: "/admin/careers/applications", label: "Job Applications", icon: Users, page: "careers.applications.view", section: "Careers" },
  { href: "/admin/careers/talent-pool", label: "Talent Pool", icon: UserCheck, page: "careers.talent_pool.view", section: "Careers" },
  { href: "/admin/careers/assessments", label: "Assessments", icon: ClipboardCheck, page: "careers.assessments.manage", section: "Careers" },
  { href: "/admin/careers/deployments", label: "Deployments", icon: MapPin, page: "careers.deployments.view", section: "Careers" },
  { href: "/admin/careers/role-templates", label: "Role Templates", icon: FileText, page: "careers.role_templates.view", section: "Careers" },
  { href: "/admin/careers/commissions", label: "Commissions", icon: TrendingUp, page: "careers.commissions.view", section: "Careers" },
  { href: "/admin/careers/pipeline", label: "Pipeline", icon: Route, page: "careers.performance.view", section: "Careers" },
  { href: "/admin/careers/performance", label: "Performance", icon: Activity, page: "careers.performance.view", section: "Careers" },
  { href: "/admin/careers/reports", label: "Reports", icon: BarChart3, page: "careers.dashboard.view", section: "Careers" },
  { href: "/admin/careers/settings", label: "Careers Settings", icon: Settings, page: "careers.settings.manage", section: "Careers" },

  // CREATOR NETWORK
  { href: "/admin/creators", label: "Creators Dashboard", icon: Video, page: "creator.view", section: "Creator Network" },
  { href: "/admin/creators/applications", label: "Applications", icon: FileText, page: "creator.view", section: "Creator Network" },
  { href: "/admin/creators/creators", label: "Creators", icon: Users, page: "creator.view", section: "Creator Network" },
  { href: "/admin/creators/interviews", label: "Interviews", icon: CalendarClock, page: "creator.interview.manage", section: "Creator Network" },
  { href: "/admin/creators/challenges", label: "Challenges", icon: Trophy, page: "creator.challenge.manage", section: "Creator Network" },
  { href: "/admin/creators/submissions", label: "Submissions", icon: ClipboardCheck, page: "creator.submission.review", section: "Creator Network" },
  { href: "/admin/creators/leaderboard", label: "Leaderboard", icon: TrendingUp, page: "creator.view", section: "Creator Network" },
  { href: "/admin/creators/rewards", label: "Rewards", icon: Wallet, page: "creator.reward.manage", section: "Creator Network" },
  { href: "/admin/creators/learning", label: "Learning Centre", icon: GraduationCap, page: "creator.learning.manage", section: "Creator Network" },
  { href: "/admin/creators/kit", label: "Creator Kit", icon: FolderOpen, page: "creator.resource.manage", section: "Creator Network" },
  { href: "/admin/creators/guides", label: "Business Guides", icon: Building2, page: "creator.learning.manage", section: "Creator Network" },
  { href: "/admin/creators/faqs", label: "Creator FAQs", icon: HelpCircle, page: "creator.learning.manage", section: "Creator Network" },
  { href: "/admin/creators/reports", label: "Reports", icon: BarChart3, page: "creator.report.view", section: "Creator Network" },
  { href: "/admin/creators/settings", label: "Creator Settings", icon: Settings, page: "creator.settings.manage", section: "Creator Network" },

  // MARKETING
  { href: "/admin/marketing", label: "Campaigns", icon: Megaphone, page: "marketing", section: "Marketing" },
  { href: "/admin/marketing/audiences", label: "Audiences", icon: Users, page: "marketing", section: "Marketing" },
  { href: "/admin/marketing/suppressions", label: "Suppressions", icon: Ban, page: "marketing", section: "Marketing" },

  // CONTENT
  { href: "/admin/seo", label: "SEO", icon: Search, page: "seo", section: "Content" },
  { href: "/admin/blog", label: "Blog", icon: FileText, page: "blog", section: "Content" },
  { href: "/admin/faqs", label: "FAQs", icon: HelpCircle, page: "faqs", section: "Content" },
  { href: "/admin/tracker", label: "Tracker", icon: MousePointerClick, page: "tracker", section: "Content" },
  { href: "/admin/tracker/referrers", label: "Traffic Sources", icon: Globe, page: "tracker", section: "Content" },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3, page: "analytics", section: "Content" },
  { href: "/admin/brochure", label: "Brochure", icon: Download, page: "partners", section: "Content" },

  // ADMINISTRATION
  { href: "/admin/settings", label: "Settings", icon: Settings, page: "settings", section: "Administration" },
  { href: "/admin/integrations", label: "Integrations", icon: Radio, page: "integrations", section: "Administration" },
  { href: "/admin/settings/email", label: "Email Settings", icon: Mail, page: "settings", section: "Administration" },
  { href: "/admin/settings/email-routes", label: "Email Routes", icon: Route, page: "settings", section: "Administration" },
  { href: "/admin/settings/email-templates", label: "Email Templates", icon: Mail, page: "settings", section: "Administration" },
  { href: "/admin/email-logs", label: "Email Logs", icon: FileText, page: "settings", section: "Administration" },
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

  // Collapsed/expanded state per section, persisted across navigations.
  // null = not yet hydrated from localStorage → fall back to "section with active page is open".
  const [openSections, setOpenSections] = useState<Record<string, boolean> | null>(null)

  useEffect(() => {
    let stored: Record<string, boolean> = {}
    try {
      stored = JSON.parse(localStorage.getItem("admin-nav-sections") || "{}")
    } catch {}
    const t = setTimeout(() => setOpenSections(stored), 0)
    return () => clearTimeout(t)
  }, [])

  const pathUnder = (item: NavItem) => {
    const base = item.href.split("?")[0]
    return pathname === base || (base !== "/admin" && pathname.startsWith(base + "/"))
  }

  const isOpen = (section: string, items: NavItem[]) =>
    openSections && section in openSections ? openSections[section] : items.some(pathUnder)

  const toggleSection = (section: string, currentlyOpen: boolean) => {
    const next = { ...(openSections || {}), [section]: !currentlyOpen }
    setOpenSections(next)
    try {
      localStorage.setItem("admin-nav-sections", JSON.stringify(next))
    } catch {}
  }

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
        {Object.entries(grouped).map(([section, items]) => {
          const open = isOpen(section, items)
          return (
          <div key={section}>
            <button
              type="button"
              onClick={() => toggleSection(section, open)}
              className="w-full flex items-center justify-between px-3 py-1 mb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors"
              aria-expanded={open}
            >
              {section}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "" : "-rotate-90"}`} />
            </button>
            {open && (
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
            )}
          </div>
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
