import { redirect } from "next/navigation"
import { requirePartnerSession, authorizePartner } from "@/lib/partner-auth"
import { listPartnerQuoteRequests, QUOTE_REQUEST_STATUS_LABELS, type QuoteRequestStatus } from "@/lib/partner-quote-requests"
import { listPartnerLeads } from "@/lib/partner-leads"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileQuestion } from "lucide-react"
import { QuoteRequestForm } from "./quotes-client"

function fmtDate(iso?: string | null) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return iso
  }
}

export default async function PartnerQuotesPage() {
  const session = await requirePartnerSession()

  const auth = await authorizePartner({ session, permission: "quotes:request_own" })
  if (!auth.authorized) redirect("/partner")

  const [requests, leads] = await Promise.all([
    listPartnerQuoteRequests(session.partnerId),
    listPartnerLeads(session.partnerId),
  ])

  const eligibleLeads = leads
    .filter((l) => !["LOST", "EXPIRED"].includes(l.status))
    .map((l) => ({ id: l.id, businessName: l.businessName }))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Quote Requests</h2>
        <p className="text-muted-foreground">
          Request a MartPoint-issued quotation against a registered opportunity. Quotes are priced and issued by MartPoint Sales.
        </p>
      </div>

      {eligibleLeads.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileQuestion className="w-4 h-4" /> New Quote Request
            </CardTitle>
          </CardHeader>
          <CardContent>
            <QuoteRequestForm leads={eligibleLeads} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Requests</CardTitle></CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No quote requests yet.</p>
          ) : (
            <div className="space-y-3">
              {requests.map((r) => {
                const lead = r.partner_leads as Record<string, unknown> | null
                const status = r.status as QuoteRequestStatus
                return (
                  <div key={r.id as string} className="p-4 rounded-xl border border-border bg-background">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold">{(lead?.company_name as string) || "Opportunity"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {[r.plan_name, r.locations, r.users_estimate ? `${r.users_estimate} users` : null]
                            .filter(Boolean)
                            .join(" · ") || "General quote"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Requested {fmtDate(r.created_at as string)}
                          {!!r.issued_quote_ref && ` · Quote ref: ${r.issued_quote_ref as string}`}
                          {!!r.decision_reason && ` · ${r.decision_reason as string}`}
                        </p>
                      </div>
                      <span className={`text-[10px] uppercase px-2 py-0.5 rounded-full font-medium ${
                        status === "ISSUED" ? "bg-green-100 text-green-700"
                        : status === "DECLINED" || status === "EXPIRED" ? "bg-red-100 text-red-700"
                        : "bg-blue-100 text-blue-700"
                      }`}>
                        {QUOTE_REQUEST_STATUS_LABELS[status] || status}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
