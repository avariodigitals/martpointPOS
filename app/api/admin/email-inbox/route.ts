import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { getEmailSettings, isImapConfigured } from "@/lib/email"
import { isSupabaseConfigured } from "@/lib/supabase"
import { describeSyncResult, syncLeadInbox } from "@/lib/lead-email-sync"

/* ─────────────────────  Lead mailbox: status + manual import  ─────────────────────
 * Backs the "Check mailbox for replies" control on the lead Email tab, and the
 * mailbox status line in Settings → Email. The background job
 * (/api/cron/email-sync) runs the same import every 10 minutes.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function GET() {
  const { denied } = await authorizeAdmin("leads")
  if (denied) return denied
  const settings = await getEmailSettings()
  return NextResponse.json({
    configured: isImapConfigured(settings),
    mailbox: settings.imap.mailbox,
    host: settings.imap.host,
    account: settings.imap.user,
  })
}

export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("leads")
  if (denied) return denied
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  const result = await syncLeadInbox()
  if (result.error) {
    console.error("[lead inbox manual sync]", result.error)
    return NextResponse.json({ error: result.error, summary: describeSyncResult(result), ...result }, { status: 502 })
  }

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.LEAD_INBOX_SYNCED,
    entityType: AUDIT_ENTITIES.LEAD,
    metadata: { scanned: result.scanned, imported: result.imported },
  })

  return NextResponse.json({ ok: true, ...result, summary: describeSyncResult(result) })
}
