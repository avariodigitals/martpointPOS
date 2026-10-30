import "server-only"

import sanitizeHtml from "sanitize-html"
import { supabase } from "@/lib/supabase"
import { fileInboundLeadEmail, resolveUniqueLeadIdByAddress, type InboundLeadEmail } from "@/lib/lead-emails-inbound"
import { fileInboundPartnerEmail } from "@/lib/partner-emails-inbound"
import { fileInboundCreatorEmail } from "@/lib/creator-emails-inbound"
import { fileInboundSupportEmail } from "@/lib/support-email-inbound"
import { syncCrmCorrespondenceToMailbox } from "@/lib/admin-mailbox-correspondence"

export type MailboxConfig = {
  id: string
  name: string
  email: string
  imap_host: string
  imap_port: number
  imap_secure: boolean
  imap_user: string
  imap_password: string
  imap_folder: string
  signature_html: string
  signature_format: "plain" | "html"
  active: boolean
  last_synced_uid: number
  last_synced_uid_validity: string | null
  last_sync_at: string | null
  last_sync_error: string | null
  created_at: string
}

export type MailboxThread = {
  id: string
  mailbox_id: string
  subject: string
  participants: string[]
  status: "open" | "closed" | "deleted"
  is_starred: boolean
  assigned_to: string | null
  last_message_at: string
  last_message_preview: string
  unread: boolean
}

export function cleanEmailHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "h1", "h2", "h3", "hr"]),
    allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, a: ["href", "name", "target"], img: ["src", "alt", "width", "height"] },
    allowedSchemes: ["http", "https", "mailto", "cid"],
    transformTags: { a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer" }) },
  })
}

export async function getMailbox(mailboxId: string): Promise<MailboxConfig | null> {
  const { data, error } = await supabase.from("admin_mailboxes").select("*").eq("id", mailboxId).maybeSingle()
  if (error) throw new Error(error.message)
  return data as MailboxConfig | null
}

export async function canAccessMailbox(mailboxId: string, userId: string, isAdmin = false): Promise<boolean> {
  if (isAdmin) return Boolean(await getMailbox(mailboxId))
  const { data, error } = await supabase.from("admin_mailbox_members").select("mailbox_id").eq("mailbox_id", mailboxId).eq("user_id", userId).maybeSingle()
  if (error) throw new Error(error.message)
  return Boolean(data)
}

export async function listMailboxesForUser(userId: string, isAdmin = false) {
  if (isAdmin) {
    const { data, error } = await supabase.from("admin_mailboxes").select("id,name,email,active,created_at,last_sync_at,last_sync_error").order("name")
    if (error) throw new Error(error.message)
    return data || []
  }
  const { data, error } = await supabase.from("admin_mailbox_members").select("mailbox:admin_mailboxes(id,name,email,active,created_at,last_sync_at,last_sync_error)").eq("user_id", userId)
  if (error) throw new Error(error.message)
  return (data || []).flatMap((row) => Array.isArray(row.mailbox) ? row.mailbox : [row.mailbox]).filter((mailbox): mailbox is NonNullable<typeof mailbox> => Boolean(mailbox && mailbox.active))
}

function addressValues(value: unknown): string[] {
  if (!value) return []
  const groups = Array.isArray(value) ? value : [value]
  const out: string[] = []
  for (const group of groups) {
    const entries = (group as { value?: { address?: string }[] })?.value
    if (Array.isArray(entries)) for (const entry of entries) if (entry?.address) out.push(entry.address.toLowerCase())
  }
  return [...new Set(out)]
}

function addressNames(value: unknown): string[] {
  if (!value) return []
  const groups = Array.isArray(value) ? value : [value]
  const out: string[] = []
  for (const group of groups) {
    const entries = (group as { value?: { address?: string; name?: string }[] })?.value
    if (Array.isArray(entries)) for (const entry of entries) if (entry?.address) out.push(entry.name ? `${entry.name} <${entry.address.toLowerCase()}>` : entry.address.toLowerCase())
  }
  return [...new Set(out)]
}

function plainText(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, 500)
}

function normalizeSubject(value: string): string {
  return value.replace(/^(\s*(re|fw|fwd)\s*:\s*)+/i, "").trim().toLowerCase() || "(no subject)"
}

