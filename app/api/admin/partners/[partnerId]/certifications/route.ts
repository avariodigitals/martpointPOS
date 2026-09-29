import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { listPartnerCertifications, decideCertification, type CertificationStatus } from "@/lib/partner-certifications"

/* ─── GET: partner certification records ─── */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied

  const { partnerId } = await params
  const certifications = await listPartnerCertifications(partnerId)
  return NextResponse.json({ certifications })
}

/* ─── POST: record a certification decision ───
 * Body: { programme?, status, score?, assessor?, supervisedDelivery?,
 *         restrictions?, notes?, expiresAt? }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  const { partnerId } = await params
  const body = await request.json().catch(() => ({}))
  const status = String(body?.status || "")
  const allowed: CertificationStatus[] = ["CANDIDATE", "TRAINING", "ASSESSMENT", "SUPERVISED", "CERTIFIED", "EXPIRED", "REVOKED"]
  if (!allowed.includes(status as CertificationStatus)) {
    return NextResponse.json({ error: "Invalid certification status" }, { status: 400 })
  }

  const result = await decideCertification(
    partnerId,
    {
      programme: body?.programme ? String(body.programme) : undefined,
      status: status as CertificationStatus,
      score: body?.score != null && body.score !== "" ? Number(body.score) : null,
      assessor: body?.assessor ? String(body.assessor) : null,
      supervisedDelivery: Boolean(body?.supervisedDelivery),
      restrictions: body?.restrictions ? String(body.restrictions) : null,
      notes: body?.notes ? String(body.notes) : null,
      expiresAt: body?.expiresAt ? String(body.expiresAt) : null,
    },
    session.userId
  )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ success: true, certification: result.record })
}
