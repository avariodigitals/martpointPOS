import type { UserRole } from "./admin-types"
import { hasEffectivePermission } from "./permission-overrides"

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
}

export function hasFinanceAction(role: UserRole, action: FinanceAction): boolean {
  return FINANCE_PERMISSIONS[role]?.includes(action) ?? false
}

export async function hasFinanceActionForUser(userId: string, role: UserRole, action: FinanceAction): Promise<boolean> {
  return hasEffectivePermission(userId, role, action, hasFinanceAction(role, action))
}
