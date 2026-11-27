import type { UserRole } from "./admin-types"
import { hasEffectivePermissionForRoles } from "./permission-overrides"
import { supabase } from "./supabase"

export type FinanceAction =
  | "finance:view"
  | "finance:quotes:create"
  | "finance:quotes:approve"
  | "finance:invoices:create"
  | "finance:invoices:issue"
  | "finance:invoices:void"
  | "finance:invoices:remind"
  | "finance:invoices:approval_request"
  | "finance:approvals:request"
  | "finance:payments:view"
  | "finance:payments:record"
  | "finance:payments:confirm"
  | "finance:payments:reverse"
  | "finance:subscriptions:view"
  | "finance:subscriptions:manage"
  | "finance:renewals:manage"
  | "finance:commissions:view"
  | "finance:commissions:approve"
  | "finance:commissions:payout"
  | "finance:accounts:manage"
  | "finance:reports:view"

export const FINANCE_PERMISSION_KEYS: FinanceAction[] = [
  "finance:view", "finance:quotes:create", "finance:quotes:approve", "finance:invoices:create", "finance:invoices:issue", "finance:invoices:void", "finance:invoices:remind", "finance:invoices:approval_request", "finance:approvals:request",
  "finance:payments:view", "finance:payments:record", "finance:payments:confirm", "finance:payments:reverse", "finance:subscriptions:view", "finance:subscriptions:manage",
  "finance:renewals:manage", "finance:commissions:view", "finance:commissions:approve", "finance:commissions:payout", "finance:accounts:manage", "finance:reports:view",
]

const FINANCE_PERMISSIONS: Record<UserRole, FinanceAction[]> = {
  Admin: [
    "finance:view", "finance:quotes:create", "finance:quotes:approve",
    "finance:invoices:create", "finance:invoices:issue", "finance:invoices:void", "finance:invoices:remind", "finance:invoices:approval_request", "finance:approvals:request",
    "finance:payments:view", "finance:payments:record", "finance:payments:confirm", "finance:payments:reverse",
    "finance:subscriptions:view", "finance:subscriptions:manage",
    "finance:renewals:manage",
    "finance:commissions:view", "finance:commissions:approve", "finance:commissions:payout",
    "finance:accounts:manage",
    "finance:reports:view",
  ],
  "Super Admin": [
    "finance:view", "finance:quotes:create", "finance:quotes:approve",
    "finance:invoices:create", "finance:invoices:issue", "finance:invoices:void", "finance:invoices:remind", "finance:invoices:approval_request", "finance:approvals:request",
    "finance:payments:view", "finance:payments:record", "finance:payments:confirm", "finance:payments:reverse",
    "finance:subscriptions:view", "finance:subscriptions:manage", "finance:renewals:manage",
    "finance:commissions:view", "finance:commissions:approve", "finance:commissions:payout", "finance:accounts:manage", "finance:reports:view",
  ],
  Finance: [
    "finance:view",
    "finance:quotes:create", "finance:quotes:approve",
    "finance:invoices:create", "finance:invoices:issue", "finance:invoices:remind", "finance:invoices:approval_request", "finance:approvals:request",
    "finance:payments:view", "finance:payments:record", "finance:payments:confirm", "finance:payments:reverse",
    "finance:subscriptions:view", "finance:subscriptions:manage",
    "finance:renewals:manage",
    "finance:commissions:view", "finance:commissions:approve",
    "finance:accounts:manage",
    "finance:reports:view",
  ],
  "Digital Marketer": ["finance:view"],
  Sales: ["finance:view", "finance:payments:view", "finance:quotes:create", "finance:invoices:approval_request", "finance:approvals:request"],
  "Customer Care": [],
  Tech: ["finance:view"],
  Editor: [],
  "HR Manager": [],
  "Hiring Manager": [],
  Reviewer: [],
  "Deployment Supervisor": [],
  "Deployment Manager": [],
  "Partner Manager": [],
}

export function hasFinanceAction(role: UserRole | UserRole[], action: FinanceAction): boolean {
  const roles = Array.isArray(role) ? role : [role]
  return roles.some((item) => FINANCE_PERMISSIONS[item]?.includes(action) ?? false)
}

export async function hasFinanceActionForUser(userId: string, role: UserRole | UserRole[], action: FinanceAction): Promise<boolean> {
  const { data } = await supabase.from("users").select("roles").eq("id", userId).maybeSingle()
  const fallbackRoles = Array.isArray(role) ? role : [role]
  const roles = Array.isArray(data?.roles) && data.roles.length ? data.roles as UserRole[] : fallbackRoles
  return hasEffectivePermissionForRoles(userId, roles, action, hasFinanceAction(roles, action))
}
