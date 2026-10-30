import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { inboundMessageKey, type InboundLeadEmail } from "@/lib/lead-emails-inbound"
import { htmlToText } from "@/lib/email-html"
import { notifyAllAdmins } from "@/lib/admin-notifications"
import { REPLY_TO } from "@/lib/email"
import { mirrorConversationMessageToMailbox } from "@/lib/admin-mailbox-correspondence"

export function isPartnerMailbox(to: string): boolean {
  return to
    .split(/[,;]/)
    .some((address) => /^(?:[^<>]*<)?partners@martpoint\.com\.ng>?$/i.test(address.trim()))
}

/** Only a verified thread or one unambiguous saved contact can own a reply. */
export async function fileInboundPartnerEmail(email: InboundLeadEmail): Promise<boolean> {
  if (!isSupabaseConfigured() || !email.from || !isPartnerMailbox(email.to)) return false
  const sender = email.from.trim().toLowerCase()
  let partnerId: string | null = null
  const references =
    `${email.inReplyTo || ""} ${email.references || ""}`.match(/<partner-[a-f0-9-]+@martpoint\.com\.ng>/gi) ||
    []
  if (references.length) {
    const { data, error } = await supabase
      .from("partner_emails")
      .select("partner_id, to_email")
      .eq("direction", "outbound")
      .in("provider_message_id", references)
    if (error) throw error
    const matches = new Set(
      (data || []).filter((row) => row.to_email.toLowerCase() === sender).map((row) => String(row.partner_id))
    )
    if (matches.size === 1) partnerId = [...matches][0]
    else if (matches.size > 1) return false
  }
  if (!partnerId) {
    // Escape ILIKE wildcards: underscores in real addresses must match literally.
    const address = sender.replace(/[\\%_]/g, "\\$&")
    const [partners, users] = await Promise.all([
      supabase.from("partners").select("id").ilike("public_email", address),
      supabase
        .from("partner_users")
        .select("partner_id")
        .ilike("email", address)
        .in("status", ["ACTIVE", "INVITED"])
    ])
    if (partners.error || users.error) throw partners.error || users.error
    const matches = new Set([
      ...(partners.data || []).map((row) => String(row.id)),
      ...(users.data || []).map((row) => String(row.partner_id))
    ])
    if (matches.size !== 1) return false
    partnerId = [...matches][0]
  }
  const { data, error } = await supabase
    .from("partner_emails")
    .insert({
      partner_id: partnerId,
      direction: "inbound",
      from_email: sender,
      to_email: email.to,
      subject: email.subject || "(no subject)",
      body_text: email.text || htmlToText(email.html || ""),
      status: "received",
      provider: email.provider || null,
      provider_message_id: inboundMessageKey(email),
      metadata: {
        in_reply_to: email.inReplyTo || null,
        references: email.references || null,
        sent_at: email.sentAt || null
      }
    })
    .select("id")
    .single()
  if (error?.code === "23505") return false
  // Throw so IMAP does not mark a temporarily failed import as processed.
  if (error) throw error
  try {
    const refs = `${email.inReplyTo || ""} ${email.references || ""}`.match(/<[^<>\s]+>/g) || []
    const messageKey = inboundMessageKey(email)
    await mirrorConversationMessageToMailbox({
      mailboxEmail: REPLY_TO.partners,
      threadKey: refs[0] || messageKey || `partner-${partnerId}`,
      messageId: messageKey,
      providerMessageId: messageKey || `partner-email:${data.id}`,
      direction: "inbound",
      fromEmail: sender,
      to: email.to,
      cc: email.cc || undefined,
      subject: email.subject || "(no subject)",
      text: email.text || htmlToText(email.html || ""),
      html: email.html || "",
      provider: email.provider || "imap",
      createdAt: email.sentAt || null,
      inReplyTo: email.inReplyTo,
      references: email.references,
    })
  } catch (mirrorError) {
    console.error("[partner emails] could not mirror inbound message to Mailbox:", mirrorError)
  }
  try {
    await notifyAllAdmins({
      type: "PARTNER_EMAIL_RECEIVED",
      title: "New email from a partner",
      message: `${sender} · ${email.subject || "(no subject)"}`,
      deep_link: `/admin/partners/${partnerId}?tab=email`,
      source_type: "partner_email",
      source_id: String(data.id)
    })
  } catch (error) {
    console.error("[partner emails notification]", error)
  }
  return true
}
