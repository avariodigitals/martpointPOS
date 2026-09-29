import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { listQuoteRequestsForAdmin, decideQuoteRequest } from "@/lib/partner-quote-requests"

/* ─── GET: quotation request queue (optionally ?partnerId=) ─── */
export async function GET(request: Request) {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied

  const partnerId = new URL(request.url).searchParams.get("partnerId") || undefined
  const requests = await listQuoteRequestsForAdmin(partnerId)
  return NextResponse.json({ requests })
}

/* ─── POST: decide a quotation request ───
 * Body: { quoteRequestId, decision: "ISSUED" | "DECLINED" | "UNDER_REVIEW",
 *         issuedQuoteRef?, decisionReason? }
 */
export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  const body = await request.json().catch(() => ({}))
  if (!body?.quoteRequestId || !body?.decision) {
    return NextResponse.json({ error: "Quote request and decision are required" }, { status: 400 })
  }
  const decision = String(body.decision)
  if (!["ISSUED", "DECLINED", "UNDER_REVIEW"].includes(decision)) {
    return NextResponse.json({ error: "Decision must be ISSUED, DECLINED or UNDER_REVIEW" }, { status: 400 })
  }

  const result = await decideQuoteRequest(
    String(body.quoteRequestId),
    decision as "ISSUED" | "DECLINED" | "UNDER_REVIEW",
    {
      issuedQuoteRef: body?.issuedQuoteRef ? String(body.issuedQuoteRef) : null,
      decisionReason: body?.decisionReason ? String(body.decisionReason) : null,
    },
    session.userId
  )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ success: true })
}
