import { redirect } from "next/navigation"
import { getPartnerSession, authorizePartner, partnerHasCapability } from "@/lib/partner-auth"
import { listPartnerLeads } from "@/lib/partner-leads"
import Link from "next/link"

export default async function PartnerLeadsPage() {
  const session = await getPartnerSession()
  if (!session) redirect("/partner/login")

  const auth = await authorizePartner({ session, permission: "leads:view" })
  if (!auth.authorized) redirect("/partner")

  const hasSales = await partnerHasCapability(session.partnerId, "SALES")
  const hasReferrals = await partnerHasCapability(session.partnerId, "REFERRALS")
  if (!hasSales && !hasReferrals) redirect("/partner")

  const leads = await listPartnerLeads(session.partnerId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">My Leads</h2>
        <Link
          href="/partner/leads/new"
          className="inline-flex items-center rounded-md bg-retail px-4 py-2 text-sm font-medium text-white hover:bg-retail/90"
        >
          Register Lead
        </Link>
      </div>

      {leads.length === 0 ? (
        <p className="text-muted-foreground">No leads yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left">Business</th>
                <th className="px-4 py-2 text-left">Contact</th>
                <th className="px-4 py-2 text-left">Product</th>
                <th className="px-4 py-2 text-left">Registered</th>
                <th className="px-4 py-2 text-left">Lead Status</th>
                <th className="px-4 py-2 text-left">Protection</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link href={`/partner/leads/${lead.id}`} className="font-medium hover:underline">
                      {lead.businessName}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{lead.contactName}</td>
                  <td className="px-4 py-2">{lead.interestedProduct}</td>
                  <td className="px-4 py-2">{new Date(lead.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2">{lead.status}</td>
                  <td className="px-4 py-2">{lead.protectionStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