async function locateOrCreateThread(mailboxId: string, email: { subject: string; messageId?: string | null; inReplyTo?: string | null; references?: string | null; participants: string[]; text: string; date?: string | null }) {
  const keys = [email.inReplyTo, ...(email.references || "").split(/\s+/)].filter((key): key is string => Boolean(key))
  let thread: Record<string, unknown> | null = null
  if (keys.length) {
    const { data } = await supabase.from("admin_mailbox_messages").select("thread_id").eq("mailbox_id", mailboxId).in("message_id", keys).limit(1).maybeSingle()
    if (data?.thread_id) {
      const found = await supabase.from("admin_mailbox_threads").select("*").eq("id", data.thread_id).maybeSingle()
      thread = found.data as Record<string, unknown> | null
    }
  }
  const key = keys[0] || email.messageId || `subject:${normalizeSubject(email.subject)}:${email.participants.filter((item) => item.includes("@"))[0] || "unknown"}`
  if (!thread) {
    const created = await supabase.from("admin_mailbox_threads").insert({
      mailbox_id: mailboxId,
      thread_key: key,
      subject: email.subject || "(no subject)",
      participants: email.participants,
      status: "open",
      last_message_at: email.date || new Date().toISOString(),
      last_message_preview: plainText(email.text),
    }).select("*").single()
    if (created.error) {
      // A repeated IMAP delivery can race on the thread key; resolve the winner.
      const existing = await supabase.from("admin_mailbox_threads").select("*").eq("mailbox_id", mailboxId).eq("thread_key", key).maybeSingle()
      if (existing.error || !existing.data) throw new Error(created.error.message)
      thread = existing.data as Record<string, unknown>
    } else thread = created.data as Record<string, unknown>
  }
  return thread
}

export async function importMailboxMessage(mailbox: MailboxConfig, parsed: Record<string, unknown>): Promise<boolean> {
  const messageId = typeof parsed.messageId === "string" ? parsed.messageId : null
  if (messageId) {
    const existing = await supabase.from("admin_mailbox_messages").select("id,thread_id").eq("mailbox_id", mailbox.id).eq("message_id", messageId).maybeSingle()
    if (existing.data) {
      const senderAddress = addressValues(parsed.from)[0]
      const leadId = senderAddress ? await resolveUniqueLeadIdByAddress(senderAddress) : null
      if (leadId) {
        const linked = await supabase.from("admin_mailbox_threads").update({ lead_id: leadId }).eq("id", existing.data.thread_id).is("lead_id", null)
        if (linked.error) throw new Error(linked.error.message)
      }
      return false
    }
  }
  const subject = String(parsed.subject || "(no subject)").slice(0, 998)
  const fromAddresses = addressValues(parsed.from)
  const fromNames = addressNames(parsed.from)
  const to = addressValues(parsed.to)
  const cc = addressValues(parsed.cc)
  const text = String(parsed.text || "")
  const html = typeof parsed.html === "string" ? cleanEmailHtml(parsed.html) : ""
  const participants = [...new Set([...fromAddresses, ...to, ...cc])]
  const references = Array.isArray(parsed.references) ? parsed.references.join(" ") : String(parsed.references || "")
  const inReplyTo = Array.isArray(parsed.inReplyTo) ? String(parsed.inReplyTo[0] || "") : String(parsed.inReplyTo || "")
  const date = parsed.date instanceof Date ? parsed.date.toISOString() : typeof parsed.date === "string" ? parsed.date : new Date().toISOString()
  const thread = await locateOrCreateThread(mailbox.id, { subject, messageId, inReplyTo, references, participants, text, date })
  if (!thread.lead_id && fromAddresses[0]) {
    const leadId = await resolveUniqueLeadIdByAddress(fromAddresses[0])
    if (leadId) {
      const linked = await supabase.from("admin_mailbox_threads").update({ lead_id: leadId }).eq("id", thread.id).is("lead_id", null)
      if (linked.error) throw new Error(linked.error.message)
    }
  }
  const parsedAttachments = Array.isArray(parsed.attachments) ? parsed.attachments as { filename?: string; contentType?: string; content?: Buffer; size?: number }[] : []
  const attachmentNames = parsedAttachments.map((item) => String(item.filename || "attachment"))
  const messageKey = crypto.randomUUID()
  const attachments: { id: string; filename: string; contentType: string; size: number; storagePath: string }[] = []
  for (const [index, attachment] of parsedAttachments.entries()) {
    if (!attachment.content?.length) continue
    const filename = String(attachment.filename || "attachment").replace(/[\\/\0]/g, "_").slice(0, 180)
    const storagePath = `${mailbox.id}/${messageKey}/${index}-${filename}`
    const uploaded = await supabase.storage.from("admin-mailbox-attachments").upload(storagePath, attachment.content, { contentType: attachment.contentType || "application/octet-stream", upsert: false })
    if (uploaded.error) throw new Error(`Could not save attachment ${filename}: ${uploaded.error.message}`)
    attachments.push({ id: String(index), filename, contentType: attachment.contentType || "application/octet-stream", size: attachment.size || attachment.content.length, storagePath })
  }
  const { error } = await supabase.from("admin_mailbox_messages").insert({
    id: messageKey,
    mailbox_id: mailbox.id,
    thread_id: thread.id,
    direction: "inbound",
    from_email: fromAddresses[0] || "unknown",
    from_name: fromNames[0] || "",
    to_emails: to,
    cc_emails: cc,
    subject,
    body_text: text,
    body_html: html,
    message_id: messageId,
    in_reply_to: inReplyTo || null,
    references_header: references || null,
    provider: "imap",
    send_status: "received",
    attachment_names: attachmentNames,
    attachments,
    created_at: date,
  })
  if (error) {
    if (error.code === "23505") return false
    throw new Error(error.message)
  }
  await supabase.from("admin_mailbox_threads").update({
    participants,
    last_message_at: date,
    last_message_preview: plainText(text || html.replace(/<[^>]+>/g, " ")),
    updated_at: new Date().toISOString(),
  }).eq("id", thread.id)
  const { data: members } = await supabase.from("admin_mailbox_members").select("user_id").eq("mailbox_id", mailbox.id)
  if (members?.length) await supabase.from("admin_mailbox_thread_state").upsert(members.map((member) => ({ thread_id: thread.id, user_id: member.user_id, is_read: false })), { onConflict: "thread_id,user_id" })
  return true
}

