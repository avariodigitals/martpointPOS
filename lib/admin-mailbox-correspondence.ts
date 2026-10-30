import "server-only"

import { supabase } from "@/lib/supabase"
import { REPLY_TO } from "@/lib/email"

type OutboundMailboxMessage = {
  mailboxEmail: string
  messageId: string
  fromEmail: string
  fromName?: string | null
  to: string | string[]
  cc?: string | string[]
  subject: string
  text: string
  html?: string | null
  provider?: string | null
  sentBy?: string | null
  sentByName?: string | null
  clientRequestId?: string | null
  inReplyTo?: string | null
  references?: string | null
  createdAt?: string | null
  leadId?: string | null
}

export type MirroredConversationMessage = {
  mailboxEmail: string
  threadKey: string
  messageId?: string | null
  providerMessageId: string
  direction: "inbound" | "outbound"
  fromEmail: string
  fromName?: string | null
  to: string | string[]
  cc?: string | string[]
  subject: string
  text: string
  html?: string | null
  provider: string
  createdAt?: string | null
  leadId?: string | null
  inReplyTo?: string | null
  references?: string | null
}

function addresses(value: string | string[] | undefined): string[] {
  const values = Array.isArray(value) ? value : [value || ""]
  return [...new Set(values.flatMap((item) => item.split(/[,;\n]+/)).map((item) => {
    const angled = item.match(/<([^>]+)>/)
    return (angled?.[1] || item).trim().toLowerCase()
  }).filter((item) => item.includes("@")))]
}

function sender(value: string): string {
  const angled = value.match(/<([^>]+)>/)
  return (angled?.[1] || value).trim().toLowerCase()
}

async function resolveMailbox(mailboxEmail: string) {
  const wanted = sender(mailboxEmail)
  const { data, error } = await supabase
    .from("admin_mailboxes")
    .select("id,email")
    .ilike("email", wanted)
    .eq("active", true)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (data) return data

  // Mail routed through department aliases still belongs in the central Sales
  // mailbox when that is the only shared inbox configured.
  if (wanted !== sender(REPLY_TO.sales)) {
    const fallback = await supabase
      .from("admin_mailboxes")
      .select("id,email")
      .ilike("email", sender(REPLY_TO.sales))
      .eq("active", true)
      .maybeSingle()
    if (fallback.error) throw new Error(fallback.error.message)
    return fallback.data
  }
  return null
}

function references(input: { inReplyTo?: string | null; references?: string | null }): string[] {
  return [...new Set(`${input.inReplyTo || ""} ${input.references || ""}`.match(/<[^<>\s]+>/g) || [])]
}

function normalizedSubject(value: string): string {
  return value.replace(/^(\s*(re|fw|fwd)\s*:\s*)+/i, "").trim().toLowerCase()
}

async function findMatchingThread(mailboxId: string, subject: string, participantEmails: string[]) {
  const normalized = normalizedSubject(subject)
  if (!normalized || !participantEmails.length) return null
  const { data, error } = await supabase.from("admin_mailbox_threads")
    .select("id,subject,participants")
    .eq("mailbox_id", mailboxId)
    .order("last_message_at", { ascending: false })
    .limit(150)
  if (error) throw new Error(error.message)
  const participantSet = new Set(participantEmails)
  return (data || []).find((thread) =>
    normalizedSubject(String(thread.subject || "")) === normalized &&
    addresses((thread.participants as string[] || [])).some((address) => participantSet.has(address))
  ) || null
}

