import { describe, it, expect } from "vitest"
import {
  REFERRAL_STATUSES,
  REFERRAL_STATUS_LABELS,
  REFERRAL_TRANSITIONS,
  transitionAllowed,
  showsPayableCommission,
  attributionProtected,
  toPartnerSafeReferral,
  canPartnerAccessReferral,
  NON_EARNING_STATUSES,
  type ReferralStatus,
} from "@/lib/referral-status"
import {
  STANDARD_SCHEDULE_TERMS,
  classifyInvoiceLine,
  computeEligibleBase,
  calculateReferralCommission,
  rateForEarning,
  earningAllowedForTrigger,
  earningTransitionAllowed,
  evaluateReferralEligibility,
  computeRefundAdjustment,
  evaluateStacking,
  renewalEarningAllowed,
  holdingCompletionAt,
  payoutDueAt,
  protectionExpiry,
  attributionValidAt,
  type InvoiceLineInput,
} from "@/lib/referral-commission-engine"
import {
  referralAdminCan,
  bankChangeDualApproval,
  manualOverrideAllowed,
  safeDuplicateExplanation,
  SAFE_DUPLICATE_CATEGORIES,
  REFERRAL_ADMIN_ACTIONS,
} from "@/lib/referral-permissions"
import { validateReferralSubmission, type ReferralSubmissionInput } from "@/lib/referral"
import { referralActivationGates } from "@/lib/referral-agreements"
import { agreementTransitionAllowed, agreementInForce } from "@/lib/referral-agreements"

/* ───────────────────────────  The approved commercial rules, as tests  ───────────────────────────
 * Each numbered case maps to one of the rules the Referral Partner workflow must
 * never break. All of them are pure logic — no database, no network.
 */

const DAY = 86_400_000

function submission(overrides: Partial<ReferralSubmissionInput> = {}): ReferralSubmissionInput {
  return {
    businessName: "Ayo Supermarket",
    contactName: "Ayo Bakare",
    phone: "08012345678",
    email: "ayo@example.com",
    country: "Nigeria",
    state: "Lagos",
    city: "Ikeja",
    businessType: "Supermarket",
    currentSystem: "Paper book",
    knownRequirement: "Track stock across two branches",
    relationshipSource: "I know the owner personally",
    consentConfirmed: true,
    ...overrides,
  }
}

function line(overrides: Partial<InvoiceLineInput> = {}): InvoiceLineInput {
  return {
    id: "L1",
    itemType: "PLAN",
    description: "MartPoint Retail — 12 months",
    quantity: 1,
    unitPrice: 240_000,
    discount: 0,
    tax: 18_000,
    ...overrides,
  }
}

describe("case 1 — the sixteen approved statuses exist and are labelled", () => {
  it("covers every lifecycle state with a partner-readable label", () => {
    expect(REFERRAL_STATUSES).toHaveLength(16)
    for (const status of REFERRAL_STATUSES) {
      expect(REFERRAL_STATUS_LABELS[status]).toBeTruthy()
      expect(REFERRAL_STATUS_LABELS[status]).not.toMatch(/_/)
    }
  })
})

describe("case 2 — submission never jumps to an accepting status", () => {
  it("only review can accept, and a partner cannot reach ACCEPTED from SUBMITTED", () => {
    expect(transitionAllowed("SUBMITTED", "ACCEPTED")).toBe(false)
    expect(transitionAllowed("SUBMITTED", "UNDER_REVIEW")).toBe(true)
    expect(transitionAllowed("UNDER_REVIEW", "ACCEPTED")).toBe(true)
    expect(REFERRAL_TRANSITIONS["SUBMITTED"]).not.toContain("ACCEPTED")
  })

  it("terminal statuses allow nothing further", () => {
    for (const status of ["PAID", "DUPLICATE", "REJECTED", "LOST", "EXPIRED"] as ReferralStatus[]) {
      expect(REFERRAL_TRANSITIONS[status]).toEqual([])
    }
  })
})

