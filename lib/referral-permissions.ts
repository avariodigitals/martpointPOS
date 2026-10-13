/* ───────────────────────────  Referral decision permissions  ───────────────────────────
 * Server-side decision matrix for the Referral Partner workflow. UI buttons
 * are cosmetic; every route must call referralAdminCan() before acting.
 *
 * Ownership per the approved controls:
 *   Sales + Partner Operations → referral acceptance and duplicate decisions
 *   Finance                    → cleared payment, eligible revenue, commission, payout
 *   Operations (authorised)    → licence activation
 *   Management (Admin)         → exceptions, splits, suspension, termination, overrides
 * Partners can never approve their own referrals or earnings.
 */

import type { UserRole } from "./admin-types"

export const REFERRAL_ADMIN_ACTIONS = [
  "referral:review", // submit under review / information request / accept / duplicate / reject
  "referral:attribute", // protection extension, reassignment, closure reason
  "referral:override", // manual status/amount override (requires reason)
  "agreement:review", // legal + commercial review, approve for signature, execute
  "schedule:approve", // approve Commission Schedule commercial terms
  "partner:activate", // activation decision + Activation Confirmation
  "grade:decide", // quarterly grade decision
  "finance:approve", // commission eligibility approval
  "finance:payout", // payout execution + payout statement
  "partner:suspend", // suspension / termination (management)
  "bank:approve", // payout bank change: reverification + dual approval
] as const

export type ReferralAdminAction = (typeof REFERRAL_ADMIN_ACTIONS)[number]

/** Admin roles that may act on each referral control. */
const MATRIX: Record<ReferralAdminAction, UserRole[]> = {
  "referral:review": ["Admin", "Sales"],
  "referral:attribute": ["Admin", "Sales"],
  "referral:override": ["Admin"],
  "agreement:review": ["Admin", "Finance"],
  "schedule:approve": ["Admin", "Finance"],
  "partner:activate": ["Admin"],
  "grade:decide": ["Admin"],
  "finance:approve": ["Admin", "Finance"],
  "finance:payout": ["Admin", "Finance"],
  "partner:suspend": ["Admin"],
  "bank:approve": ["Admin", "Finance"],
}

export function referralAdminCan(role: UserRole | string | null | undefined, action: ReferralAdminAction): boolean {
  if (!role) return false
  if (role === "Admin") return true // Admin bypass mirrors admin-types.authorize()
  return (MATRIX[action] || []).includes(role as UserRole)
}

/**
 * Bank-detail changes require reverification and dual approval: two distinct
 * approvers, and verification must have happened first.
 */
export function bankChangeDualApproval(input: {
  requestedBy: string | null
  firstApprovalBy: string | null
  secondApprovalBy: string | null
  reverified: boolean
}): { approved: boolean; reason: string } {
  if (!input.reverified) return { approved: false, reason: "Bank change requires reverification before approval" }
  if (!input.firstApprovalBy || !input.secondApprovalBy) {
    return { approved: false, reason: "Bank change requires two approvals" }
  }
  if (input.firstApprovalBy === input.secondApprovalBy) {
    return { approved: false, reason: "Bank change requires two different approvers" }
  }
  if (input.requestedBy && input.secondApprovalBy === input.requestedBy) {
    return { approved: false, reason: "Requester cannot be an approver" }
  }
  return { approved: true, reason: "" }
}

/** A manual override always needs a reason and a named approver (audit entry). */
export function manualOverrideAllowed(input: {
  reason: string | null | undefined
  approver: string | null | undefined
}): { allowed: boolean; reason: string } {
  if (!input.reason || !input.reason.trim()) return { allowed: false, reason: "Manual override requires a recorded reason" }
  if (!input.approver) return { allowed: false, reason: "Manual override requires an approver" }
  return { allowed: true, reason: "" }
}

/**
 * Which internal detail may appear in a duplicate/rejection decision notice.
 * Never exposes another partner's identity or private sales information.
 */
export const SAFE_DUPLICATE_CATEGORIES = [
  "EXISTING_CUSTOMER",
  "EXISTING_CRM_LEAD",
  "ACTIVE_OPPORTUNITY",
  "PREVIOUSLY_ACCEPTED_REFERRAL",
  "DIRECT_SALES_ACTIVITY",
  "ANOTHER_PARTNER_REFERRAL",
] as const

export type DuplicateCategory = (typeof SAFE_DUPLICATE_CATEGORIES)[number]

export function safeDuplicateExplanation(category: DuplicateCategory): string {
  switch (category) {
    case "EXISTING_CUSTOMER":
      return "The business already exists as a MartPoint customer."
    case "EXISTING_CRM_LEAD":
      return "The business is already in the MartPoint sales pipeline."
    case "ACTIVE_OPPORTUNITY":
      return "An active MartPoint opportunity already exists for this business."
    case "PREVIOUSLY_ACCEPTED_REFERRAL":
      return "This business was already submitted and accepted through an earlier referral."
    case "DIRECT_SALES_ACTIVITY":
      return "MartPoint sales activity already exists for this business."
    case "ANOTHER_PARTNER_REFERRAL":
      // Deliberately does not identify the other partner.
      return "This business has already been referred through another approved source."
    default:
      return "A duplicate registration was detected."
  }
}