/** Mirror an external conversation (for example LeadsRite) into a shared box. */
export async function mirrorConversationMessageToMailbox(input: MirroredConversationMessage): Promise<boolean> {
  const mailbox = await resolveMailbox(input.mailboxEmail)
  if (!mailbox) return false

  const existing = await supabase.from("admin_mailbox_messages")
    .select("id")
    .eq("mailbox_id", mailbox.id)
    .eq("provider_message_id", input.providerMessageId)
    .maybeSingle()
  if (existing.error) throw new Error(existing.error.message)
  if (existing.data) return false

  const to = addresses(input.to)
  const cc = addresses(input.cc)
  const participants = [...new Set([sender(input.fromEmail), ...to, ...cc])]
  let thread: { data: { id: string; participants: unknown } | null; error: { message: string } | null }
  const referenceIds = references(input)
  if (referenceIds.length) {
    const matched = await supabase.from("admin_mailbox_messages").select("thread_id")
      .eq("mailbox_id", mailbox.id).in("message_id", referenceIds).limit(1).maybeSingle()
    if (matched.error) throw new Error(matched.error.message)
    if (matched.data?.thread_id) {
      const existingThread = await supabase.from("admin_mailbox_threads").select("id,participants")
        .eq("id", matched.data.thread_id).maybeSingle()
      thread = existingThread
    } else {
      thread = await supabase.from("admin_mailbox_threads").select("id,participants")
        .eq("mailbox_id", mailbox.id).eq("thread_key", input.threadKey).maybeSingle()
    }
  } else {
    thread = await supabase.from("admin_mailbox_threads").select("id,participants")
      .eq("mailbox_id", mailbox.id).eq("thread_key", input.threadKey).maybeSingle()
  }
  if (thread.error) throw new Error(thread.error.message)
  if (!thread.data) {
    const created = await supabase.from("admin_mailbox_threads").insert({
      mailbox_id: mailbox.id,
      thread_key: input.threadKey,
      subject: input.subject || "(no subject)",
      lead_id: input.leadId || null,
      participants,
      status: "open",
      last_message_at: input.createdAt || new Date().toISOString(),
      last_message_preview: input.text.replace(/\s+/g, " ").trim().slice(0, 500),
    }).select("id,participants").single()
    if (created.error) {
      const raced = await supabase.from("admin_mailbox_threads").select("id,participants")
        .eq("mailbox_id", mailbox.id).eq("thread_key", input.threadKey).maybeSingle()
      if (raced.error || !raced.data) throw new Error(created.error.message)
      thread = raced
    } else thread = created
  }

  const message = await supabase.from("admin_mailbox_messages").insert({
    mailbox_id: mailbox.id,
    thread_id: thread.data!.id,
    direction: input.direction,
    from_email: sender(input.fromEmail),
    from_name: input.fromName || "",
    to_emails: to,
    cc_emails: cc,
    subject: input.subject || "(no subject)",
    body_text: input.text,
    body_html: input.html || "",
    message_id: input.messageId || null,
    provider: input.provider,
    send_status: input.direction === "inbound" ? "received" : "sent",
    provider_message_id: input.providerMessageId,
    in_reply_to: input.inReplyTo || null,
    references_header: input.references || null,
    created_at: input.createdAt || new Date().toISOString(),
  })
  if (message.error && message.error.code !== "23505") throw new Error(message.error.message)

  const threadUpdate = await supabase.from("admin_mailbox_threads").update({
    participants: [...new Set([...(thread.data!.participants as string[] || []), ...participants])],
    last_message_at: input.createdAt || new Date().toISOString(),
    last_message_preview: input.text.replace(/\s+/g, " ").trim().slice(0, 500),
    ...(input.leadId ? { lead_id: input.leadId } : {}),
    updated_at: new Date().toISOString(),
  }).eq("id", thread.data!.id)
  if (threadUpdate.error) throw new Error(threadUpdate.error.message)
  if (input.direction === "inbound") {
    const { data: members, error: membersError } = await supabase.from("admin_mailbox_members")
      .select("user_id").eq("mailbox_id", mailbox.id)
    if (membersError) throw new Error(membersError.message)
    if (members?.length) {
      const { error: stateError } = await supabase.from("admin_mailbox_thread_state").upsert(
        members.map((member) => ({ thread_id: thread.data!.id, user_id: member.user_id, is_read: false })),
        { onConflict: "thread_id,user_id" },
      )
      if (stateError) throw new Error(stateError.message)
    }
  }
  return !message.error
}

