import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import {
  listPartnerComplianceDocuments,
  createSignedComplianceDocUrl,
  requestComplianceDocument,
  submitComplianceDocument,
} from "@/lib/partner-service"

export async function GET() {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "partner:compliance:view" })
  if (!auth.authorized) return auth.response!

  const docs = await listPartnerComplianceDocuments(session.partnerId)
  const docsWithUrls = await Promise.all(
    docs.map(async (d) => {
      const url = d.storage_path ? await createSignedComplianceDocUrl(d.storage_path as string) : null
      return { ...d, signedUrl: url }
    })
  )

  return NextResponse.json({ documents: docsWithUrls })
}

export async function POST(request: Request) {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "partner:compliance:submit" })
  if (!auth.authorized) return auth.response!

  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const docId = formData.get("docId") as string | null
    const documentType = formData.get("documentType") as string | null

    if (!file) return NextResponse.json({ error: "File is required" }, { status: 400 })

    let targetDocId = docId
    if (!targetDocId) {
      if (!documentType) {
        return NextResponse.json({ error: "Document type is required" }, { status: 400 })
      }
      const created = await requestComplianceDocument(session.partnerId, documentType, session.partnerUserId)
      if (!created.ok || !created.doc) {
        return NextResponse.json({ error: created.error || "Failed to create document" }, { status: 500 })
      }
      targetDocId = created.doc.id as string
    }

    const result = await submitComplianceDocument(targetDocId, session.partnerUserId, file)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 })
  }
}
