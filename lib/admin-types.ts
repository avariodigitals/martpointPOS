export type UserRole =
  | "Admin"
  | "Finance"
  | "Digital Marketer"
  | "Sales"
  | "Tech"
  | "Editor"
  | "HR Manager"
  | "Hiring Manager"
  | "Reviewer"
  | "Deployment Supervisor"

export interface User {
  id: string
  username: string
  name: string
  passwordHash: string
  role: UserRole
  status: "ACTIVE" | "DISABLED"
  createdAt: string
}

export interface SessionPayload {
  userId: string
  username: string
  role: UserRole
  name: string
}

/* ───────────────────────────  Permissions  ───────────────────────────
 * Canonical permission map. The UI and backend MUST both use this.
 * Previously the Users UI only listed 4 roles while admin-types listed 6,
 * causing inconsistency. Both now reference ALL_ROLES below.
 */

export const ALL_ROLES: UserRole[] = [
  "Admin",
  "Finance",
  "Digital Marketer",
  "Sales",
  "Tech",
  "Editor",
  "HR Manager",
  "Hiring Manager",
  "Reviewer",
  "Deployment Supervisor",
]

/* Careers module granular permissions. These strings double as the `page`
 * argument to authorize()/authorizeAdmin() — hasPermission() checks them
 * literally against the role's list. */
export const CAREERS_PERMISSIONS = [
  "careers.dashboard.view",
  "careers.vacancies.view",
  "careers.vacancies.create",
  "careers.vacancies.edit",
  "careers.vacancies.publish",
  "careers.vacancies.close",
  "careers.applications.view",
  "careers.applications.review",
  "careers.applications.export",
  "careers.applications.delete",
  "careers.assessments.manage",
  "careers.talent_pool.view",
  "careers.talent_pool.manage",
  "careers.deployments.view",
  "careers.deployments.manage",
  "careers.settings.manage",
] as const

const CAREERS_HR_PERMISSIONS = CAREERS_PERMISSIONS.filter(
  (p) => p !== "careers.settings.manage"
)

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  Admin: "Full access to all Control Centre features",
  Finance: "Dashboard, finance, tracker, analytics, leads, customers, onboarding",
  "Digital Marketer": "Dashboard, SEO, blog, FAQs, tracker, analytics, leads, customers, onboarding",
  Sales: "Tracker, analytics, leads, customers, finance, onboarding",
  Tech: "Settings, SEO, blog, FAQs, customers",
  Editor: "Blog & FAQs content only",
  "HR Manager": "Full Careers access — vacancies, applicants, talent pool, assessments, deployments",
  "Hiring Manager": "Assigned vacancies and their applicants — review and scoring",
  Reviewer: "Candidate review and scoring only",
  "Deployment Supervisor": "Assigned deployments, attendance and performance",
}

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  Admin: ["dashboard", "seo", "blog", "faqs", "tracker", "analytics", "settings", "integrations", "users", "leads", "quotations", "customers", "finance", "onboarding", "partners", "businesses", "support", "customer_success", "compliance", "tasks", "marketing", "status"],
  Finance: ["dashboard", "finance", "tracker", "analytics", "leads", "quotations", "customers", "onboarding", "businesses", "compliance"],
  "Digital Marketer": ["dashboard", "seo", "blog", "faqs", "tracker", "analytics", "leads", "quotations", "customers", "onboarding", "businesses", "marketing"],
  Sales: ["tracker", "analytics", "leads", "quotations", "customers", "finance", "onboarding", "businesses", "partners", "customer_success", "marketing"],
  Tech: ["settings", "integrations", "seo", "blog", "faqs", "customers", "businesses", "support", "customer_success", "compliance", "tasks", "status"],
  Editor: ["blog", "faqs"],
  "HR Manager": [...CAREERS_HR_PERMISSIONS, "dashboard"],
  "Hiring Manager": [
    "dashboard",
    "careers.dashboard.view",
    "careers.vacancies.view",
    "careers.applications.view",
    "careers.applications.review",
    "careers.talent_pool.view",
  ],
  Reviewer: [
    "dashboard",
    "careers.dashboard.view",
    "careers.applications.view",
    "careers.applications.review",
  ],
  "Deployment Supervisor": [
    "dashboard",
    "careers.dashboard.view",
    "careers.deployments.view",
    "careers.deployments.manage",
  ],
}

// Finance also sees deployment compensation summaries.
ROLE_PERMISSIONS.Finance = [...ROLE_PERMISSIONS.Finance, "careers.deployments.view"]

export function hasPermission(role: UserRole, page: string): boolean {
  // Admin has full access — mirrors the bypass in authorize(). The literal
  // ROLE_PERMISSIONS.Admin list doesn't enumerate granular permissions like
  // the careers.* set, so without this an Admin would lose menu items and
  // fail PermissionGuard/API checks that call hasPermission directly.
  if (role === "Admin") return true
  return ROLE_PERMISSIONS[role]?.includes(page) ?? false
}

/* ───────────────────────────  Authorization  ───────────────────────────
 * Server-side authorization helper. This is the security boundary.
 * PermissionGuard (client) may remain for UX only and MUST NOT be relied on
 * for security. All new APIs enforce authorization server-side via this.
 *
 * Granular action/resource permissions are prepared here for future RBAC but
 * currently resolve to page-level permissions.
 */

export type AdminAction =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "manage"
  | "approve"
  | "reject"
  | "activate"
  | "suspend"

export interface AuthorizeResult {
  authorized: boolean
  session: SessionPayload | null
}

export function authorize(
  session: SessionPayload | null,
  page: string,
  action?: AdminAction
): boolean {
  if (!session) return false
  // Admin role bypasses granular checks for now.
  if (session.role === "Admin") return true

  // Business CRUD: view is page-level; create/update/delete limited to
  // Admin, Finance, and Sales roles only.
  if (page === "businesses" && action) {
    if (action === "view") return hasPermission(session.role, "businesses")
    return ["Finance", "Sales"].includes(session.role)
  }

  return hasPermission(session.role, page)
}