/** Keep CRM correspondence in the shared Mailbox and preserve RFC threading. */
export async function mirrorSentMessageToMailbox(input: OutboundMailboxMessage): Promise<void> {
  const mailbox = await resolveMailbox(input.mailboxEmail)
  // CRM mail remains available in its entity history if this address has not
  // been configured as a shared mailbox yet.
  if (!mailbox) return

  const existing = await supabase.from("admin_mailbox_messages")
    .select("id")
    .eq("mailbox_id", mailbox.id)
    .eq("message_id", input.messageId)
    .maybeSingle()
  if (existing.error) throw new Error(existing.error.message)
  if (existing.data) return

  const to = addresses(input.to)
  const cc = addresses(input.cc)
  const participants = [...new Set([sender(input.fromEmail), ...to, ...cc])]
  const referenceIds = references(input)
  let priorThread: { id: string } | null = null
  if (referenceIds.length) {
    const matched = await supabase.from("admin_mailbox_messages").select("thread_id")
      .eq("mailbox_id", mailbox.id).in("message_id", referenceIds).limit(1).maybeSingle()
    if (matched.error) throw new Error(matched.error.message)
    if (matched.data?.thread_id) priorThread = { id: String(matched.data.thread_id) }
  }
  if (!priorThread) {
    const likelyThread = await findMatchingThread(mailbox.id, input.subject, participants)
    if (likelyThread) priorThread = { id: likelyThread.id }
  }
  const thread = priorThread
    ? { data: priorThread, error: null }
    : await supabase.from("admin_mailbox_threads").insert({
    mailbox_id: mailbox.id,
    thread_key: input.messageId,
    subject: input.subject || "(no subject)",
    lead_id: input.leadId || null,
    participants,
    status: "open",
    last_message_at: input.createdAt || new Date().toISOString(),
    last_message_preview: input.text.replace(/\s+/g, " ").trim().slice(0, 500),
  }).select("id").single()
  if (thread.error) {
    // A concurrent retry may have created this thread already.
    const raced = await supabase.from("admin_mailbox_threads").select("id")
      .eq("mailbox_id", mailbox.id).eq("thread_key", input.messageId).maybeSingle()
    if (raced.error || !raced.data) throw new Error(thread.error.message)
    const message = await supabase.from("admin_mailbox_messages").insert({
      mailbox_id: mailbox.id,
      thread_id: raced.data.id,
      direction: "outbound",
      from_email: sender(input.fromEmail),
      from_name: input.fromName || "",
      to_emails: to,
      cc_emails: cc,
      subject: input.subject || "(no subject)",
      body_text: input.text,
      body_html: input.html || "",
      message_id: input.messageId,
      in_reply_to: input.inReplyTo || null,
      references_header: input.references || null,
      provider: input.provider || "resend",
      send_status: "sent",
      provider_message_id: input.messageId,
      sent_by: input.sentBy || null,
      sent_by_name: input.sentByName || null,
      client_request_id: input.clientRequestId || null,
      created_at: input.createdAt || new Date().toISOString(),
    })
    if (message.error && message.error.code !== "23505") throw new Error(message.error.message)
    if (input.leadId) await supabase.from("admin_mailbox_threads").update({ lead_id: input.leadId }).eq("id", raced.data.id).is("lead_id", null)
    return
  }

  const message = await supabase.from("admin_mailbox_messages").insert({
    mailbox_id: mailbox.id,
    thread_id: thread.data!.id,
    direction: "outbound",
    from_email: sender(input.fromEmail),
    from_name: input.fromName || "",
    to_emails: to,
    cc_emails: cc,
    subject: input.subject || "(no subject)",
    body_text: input.text,
    body_html: input.html || "",
    message_id: input.messageId,
    in_reply_to: input.inReplyTo || null,
    references_header: input.references || null,
    provider: input.provider || "resend",
    send_status: "sent",
    provider_message_id: input.messageId,
    sent_by: input.sentBy || null,
    sent_by_name: input.sentByName || null,
    client_request_id: input.clientRequestId || null,
    created_at: input.createdAt || new Date().toISOString(),
  })
  if (message.error && message.error.code !== "23505") throw new Error(message.error.message)
  await supabase.from("admin_mailbox_threads").update({
    participants: participants,
    last_message_at: input.createdAt || new Date().toISOString(),
    last_message_preview: input.text.replace(/\s+/g, " ").trim().slice(0, 500),
    ...(input.leadId ? { lead_id: input.leadId } : {}),
    updated_at: new Date().toISOString(),
  }).eq("id", thread.data!.id)
}

