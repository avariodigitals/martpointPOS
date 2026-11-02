import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { inboundMessageKey, type InboundLeadEmail } from "@/lib/lead-emails-inbound"
import { notifyAllAdmins } from "@/lib/admin-notifications"
import { REPLY_TO } from "@/lib/email"
import { mirrorConversationMessageToMailbox } from "@/lib/admin-mailbox-correspondence"
import { sanitizeSupportHtml } from "@/lib/support-html"

/** File a reply to creators@ against the matching creator application. */
export async function fileInboundCreatorEmail(email: InboundLeadEmail): Promise<boolean> {
  if (!isSupabaseConfigured() || !email.from || !email.to.toLowerCase().includes("creators@martpoint.com.ng")) return false
  const sender = email.from.trim().toLowerCase()
  let application: { id: string; full_name: string; reference_number: string } | null = null
  const references = `${email.inReplyTo || ""} ${email.references || ""}`.match(/<creator-[a-f0-9-]+@martpoint\.com\.ng>/gi) || []
  if (references.length) {
    const { data, error } = await supabase.from("creator_application_emails")
      .select("application_id, to_email")
      .eq("direction", "outbound")
      .in("provider_message_id", references)
    if (error) throw new Error(`Could not find creator email thread: ${error.message}`)
    const matches = new Set((data || [])
      .filter((row) => String(row.to_email || "").toLowerCase() === sender)
      .map((row) => String(row.application_id)))
    if (matches.size > 1) return false
    const matchedId = [...matches][0]
    if (matchedId) {
      const result = await supabase.from("creator_applications")
        .select("id, full_name, reference_number")
        .eq("id", matchedId)
        .is("deleted_at", null)
        .maybeSingle()
      if (result.error) throw new Error(`Could not load creator email thread: ${result.error.message}`)
      application = result.data
    }
  }
  if (!application) {
    const exactSender = sender.replace(/[\\%_]/g, "\\$&")
    const result = await supabase.from("creator_applications")
      .select("id, full_name, reference_number")
      .ilike("email", exactSender)
      .is("deleted_at", null)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (result.error) throw new Error(`Could not find creator application for reply: ${result.error.message}`)
    application = result.data
  }
  if (!application?.id) return false

  const messageKey = inboundMessageKey(email)
  if (messageKey) {
    const { data: existing, error: duplicateCheckError } = await supabase.from("creator_application_emails")
      .select("id").eq("application_id", application.id).eq("provider_message_id", messageKey).maybeSingle()
    if (duplicateCheckError) throw new Error(`Could not check for duplicate creator reply: ${duplicateCheckError.message}`)
    if (existing) return false
  }
  const { data: inserted, error } = await supabase.from("creator_application_emails").insert({
    application_id: application.id, direction: "inbound", from_email: sender,
    to_email: email.to || null, subject: email.subject || "(no subject)",
    body_text: email.text || null, body_html: email.html ? sanitizeSupportHtml(email.html) : null,
    status: "received", provider: email.provider || null, provider_message_id: messageKey,
    metadata: { in_reply_to: email.inReplyTo || null, references: email.references || null, cc: email.cc || null, sent_at: email.sentAt || null },
  }).select("id").single()
  if (error) {
    if (error.code === "23505") return false
    console.error("[creator-emails] inbound insert failed:", error.message)
    throw new Error(`Could not save creator reply: ${error.message}`)
  }
  try {
    const refs = `${email.inReplyTo || ""} ${email.references || ""}`.match(/<[^<>\s]+>/g) || []
    await mirrorConversationMessageToMailbox({
      mailboxEmail: REPLY_TO.creators,
      threadKey: refs[0] || messageKey || `creator-${application.id}`,
      messageId: messageKey,
      providerMessageId: messageKey || `creator-email:${inserted.id}`,
      direction: "inbound",
      fromEmail: sender,
      to: email.to,
      cc: email.cc || undefined,
      subject: email.subject || "(no subject)",
      text: email.text || "",
      html: email.html || "",
      provider: email.provider || "imap",
      createdAt: email.sentAt || null,
      inReplyTo: email.inReplyTo,
      references: email.references,
    })
  } catch (mirrorError) {
    console.error("[creator emails] could not mirror inbound message to Mailbox:", mirrorError)
  }
  try {
    await notifyAllAdmins({
      type: "CREATOR_APPLICATION_EMAIL_RECEIVED",
      title: "New email from a creator applicant",
      message: `${application.full_name} · ${application.reference_number} · ${email.subject || "(no subject)"}`,
      deep_link: `/admin/creators/applications/${application.id}`,
      source_type: "creator_application_email",
      source_id: inserted?.id ? String(inserted.id) : String(application.id),
    })
  } catch (error) {
    console.error("[creator-emails] notification failed:", error)
  }
  return true
}
