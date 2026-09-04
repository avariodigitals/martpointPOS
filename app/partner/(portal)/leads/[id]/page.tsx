import { redirect, notFound } from "next/navigation"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { getPartnerLeadByIdForPartner } from "@/lib/partner-leads"
import Link from "next/link"

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const session = await getPartnerSession()
  if (!session) redirect("/partner/login")

  const auth = await authorizePartner({ session, permission: "leads:view" })
  if (!auth.authorized) redirect("/partner/leads")

  const lead = await getPartnerLeadByIdForPartner(params.id, session.partnerId)
  if (!lead) notFound()

  const editable = ["REGISTERED", "UNDER_REVIEW"].includes(lead.status)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{lead.businessName}</h2>
        <Link href="/partner/leads" className="text-sm text-muted-foreground hover:underline">← Back to leads</Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Contact</p><p className="font-medium">{lead.contactName}</p></div>
        <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Product</p><p className="font-medium">{lead.interestedProduct}</p></div>
        <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Status</p><p className="font-medium">{lead.status}</p></div>
        <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Protection</p><p className="font-medium">{lead.protectionStatus}</p></div>
        <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Location</p><p className="font-medium">{[lead.city, lead.state, lead.country].filter(Boolean).join(", ")}</p></div>
        <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Industry / Type</p><p className="font-medium">{lead.industry} / {lead.businessType}</p></div>
      </div>

      {lead.protectionStatus === "PENDING" && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
          This business may already exist in the MartPoint pipeline. Our team will review the registration.
        </p>
      )}

      {!editable && (
        <p className="text-sm text-muted-foreground">This lead is under review by MartPoint and cannot be edited.</p>
      )}
    </div>
  )
}
