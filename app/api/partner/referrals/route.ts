import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { auditContextFromPartnerSession } from "@/lib/audit"
import { checkRateLimit } from "@/lib/rate-limit"
import { z } from "zod"
import {
  createReferralSubmission,
  duplicateNoticeMessage,
  type ReferralSubmissionInput,
} from "@/lib/referral"
import { listPartnerReferrals } from "@/lib/referral-portal"

/* ───────────────────────────  Partner referral submission + tracking  ───────────────────────────
 * Referral Partners only. The response is the partner-safe projection: no sales
 * notes, no internal duplicate detail, no other partner's identity.
 */

/* Fields are only fully required for a real submission — the workflow library
 * enforces consent and the mandatory answers, so a draft can be partial. */
const submissionSchema = z.object({
  businessName: z.string().default(""),
  contactName: z.string().default(""),
  phone: z.string().default(""),
  email: z.string().default(""),
  country: z.string().default(""),
  state: z.string().default(""),
  city: z.string().default(""),
  businessType: z.string().default(""),
  estimatedBranches: z.coerce.number().int().min(1).optional().nullable(),
  estimatedUsers: z.coerce.number().int().min(1).optional().nullable(),
  currentSystem: z.string().default(""),
  knownRequirement: z.string().default(""),
  relationshipSource: z.string().default(""),
  consentConfirmed: z.boolean().default(false),
  notes: z.string().optional().nullable(),
  asDraft: z.boolean().optional(),
})

export async function GET() {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "leads:view" })
  if (!auth.authorized) return auth.response!

  const referrals = await listPartnerReferrals(session.partnerId)
  return NextResponse.json({ referrals })
}

export async function POST(request: Request) {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "leads:create" })
  if (!auth.authorized) return auth.response!

  const limit = await checkRateLimit(request, { key: "partner-referral-create", max: 20, windowSeconds: 3600 })
  if (!limit.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })

  try {
    const parsed = submissionSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const { asDraft, ...fields } = parsed.data
    if (asDraft && !fields.businessName.trim()) {
      return NextResponse.json({ error: "A draft needs at least the business name" }, { status: 400 })
    }
    const input: ReferralSubmissionInput = { ...fields, consentAt: new Date().toISOString() }

    const ctx = auditContextFromPartnerSession(session, request)
    const result = await createReferralSubmission(input, session.partnerId, session.partnerUserId, ctx, {
      asDraft: asDraft === true,
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

    return NextResponse.json({
      referral: { id: result.leadId, reference: result.reference },
      // Safe notice only — the internal match detail never leaves the server.
      duplicateWarning: result.duplicate.duplicate ? duplicateNoticeMessage(result.duplicate) : null,
    })
  } catch {
    return NextResponse.json({ error: "Failed to submit referral" }, { status: 500 })
  }
}
