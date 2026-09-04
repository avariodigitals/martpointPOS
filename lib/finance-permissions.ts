import type { UserRole } from "./admin-types"

export type FinanceAction =
  | "finance:view"
  | "finance:quotes:create"
  | "finance:quotes:approve"
  | "finance:invoices:create"
  | "finance:invoices:issue"
  | "finance:invoices:void"
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
  | "finance:reports:view"

const FINANCE_PERMISSIONS: Record<UserRole, FinanceAction[]> = {
  Admin: [
    "finance:view", "finance:quotes:create", "finance:quotes:approve",
    "finance:invoices:create", "finance:invoices:issue", "finance:invoices:void",
    "finance:payments:view", "finance:payments:record", "finance:payments:confirm", "finance:payments:reverse",
    "finance:subscriptions:view", "finance:subscriptions:manage",
    "finance:renewals:manage",
    "finance:commissions:view", "finance:commissions:approve", "finance:commissions:payout",
    "finance:reports:view",
  ],
  Finance: [
    "finance:view",
    "finance:quotes:create", "finance:quotes:approve",
    "finance:invoices:create", "finance:invoices:issue",
    "finance:payments:view", "finance:payments:record", "finance:payments:confirm", "finance:payments:reverse",
    "finance:subscriptions:view", "finance:subscriptions:manage",
    "finance:renewals:manage",
    "finance:commissions:view", "finance:commissions:approve",
    "finance:reports:view",
  ],
  "Digital Marketer": ["finance:view"],
  Sales: ["finance:view", "finance:quotes:create"],
  Tech: ["finance:view"],
  Editor: [],
}

export function hasFinanceAction(role: UserRole, action: FinanceAction): boolean {
  return FINANCE_PERMISSIONS[role]?.includes(action) ?? false
}
