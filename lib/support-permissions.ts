import type { UserRole } from "./admin-types"
import type { PartnerUserRole } from "./partner-permissions"

export type SupportAdminAction =
  | "support:view"
  | "support:create"
  | "support:assign"
  | "support:update"
  | "support:resolve"
  | "support:close"
  | "support:internal_notes"
  | "support:sensitive"
  | "support:sla_manage"
  | "customer_success:view"
  | "customer_success:manage"
  | "compliance:view"
  | "compliance:request"
  | "compliance:review"
  | "compliance:approve"

const SUPPORT_ADMIN_PERMISSIONS: Record<UserRole, SupportAdminAction[]> = {
  Admin: [
    "support:view", "support:create", "support:assign", "support:update", "support:resolve",
    "support:close", "support:internal_notes", "support:sensitive", "support:sla_manage",
    "customer_success:view", "customer_success:manage",
    "compliance:view", "compliance:request", "compliance:review", "compliance:approve",
  ],
  Finance: ["support:view", "customer_success:view"],
  "Digital Marketer": ["support:view", "customer_success:view"],
  Sales: ["support:view", "customer_success:view", "customer_success:manage"],
  Tech: ["support:view", "support:create", "support:update", "support:resolve", "support:sla_manage"],
  Editor: [],
}

export function hasSupportAdminAction(role: UserRole, action: SupportAdminAction): boolean {
  return SUPPORT_ADMIN_PERMISSIONS[role]?.includes(action) ?? false
}

const SENSITIVE_CATEGORIES = new Set([
  "BILLING",
  "LICENSING",
  "SECURITY",
  "PRIVACY_DATA",
  "PARTNER_COMPLAINT",
])

export function isSensitiveSupportCategory(category: string): boolean {
  return SENSITIVE_CATEGORIES.has(category)
}

export function canPartnerAccessSupportCategory(category: string): boolean {
  return !isSensitiveSupportCategory(category)
}

export const PARTNER_SUPPORT_PERMISSIONS = ["support:view_assigned", "support:manage_assigned"] as const
export const PARTNER_COMPLIANCE_PERMISSIONS = ["compliance:view", "compliance:submit"] as const

export type PartnerSupportPermission = (typeof PARTNER_SUPPORT_PERMISSIONS)[number]
export type PartnerCompliancePermission = (typeof PARTNER_COMPLIANCE_PERMISSIONS)[number]
