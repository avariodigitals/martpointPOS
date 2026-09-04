export type UserRole = "Admin" | "Finance" | "Digital Marketer" | "Sales" | "Tech" | "Editor"

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
]

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  Admin: "Full access to all Control Centre features",
  Finance: "Dashboard, finance, tracker, analytics, leads, customers, onboarding",
  "Digital Marketer": "Dashboard, SEO, blog, FAQs, tracker, analytics, leads, customers, onboarding",
  Sales: "Tracker, analytics, leads, customers, finance, onboarding",
  Tech: "Settings, SEO, blog, FAQs, customers",
  Editor: "Blog & FAQs content only",
}

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  Admin: ["dashboard", "seo", "blog", "faqs", "tracker", "analytics", "settings", "users", "leads", "customers", "finance", "onboarding", "partners", "businesses", "support", "customer_success", "compliance", "tasks"],
  Finance: ["dashboard", "finance", "tracker", "analytics", "leads", "customers", "onboarding", "businesses", "compliance"],
  "Digital Marketer": ["dashboard", "seo", "blog", "faqs", "tracker", "analytics", "leads", "customers", "onboarding", "businesses"],
  Sales: ["tracker", "analytics", "leads", "customers", "finance", "onboarding", "businesses", "partners", "customer_success"],
  Tech: ["settings", "seo", "blog", "faqs", "customers", "businesses", "support", "customer_success", "compliance", "tasks"],
  Editor: ["blog", "faqs"],
}

export function hasPermission(role: UserRole, page: string): boolean {
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
  _action?: AdminAction,
  _resource?: string
): boolean {
  if (!session) return false
  // Admin role bypasses granular checks for now.
  if (session.role === "Admin") return true
  return hasPermission(session.role, page)
}
