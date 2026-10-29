import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin, getUserById } from "@/lib/admin-auth"
import { isSupabaseConfigured } from "@/lib/supabase"
import { htmlToText } from "@/lib/email-html"
import { sanitizeSupportHtml } from "@/lib/support-html"
import { loadPartnerEmailContext, renderPartnerEmail } from "@/lib/partner-email"

export async function POST(request: Request, { params }: { params: Promise<{ partnerId: string }> }) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { partnerId } = await params
  if (!z.uuid().safeParse(partnerId).success)
    return NextResponse.json({ error: "Invalid partner" }, { status: 400 })
  const parsed = z
    .object({ bodyHtml: z.string().max(50000) })
    .safeParse(await request.json().catch(() => null))
  if (!parsed.success || !htmlToText(sanitizeSupportHtml(parsed.data.bodyHtml)).trim())
    return NextResponse.json({ error: "Write a message first" }, { status: 400 })
  try {
    if (!(await loadPartnerEmailContext(partnerId)))
      return NextResponse.json({ error: "Partner not found" }, { status: 404 })
    const actor = await getUserById(session.userId)
    return NextResponse.json(
      await renderPartnerEmail(
        parsed.data.bodyHtml,
        actor?.signatureHtml || "",
        actor?.name || session.name || session.username
      )
    )
  } catch {
    return NextResponse.json({ error: "Could not preview email" }, { status: 500 })
  }
}
