import { NextResponse } from "next/server"
import { getSession, type UserRole, hasPermissionForUser } from "@/lib/admin-auth"
import { getEmailSettings, REPLY_TO } from "@/lib/email"

export async function GET() {
  const session = await getSession()
  if (!session || !await hasPermissionForUser(session.userId, session.role as UserRole, "marketing")) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  try {
    const settings = await getEmailSettings()
    return NextResponse.json({
      from: settings.fromEmail || settings.smtp?.fromEmail || process.env.SMTP_FROM_EMAIL || process.env.RESEND_FROM_EMAIL || "MartPoint <hello@martpoint.com.ng>",
      replyTo: REPLY_TO.sales,
    })
  } catch { return NextResponse.json({ error: "Unable to load the configured sender" }, { status: 500 }) }
}
