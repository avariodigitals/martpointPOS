import { redirect, notFound } from "next/navigation"
import { getPartnerSession, authorizePartner, getPartnerUserById } from "@/lib/partner-auth"
import { getPartnerCustomerDetail } from "@/lib/partner-customers"
import Link from "next/link"

export default async function CustomerDetailPage({ params }: { params: { businessId: string } }) {
  const session = await getPartnerSession()
  if (!session) redirect("/partner/login")

  const auth = await authorizePartner({ session, permission: "customers:view_assigned" })
  if (!auth.authorized) redirect("/partner/customers")

  const user = await getPartnerUserById(session.partnerUserId)
  if (!user) redirect("/partner/login")

  const result = await getPartnerCustomerDetail(session.partnerId, params.businessId, user)
  if (!result.ok) notFound()

  const { business, assignment, deployment, entitlement } = result.detail

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{business.businessName}</h2>
        <Link href="/partner/customers" className="text-sm text-muted-foreground hover:underline">← Back</Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Business Type</p><p className="font-medium">{business.businessType}</p></div>
        <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Industry</p><p className="font-medium">{business.industry}</p></div>
        <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Phone</p><p className="font-medium">{business.primaryPhone}</p></div>
        <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Email</p><p className="font-medium">{business.primaryEmail}</p></div>
        <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Location</p><p className="font-medium">{[business.address, business.city, business.state, business.country].filter(Boolean).join(", ")}</p></div>
        <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Relationship</p><p className="font-medium">{assignment.relationship}</p></div>
        <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Partner Access</p><p className="font-medium">{assignment.accessLevel}</p></div>
        <div className="rounded-lg border p-4"><p className="text-sm text-muted-foreground">Business Status</p><p className="font-medium">{business.status}</p></div>
      </div>

      {entitlement && (
        <div className="rounded-lg border p-4 space-y-2">
          <h3 className="font-semibold">Entitlements</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><span className="text-muted-foreground">Users:</span> {entitlement.max_users as number}</div>
            <div><span className="text-muted-foreground">Branches:</span> {entitlement.max_branches as number}</div>
            <div><span className="text-muted-foreground">Online Store:</span> {entitlement.online_store_enabled ? "Enabled" : "Disabled"}</div>
          </div>
        </div>
      )}

      {deployment && (
        <div className="rounded-lg border p-4 space-y-2">
          <h3 className="font-semibold">Deployment</h3>
          <p className="text-sm text-muted-foreground">Status: <span className="font-medium text-foreground">{deployment.status as string}</span></p>
        </div>
      )}

      {assignment.accessLevel === "ONBOARDING_MANAGER" && (
        <Link
          href={`/partner/customers/${params.businessId}/onboarding`}
          className="inline-flex rounded-md bg-retail px-4 py-2 text-sm font-medium text-white hover:bg-retail/90"
        >
          Open Onboarding Workspace
        </Link>
      )}
    </div>
  )
}
