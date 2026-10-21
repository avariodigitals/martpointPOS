import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { getPartnerQuoteRequestForPartner } from "@/lib/partner-quote-requests"
import { PartnerQuoteViewer } from "./quote-viewer"

export default async function PartnerQuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getPartnerSession()
  if (!session) redirect("/partner/login")

  const auth = await authorizePartner({ session, permission: "quotes:request_own" })
  if (!auth.authorized) redirect("/partner/quotes")

  const result = await getPartnerQuoteRequestForPartner(id, auth.partner!.id)
  if (!result) notFound()

  const lead = result.lead || {}
  return (
    <div className="space-y-6">
      <div>
        <Link href="/partner/quotes" className="text-sm text-muted-foreground hover:underline">← Back to quote requests</Link>
        <h2 className="text-2xl font-bold tracking-tight mt-2">Quote {result.request.issued_quote_ref as string || "request"}</h2>
        <p className="text-muted-foreground">{lead.business_name as string || "Customer opportunity"}</p>
      </div>
      <PartnerQuoteViewer requestId={id} lead={lead} quote={result.quote} />
    </div>
  )
}
