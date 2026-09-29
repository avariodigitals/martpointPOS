import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { submitMilestoneEvidence } from "@/lib/partner-work-orders"

/* ─── POST: submit milestone evidence for MartPoint review ─── */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getPartnerSession()
  const auth = await authorizePartner({ session, permission: "workorders:manage_own", capability: "IMPLEMENTATION" })
  if (!auth.authorized) return auth.response!

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const evidenceText = body?.evidenceText ? String(body.evidenceText) : undefined
  const evidenceUrl = body?.evidenceUrl ? String(body.evidenceUrl) : undefined
  if (!evidenceText?.trim() && !evidenceUrl?.trim()) {
    return NextResponse.json({ error: "Evidence text or link is required" }, { status: 400 })
  }

  const result = await submitMilestoneEvidence(id, auth.partner!.id, { id: auth.user!.id, name: auth.user!.fullName }, { evidenceText, evidenceUrl })
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ success: true })
}