/** Mirror synced replies into the entity email tabs as well as the Mailbox. */
async function fileMailboxMessageToEntityHistory(parsed: Record<string, unknown>): Promise<void> {
  const from = addressValues(parsed.from)[0] || ""
  const to = addressValues(parsed.to).join(", ")
  const cc = addressValues(parsed.cc).join(", ")
  const references = Array.isArray(parsed.references) ? parsed.references.join(" ") : String(parsed.references || "")
  const inReplyTo = Array.isArray(parsed.inReplyTo) ? String(parsed.inReplyTo[0] || "") : String(parsed.inReplyTo || "")
  const inbound: InboundLeadEmail = {
    from,
    to,
    cc,
    subject: String(parsed.subject || "(no subject)"),
    text: String(parsed.text || ""),
    html: typeof parsed.html === "string" ? parsed.html : "",
    messageId: typeof parsed.messageId === "string" ? parsed.messageId : null,
    inReplyTo: inReplyTo || null,
    references: references || null,
    sentAt: parsed.date instanceof Date ? parsed.date.toISOString() : typeof parsed.date === "string" ? parsed.date : null,
    provider: "imap",
  }
  if (!inbound.from) return

  // These handlers match their own receiving address and saved contact. They
  // dedupe by Message-ID, so this is safe if the legacy inbox poller also runs.
  const supportFiled = await fileInboundSupportEmail(inbound)
  if (supportFiled) return
  const partnerFiled = await fileInboundPartnerEmail(inbound)
  if (partnerFiled) return
  const creatorFiled = await fileInboundCreatorEmail(inbound)
  if (creatorFiled) return
  await fileInboundLeadEmail(inbound)
}