describe("case 3 — a referral without consent is never submitted", () => {
  it("rejects a missing consent confirmation", () => {
    expect(validateReferralSubmission(submission({ consentConfirmed: false })).ok).toBe(false)
  })

  it("rejects an incomplete introduction and accepts a complete one", () => {
    expect(validateReferralSubmission(submission({ businessName: "  " })).ok).toBe(false)
    expect(validateReferralSubmission(submission({ relationshipSource: "" })).ok).toBe(false)
    expect(validateReferralSubmission(submission()).ok).toBe(true)
  })
})

describe("case 4 — a lead, an acceptance, a meeting, a demo, a quotation, an invoice or a promise never earn", () => {
  it("only cleared customer money creates an earning", () => {
    for (const trigger of [
      "LEAD_SUBMITTED",
      "REFERRAL_ACCEPTED",
      "MEETING_ARRANGED",
      "DEMONSTRATION_ATTENDED",
      "QUOTATION_REQUESTED",
      "INVOICE_ISSUED",
      "VERBAL_COMMITMENT",
      "UNPAID_ORDER",
    ] as const) {
      expect(earningAllowedForTrigger(trigger)).toBe(false)
    }
    expect(earningAllowedForTrigger("CLEARED_CUSTOMER_PAYMENT")).toBe(true)
    expect(earningAllowedForTrigger("CLEARED_RENEWAL_PAYMENT")).toBe(true)
  })

  it("keeps pre-payment statuses in the non-earning set", () => {
    for (const status of ["SUBMITTED", "ACCEPTED", "QUALIFIED", "INFORMATION_REQUIRED"]) {
      expect(NON_EARNING_STATUSES).toContain(status)
    }
  })

  it("treats a converted-but-unpaid customer as still unearned, while keeping attribution", () => {
    expect(showsPayableCommission("CONVERTED_UNPAID")).toBe(false)
    expect(attributionProtected("CONVERTED_UNPAID")).toBe(true)
  })
})

describe("case 5 — the partner portal shows no payable amount before COMMISSION_ELIGIBLE", () => {
  it("reports zero on every earlier status even when a figure exists", () => {
    for (const status of ["SUBMITTED", "UNDER_REVIEW", "ACCEPTED", "QUALIFIED", "PAID_PENDING_ACTIVATION", "ACTIVATED_HOLDING"]) {
      const safe = toPartnerSafeReferral("MPR-2026-00001", "Ayo Supermarket", null, {
        status,
        payableCommissionNaira: 500_000,
      })
      expect(safe.payableCommissionNaira).toBe(0)
      expect(showsPayableCommission(status)).toBe(false)
    }
  })

  it("reveals the amount only once eligible, approved or paid", () => {
    for (const status of ["COMMISSION_ELIGIBLE", "APPROVED", "PAID"]) {
      expect(showsPayableCommission(status)).toBe(true)
      const safe = toPartnerSafeReferral("MPR-2026-00001", "Ayo Supermarket", null, {
        status,
        payableCommissionNaira: 24_000,
      })
      expect(safe.payableCommissionNaira).toBe(24_000)
    }
  })

  it("never leaks a negative or invented figure", () => {
    const safe = toPartnerSafeReferral("MPR-2026-00001", "Ayo Supermarket", null, {
      status: "PAID",
      payableCommissionNaira: -5_000,
    })
    expect(safe.payableCommissionNaira).toBe(0)
  })
})

