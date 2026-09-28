import { NextResponse } from "next/server"
import { getEmailSettings, isImapConfigured } from "@/lib/email"
import { fileInboundLeadEmail } from "@/lib/lead-emails-inbound"
import { isSupabaseConfigured } from "@/lib/supabase"

/* ───────────────────────────  IMAP email sync  ───────────────────────────
 * Polls the configured mailbox over IMAP and files new messages into
 * lead_emails when the sender matches a lead. This gives the admin Email tab
 * a true two-way thread backed by your own mailbox (no Resend inbound needed).
 *
 * Triggering:
 *   - Vercel cron: see vercel.json ("crons"). Vercel sends
 *     Authorization: Bearer <CRON_SECRET> automatically.
 *   - External cron (e.g. cron-job.org) or manual run:
 *     GET /api/cron/email-sync?secret=<INBOUND_EMAIL_WEBHOOK_SECRET>
 *   - If CRON_SECRET is unset, INBOUND_EMAIL_WEBHOOK_SECRET is accepted via
 *     the Authorization header, x-webhook-secret header, or ?secret= param.
 *   - If neither secret is configured the route is open — set one in prod.
 *
 * Mailbox config: Admin → Settings → Email → "Lead Thread Mailbox", or the
 * IMAP_HOST / IMAP_PORT / IMAP_SECURE / IMAP_USER / IMAP_PASS / IMAP_MAILBOX
 * env variables.
 */

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const MAX_MESSAGES_PER_RUN = 50

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  const inboundSecret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET
  if (!cronSecret && !inboundSecret) return true

  const auth = request.headers.get("authorization")
  const provided =
    (auth?.startsWith("Bearer ") ? auth.slice(7) : null) ||
    request.headers.get("x-webhook-secret") ||
    new URL(request.url).searchParams.get("secret")

  return provided === cronSecret || provided === inboundSecret
}

function addressList(value: unknown): string {
  if (!value) return ""
  const groups = Array.isArray(value) ? value : [value]
  const out: string[] = []
  for (const group of groups) {
    const entries = (group as { value?: { address?: string }[] })?.value
    if (Array.isArray(entries)) {
      for (const e of entries) if (e?.address) out.push(e.address)
    }
  }
  return out.join(", ")
}

async function syncImap(): Promise<{ processed: number; matched: number; skipped: string[] }> {
  const settings = await getEmailSettings()
  if (!isImapConfigured(settings)) {
    return { processed: 0, matched: 0, skipped: ["imap not configured"] }
  }

  const { ImapFlow } = await import("imapflow")
  const { simpleParser } = await import("mailparser")

  const imap = settings.imap
  const client = new ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: imap.secure,
    auth: { user: imap.user, pass: imap.pass },
    logger: false,
  })

  let processed = 0
  let matched = 0
  const skipped: string[] = []

  await client.connect()
  try {
    const lock = await client.getMailboxLock(imap.mailbox)
    try {
      const uids = (await client.search({ seen: false }, { uid: true })) || []
      for (const uid of uids.slice(-MAX_MESSAGES_PER_RUN)) {
        try {
          const msg = await client.fetchOne(uid, { source: true }, { uid: true })
          if (!msg || !msg.source) continue
          const parsed = await simpleParser(msg.source)

          const filed = await fileInboundLeadEmail({
            from: addressList(parsed.from),
            to: addressList(parsed.to),
            subject: parsed.subject || "(no subject)",
            text: parsed.text || "",
            html: typeof parsed.html === "string" ? parsed.html : "",
            messageId: parsed.messageId || null,
            inReplyTo: Array.isArray(parsed.inReplyTo) ? parsed.inReplyTo[0] || null : parsed.inReplyTo || null,
            provider: "imap",
          })

          processed++
          if (filed) matched++
          // Mark read so the message isn't re-fetched; lead matching is also
          // deduped by provider_message_id in the database.
          await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true })
        } catch (err) {
          skipped.push(`uid ${uid}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => {})
  }

  return { processed, matched, skipped }
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true, processed: 0, matched: 0, skipped: ["supabase not configured"] })
  }

  try {
    const result = await syncImap()
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error("[email-sync]", err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "IMAP sync failed" },
      { status: 500 },
    )
  }
}

export const POST = GET
