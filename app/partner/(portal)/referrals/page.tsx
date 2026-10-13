import { redirect } from "next/navigation"
import Link from "next/link"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { listPartnerReferrals } from "@/lib/referral-portal"
import { ReferralStatusPill } from "@/components/partner/referral-status-pill"

export const dynamic = "force-dynamic"

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return iso
  }
}

function daysLeft(iso: string | null) {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  return Math.ceil(ms / 86_400_000)
}

function naira(amount: number) {
  return `₦${(amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default async function PartnerReferralsPage() {
  const session = await getPartnerSession()
  if (!session) redirect("/partner/login")

  const auth = await authorizePartner({ session, permission: "leads:view" })
  if (!auth.authorized) redirect("/partner")

  const referrals = await listPartnerReferrals(session.partnerId)
  const awaitingAction = referrals.filter((r) => r.status === "INFORMATION_REQUIRED" || r.status === "DRAFT").length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">My Referrals</h2>
          <p className="text-sm text-muted-foreground">
            Businesses you have introduced to MartPoint.
            {awaitingAction > 0 ? ` ${awaitingAction} need your attention.` : ""}
          </p>
        </div>
        <Link
          href="/partner/referrals/new"
          className="inline-flex items-center rounded-md bg-retail px-4 py-2 text-sm font-medium text-white hover:bg-retail/90"
        >
          Refer a business
        </Link>
      </div>

      <p className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        A referral becomes payable only after the business becomes a paying customer, their licence is activated and
        the holding period completes. Submitting a name, an acceptance, a demonstration, a quotation or an invoice never
        creates a commission — the figures below come from MartPoint Finance records, not estimates.
      </p>

      {referrals.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">You have not referred a business yet.</p>
          <Link href="/partner/referrals/new" className="mt-2 inline-block text-sm font-medium text-retail hover:underline">
            Refer your first business
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left">
              <tr>
                <th className="px-4 py-2 font-medium">Referral</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Submitted</th>
                <th className="px-4 py-2 font-medium">Protection until</th>
                <th className="px-4 py-2 text-right font-medium">Payable</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => {
                const remaining = daysLeft(r.protectionExpiresAt)
                return (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-3">
                      <Link href={`/partner/referrals/${r.id}`} className="font-medium hover:underline">
                        {r.businessName || r.referralReference}
                      </Link>
                      <p className="font-mono text-xs text-muted-foreground">{r.referralReference}</p>
                      {r.requiredAction && (
                        <p className="mt-1 text-xs text-amber-700">Action needed: information requested by MartPoint</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ReferralStatusPill status={r.status} label={r.statusLabel} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.submittedAt)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.protectionExpiresAt ? (
                        <>
                          {fmtDate(r.protectionExpiresAt)}
                          {remaining !== null && remaining > 0 && (
                            <span className="block text-xs">{remaining} days left</span>
                          )}
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{naira(r.payableCommissionNaira)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