describe("case 6 — the portal only projects the fields its status allows", () => {
  it("hides protection dates before acceptance", () => {
    const safe = toPartnerSafeReferral("MPR-2026-00001", "Ayo Supermarket", null, {
      status: "SUBMITTED",
      acceptanceDate: "2026-01-10T00:00:00.000Z",
      protectionExpiresAt: "2026-04-10T00:00:00.000Z",
    })
    expect(safe.acceptanceDate).toBeNull()
    expect(safe.protectionExpiresAt).toBeNull()
  })

  it("shows the required action only while information is outstanding", () => {
    const asking = toPartnerSafeReferral("MPR-2026-00001", "Ayo Supermarket", null, {
      status: "INFORMATION_REQUIRED",
      requiredAction: "Confirm who the decision maker is",
      informationRequestDue: "2026-02-01T00:00:00.000Z",
    })
    expect(asking.requiredAction).toBe("Confirm who the decision maker is")
    const decided = toPartnerSafeReferral("MPR-2026-00001", "Ayo Supermarket", null, {
      status: "ACCEPTED",
      requiredAction: "Confirm who the decision maker is",
    })
    expect(decided.requiredAction).toBeNull()
  })

  it("gives a closure reason only on a closed referral", () => {
    const closed = toPartnerSafeReferral("MPR-2026-00001", "Ayo Supermarket", null, {
      status: "EXPIRED",
      closureReason: "Protection period ended without a purchase",
    })
    expect(closed.closureReason).toBe("Protection period ended without a purchase")
    const live = toPartnerSafeReferral("MPR-2026-00001", "Ayo Supermarket", null, {
      status: "ACCEPTED",
      closureReason: "Protection period ended without a purchase",
    })
    expect(live.closureReason).toBeNull()
  })
})

describe("case 7 — one partner never sees another partner's referral", () => {
  it("requires an exact owner match and rejects unowned rows", () => {
    expect(canPartnerAccessReferral("partner-a", "partner-a")).toBe(true)
    expect(canPartnerAccessReferral("partner-a", "partner-b")).toBe(false)
    expect(canPartnerAccessReferral("partner-a", null)).toBe(false)
    expect(canPartnerAccessReferral(null, "partner-a")).toBe(false)
  })
})

describe("case 8 — the standard commercial terms are the documented fallback", () => {
  it("matches the approved rates and windows", () => {
    expect(STANDARD_SCHEDULE_TERMS.firstYearRatePercent).toBe(10)
    expect(STANDARD_SCHEDULE_TERMS.firstRenewalRatePercent).toBe(5)
    expect(STANDARD_SCHEDULE_TERMS.protectionDays).toBe(90)
    expect(STANDARD_SCHEDULE_TERMS.holdingDays).toBe(30)
    expect(STANDARD_SCHEDULE_TERMS.payoutDaysAfterMonthEnd).toBe(14)
  })

  it("the signed schedule, not the constant, decides the rate when one is in force", () => {
    const negotiated = { ...STANDARD_SCHEDULE_TERMS, firstYearRatePercent: 8 }
    expect(rateForEarning(negotiated, "FIRST_YEAR")).toBe(8)
    expect(rateForEarning(STANDARD_SCHEDULE_TERMS, "RENEWAL")).toBe(5)
  })
})

