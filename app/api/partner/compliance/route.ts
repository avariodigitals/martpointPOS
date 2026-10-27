import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import {
  listPartnerComplianceDocuments,
  createSignedComplianceDocUrl,
  requestComplianceDocument,
  submitComplianceDocument,
  submitPartnerBankDetails,
} from "@/lib/partner-service"
import { supabase } from "@/lib/supabase"
import { notifyAllAdmins } from "@/lib/admin-notifications"
import { REPLY_TO } from "@/lib/email"
import { publicUrl } from "@/lib/public-url"

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
    if (request.headers.get("content-type")?.includes("application/json")) {
      const body = await request.json()
      const docId = typeof body.docId === "string" ? body.docId : ""
      const result = await submitPartnerBankDetails({
        docId,
        partnerId: session.partnerId,
        partnerUserId: session.partnerUserId,
        bankName: typeof body.bankName === "string" ? body.bankName : "",
        accountName: typeof body.accountName === "string" ? body.accountName : "",
        accountNumber: typeof body.accountNumber === "string" ? body.accountNumber : "",
      })
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

      const { data: document } = await supabase.from("partner_documents")
        .select("partner_id, application_id")
        .eq("id", docId).eq("partner_id", session.partnerId).maybeSingle()
      await notifyAllAdmins({
        type: "PARTNER_COMPLIANCE_DOCUMENT_SUBMITTED",
        title: "Partner bank details submitted for compliance",
        message: `Bank details are ready for review from partner ${session.partnerId}.`,
        deep_link: document?.application_id ? `/admin/partners/applications/${document.application_id}` : "/admin/partners/applications",
        source_type: "partner_document",
        source_id: docId,
        roles: ["Admin", "Sales"],
        email: {
          route: "partner_compliance_document",
          subject: "Partner Bank Details Submitted for Review",
          text: `A partner submitted bank details through the secure compliance form.\n\nPartner: ${session.partnerId}\n\nReview them in the Admin Portal: ${publicUrl(document?.application_id ? `/admin/partners/applications/${document.application_id}` : "/admin/partners/applications")}`,
          replyTo: REPLY_TO.partners,
        },
      })
      return NextResponse.json({ success: true })
    }

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

    const { data: document } = await supabase
      .from("partner_documents")
      .select("partner_id, application_id, original_filename")
      .eq("id", targetDocId)
      .maybeSingle()
    await notifyAllAdmins({
      type: "PARTNER_COMPLIANCE_DOCUMENT_SUBMITTED",
      title: "Partner compliance document submitted",
      message: `${file.name} is ready for review from partner ${session.partnerId}.`,
      deep_link: document?.application_id
        ? `/admin/partners/applications/${document.application_id}`
        : "/admin/partners/applications",
      source_type: "partner_document",
      source_id: targetDocId,
      roles: ["Admin", "Sales"],
      email: {
        route: "partner_compliance_document",
        subject: "Partner Compliance Document Submitted",
        text: `A partner has uploaded compliance evidence for review.

Partner: ${session.partnerId}
Document: ${file.name}

Open Partner Applications in the Admin Portal:
/admin/partners/applications`,
        replyTo: REPLY_TO.partners,
      },
    })

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 })
  }
}
