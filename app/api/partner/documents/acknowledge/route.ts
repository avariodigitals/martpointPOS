import { NextResponse } from "next/server"
import { getPartnerSession } from "@/lib/partner-auth"
import { acknowledgeGeneratedDocument } from "@/lib/partner-generated-docs"

/* ─── POST: partner principal acknowledges a generated document ───
 * Customer Assignments (and other acknowledgement-required records) become
 * ACCEPTED once a PARTNER_OWNER or PARTNER_MANAGER confirms scope, dates and
 * access in the portal.
 */
export async function POST(request: Request) {
  const session = await getPartnerSession()
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }
  if (session.role !== "PARTNER_OWNER" && session.role !== "PARTNER_MANAGER") {
    return NextResponse.json(
      { error: "Only a partner owner or manager can acknowledge this document" },
      { status: 403 }
    )
  }

  try {
    const body = await request.json().catch(() => ({}))
    const documentId = typeof body?.documentId === "string" ? body.documentId : ""
    if (!documentId) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 })
    }

    const result = await acknowledgeGeneratedDocument(documentId, session.partnerId, {
      id: session.partnerUserId,
      name: session.name,
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to acknowledge document" }, { status: 500 })
  }
}