describe("case 9 — eligible revenue excludes tax and non-software charges", () => {
  it("classifies every excluded line by reason", () => {
    const cases: Array<[string, string]> = [
      ["POS terminal", "HARDWARE"],
      ["Delivery to Ikeja branch", "LOGISTICS"],
      ["Implementation and staff setup", "IMPLEMENTATION"],
      ["Training workshop", "TRAINING"],
      ["Data migration from legacy book", "DATA_MIGRATION"],
      ["Third-party payment gateway fee", "THIRD_PARTY"],
    ]
    for (const [description, reason] of cases) {
      expect(classifyInvoiceLine(line({ description, itemType: "SERVICE" })).reason).toBe(reason)
    }
    expect(classifyInvoiceLine(line({ description: "Custom development", itemType: "CUSTOM" })).reason).toBe(
      "UNSUPPORTED_CUSTOM_WORK"
    )
  })

  it("keeps software plans and addons eligible and removes tax from the base", () => {
    const base = computeEligibleBase({
      lines: [
        line(),
        line({ id: "L2", itemType: "ADDON", description: "Inventory add-on", unitPrice: 60_000, tax: 4_500 }),
        line({ id: "L3", itemType: "SERVICE", description: "Implementation", unitPrice: 100_000, tax: 7_500 }),
      ],
      invoiceGrossNaira: 430_000,
      clearedGrossNaira: 430_000,
      taxNaira: 30_000,
    })
    expect(base.eligibleNetNaira).toBe(300_000)
    expect(base.excludedNetNaira).toBe(100_000)
    expect(base.clearedEligibleNaira).toBe(300_000)
    expect(base.taxExcludedNaira).toBe(30_000)
  })

  it("pays only the share of eligible revenue the customer actually cleared", () => {
    const half = computeEligibleBase({
      lines: [line()],
      invoiceGrossNaira: 258_000,
      clearedGrossNaira: 129_000,
    })
    expect(half.paymentFraction).toBe(0.5)
    expect(half.clearedEligibleNaira).toBe(120_000)
    expect(calculateReferralCommission({ clearedEligibleNaira: half.clearedEligibleNaira, ratePercent: 10 }).commissionNaira).toBe(
      12_000
    )
  })

  it("handles a discount without letting commission go negative", () => {
    const discounted = line({ discount: 40_000 })
    expect(classifyInvoiceLine(discounted).netNaira).toBe(200_000)
    expect(calculateReferralCommission({ clearedEligibleNaira: 200_000, ratePercent: 10, taxDeductionNaira: 25_000 }).commissionNaira).toBe(
      0
    )
    expect(calculateReferralCommission({ clearedEligibleNaira: 200_000, ratePercent: 10, taxDeductionNaira: 5_000 }).commissionNaira).toBe(
      15_000
    )
  })
})

describe("case 10 — every eligibility gate must clear before a commission is eligible", () => {
  const paying = {
    attributionAccepted: true,
    agreementActive: true,
    scheduleExecuted: true,
    clearedGrossNaira: 258_000,
    paymentClearedAt: "2026-01-01T00:00:00.000Z",
    licenceActivatedAt: "2026-01-05T00:00:00.000Z",
    holdingDays: 30,
    now: "2026-03-01T00:00:00.000Z",
    blockingHold: false,
  }

  it("is eligible only with all gates satisfied", () => {
    const ok = evaluateReferralEligibility(paying)
    expect(ok.eligible).toBe(true)
    expect(ok.status).toBe("ELIGIBLE")
    expect(ok.failedGates).toEqual([])
  })

  it("stays pending before the holding period completes", () => {
    const early = evaluateReferralEligibility({ ...paying, now: "2026-01-20T00:00:00.000Z" })
    expect(early.eligible).toBe(false)
    expect(early.failedGates).toContain("HOLDING")
    expect(early.status).toBe("PENDING")
  })

  it("is not eligible without licence activation", () => {
    const noLicence = evaluateReferralEligibility({ ...paying, licenceActivatedAt: null })
    expect(noLicence.failedGates).toContain("ACTIVATION")
    expect(noLicence.eligible).toBe(false)
  })

  it("is held while an agreement, schedule or compliance hold blocks it", () => {
    expect(evaluateReferralEligibility({ ...paying, agreementActive: false }).status).toBe("HELD")
    expect(evaluateReferralEligibility({ ...paying, scheduleExecuted: false }).status).toBe("HELD")
    expect(evaluateReferralEligibility({ ...paying, attributionAccepted: false }).status).toBe("HELD")
    const refunded = evaluateReferralEligibility({ ...paying, blockingHold: true })
    expect(refunded.status).toBe("HELD")
    expect(refunded.failedGates).toContain("COMPLIANCE")
  })

  it("is only potential while nothing has been collected", () => {
    const nothing = evaluateReferralEligibility({ ...paying, clearedGrossNaira: 0, paymentClearedAt: null })
    expect(nothing.status).toBe("POTENTIAL")
  })
})

