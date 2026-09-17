import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { isSupabaseConfigured } from "@/lib/supabase"
import {
  getAudienceRecipients,
  getSuppressedEmails,
  parseManualEmails,
} from "@/lib/marketing"
import type { MarketingRecipient } from "@/lib/marketing"

/* ─── GET: preview resolved + suppression-filtered recipients ─── */
export async function GET(request: Request) {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "marketing")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const audience = searchParams.get("audience") || "leads"
  const manual = searchParams.get("manual") || ""

  let recipients: MarketingRecipient[]
  if (audience === "manual") {
    recipients = parseManualEmails(manual)
  } else if (isSupabaseConfigured()) {
    recipients = await getAudienceRecipients(audience)
  } else {
    recipients = []
  }

  const suppressed = await getSuppressedEmails(recipients.map((r) => r.email))
  const deliverable = recipients.filter((r) => !suppressed.has(r.email))

  return NextResponse.json({
    total: recipients.length,
    deliverable: deliverable.length,
    suppressed: recipients.length - deliverable.length,
    preview: deliverable.slice(0, 8),
  })
}
