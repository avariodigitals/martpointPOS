import {
  LayoutDashboard,
  Settings,
  Radio,
  BarChart3,
  FileText,
  HelpCircle,
  LifeBuoy,
  Users,
  Funnel,
  Share2,
  Landmark,
  Award,
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
  Calendar as CalendarIcon,
  MessageCircle,
  Megaphone,
  Smartphone,
  Workflow,
  Search,
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
  PhoneCall,
  CreditCard,
  Star,
  type LucideIcon
} from "lucide-react"
import { hasPermission, type UserRole } from "@/lib/admin-types"

export interface AdminNavItem {
  href: string
  label: string
  icon: LucideIcon
  page: string
  section: string
  permissions?: string[]
}

export const ADMIN_SECTION_ORDER = [
  "Control Centre",
  "Communications",
  "Content & Website",
  "Creator Network",
  "Partner Network",
  "Sales",
  "Approvals & Workflows",
  "Finance",
  "Onboarding & Customers",
  "Contact Centre",
  "Support & Inbox",
  "Operations",
  "People & Careers",
  "Administration"
] as const

export const adminNavItems: AdminNavItem[] = [
  // Control Centre
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, page: "dashboard", section: "Control Centre" },
  {
    href: "/admin/tasks",
    label: "Action Centre",
    icon: ClipboardList,
    page: "tasks",
    section: "Control Centre"
  },
  { href: "/admin/mailbox", label: "Mailbox", icon: Mail, page: "mailbox", section: "Support & Inbox" },
  { href: "/admin/communications/sms", label: "SMS", icon: Smartphone, page: "marketing", section: "Communications", permissions: ["leads"] },
  { href: "/admin/communications/email", label: "Email", icon: Mail, page: "marketing", section: "Communications" },
  { href: "/admin/communications/whatsapp", label: "WhatsApp", icon: MessageCircle, page: "marketing", section: "Communications", permissions: ["leads"] },
  { href: "/admin/communications/automation", label: "Automation", icon: Workflow, page: "marketing", section: "Communications", permissions: ["leads"] },
  { href: "/admin/blog", label: "Blog", icon: FileText, page: "blog", section: "Content & Website" },
  { href: "/admin/faqs", label: "FAQs", icon: HelpCircle, page: "faqs", section: "Content & Website" },
  { href: "/admin/brochure", label: "Brochure", icon: BookOpen, page: "partners", section: "Content & Website" },
  { href: "/admin/seo", label: "SEO", icon: Search, page: "seo", section: "Content & Website" },
  { href: "/admin/tracker", label: "Website tracker", icon: Activity, page: "tracker", section: "Content & Website" },
  { href: "/admin/tracker/referrers", label: "Traffic sources", icon: Route, page: "tracker", section: "Content & Website" },
  { href: "/admin/analytics", label: "Website analytics", icon: BarChart3, page: "analytics", section: "Content & Website" },
  { href: "/admin/reports", label: "Reports", icon: BarChart3, page: "analytics", section: "Control Centre" },

  // Creator Network
  {
    href: "/admin/creators",
    label: "Creators Dashboard",
    icon: Video,
    page: "creator.view",
    section: "Creator Network"
  },
  {
    href: "/admin/creators/applications",
    label: "Applications",
    icon: FileText,
    page: "creator.view",
    section: "Creator Network"
  },
  {
    href: "/admin/creators/interviews",
    label: "Interviews",
    icon: CalendarClock,
    page: "creator.interview.manage",
    section: "Creator Network"
  },
  {
    href: "/admin/creators/creators",
    label: "Creators",
    icon: Users,
    page: "creator.view",
    section: "Creator Network"
  },
  {
    href: "/admin/creators/learning",
    label: "Learning Centre",
    icon: GraduationCap,
    page: "creator.learning.manage",
    section: "Creator Network"
  },
  {
    href: "/admin/creators/kit",
    label: "Creator Kit",
    icon: FolderOpen,
    page: "creator.resource.manage",
    section: "Creator Network"
  },
  {
    href: "/admin/creators/guides",
    label: "Business Guides",
    icon: Building2,
    page: "creator.learning.manage",
    section: "Creator Network"
  },
  {
    href: "/admin/creators/faqs",
    label: "Creator FAQs",
    icon: HelpCircle,
    page: "creator.learning.manage",
    section: "Creator Network"
  },
  {
    href: "/admin/creators/challenges",
    label: "Challenges",
    icon: Trophy,
    page: "creator.challenge.manage",
    section: "Creator Network"
  },
  {
    href: "/admin/creators/submissions",
    label: "Submissions",
    icon: ClipboardCheck,
    page: "creator.submission.review",
    section: "Creator Network"
  },
  {
    href: "/admin/creators/leaderboard",
    label: "Leaderboard",
    icon: TrendingUp,
    page: "creator.view",
    section: "Creator Network"
  },
  {
    href: "/admin/creators/rewards",
    label: "Rewards",
    icon: Wallet,
    page: "creator.reward.manage",
    section: "Creator Network"
  },
  {
    href: "/admin/support?category=CREATOR_NETWORK",
    label: "Creator Support",
    icon: LifeBuoy,
    page: "creator.view",
    section: "Creator Network"
  },
  {
    href: "/admin/creators/reports",
    label: "Reports",
    icon: BarChart3,
    page: "creator.report.view",
    section: "Creator Network"
  },

  // Partner Network
  {
    href: "/admin/partners/prospects",
    label: "Partner Prospects",
    icon: UserPlus,
    page: "partners",
    section: "Partner Network"
  },
  {
    href: "/admin/partners/applications",
    label: "Applications",
    icon: FileText,
    page: "partners",
    section: "Partner Network"
  },
  {
    href: "/admin/partners/assessments",
    label: "Partner Assessments",
    icon: ClipboardCheck,
    page: "partners",
    section: "Partner Network"
  },
  {
    href: "/admin/compliance",
    label: "Compliance",
    icon: Shield,
    page: "compliance",
    section: "Partner Network"
  },
  {
    href: "/admin/partners",
    label: "Partners",
    icon: Handshake,
    page: "partners",
    section: "Partner Network"
  },
  {
    href: "/admin/partners/grades",
    label: "Partner Grades",
    icon: Award,
    page: "partners",
    section: "Partner Network"
  },
  {
    href: "/admin/partners/resources",
    label: "Partner Resources",
    icon: BookOpen,
    page: "partners",
    section: "Partner Network"
  },
  {
    href: "/admin/partners/branding-requests",
    label: "Branding Requests",
    icon: Palette,
    page: "partners",
    section: "Partner Network"
  },
  {
    href: "/admin/partners/leads",
    label: "Partner Leads",
    icon: Funnel,
    page: "partners",
    section: "Partner Network"
  },
  {
    href: "/admin/partners/quotes",
    label: "Partner Quotes",
    icon: FileText,
    page: "partner_quotes",
    section: "Partner Network"
  },
  {
    href: "/admin/partners/referrals",
    label: "Referral Decisions",
    icon: Share2,
    page: "partners",
    section: "Partner Network"
  },
  {
    href: "/admin/partners/guide",
    label: "Partner Admin Guide",
    icon: BookOpen,
    page: "partners",
    section: "Partner Network"
  },

  // Sales
  { href: "/admin/leads", label: "Leads", icon: Funnel, page: "leads", section: "Sales" },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarIcon, page: "leads", section: "Sales" },
  {
    href: "/admin/quotations?estimator=1",
    label: "Estimator",
    icon: Calculator,
    page: "quotations",
    section: "Sales"
  },
  { href: "/admin/quotations", label: "Quotations", icon: FileText, page: "quotations", section: "Sales" },

  // Approvals & Workflows
  { href: "/admin/approvals", label: "Approval Inbox", icon: ClipboardCheck, page: "approvals", section: "Approvals & Workflows" },

  // Finance
  { href: "/admin/finance", label: "Finance", icon: Landmark, page: "finance", section: "Finance" },
  { href: "/admin/finance/invoices", label: "Invoices", icon: Receipt, page: "finance.invoices.view", section: "Finance" },
  {
    href: "/admin/finance/payments",
    label: "Payments",
    icon: CreditCard,
    page: "finance.payments.view",
    section: "Finance"
  },
  {
    href: "/admin/finance/transactions?type=income",
    label: "Income",
    icon: TrendingUp,
    page: "finance",
    section: "Finance"
  },
  {
    href: "/admin/finance/transactions?type=expense",
    label: "Expenses",
    icon: Wallet,
    page: "finance",
    section: "Finance"
  },
  {
    href: "/admin/finance/accounts",
    label: "Accounts",
    icon: ArrowLeftRight,
    page: "finance",
    section: "Finance"
  },
  {
    href: "/admin/partners/payout-requests",
    label: "Payout Requests",
    icon: Wallet,
    page: "finance",
    section: "Finance"
  },
  {
    href: "/admin/partners/bank-changes",
    label: "Payout Account Changes",
    icon: Landmark,
    page: "finance",
    section: "Finance"
  },
  {
    href: "/admin/finance/commission-close",
    label: "Commission Close",
    icon: CalendarIcon,
    page: "finance",
    section: "Finance"
  },
  {
    href: "/admin/finance/books-review",
    label: "Books Review",
    icon: Sparkles,
    page: "finance",
    section: "Finance"
  },
  { href: "/admin/finance/reports", label: "Reports", icon: BarChart3, page: "finance", section: "Finance" },
  { href: "/admin/finance/catalog", label: "Catalog", icon: Package, page: "finance", section: "Finance" },
  { href: "/admin/finance/categories", label: "Categories", icon: Tag, page: "finance", section: "Finance" },
  {
    href: "/admin/finance/chart-of-accounts",
    label: "Chart of Accounts",
    icon: Scale,
    page: "finance",
    section: "Finance"
  },

  // Onboarding & Customers
  {
    href: "/admin/onboarding",
    label: "Onboarding",
    icon: ClipboardCheck,
    page: "onboarding",
    section: "Onboarding & Customers"
  },
  {
    href: "/admin/businesses",
    label: "Businesses",
    icon: Building2,
    page: "businesses",
    section: "Onboarding & Customers"
  },
  {
    href: "/admin/customers",
    label: "Customers",
    icon: Users,
    page: "customers",
    section: "Onboarding & Customers"
  },
  {
    href: "/admin/customer-success",
    label: "Customer Success",
    icon: Activity,
    page: "customer_success",
    section: "Onboarding & Customers"
  },

  // Contact Centre
  {
    href: "/admin/azera/calls",
    label: "My Phone",
    icon: PhoneCall,
    page: "azera",
    section: "Contact Centre"
  },
  {
    href: "/admin/azera/campaigns",
    label: "Voice Campaigns",
    icon: Megaphone,
    page: "azera",
    section: "Contact Centre"
  },
  {
    href: "/admin/azera/voicemails",
    label: "Voicemails",
    icon: FileAudio,
    page: "azera",
    section: "Contact Centre"
  },
  {
    href: "/admin/azera/reports",
    label: "Call Reports",
    icon: BarChart3,
    page: "azera",
    section: "Contact Centre"
  },
  // Support & Inbox
  {
    href: "/admin/support",
    label: "Support Desk",
    icon: Ticket,
    page: "support",
    section: "Support & Inbox"
  },
  {
    href: "/admin/azera",
    label: "Azera Chat",
    icon: MessageCircle,
    page: "azera",
    section: "Support & Inbox"
  },
  {
    href: "/admin/azera/knowledge",
    label: "AI Knowledge Base",
    icon: BookOpen,
    page: "azera",
    section: "Support & Inbox"
  },
  {
    href: "/admin/google-reviews",
    label: "Google Reviews",
    icon: Star,
    page: "support",
    section: "Support & Inbox"
  },

  // Operations
  { href: "/admin/incidents", label: "Incidents", icon: Shield, page: "support", section: "Operations" },
  { href: "/admin/status", label: "Status Page", icon: Activity, page: "status", section: "Operations" },

  // People & Careers
  {
    href: "/admin/careers",
    label: "Careers",
    icon: Briefcase,
    page: "careers.dashboard.view",
    section: "People & Careers"
  },
  {
    href: "/admin/careers/role-templates",
    label: "Role Templates",
    icon: FileText,
    page: "careers.role_templates.view",
    section: "People & Careers"
  },
  {
    href: "/admin/careers/vacancies",
    label: "Vacancies",
    icon: FileText,
    page: "careers.vacancies.view",
    section: "People & Careers"
  },
  {
    href: "/admin/careers/applications",
    label: "Job Applications",
    icon: Users,
    page: "careers.applications.view",
    section: "People & Careers"
  },
  {
    href: "/admin/careers/talent-pool",
    label: "Talent Pool",
    icon: UserCheck,
    page: "careers.talent_pool.view",
    section: "People & Careers"
  },
  {
    href: "/admin/careers/assessments",
    label: "Assessments",
    icon: ClipboardCheck,
    page: "careers.assessments.manage",
    section: "People & Careers"
  },
  {
    href: "/admin/careers/deployments",
    label: "Deployments",
    icon: MapPin,
    page: "careers.deployments.view",
    section: "People & Careers"
  },
  {
    href: "/admin/careers/pipeline",
    label: "Pipeline",
    icon: Route,
    page: "careers.performance.view",
    section: "People & Careers"
  },
  {
    href: "/admin/careers/performance",
    label: "Performance",
    icon: Activity,
    page: "careers.performance.view",
    section: "People & Careers"
  },
  {
    href: "/admin/careers/commissions",
    label: "Commissions",
    icon: TrendingUp,
    page: "careers.commissions.view",
    section: "People & Careers"
  },
  {
    href: "/admin/careers/reports",
    label: "Reports",
    icon: BarChart3,
    page: "careers.dashboard.view",
    section: "People & Careers"
  },

  // Administration
  { href: "/admin/users", label: "Team Members", icon: Users, page: "users", section: "Administration" },
  { href: "/admin/settings", label: "Settings", icon: Settings, page: "settings", section: "Administration" },
  { href: "/admin/settings/approvals", label: "Approval Rules", icon: Shield, page: "settings", section: "Administration" },
  {
    href: "/admin/azera/settings",
    label: "Azera Settings",
    icon: Settings,
    page: "azera",
    section: "Administration"
  },
  {
    href: "/admin/azera/voice-agents",
    label: "Voice Agent Assignments",
    icon: PhoneCall,
    page: "settings",
    section: "Administration"
  },
  {
    href: "/admin/creators/settings",
    label: "Creator Settings",
    icon: Settings,
    page: "creator.settings.manage",
    section: "Administration"
  },
  {
    href: "/admin/careers/settings",
    label: "Careers Settings",
    icon: Settings,
    page: "careers.settings.manage",
    section: "Administration"
  },
  {
    href: "/admin/integrations",
    label: "Integrations",
    icon: Radio,
    page: "integrations",
    section: "Administration"
  },
  {
    href: "/admin/settings/email",
    label: "Email Settings",
    icon: Mail,
    page: "settings",
    section: "Administration"
  },
  {
    href: "/admin/settings/email-routes",
    label: "Email Routes",
    icon: Route,
    page: "settings",
    section: "Administration"
  },
  {
    href: "/admin/settings/email-templates",
    label: "Email Templates",
    icon: Mail,
    page: "settings",
    section: "Administration"
  },
  {
    href: "/admin/settings/client-checkins",
    label: "Client Check-ins",
    icon: HeartHandshake,
    page: "settings",
    section: "Administration"
  },
  {
    href: "/admin/city-requests",
    label: "City Requests",
    icon: MapPin,
    page: "businesses",
    section: "Administration"
  },
  {
    href: "/admin/email-logs",
    label: "Email Logs",
    icon: FileText,
    page: "settings",
    section: "Administration"
  },
  { href: "/admin/audit", label: "Audit Logs", icon: Command, page: "admin", section: "Administration" }
]