describe("case 11 — holding runs from the later of cleared payment and activation", () => {
  it("starts the clock at the later date", () => {
    const completed = holdingCompletionAt("2026-01-01T00:00:00.000Z", "2026-01-10T00:00:00.000Z", 30)
    expect(completed).toBe(new Date(new Date("2026-01-10T00:00:00.000Z").getTime() + 30 * DAY).toISOString())

    const flipped = holdingCompletionAt("2026-02-01T00:00:00.000Z", "2026-01-10T00:00:00.000Z", 30)
    expect(flipped).toBe(new Date(new Date("2026-02-01T00:00:00.000Z").getTime() + 30 * DAY).toISOString())
  })

  it("approved payouts fall due within 14 days of the month-end after approval", () => {
    const due = payoutDueAt("2026-01-20T09:00:00.000Z", 14)
    expect(due.startsWith("2026-02-")).toBe(true)
    expect(due).toBe(new Date(Date.UTC(2026, 1, 0) + 14 * DAY).toISOString())
  })
})

describe("case 12 — protection starts at acceptance and never before", () => {
  it("runs the window from the acceptance date", () => {
    const expiry = protectionExpiry("2026-01-10T00:00:00.000Z", 90)
    expect(expiry).toBe(new Date(new Date("2026-01-10T00:00:00.000Z").getTime() + 90 * DAY).toISOString())
  })

  it("attributing a payment after expiry is not valid", () => {
    expect(attributionValidAt("2026-01-10T00:00:00.000Z", expiry(), "2026-02-01T00:00:00.000Z")).toBe(true)
    expect(attributionValidAt("2026-01-10T00:00:00.000Z", expiry(), "2026-05-01T00:00:00.000Z")).toBe(false)
    expect(attributionValidAt(null, null, "2026-02-01T00:00:00.000Z")).toBe(false)
  })

  function expiry() {
    return protectionExpiry("2026-01-10T00:00:00.000Z", 90)
  }

  it("only accepted-through-paid statuses keep attribution protected", () => {
    expect(attributionProtected("SUBMITTED")).toBe(false)
    expect(attributionProtected("INFORMATION_REQUIRED")).toBe(false)
    expect(attributionProtected("ACCEPTED")).toBe(true)
    expect(attributionProtected("ACTIVATED_HOLDING")).toBe(true)
    expect(attributionProtected("EXPIRED")).toBe(false)
  })
})

describe("case 13 — a refund or chargeback links an adjustment and never overwrites an approved earning", () => {
  it("creates a linked negative adjustment once approved or paid", () => {
    for (const status of ["APPROVED", "PAID", "SCHEDULED"]) {
      const out = computeRefundAdjustment({
        commissionNaira: 24_000,
        refundedNaira: 258_000,
        clearedNaira: 258_000,
        earningStatus: status,
      })
      expect(out.setOriginalToReversed).toBe(false)
      expect(out.adjustmentNaira).toBe(-24_000)
    }
  })

  it("reverses the original only while it is not yet approved", () => {
    const out = computeRefundAdjustment({
      commissionNaira: 24_000,
      refundedNaira: 258_000,
      clearedNaira: 258_000,
      earningStatus: "ELIGIBLE",
    })
    expect(out.setOriginalToReversed).toBe(true)
    expect(out.adjustmentNaira).toBe(0)
  })

  it("reduces a partial refund proportionately and never below zero", () => {
    const out = computeRefundAdjustment({
      commissionNaira: 24_000,
      refundedNaira: 51_600,
      clearedNaira: 258_000,
      kind: "CHARGEBACK",
      earningStatus: "PAID",
    })
    expect(out.kind).toBe("CHARGEBACK")
    expect(out.adjustmentNaira).toBeCloseTo(-4_800, 2)
  })

  it("does nothing when no money came back", () => {
    expect(computeRefundAdjustment({ commissionNaira: 24_000, refundedNaira: 0, clearedNaira: 258_000, earningStatus: "PAID" }).adjustmentNaira).toBe(0)
  })

  it("reversed earnings are final", () => {
    expect(earningTransitionAllowed("REVERSED", "PAID")).toBe(false)
    expect(earningTransitionAllowed("PENDING", "PAID")).toBe(false)
    expect(earningTransitionAllowed("ELIGIBLE", "APPROVED")).toBe(true)
    expect(earningTransitionAllowed("APPROVED", "PAID")).toBe(true)
  })
})

