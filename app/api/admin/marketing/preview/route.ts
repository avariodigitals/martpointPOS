import { NextResponse } from "next/server"
import { getSession, type UserRole, hasPermissionForUser } from "@/lib/admin-auth"
import { applyMergeTags, buildMarketingHtml, getBaseUrl } from "@/lib/marketing"
import { getEmailSettings } from "@/lib/email"

export async function POST(request: Request) {
  const session = await getSession()
  if (!session || !await hasPermissionForUser(session.userId, session.role as UserRole, "marketing")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  try {
    const body = await request.json()
    if (typeof body.html !== "string" || body.html.length > 2_000_000) return NextResponse.json({ error: "A valid email body is required (maximum 2 MB)" }, { status: 400 })
    const settings = await getEmailSettings()
    // No tracking requests or functional unsubscribe links in a preview.
    const html = buildMarketingHtml(applyMergeTags(body.html, { name: "Ada Okafor", email: "ada@example.com" }), "preview", getBaseUrl(), String(body.preheader || ""))
      .replace(/<img[^>]+\/api\/marketing\/track\/open\/preview[^>]*>/gi, "")
      .replace(/href="[^"]*\/api\/marketing\/track\/click\/preview[^\"]*"/gi, 'href="#"')
      .replace(/href="[^"]*\/unsubscribe\?t=preview"/gi, 'href="#"')
    const policy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; font-src https:;">`
    return NextResponse.json({ html: policy + html, from: String(body.from || settings.fromEmail || settings.smtp?.fromEmail || process.env.SMTP_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || "MartPoint <hello@martpoint.com.ng>") })
  } catch { return NextResponse.json({ error: "Unable to render preview" }, { status: 500 }) }
}
