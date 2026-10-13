import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { auditContextFromPartnerSession } from "@/lib/audit"
import { checkRateLimit } from "@/lib/rate-limit"
import { z } from "zod"
import { submitDraftReferral, provideReferralInformation } from "@/lib/referral"
import { getPartnerReferralDetail } from "@/lib/referral-portal"
import { getGeneratedDocumentSignedUrl } from "@/lib/partner-generated-docs"

/* ───────────────────────────  One referral, partner-safe  ───────────────────────────
 * Ownership is re-checked on every read and write. The timeline carries status and
 * date only — decision reasons reach the partner through their controlled notice.
 */

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("submit") }),
  z.object({ action: z.literal("provide_information"), response: z.string().min(1).max(4000) }),
  z.object({ action: z.literal("open_document"), documentId: z.string().min(1) }),
])

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "leads:view" })
  if (!auth.authorized) return auth.response!

  const detail = await getPartnerReferralDetail(session.partnerId, id)
  if (!detail) return NextResponse.json({ error: "Referral not found" }, { status: 404 })
  return NextResponse.json(detail)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "leads:update" })
  if (!auth.authorized) return auth.response!

  const limit = await checkRateLimit(request, { key: "partner-referral-action", max: 30, windowSeconds: 3600 })
  if (!limit.allowed) return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })

  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Unsupported action" }, { status: 400 })

  const ctx = auditContextFromPartnerSession(session, request)

  if (parsed.data.action === "open_document") {
    const documentId = parsed.data.documentId
    // Re-project through the partner-safe loader: a document must belong to this
    // partner and to this referral before a signed view is issued.
    const detail = await getPartnerReferralDetail(session.partnerId, id)
    if (!detail?.documents.some((d) => d.id === documentId)) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }
    const url = await getGeneratedDocumentSignedUrl(documentId, {
      partnerId: session.partnerId,
      actor: ctx,
    })
    if (!url) return NextResponse.json({ error: "Document unavailable" }, { status: 500 })
    return NextResponse.json({ url })
  }

  const result =
    parsed.data.action === "submit"
      ? await submitDraftReferral(id, session.partnerId, session.partnerUserId, ctx)
      : await provideReferralInformation(id, session.partnerId, session.partnerUserId, parsed.data.response, ctx)

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
