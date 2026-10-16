/* ───────────────────  Lead inbox import (IMAP)  ───────────────────
 * Pulls mail out of the configured "Lead Thread Mailbox" and files the ones
 * whose sender is a lead into lead_emails, so replies show up in the admin
 * Email tab.
 *
 * Two rules matter:
 *  - Mail is found by date, not by unread status. The old importer only looked
 *    at unread messages and marked them read, so a founder opening a reply in
 *    their own mailbox deleted it from the thread before the job ever ran.
 *  - Processed messages get a private IMAP keyword ($MartpointLeadMail) instead
 *    of touching the user's read/unread flags, so later runs skip them cheaply.
 */

import { getEmailSettings, isImapConfigured, type EmailSettings } from "./email"
import { fileInboundLeadEmail } from "./lead-emails-inbound"

export const LEAD_INBOX_SYNC_FLAG = "$MartpointLeadMail"

const LOOKBACK_DAYS = 7
const MAX_ENVELOPES_PER_RUN = 400
const MAX_MESSAGES_PER_RUN = 60

export interface LeadInboxSyncResult {
  ran: boolean
  configured: boolean
  mailbox: string
  host: string
  /** Messages found in this mailbox window that had not been processed before. */
  scanned: number
  /** Replies filed against a lead. */
  imported: number
  skipped: string[]
  error?: string
}

const NOT_CONFIGURED = (host: string, mailbox: string): LeadInboxSyncResult => ({
  ran: false,
  configured: false,
  mailbox,
  host,
  scanned: 0,
  imported: 0,
  skipped: ["Mailbox is not connected — add the IMAP host and username above."],
})

function addressList(value: unknown): string {
  if (!value) return ""
  const groups = Array.isArray(value) ? value : [value]
  const out: string[] = []
  for (const group of groups) {
    const entries = (group as { value?: { address?: string }[] })?.value
    if (Array.isArray(entries)) {
      for (const entry of entries) if (entry?.address) out.push(entry.address)
    }
  }
  return out.join(", ")
}

function firstAddress(value: unknown): string {
  return addressList(value).split(",")[0]?.trim() || ""
}

export function hasSyncFlag(flags: unknown): boolean {
  const list = flags instanceof Set ? [...flags] : Array.isArray(flags) ? flags : []
  return list.some((flag) => String(flag).toLowerCase() === LEAD_INBOX_SYNC_FLAG.toLowerCase())
}

/** Newest `MAX_ENVELOPES_PER_RUN` uids, oldest first. */
export function scopeUids(uids: number[]): number[] {
  return uids.slice(-MAX_ENVELOPES_PER_RUN)
}

export async function syncLeadInbox(preloadedSettings?: EmailSettings): Promise<LeadInboxSyncResult> {
  const settings = preloadedSettings || (await getEmailSettings())
  const imap = settings.imap
  if (!isImapConfigured(settings)) return NOT_CONFIGURED(imap.host, imap.mailbox)

  const { ImapFlow } = await import("imapflow")
  const { simpleParser } = await import("mailparser")

  const client = new ImapFlow({
    host: imap.host,
    port: imap.port,
    secure: imap.secure,
    auth: { user: imap.user, pass: imap.pass },
    logger: false,
  })

  const base: LeadInboxSyncResult = {
    ran: true,
    configured: true,
    mailbox: imap.mailbox,
    host: imap.host,
    scanned: 0,
    imported: 0,
    skipped: [],
  }
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000)
  const pending: number[] = []

  await client.connect()
  try {
    const lock = await client.getMailboxLock(imap.mailbox)
    try {
      const uids = scopeUids(((await client.search({ since }, { uid: true })) || []) as number[])
      if (uids.length === 0) return base
      const uidRange: [number, number] = [uids[0], uids[uids.length - 1]]

      // Envelope + flags only: cheap way to drop everything already processed.
      const wanted = new Set(uids)
      for await (const message of client.fetch(`${uidRange[0]}:${uidRange[1]}`, { envelope: true, flags: true }, { uid: true })) {
        const uid = Number(message?.uid)
        if (!wanted.has(uid) || hasSyncFlag(message?.flags)) continue
        base.scanned++
        pending.push(uid)
      }

      const queued = pending.slice(0, MAX_MESSAGES_PER_RUN)
      if (pending.length > queued.length) {
        base.skipped.push(`${pending.length - queued.length} older messages deferred to the next run`)
      }

      for (const uid of queued) {
        try {
          const fetched = await client.fetchOne(uid, { source: true }, { uid: true })
          const source = fetched === false ? null : fetched?.source
          if (!source) {
            base.skipped.push(`uid ${uid}: empty message`)
            continue
          }
          const parsed = await simpleParser(source)
          const filed = await fileInboundLeadEmail({
            from: firstAddress(parsed.from),
            to: addressList(parsed.to),
            subject: parsed.subject || "(no subject)",
            text: parsed.text || "",
            html: typeof parsed.html === "string" ? parsed.html : "",
            messageId: parsed.messageId || null,
            inReplyTo: Array.isArray(parsed.inReplyTo) ? parsed.inReplyTo[0] || null : parsed.inReplyTo || null,
            sentAt: parsed.date ? parsed.date.toISOString() : null,
            provider: "imap",
          })
          if (filed) base.imported++
          // Flag even non-lead mail: it has been looked at and deliberately ignored.
          await client.messageFlagsAdd(uid, [LEAD_INBOX_SYNC_FLAG], { uid: true })
        } catch (err) {
          base.skipped.push(`uid ${uid}: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    } finally {
      lock.release()
    }
  } catch (err) {
    base.ran = false
    base.error = describeImapError(err instanceof Error ? err.message : "Mailbox sync failed", imap.host)
  } finally {
    await client.logout().catch(() => {})
  }

  return base
}

/** Turn a raw IMAP connection error into something an operator can act on. */
export function describeImapError(raw: string, host: string): string {
  const lowered = raw.toLowerCase()
  if (lowered.includes("auth")) {
    return `${raw} — check the IMAP username and password (an app password is often required).`
  }
  if (lowered.includes("enotfound") || lowered.includes("getaddrinfo") || lowered.includes("ebusy")) {
    // Almost always the host field holding an address rather than a server
    // name, e.g. "mail@martpoint.com.ng" instead of "mail.martpoint.com.ng".
    return `${raw} — the IMAP host "${host}" could not be resolved. Use the mail server name only, e.g. mail.martpoint.com.ng (no @, no spaces), in Settings → Email → Lead Thread Mailbox.`
  }
  return raw
}

export function describeSyncResult(result: LeadInboxSyncResult): string {
  if (!result.configured) return result.skipped[0] || "Mailbox is not connected."
  if (result.error) return result.error
  if (result.scanned === 0) return "Mailbox checked — nothing new since the last run."
  if (result.imported === 0) return `Looked at ${result.scanned} new message${result.scanned === 1 ? "" : "s"} — no sender matched a lead.`
  return `Looked at ${result.scanned} new message${result.scanned === 1 ? "" : "s"}, added ${result.imported} reply${
    result.imported === 1 ? "" : "s"
  } to lead threads.`
}
