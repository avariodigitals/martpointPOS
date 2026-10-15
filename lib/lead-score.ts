/* ───────────────────────────  Lead scoring (rules-based, free)  ───────────────────────────
 * Transparent point rules — no AI agent, no extra spend. Every rule that fires
 * returns a reason, so the sales team can see WHY a lead is hot.
 *
 * Upgrade path: if we ever want AI on top, it should narrate these same
 * computed points (the creator-AI pattern), never replace the arithmetic.
 */

export type LeadScoreBucket = "hot" | "warm" | "cold" | "won" | "lost"

export type LeadScoreInput = {
  status: string
  branches?: string | null
  staffSize?: string | null
  productInterest?: string | null
  challenge?: string | null
  message?: string | null
  estimate?: unknown
  questionnaireStatus?: string | null
  source?: string | null
  email?: string | null
  phone?: string | null
  submittedAt: string
}

export type LeadScore = {
  score: number
  bucket: LeadScoreBucket
  reasons: string[]
}

const HOT_AT = 60
const WARM_AT = 35

const BRANCH_POINTS: Record<string, number> = { "1": 4, "2-3": 8, "4-6": 12, "7-10": 15, "10+": 18 }
const STAFF_POINTS: Record<string, number> = { "1-5": 2, "6-15": 5, "16-30": 8, "31-50": 10, "50+": 12 }
const PRODUCT_POINTS: Record<string, number> = { erp: 12, retail: 8, "not-sure": 3 }
const QUESTIONNAIRE_POINTS: Record<string, number> = { Submitted: 15, Reviewed: 15, "In Progress": 8, Sent: 3 }
const SOURCE_POINTS: Record<string, number> = { explee: 12, whatsapp: 8, website: 5, brochure: 5, meta: 3, tiktok: 3 }

const hasText = (s?: string | null) => !!s && s.trim().length > 2

export function computeLeadScore(lead: LeadScoreInput, now: Date = new Date()): LeadScore {
  if (lead.status === "Won") return { score: 100, bucket: "won", reasons: ["Already a customer"] }
  if (lead.status === "Lost") return { score: 0, bucket: "lost", reasons: ["Marked lost"] }

  const reasons: string[] = []
  let score = 0

  const branchPts = BRANCH_POINTS[(lead.branches || "").trim()]
  if (branchPts) {
    score += branchPts
    reasons.push(`${lead.branches} branch(es) — bigger rollout (${branchPts} pts)`)
  }

  const staffPts = STAFF_POINTS[(lead.staffSize || "").trim()]
  if (staffPts) {
    score += staffPts
    reasons.push(`Team of ${lead.staffSize} users (${staffPts} pts)`)
  }

  const productPts = PRODUCT_POINTS[(lead.productInterest || "").trim()]
  if (productPts) {
    score += productPts
    const label = productPts >= 10 ? "ERP interest — highest-value product" : lead.productInterest === "retail" ? "Retail POS interest" : "Still deciding on product"
    reasons.push(`${label} (${productPts} pts)`)
  }

  if (lead.estimate) {
    score += 8
    reasons.push("Used the estimate calculator — self-selected a plan (8 pts)")
  }

  if (hasText(lead.challenge)) {
    score += 4
    reasons.push("Described a concrete challenge (4 pts)")
  }
  if (hasText(lead.message)) {
    score += 4
    reasons.push("Left a personal message (4 pts)")
  }

  const qPts = QUESTIONNAIRE_POINTS[(lead.questionnaireStatus || "").trim()]
  if (qPts) {
    score += qPts
    reasons.push(`Questionnaire ${lead.questionnaireStatus} (${qPts} pts)`)
  }

  const srcPts = SOURCE_POINTS[(lead.source || "").trim()]
  if (srcPts) {
    score += srcPts
    const label = lead.source === "explee" ? "Flagged hot by outbound campaign" : lead.source === "whatsapp" ? "Came in via WhatsApp conversation" : `Source: ${lead.source}`
    reasons.push(`${label} (${srcPts} pts)`)
  }

  const ageDays = (now.getTime() - new Date(lead.submittedAt).getTime()) / 86_400_000
  if (!Number.isNaN(ageDays)) {
    if (ageDays <= 7) {
      score += 6
      reasons.push("Fresh lead — contacted within the week (6 pts)")
    } else if (ageDays <= 30) {
      score += 3
      reasons.push("Still recent — under 30 days (3 pts)")
    }
  }

  const validEmail = hasText(lead.email) && lead.email!.includes("@")
  const validPhone = hasText(lead.phone) && lead.phone!.replace(/\D/g, "").length >= 8
  if (validEmail && validPhone) {
    score += 2
    reasons.push("Reachable on both email and phone (2 pts)")
  }

  score = Math.max(0, Math.min(100, score))
  const bucket: LeadScoreBucket = score >= HOT_AT ? "hot" : score >= WARM_AT ? "warm" : "cold"
  return { score, bucket, reasons }
}

export const BUCKET_LABEL: Record<LeadScoreBucket, string> = {
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
  won: "Customer",
  lost: "Lost",
}