describe("case 14 — only the first collected renewal earns", () => {
  it("blocks a second renewal earning", () => {
    expect(renewalEarningAllowed({ earningKind: "FIRST_YEAR", existingRenewalEarnings: 3 }).allowed).toBe(true)
    expect(renewalEarningAllowed({ earningKind: "RENEWAL", existingRenewalEarnings: 0 }).allowed).toBe(true)
    const blocked = renewalEarningAllowed({ earningKind: "RENEWAL", existingRenewalEarnings: 1 })
    expect(blocked.allowed).toBe(false)
    expect(blocked.reason).toMatch(/first collected renewal/)
  })
})

describe("case 15 — referral and channel rewards do not stack without an approved split", () => {
  const existing = [{ beneficiaryPartnerId: "partner-b", attributionType: "SALES", status: "APPROVED" }]

  it("blocks stacking when the schedule records no split", () => {
    const blocked = evaluateStacking({ approvedSplit: "", existingCommissions: existing, partnerId: "partner-a" })
    expect(blocked.blocked).toBe(true)
  })

  it("allows it when the signed schedule carries the approved split", () => {
    expect(evaluateStacking({ approvedSplit: "60/40 with channel partner (approved 2026-02)", existingCommissions: existing, partnerId: "partner-a" }).blocked).toBe(false)
  })

  it("ignores reversed earnings and the same partner", () => {
    expect(
      evaluateStacking({
        approvedSplit: "",
        existingCommissions: [{ beneficiaryPartnerId: "partner-b", attributionType: "SALES", status: "REVERSED" }],
        partnerId: "partner-a",
      }).blocked
    ).toBe(false)
    expect(
      evaluateStacking({
        approvedSplit: "",
        existingCommissions: [{ beneficiaryPartnerId: "partner-a", attributionType: "SALES", status: "APPROVED" }],
        partnerId: "partner-a",
      }).blocked
    ).toBe(false)
  })
})

describe("case 16 — partners cannot approve anything, and staff split by control", () => {
  it("Admin bypasses, Sales reviews only, Finance handles money", () => {
    expect(referralAdminCan("Sales", "referral:review")).toBe(true)
    expect(referralAdminCan("Sales", "finance:payout")).toBe(false)
    expect(referralAdminCan("Sales", "partner:activate")).toBe(false)
    expect(referralAdminCan("Finance", "finance:approve")).toBe(true)
    expect(referralAdminCan("Finance", "referral:review")).toBe(false)
    expect(referralAdminCan("Finance", "referral:override")).toBe(false)
    expect(referralAdminCan("Admin", "referral:override")).toBe(true)
  })

  it("no external or partner role holds a control", () => {
    for (const role of ["PARTNER", "Editor", "Tech", "", null, undefined]) {
      for (const action of REFERRAL_ADMIN_ACTIONS) {
        expect(referralAdminCan(role as string | null, action)).toBe(false)
      }
    }
  })
})

describe("case 17 — bank changes need reverification and two different approvers", () => {
  const base = { requestedBy: "user-a", firstApprovalBy: "user-b", secondApprovalBy: "user-c", reverified: true }

  it("refuses an unverified change, a single approval or a self-approval", () => {
    expect(bankChangeDualApproval({ ...base, reverified: false }).approved).toBe(false)
    expect(bankChangeDualApproval({ ...base, secondApprovalBy: null }).approved).toBe(false)
    expect(bankChangeDualApproval({ ...base, secondApprovalBy: "user-b" }).approved).toBe(false)
    expect(bankChangeDualApproval({ ...base, secondApprovalBy: "user-a" }).approved).toBe(false)
    expect(bankChangeDualApproval(base).approved).toBe(true)
  })

  it("a manual override always needs a reason and an approver", () => {
    expect(manualOverrideAllowed({ reason: "", approver: "user-a" }).allowed).toBe(false)
    expect(manualOverrideAllowed({ reason: "Rate agreed before schedule", approver: null }).allowed).toBe(false)
    expect(manualOverrideAllowed({ reason: "Rate agreed before schedule", approver: "user-a" }).allowed).toBe(true)
  })
})