/** Import existing CRM email-tab history into the shared Sales Mailbox. */
export async function syncCrmCorrespondenceToMailbox(mailboxEmail: string): Promise<number> {
  if (sender(mailboxEmail) !== sender(REPLY_TO.sales)) return 0
  let imported = 0
  const sources = [
    { table: "lead_emails", select: "id,direction,from_email,to_email,subject,body_text,body_html,status,provider,provider_message_id,metadata,created_at,lead_id", hasLead: true },
    { table: "partner_emails", select: "id,direction,from_email,to_email,subject,body_text,body_html,status,provider,provider_message_id,metadata,created_at,sent_by_name", hasLead: false },
    { table: "creator_application_emails", select: "id,direction,from_email,to_email,subject,body_text,body_html,status,provider,provider_message_id,metadata,created_at,sent_by_name", hasLead: false },
  ] as const

  for (const source of sources) {
    const pageSize = 500
    for (let offset = 0; ; offset += pageSize) {
      const { data, error } = await supabase.from(source.table)
        .select(source.select)
        .order("created_at", { ascending: true })
        .range(offset, offset + pageSize - 1)
      if (error) {
        // Tables can be absent on installations that have not applied their
        // optional CRM correspondence migration yet. Other errors should show.
        if (["42P01", "PGRST205"].includes(error.code || "")) break
        throw new Error(`Could not import ${source.table}: ${error.message}`)
      }
      const rows = data || []
      for (const row of rows) {
        if (row.direction === "outbound" && !["sent", "accepted", "received"].includes(String(row.status))) continue
        const metadata = (row.metadata || {}) as Record<string, unknown>
        const inReplyTo = typeof metadata.in_reply_to === "string" ? metadata.in_reply_to : null
        const refs = typeof metadata.references === "string" ? metadata.references : null
        const providerMessageId = String(row.provider_message_id || `crm:${source.table}:${row.id}`)
        const messageId = /^<[^<>\s]+>$/.test(providerMessageId) ? providerMessageId : null
        const threadReferences = references({ inReplyTo, references: refs })
        try {
          const wasImported = await mirrorConversationMessageToMailbox({
            mailboxEmail,
            threadKey: threadReferences[0] || messageId || `crm:${source.table}:${row.id}`,
            messageId,
            providerMessageId,
            direction: row.direction === "inbound" ? "inbound" : "outbound",
            fromEmail: String(row.from_email || "unknown"),
            fromName: typeof row.sent_by_name === "string" ? row.sent_by_name : null,
            to: String(row.to_email || ""),
            subject: String(row.subject || "(no subject)"),
            text: String(row.body_text || ""),
            html: String(row.body_html || ""),
            provider: String(row.provider || "crm"),
            createdAt: String(row.created_at || new Date().toISOString()),
            leadId: source.hasLead && row.lead_id ? String(row.lead_id) : null,
            inReplyTo,
            references: refs,
          })
          if (wasImported) imported++
        } catch (error) {
          console.error(`[mailbox CRM sync] ${source.table}:${row.id}`, error)
        }
      }
      if (rows.length < pageSize) break
    }
  }
  return imported
}
