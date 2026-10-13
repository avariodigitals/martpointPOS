import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { getPartnerReferralDetail } from "@/lib/referral-portal"
import { ReferralStatusPill } from "@/components/partner/referral-status-pill"
import { ReferralActions } from "./referral-actions"

export const dynamic = "force-dynamic"

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return iso
  }
}

function fmtDateTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
  } catch {
    return iso
  }
}

function naira(amount: number) {
  return `₦${(amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  const text = value === null || value === undefined || value === "" ? "—" : String(value)
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium break-words">{text}</p>
    </div>
  )
}

export default async function PartnerReferralDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getPartnerSession()
  if (!session) redirect("/partner/login")

  const auth = await authorizePartner({ session, permission: "leads:view" })
  if (!auth.authorized) redirect("/partner")

  const detail = await getPartnerReferralDetail(session.partnerId, id)
  if (!detail) notFound()

  const { referral, submitted, timeline, documents } = detail
  const protectionDaysLeft = referral.protectionExpiresAt
    ? Math.ceil((new Date(referral.protectionExpiresAt).getTime() - Date.now()) / 86_400_000)
    : null

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{referral.businessName}</h2>
          <p className="mt-1 font-mono text-xs text-muted-foreground">{referral.referralReference}</p>
        </div>
        <div className="flex items-center gap-3">
          <ReferralStatusPill status={referral.status} label={referral.statusLabel} />
          <Link href="/partner/referrals" className="text-sm text-muted-foreground hover:underline">
            ← Back to referrals
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Submitted" value={fmtDate(referral.submittedAt)} />
        <Field label="Accepted" value={fmtDate(referral.acceptanceDate)} />
        <Field
          label="Protection until"
          value={
            referral.protectionExpiresAt
              ? `${fmtDate(referral.protectionExpiresAt)}${protectionDaysLeft && protectionDaysLeft > 0 ? ` · ${protectionDaysLeft} days` : ""}`
              : null
          }
        />
        <Field label="Payable commission" value={naira(referral.payableCommissionNaira)} />
      </div>

      {referral.closureReason && (
        <p className="rounded-lg border bg-muted/40 p-3 text-sm">
          <span className="font-medium">Why this referral closed: </span>
          {referral.closureReason}
        </p>
      )}

      <ReferralActions
        referralId={id}
        status={referral.status}
        requestedInformation={referral.requiredAction}
        responseGiven={submitted.informationResponse}
        documents={documents.map((d) => ({ id: d.id, label: d.label }))}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">What you submitted</h3>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Contact" value={submitted.contactName} />
            <Field label="Phone" value={submitted.phone} />
            <Field label="Email" value={submitted.email} />
            <Field label="Business type" value={submitted.businessType} />
            <Field label="Location" value={[submitted.city, submitted.state, submitted.country].filter(Boolean).join(", ")} />
            <Field label="Branches" value={submitted.estimatedBranches} />
            <Field label="Users" value={submitted.estimatedUsers} />
            <Field label="Runs sales today" value={submitted.currentSystem} />
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Need they described</p>
            <p className="mt-1 whitespace-pre-line text-sm">{submitted.knownRequirement || "—"}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">How you know them</p>
            <p className="mt-1 text-sm">{submitted.relationshipSource || "—"}</p>
          </div>
          {submitted.notes && (
            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Your notes</p>
              <p className="mt-1 whitespace-pre-line text-sm">{submitted.notes}</p>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            Consent recorded {submitted.consentConfirmed ? "before submission" : "not confirmed"}.
          </p>
        </div>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold">Status history</h3>
          <ol className="relative space-y-3 border-l pl-4">
            {timeline.map((entry, i) => (
              <li key={`${entry.at}-${i}`} className="relative text-sm">
                <span className="absolute -left-5 mt-1.5 h-2 w-2 rounded-full bg-retail" />
                <p className="font-medium">{entry.statusLabel}</p>
                <p className="text-xs text-muted-foreground">{fmtDateTime(entry.at)}</p>
              </li>
            ))}
          </ol>

          <h3 className="pt-2 text-sm font-semibold">What happens next</h3>
          <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
            <p>
              {referral.status === "SUBMITTED" || referral.status === "UNDER_REVIEW"
                ? "MartPoint Sales checks the prospect against existing customers and other referrals, then records a decision."
                : referral.status === "ACCEPTED" || referral.status === "QUALIFIED"
                  ? "Attribution is protected. MartPoint Sales owns the conversation from here — please do not quote prices or promise timelines."
                  : referral.status === "CONVERTED_UNPAID" || referral.status === "PAID_PENDING_ACTIVATION"
                    ? "The business is buying. Commission is still not payable until payment clears and the licence is activated."
                    : referral.status === "ACTIVATED_HOLDING"
                      ? "The licence is active and the holding period is running. Finance closes earnings monthly."
                      : referral.status === "COMMISSION_ELIGIBLE"
                        ? "Finance has marked this earning eligible and is approving the payout."
                        : referral.status === "APPROVED"
                          ? "Payout approved and scheduled; expect it within the payout window stated in your Commission Schedule."
                          : referral.status === "PAID"
                            ? "Paid. Your payout statement is in the Documents page."
                            : "No further action is needed on this referral."}
            </p>
            <p className="mt-2">
              Commission is only ever created from cleared, eligible collected revenue after licence activation and the
              holding period — never from a lead, meeting, demonstration, quotation or invoice.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
