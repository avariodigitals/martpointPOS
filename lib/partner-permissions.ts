import type { PartnerType } from "./partners"

export type PartnerUserRole =
  | "PARTNER_OWNER"
  | "PARTNER_MANAGER"
  | "PARTNER_SALES"
  | "PARTNER_IMPLEMENTATION"
  | "PARTNER_SUPPORT"

export type PartnerUserStatus = "INVITED" | "ACTIVE" | "SUSPENDED" | "DISABLED"

export type PartnerOrgCapability =
  | "REFERRALS"
  | "SALES"
  | "IMPLEMENTATION"
  | "FIRST_LINE_SUPPORT"
  | "TECHNOLOGY"
  | "PAYMENT"
  | "TRAINING"
  | "CUSTOMER_ONBOARDING"

export type AccessLevel = "VIEW_ONLY" | "SALES" | "ONBOARDING_MANAGER" | "SUPPORT"

export const PARTNER_USER_ROLES: PartnerUserRole[] = [
  "PARTNER_OWNER",
  "PARTNER_MANAGER",
  "PARTNER_SALES",
  "PARTNER_IMPLEMENTATION",
  "PARTNER_SUPPORT",
]

export const PARTNER_ROLE_LABELS: Record<PartnerUserRole, string> = {
  PARTNER_OWNER: "Owner",
  PARTNER_MANAGER: "Manager",
  PARTNER_SALES: "Sales",
  PARTNER_IMPLEMENTATION: "Implementation",
  PARTNER_SUPPORT: "Support",
}

export const PARTNER_PERMISSIONS = [
  "partner:profile:view",
  "partner:profile:update",
  "partner:users:view",
  "partner:users:invite",
  "partner:users:manage",
  "partner:compliance:view",
  "partner:compliance:submit",
  "partner:resources:view",
  "leads:view",
  "leads:create",
  "leads:update",
  "customers:view_assigned",
  "onboarding:view_assigned",
  "onboarding:manage_assigned",
  "support:view_assigned",
  "support:manage_assigned",
  "commissions:view_own",
] as const

export type PartnerPermission = (typeof PARTNER_PERMISSIONS)[number]

export const ROLE_PERMISSIONS: Record<PartnerUserRole, PartnerPermission[]> = {
  PARTNER_OWNER: [
    "partner:profile:view",
    "partner:profile:update",
    "partner:users:view",
    "partner:users:invite",
    "partner:users:manage",
    "partner:compliance:view",
    "partner:compliance:submit",
    "partner:resources:view",
    "leads:view",
    "leads:create",
    "leads:update",
    "customers:view_assigned",
    "onboarding:view_assigned",
    "onboarding:manage_assigned",
    "support:view_assigned",
    "support:manage_assigned",
    "commissions:view_own",
  ],
  PARTNER_MANAGER: [
    "partner:profile:view",
    "partner:profile:update",
    "partner:users:view",
    "partner:compliance:view",
    "partner:compliance:submit",
    "partner:resources:view",
  ],
  PARTNER_SALES: [
    "partner:profile:view",
    "partner:resources:view",
    "leads:view",
    "leads:create",
    "leads:update",
  ],
  PARTNER_IMPLEMENTATION: [
    "partner:profile:view",
    "partner:resources:view",
    "onboarding:view_assigned",
    "onboarding:manage_assigned",
  ],
  PARTNER_SUPPORT: [
    "partner:profile:view",
    "partner:resources:view",
    "support:view_assigned",
    "support:manage_assigned",
  ],
}

export function partnerUserHasPermission(
  role: PartnerUserRole,
  permission: PartnerPermission
): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export const ORG_CAPABILITY_LABELS: Record<PartnerOrgCapability, string> = {
  REFERRALS: "Referrals",
  SALES: "Sales",
  IMPLEMENTATION: "Implementation",
  FIRST_LINE_SUPPORT: "First Line Support",
  TECHNOLOGY: "Technology",
  PAYMENT: "Payment",
  TRAINING: "Training",
  CUSTOMER_ONBOARDING: "Customer Onboarding",
}

export const PARTNER_TYPE_DEFAULT_CAPABILITIES: Record<PartnerType, PartnerOrgCapability[]> = {
  REFERRAL: ["REFERRALS"],
  CHANNEL: ["REFERRALS", "SALES"],
  IMPLEMENTATION: ["IMPLEMENTATION", "CUSTOMER_ONBOARDING"],
  CHANNEL_IMPLEMENTATION: ["REFERRALS", "SALES", "IMPLEMENTATION", "CUSTOMER_ONBOARDING"],
  TECHNOLOGY: ["TECHNOLOGY"],
  PAYMENT: ["PAYMENT"],
}

/* ───────────────────────────  Capability-based relevance  ───────────────────────────
 * Pure helpers shared by server (partner-360) and client UI to decide which
 * metrics / tabs apply to a partner given its granted capabilities.
 */

export interface PartnerCapabilityFlags {
  hasLeadCapability: boolean
  hasCustomerCapability: boolean
  hasImplementationCapability: boolean
  hasSupportCapability: boolean
  hasCommercialCapability: boolean
}

export function partnerCapabilityFlags(capabilities: PartnerOrgCapability[]): PartnerCapabilityFlags {
  const set = new Set(capabilities)
  return {
    hasLeadCapability: set.has("REFERRALS") || set.has("SALES"),
    hasCustomerCapability:
      set.has("REFERRALS") ||
      set.has("SALES") ||
      set.has("IMPLEMENTATION") ||
      set.has("CUSTOMER_ONBOARDING") ||
      set.has("FIRST_LINE_SUPPORT"),
    hasImplementationCapability:
      set.has("IMPLEMENTATION") || set.has("CUSTOMER_ONBOARDING") || set.has("TRAINING"),
    hasSupportCapability: set.has("FIRST_LINE_SUPPORT"),
    hasCommercialCapability: set.has("REFERRALS") || set.has("SALES") || set.has("PAYMENT"),
  }
}

export const PARTNER_360_TABS = [
  "overview",
  "users",
  "capabilities",
  "leads",
  "customers",
  "onboarding",
  "support",
  "compliance",
  "commissions",
  "performance",
  "activity",
] as const

export type Partner360Tab = (typeof PARTNER_360_TABS)[number]

/**
 * Which 360 tabs are relevant given the partner's granted capabilities.
 * Overview, Users, Capabilities, Compliance, Performance and Activity always apply.
 */
export function relevantPartnerTabs(capabilities: PartnerOrgCapability[]): Partner360Tab[] {
  const flags = partnerCapabilityFlags(capabilities)
  return PARTNER_360_TABS.filter((tab) => {
    switch (tab) {
      case "leads":
        return flags.hasLeadCapability
      case "customers":
        return flags.hasCustomerCapability
      case "onboarding":
        return flags.hasImplementationCapability
      case "support":
        return flags.hasSupportCapability
      case "commissions":
        return flags.hasCommercialCapability
      default:
        return true
    }
  })
}
