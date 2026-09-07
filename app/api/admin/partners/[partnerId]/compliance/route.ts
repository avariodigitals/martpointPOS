import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import {
  listPartnerComplianceDocuments,
  createSignedComplianceDocUrl,
  requestComplianceDocument,
} from "@/lib/partner-service"
import { deriveComplianceScoreAndStatus } from "@/lib/partner-compliance"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied

  const { partnerId } = await params
  const docs = await listPartnerComplianceDocuments(partnerId)
  const docsWithUrls = await Promise.all(
    docs.map(async (d) => {
      const url = d.storage_path ? await createSignedComplianceDocUrl(d.storage_path as string) : null
      return { ...d, signedUrl: url }
    })
  )

  const score = deriveComplianceScoreAndStatus(
    docs.map((d) => ({ verification_status: d.verification_status as string, required: Boolean(d.required) }))
  )

  return NextResponse.json({ documents: docsWithUrls, score })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  const { partnerId } = await params
  try {
    const body = await request.json()
    const { documentType } = body
    if (!documentType) {
      return NextResponse.json({ error: "Document type is required" }, { status: 400 })
    }

    const result = await requestComplianceDocument(partnerId, documentType, session!.userId)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
    return NextResponse.json({ success: true, doc: result.doc })
  } catch {
    return NextResponse.json({ error: "Failed to request document" }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
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

    const updates: Record<string, unknown> = {
      verification_status: status,
      notes: notes || null,
      updated_at: new Date().toISOString(),
      verified_at: ["VERIFIED", "APPROVED"].includes(status) ? new Date().toISOString() : null,
      verified_by: ["VERIFIED", "APPROVED"].includes(status) ? session!.userId : null,
    }

    const { error } = await supabase.from("partner_documents").update(updates).eq("id", docId)
    if (error) return NextResponse.json({ error: "Failed to update document" }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to update document" }, { status: 500 })
  }
}
