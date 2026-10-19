"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import {
  LayoutDashboard,
  Settings,
  Radio,
  BarChart3,
  Search,
  FileText,
  MousePointerClick,
  HelpCircle,
  LifeBuoy,
  Users,
  Funnel,
  Share2,
  Landmark,
  Award,
  Globe,
  ClipboardCheck,
  Handshake,
  HeartHandshake,
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
  Trophy,
  Video,
  CalendarClock,
  GraduationCap,
  FolderOpen,
  Calculator,
  Sparkles,
  FileAudio,
  CreditCard,
  Star,
  type LucideIcon,
} from "lucide-react"
import { PortalMobileNav } from "@/components/shared/portal-mobile-nav"
import { PortalSidebar } from "@/components/shared/portal-sidebar"
import { hasPermission, type UserRole } from "@/lib/admin-types"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
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
  { href: "/admin/quotations?estimator=1", label: "Estimator", icon: Calculator, page: "quotations", section: "Sales" },

  // CUSTOMERS
  { href: "/admin/customers", label: "Customers", icon: Users, page: "customers", section: "Customers" },
  { href: "/admin/businesses", label: "Businesses", icon: Building2, page: "businesses", section: "Customers" },
  { href: "/admin/onboarding", label: "Onboarding", icon: ClipboardCheck, page: "onboarding", section: "Customers" },
  { href: "/admin/customer-success", label: "Customer Success", icon: Activity, page: "customer_success", section: "Customers" },
  { href: "/admin/support", label: "Support", icon: Ticket, page: "support", section: "Customers" },

  // OMNICHANNEL
  { href: "/admin/azera", label: "Azera Chat", icon: MessageCircle, page: "azera", section: "Omnichannel" },
  { href: "/admin/azera/knowledge", label: "AI Knowledge Base", icon: BookOpen, page: "azera", section: "Omnichannel" },
  { href: "/admin/azera/settings", label: "Azera Settings", icon: Settings, page: "azera", section: "Omnichannel" },
  { href: "/admin/azera/reports", label: "Call Reports", icon: FileAudio, page: "support", section: "Omnichannel" },
  { href: "/admin/whatsapp", label: "WhatsApp", icon: MessageCircle, page: "customers", section: "Omnichannel" },
  { href: "/admin/messenger", label: "Messenger", icon: MessageCircle, page: "support", section: "Omnichannel" },
  { href: "/admin/instagram", label: "Instagram DM", icon: Share2, page: "support", section: "Omnichannel" },
  { href: "/admin/google-reviews", label: "Google Reviews", icon: Star, page: "support", section: "Omnichannel" },

  // PARTNERS
  { href: "/admin/partners", label: "Partners", icon: Handshake, page: "partners", section: "Partners" },
  { href: "/admin/partners/applications", label: "Applications", icon: FileText, page: "partners", section: "Partners" },
  { href: "/admin/partners/leads", label: "Partner Leads", icon: Funnel, page: "partners", section: "Partners" },
  { href: "/admin/partners/referrals", label: "Referral Decisions", icon: Share2, page: "partners", section: "Partners" },
  { href: "/admin/partners/prospects", label: "Partner Prospects", icon: UserPlus, page: "partners", section: "Partners" },
  { href: "/admin/partners/payout-requests", label: "Payout Requests", icon: Wallet, page: "finance", section: "Partners" },
  { href: "/admin/partners/bank-changes", label: "Payout Account Changes", icon: Landmark, page: "finance", section: "Partners" },
  { href: "/admin/partners/grades", label: "Partner Grades", icon: Award, page: "partners", section: "Partners" },
  { href: "/admin/partners/branding-requests", label: "Branding Requests", icon: Palette, page: "partners", section: "Partners" },
  { href: "/admin/partners/resources", label: "Partner Resources", icon: BookOpen, page: "partners", section: "Partners" },
  { href: "/admin/partners/guide", label: "Partner Admin Guide", icon: BookOpen, page: "partners", section: "Partners" },
  { href: "/admin/partners/assessments", label: "Partner Assessments", icon: ClipboardCheck, page: "partners", section: "Partners" },
  { href: "/admin/compliance", label: "Compliance", icon: Shield, page: "compliance", section: "Partners" },

  // FINANCE
  { href: "/admin/finance", label: "Finance", icon: Landmark, page: "finance", section: "Finance" },
  { href: "/admin/finance/accounts", label: "Accounts", icon: ArrowLeftRight, page: "finance", section: "Finance" },
  { href: "/admin/finance/chart-of-accounts", label: "Chart of Accounts", icon: Scale, page: "finance", section: "Finance" },
  { href: "/admin/finance/invoices", label: "Invoices", icon: Receipt, page: "finance", section: "Finance" },
  { href: "/admin/finance/payments", label: "Payments", icon: CreditCard, page: "finance", section: "Finance" },
  { href: "/admin/finance/catalog", label: "Catalog", icon: Package, page: "finance", section: "Finance" },
  { href: "/admin/finance/transactions?type=expense", label: "Expenses", icon: Wallet, page: "finance", section: "Finance" },
  { href: "/admin/finance/transactions?type=income", label: "Income", icon: TrendingUp, page: "finance", section: "Finance" },
  { href: "/admin/finance/categories", label: "Categories", icon: Tag, page: "finance", section: "Finance" },
  { href: "/admin/finance/commission-close", label: "Commission Close", icon: CalendarIcon, page: "finance", section: "Finance" },
  { href: "/admin/finance/books-review", label: "Books Review", icon: Sparkles, page: "finance", section: "Finance" },

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
  { href: "/admin/support?category=CREATOR_NETWORK", label: "Creator Support", icon: LifeBuoy, page: "creator.view", section: "Creator Network" },
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
  { href: "/admin/city-requests", label: "City Requests", icon: MapPin, page: "businesses", section: "Administration" },
  { href: "/admin/integrations", label: "Integrations", icon: Radio, page: "integrations", section: "Administration" },
  { href: "/admin/settings/email", label: "Email Settings", icon: Mail, page: "settings", section: "Administration" },
  { href: "/admin/settings/email-routes", label: "Email Routes", icon: Route, page: "settings", section: "Administration" },
  { href: "/admin/settings/email-templates", label: "Email Templates", icon: Mail, page: "settings", section: "Administration" },
  { href: "/admin/settings/client-checkins", label: "Client Check-ins", icon: HeartHandshake, page: "settings", section: "Administration" },
  { href: "/admin/email-logs", label: "Email Logs", icon: FileText, page: "settings", section: "Administration" },
  { href: "/admin/users", label: "Team Members", icon: Users, page: "users", section: "Administration" },
]

