import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import {
  listPartnerComplianceDocuments,
  createSignedComplianceDocUrl,
  requestComplianceDocument,
} from "@/lib/partner-service"

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

  return NextResponse.json({ documents: docsWithUrls })
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
