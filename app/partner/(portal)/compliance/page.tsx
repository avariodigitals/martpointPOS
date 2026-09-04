import { redirect } from "next/navigation"
import { requirePartnerSession, authorizePartner } from "@/lib/partner-auth"
import { listPartnerComplianceDocuments, createSignedComplianceDocUrl } from "@/lib/partner-service"
import { PartnerComplianceClient } from "./compliance-client"

export default async function PartnerCompliancePage() {
  const session = await requirePartnerSession()

  const auth = await authorizePartner({ session, permission: "partner:compliance:view" })
  if (!auth.authorized) {
    redirect("/partner")
  }

  const docs = await listPartnerComplianceDocuments(session.partnerId)
  const docsWithUrls = await Promise.all(
    docs.map(async (d) => ({
      id: d.id as string,
      document_type: d.document_type as string,
      verification_status: d.verification_status as string,
      uploaded_at: d.uploaded_at as string,
      original_filename: d.original_filename as string,
      signedUrl: d.storage_path ? await createSignedComplianceDocUrl(d.storage_path as string) : null,
    }))
  )

  return <PartnerComplianceClient documents={docsWithUrls} />
}