export function getAdminNavigation(role: UserRole, overrides: Record<string, "allow" | "deny"> = {}) {
  const can = (permission: string) => role === "Admin" || (overrides[permission] === "allow" ? true : overrides[permission] === "deny" ? false : hasPermission(role, permission))
  const visibleItems = adminNavItems.filter((item) => can(item.page) && (item.permissions || []).every(can))
  const sections = ADMIN_SECTION_ORDER.map((label) => ({
    label,
    collapsible: label !== "Control Centre",
    items: visibleItems.filter((item) => item.section === label)
  })).filter((section) => section.items.length > 0)
  return { visibleItems, sections }
}

const GROWTH_WORKSPACE_PERMISSIONS = ["marketing", "blog", "faqs", "seo", "tracker", "analytics", "partners"] as const

export function hasGrowthWorkspaceAccess(role: UserRole) {
  return GROWTH_WORKSPACE_PERMISSIONS.some((permission) => hasPermission(role, permission))
}

/** Most-specific permitted destination wins, including query-only siblings. */
export function activeAdminHref(
  items: Pick<AdminNavItem, "href">[],
  pathname: string,
  query: Pick<URLSearchParams, "get">
): string | undefined {
  return items
    .map((item) => {
      const [path, search] = item.href.split("?")
      if (path !== pathname && (path === "/admin" || !pathname.startsWith(path + "/"))) return null
      const wanted = new URLSearchParams(search)
      for (const [key, value] of wanted) if (query.get(key) !== value) return null
      return { href: item.href, score: path.length * 100 + Array.from(wanted).length }
    })
    .filter((item): item is { href: string; score: number } => item !== null)
    .sort((a, b) => b.score - a.score)[0]?.href
}
