import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import {
  listApplicationComplianceDocuments,
  requestApplicationComplianceDocuments,
  resendComplianceUploadToken,
  verifyApplicationComplianceDocument,
} from "@/lib/partner-compliance"

/* ─── GET: compliance documents for this application ─── */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied

  const { id } = await params
  const docs = await listApplicationComplianceDocuments(id)
  return NextResponse.json({ documents: docs })
}

/* ─── POST: request compliance documents (creates rows + upload tokens + emails) ─── */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  const { id } = await params
  try {
    const body = await request.json()
    const documentTypes = (body.documentTypes || []) as string[]
    const result = await requestApplicationComplianceDocuments(id, documentTypes, session!.userId)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true, documents: result.docs })
  } catch {
    return NextResponse.json({ error: "Failed to request compliance documents" }, { status: 500 })
  }
}

/* ─── PATCH: verify / reject / review an application compliance document ─── */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  await params
  try {
    const body = await request.json()
    const { docId, status, notes } = body
    if (!docId || !status) {
      return NextResponse.json({ error: "docId and status are required" }, { status: 400 })
    }
    const result = await verifyApplicationComplianceDocument(
      docId as string,
      status as "VERIFIED" | "APPROVED" | "REJECTED" | "UNDER_REVIEW",
      (notes as string) || "",
      session!.userId
    )
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 })
  }
}

/* ─── PUT: resend a one-time upload token ─── */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  await params
  try {
    const body = await request.json()
    const { docId } = body
    if (!docId) return NextResponse.json({ error: "docId is required" }, { status: 400 })
    const result = await resendComplianceUploadToken(docId as string, session!.userId)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to resend upload link" }, { status: 500 })
  }
}
