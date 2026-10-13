/* ───────────────────────────  Referral workflow statuses  ───────────────────────────
 * The approved Referral Partner lifecycle. Stored on partner_leads.status
 * (one referral record — no duplicate table). TRANSITIONS is the server-side
 * gate: every status change must pass through transitionAllowed().
 */

export const REFERRAL_STATUSES = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "INFORMATION_REQUIRED",
  "ACCEPTED",
  "DUPLICATE",
  "REJECTED",
  "QUALIFIED",
  "CONVERTED_UNPAID",
  "PAID_PENDING_ACTIVATION",
  "ACTIVATED_HOLDING",
  "COMMISSION_ELIGIBLE",
  "APPROVED",
  "PAID",
  "LOST",
  "EXPIRED",
] as const

export type ReferralStatus = (typeof REFERRAL_STATUSES)[number]

/** Legacy partner-lead pipeline values that may still exist on old rows. */
export type LegacyLeadStatus = "REGISTERED" | "DEMO" | "PROPOSAL" | "NEGOTIATION" | "WON"

export type AnyLeadStatus = ReferralStatus | LegacyLeadStatus

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  INFORMATION_REQUIRED: "Information Required",
  ACCEPTED: "Accepted",
  DUPLICATE: "Duplicate",
  REJECTED: "Rejected",
  QUALIFIED: "Qualified",
  CONVERTED_UNPAID: "Converted — Unpaid",
  PAID_PENDING_ACTIVATION: "Paid — Pending Activation",
  ACTIVATED_HOLDING: "Activated — Holding Period",
  COMMISSION_ELIGIBLE: "Commission Eligible",
  APPROVED: "Approved",
  PAID: "Paid",
  LOST: "Lost",
  EXPIRED: "Expired",
}

const X: ReferralStatus[] = []

/**
 * Allowed next statuses per status. Terminal: PAID, DUPLICATE, REJECTED, LOST, EXPIRED.
 * CONVERTED_UNPAID can return from ACTIVATED_HOLDING/PAID_PENDING_ACTIVATION when a
 * full refund removes cleared payment (the earning is reversed separately).
 */
export const REFERRAL_TRANSITIONS: Record<ReferralStatus, ReferralStatus[]> = {
  DRAFT: ["SUBMITTED"],
  SUBMITTED: ["UNDER_REVIEW"],
  UNDER_REVIEW: ["INFORMATION_REQUIRED", "ACCEPTED", "DUPLICATE", "REJECTED"],
  INFORMATION_REQUIRED: ["UNDER_REVIEW", "DUPLICATE", "REJECTED", "LOST", "EXPIRED"],
  ACCEPTED: ["QUALIFIED", "CONVERTED_UNPAID", "PAID_PENDING_ACTIVATION", "LOST", "EXPIRED"],
  QUALIFIED: ["CONVERTED_UNPAID", "PAID_PENDING_ACTIVATION", "LOST", "EXPIRED"],
  CONVERTED_UNPAID: ["PAID_PENDING_ACTIVATION", "LOST", "EXPIRED"],
  PAID_PENDING_ACTIVATION: ["ACTIVATED_HOLDING", "CONVERTED_UNPAID", "LOST", "EXPIRED"],
  ACTIVATED_HOLDING: ["COMMISSION_ELIGIBLE", "CONVERTED_UNPAID", "LOST", "EXPIRED"],
  COMMISSION_ELIGIBLE: ["APPROVED", "CONVERTED_UNPAID", "LOST", "EXPIRED"],
  APPROVED: ["PAID", "CONVERTED_UNPAID"],
  PAID: X,
  DUPLICATE: X,
  REJECTED: X,
  LOST: X,
  EXPIRED: X,
}

/** Statuses from which no earning may ever be created or shown as payable. */
export const NON_EARNING_STATUSES: AnyLeadStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "INFORMATION_REQUIRED",
  "ACCEPTED",
  "DUPLICATE",
  "REJECTED",
  "QUALIFIED",
  "LOST",
  "EXPIRED",
  "REGISTERED",
  "DEMO",
  "PROPOSAL",
  "NEGOTIATION",
]

export function isReferralStatus(status: string): status is ReferralStatus {
  return (REFERRAL_STATUSES as readonly string[]).includes(status)
}

export function transitionAllowed(from: string, to: string): boolean {
  if (!isReferralStatus(from) || !isReferralStatus(to)) return false
  return REFERRAL_TRANSITIONS[from].includes(to)
}

/**
 * Statuses that show the partner a provisional or payable commission figure.
 * Everything else must display ₦0.00 payable (CONVERTED_UNPAID included).
 */
export function showsPayableCommission(status: string): boolean {
  return status === "COMMISSION_ELIGIBLE" || status === "APPROVED" || status === "PAID"
}

/** Whether attribution protection is live for this status. */
export function attributionProtected(status: string): boolean {
  return (
    status === "ACCEPTED" ||
    status === "QUALIFIED" ||
    status === "CONVERTED_UNPAID" ||
    status === "PAID_PENDING_ACTIVATION" ||
    status === "ACTIVATED_HOLDING" ||
    status === "COMMISSION_ELIGIBLE" ||
    status === "APPROVED" ||
    status === "PAID"
  )
}

/* ───────────────────────────  Partner-safe projection  ───────────────────────────
 * The portal only ever receives this shape — never sales notes, decision
 * internals, another partner's identity or confidential duplicate detail.
 */

export interface PartnerSafeReferral {
  referralReference: string
  status: string
  statusLabel: string
  businessName: string
  submittedAt: string | null
  acceptanceDate: string | null
  protectionExpiresAt: string | null
  requiredAction: string | null
  informationRequestDue: string | null
  closureReason: string | null
  payableCommissionNaira: number
}

export interface PartnerSafeContext {
  status: string
  acceptanceDate?: string | null
  protectionExpiresAt?: string | null
  requiredAction?: string | null
  informationRequestDue?: string | null
  closureReason?: string | null
  payableCommissionNaira?: number
}

export function toPartnerSafeReferral(
  referralReference: string,
  businessName: string,
  submittedAt: string | null,
  ctx: PartnerSafeContext
): PartnerSafeReferral {
  const status = isReferralStatus(ctx.status) ? ctx.status : "SUBMITTED"
  return {
    referralReference,
    status,
    statusLabel: REFERRAL_STATUS_LABELS[status] ?? status,
    businessName,
    submittedAt,
    acceptanceDate: attributionProtected(status) ? ctx.acceptanceDate ?? null : null,
    protectionExpiresAt: attributionProtected(status) ? ctx.protectionExpiresAt ?? null : null,
    requiredAction: status === "INFORMATION_REQUIRED" ? ctx.requiredAction ?? null : null,
    informationRequestDue: status === "INFORMATION_REQUIRED" ? ctx.informationRequestDue ?? null : null,
    closureReason: status === "LOST" || status === "EXPIRED" ? ctx.closureReason ?? null : null,
    // Hard rule: nothing payable before COMMISSION_ELIGIBLE.
    payableCommissionNaira: showsPayableCommission(status)
      ? Math.max(0, ctx.payableCommissionNaira ?? 0)
      : 0,
  }
}

/**
 * Cross-partner guard — a referral row may only ever be projected for the
 * partner that owns it. Returns false for null ownership (admin-added leads).
 */
export function canPartnerAccessReferral(
  referralPartnerId: string | null,
  viewerPartnerId: string | null | undefined
): boolean {
  if (!viewerPartnerId) return false
  if (!referralPartnerId) return false
  return referralPartnerId === viewerPartnerId
}