export async function syncSharedMailbox(mailbox: MailboxConfig): Promise<{ imported: number; scanned: number; crmImported: number; error?: string; crmError?: string }> {
  let imported = 0
  let scanned = 0
  let crmImported = 0
  let crmError: string | undefined
  const recordSyncStatus = async (errorMessage: string | null) => {
    const { error } = await supabase.from("admin_mailboxes").update({
      last_sync_at: new Date().toISOString(),
      last_sync_error: errorMessage,
    }).eq("id", mailbox.id)
    if (error) throw new Error(`Could not save sync status: ${error.message}`)
  }

  if (!mailbox.active) return { imported, scanned, crmImported, error: "Mailbox is inactive." }
  try {
    crmImported = await syncCrmCorrespondenceToMailbox(mailbox.email)
  } catch (error) {
    crmError = error instanceof Error ? error.message : "CRM email history import failed."
    console.error("[shared-mailbox-crm-sync]", crmError)
  }
  try {
    if (!mailbox.imap_host || !mailbox.imap_user || !mailbox.imap_password) throw new Error("Mailbox IMAP settings are incomplete.")
    const { ImapFlow } = await import("imapflow")
    const { simpleParser } = await import("mailparser")
    const client = new ImapFlow({ host: mailbox.imap_host, port: mailbox.imap_port, secure: mailbox.imap_secure, auth: { user: mailbox.imap_user, pass: mailbox.imap_password }, logger: false })
    try {
    await client.connect()
    const lock = await client.getMailboxLock(mailbox.imap_folder || "INBOX")
    try {
      const uids = (await client.search({ all: true }, { uid: true })) || []
      const uidValidity = String(client.mailbox ? client.mailbox.uidValidity : "")
      const sameMailboxEpoch = mailbox.last_synced_uid_validity === uidValidity
      const newestUid = uids.length ? Math.max(...uids) : mailbox.last_synced_uid
      const unseen = sameMailboxEpoch ? uids.filter((uid) => uid > mailbox.last_synced_uid) : uids
      // Walk oldest to newest on first sync (or after UIDVALIDITY changes), then
      // continue from the saved UID cursor on later scheduled runs.
      const pending = unseen.slice(0, 250)
      for (const uid of pending) {
        const fetched = await client.fetchOne(uid, { source: true }, { uid: true })
        if (!fetched || !fetched.source) continue
        const parsed = await simpleParser(fetched.source)
        scanned++
        const saved = await importMailboxMessage(mailbox, parsed as unknown as Record<string, unknown>)
        if (saved) imported++
        await fileMailboxMessageToEntityHistory(parsed as unknown as Record<string, unknown>)
      }
      if (pending.length) {
        const cursor = sameMailboxEpoch ? Math.max(mailbox.last_synced_uid, ...pending) : Math.max(...pending)
        const { error } = await supabase.from("admin_mailboxes").update({ last_synced_uid: cursor, last_synced_uid_validity: uidValidity, updated_at: new Date().toISOString() }).eq("id", mailbox.id)
        if (error) throw new Error(error.message)
      } else if (!sameMailboxEpoch || mailbox.last_synced_uid_validity !== uidValidity) {
        const { error } = await supabase.from("admin_mailboxes").update({ last_synced_uid: newestUid, last_synced_uid_validity: uidValidity, updated_at: new Date().toISOString() }).eq("id", mailbox.id)
        if (error) throw new Error(error.message)
      }
    } finally { lock.release() }
    } finally { await client.logout().catch(() => {}) }
    await recordSyncStatus(null)
  } catch (error) {
    const message = error instanceof Error ? error.message : "IMAP sync failed."
    try { await recordSyncStatus(message.slice(0, 1000)) } catch (statusError) {
      console.error("[shared-mailbox-sync-status]", statusError)
    }
    return { imported, scanned, crmImported, error: message, ...(crmError ? { crmError } : {}) }
  }
  return { imported, scanned, crmImported, ...(crmError ? { crmError } : {}) }
}

export async function syncAllSharedMailboxes() {
  const { data, error } = await supabase.from("admin_mailboxes").select("*").eq("active", true)
  if (error) throw new Error(error.message)
  const results = []
  for (const mailbox of (data || []) as MailboxConfig[]) results.push({ id: mailbox.id, email: mailbox.email, ...(await syncSharedMailbox(mailbox)) })
  return results
}
