import { redirect } from "next/navigation"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { listPartnerCustomers } from "@/lib/partner-customers"
import Link from "next/link"

export default async function PartnerCustomersPage() {
  const session = await getPartnerSession()
  if (!session) redirect("/partner/login")

  const auth = await authorizePartner({ session, permission: "customers:view_assigned" })
  if (!auth.authorized) redirect("/partner")

  const customers = await listPartnerCustomers(session.partnerId)

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">My Customers</h2>
      {customers.length === 0 ? (
        <p className="text-muted-foreground">No customers assigned.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-2 text-left">Business</th>
                <th className="px-4 py-2 text-left">Location</th>
                <th className="px-4 py-2 text-left">Relationship</th>
                <th className="px-4 py-2 text-left">Access</th>
                <th className="px-4 py-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-4 py-2">
                    <Link href={`/partner/customers/${c.businessId}`} className="font-medium hover:underline">
                      {c.business.businessName}
                    </Link>
                  </td>
                  <td className="px-4 py-2">{[c.business.city, c.business.state, c.business.country].filter(Boolean).join(", ")}</td>
                  <td className="px-4 py-2">{c.relationship}</td>
                  <td className="px-4 py-2">{c.accessLevel}</td>
                  <td className="px-4 py-2">{c.business.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