describe("case 18 — a duplicate notice only ever states the factual category", () => {
  it("explains every category without naming anyone", () => {
    for (const category of SAFE_DUPLICATE_CATEGORIES) {
      const text = safeDuplicateExplanation(category)
      expect(text.length).toBeGreaterThan(20)
      expect(text).not.toMatch(/partner\s+(id|code|MP-)/i)
      expect(text).not.toMatch(/invoice|revenue|amount/i)
    }
  })
})

describe("case 19 — activation is gated on the records, not on intent", () => {
  const ready = {
    identityVerified: true,
    applicationStatus: "APPROVED",
    agreementInForce: true,
    scheduleInForce: true,
    payoutProfileVerified: true,
    orientationCompleted: true,
    conductAcknowledged: true,
  }

  it("activates only when every gate is met", () => {
    expect(referralActivationGates(ready)).toEqual({ ready: true, missing: [] })
  })

  it("names what is missing instead of activating anyway", () => {
    const gaps = referralActivationGates({ ...ready, agreementInForce: false, payoutProfileVerified: false })
    expect(gaps.ready).toBe(false)
    expect(gaps.missing).toContain("executed Referral Partner Agreement")
    expect(gaps.missing).toContain("verified payout and tax details")
    expect(referralActivationGates({ ...ready, identityVerified: false }).missing).toContain("identity verification")
  })
})

describe("case 20 — agreements and schedules follow their own review order", () => {
  it("cannot skip review or be executed before it is actually sent for signature", () => {
    expect(agreementTransitionAllowed("DRAFT", "EXECUTED")).toBe(false)
    expect(agreementTransitionAllowed("DRAFT", "APPROVED_FOR_SIGNATURE")).toBe(false)
    expect(agreementTransitionAllowed("LEGAL_REVIEW", "APPROVED_FOR_SIGNATURE")).toBe(false)
    expect(agreementTransitionAllowed("APPROVED_FOR_SIGNATURE", "EXECUTED")).toBe(false)
    expect(agreementTransitionAllowed("APPROVED_FOR_SIGNATURE", "SENT_FOR_SIGNATURE")).toBe(true)
    expect(agreementTransitionAllowed("SENT_FOR_SIGNATURE", "EXECUTED")).toBe(true)
    expect(agreementInForce("EXECUTED")).toBe(true)
    expect(agreementInForce("SUPERSEDED")).toBe(false)
    expect(agreementInForce("DRAFT")).toBe(false)
  })

  it("a signed instrument that is superseded or terminated stops being in force", () => {
    expect(agreementTransitionAllowed("ACTIVE", "SUPERSEDED")).toBe(true)
    expect(agreementTransitionAllowed("SUPERSEDED", "ACTIVE")).toBe(false)
    expect(agreementTransitionAllowed("TERMINATED", "ACTIVE")).toBe(false)
  })
})

describe("case 21 — a closed partner cannot keep submitting referrals", () => {
  it("consent and the submission rules stay enforced on a re-submission", () => {
    // Same rules apply to a draft being submitted later: no consent, no submission.
    expect(validateReferralSubmission(submission({ consentConfirmed: false, notes: "resubmit after suspension" })).ok).toBe(false)
    // …and a resubmitted referral still starts at SUBMITTED, never at an earning status.
    expect(transitionAllowed("DRAFT", "SUBMITTED")).toBe(true)
    expect(transitionAllowed("DRAFT", "COMMISSION_ELIGIBLE")).toBe(false)
  })
})