// Primary destinations shown in the mobile bottom quick menu (filtered by permission below).
const QUICK_HREFS = ["/admin", "/admin/tasks", "/admin/reports"]
const QUICK_LABELS: Record<string, string> = { "/admin/tasks": "Actions" }

export function AdminSidebarNav({
  userName,
  userRole,
}: {
  userName: string
  userRole: UserRole
}) {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" })
    router.push("/admin/login")
    router.refresh()
  }

  const visibleItems = navItems.filter((item) => hasPermission(userRole, item.page))

  const quickItems = visibleItems
    .filter((item) => QUICK_HREFS.includes(item.href))
    .map((item) => ({ href: item.href, label: QUICK_LABELS[item.href] ?? item.label, icon: item.icon }))

  const grouped = visibleItems.reduce<Record<string, NavItem[]>>((acc, item) => {
    const section = item.section || "Other"
    if (!acc[section]) acc[section] = []
    acc[section].push(item)
    return acc
  }, {})

  const sections = Object.entries(grouped).map(([label, items]) => ({ label, items }))

  const search = useSearchParams()
  const isItemActive = (href: string) => {
    const [path, query] = href.split("?")
    if (pathname !== path) return false
    // Entries that share a path (e.g. Quotations vs Estimator) differ by query.
    if (query) {
      const wanted = new URLSearchParams(query)
      for (const [k, v] of wanted.entries()) {
        if (search.get(k) !== v) return false
      }
      return true
    }
    // A plain path is active only when no distinguishing query is present on a
    // sibling entry (avoids both highlighting on the estimator deep-link).
    return true
  }

  return (
    <>
      <PortalMobileNav
        title="MartPoint Control Centre"
        subtitle="Operational source of truth"
        userName={userName}
        quickItems={quickItems}
        sections={sections}
        isItemActive={isItemActive}
        onLogout={handleLogout}
        logoutLabel="Logout"
      />

      <PortalSidebar
        title="MartPoint Control Centre"
        subtitle="Operational source of truth"
        sections={sections}
        userName={userName}
        userMeta={userRole}
        onLogout={handleLogout}
        logoutLabel="Logout"
        storageKey="admin-nav"
        isItemActive={isItemActive}
      />
    </>
  )
}
