import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { inboundMessageKey, type InboundLeadEmail } from "@/lib/lead-emails-inbound"
import { notifyAllAdmins } from "@/lib/admin-notifications"
import { REPLY_TO } from "@/lib/email"
import { mirrorConversationMessageToMailbox } from "@/lib/admin-mailbox-correspondence"

/** File a reply to creators@ against the matching creator application. */
export async function fileInboundCreatorEmail(email: InboundLeadEmail): Promise<boolean> {
  if (!isSupabaseConfigured() || !email.from || !email.to.toLowerCase().includes("creators@martpoint.com.ng")) return false
  const { data: application } = await supabase.from("creator_applications")
    .select("id, full_name, reference_number")
    .ilike("email", email.from)
    .is("deleted_at", null)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!application?.id) return false

  const messageKey = inboundMessageKey(email)
  if (messageKey) {
    const { data: existing } = await supabase.from("creator_application_emails")
      .select("id").eq("application_id", application.id).eq("provider_message_id", messageKey).maybeSingle()
    if (existing) return false
  }
  const { data: inserted, error } = await supabase.from("creator_application_emails").insert({
    application_id: application.id, direction: "inbound", from_email: email.from,
    to_email: email.to || null, subject: email.subject || "(no subject)",
    body_text: email.text || null, body_html: email.html || null,
    status: "received", provider: email.provider || null, provider_message_id: messageKey,
    metadata: { in_reply_to: email.inReplyTo || null, references: email.references || null, cc: email.cc || null, sent_at: email.sentAt || null },
  }).select("id").single()
  if (error) {
    console.error("[creator-emails] inbound insert failed:", error.message)
    return false
  }
  try {
    const refs = `${email.inReplyTo || ""} ${email.references || ""}`.match(/<[^<>\s]+>/g) || []
    await mirrorConversationMessageToMailbox({
      mailboxEmail: REPLY_TO.creators,
      threadKey: refs[0] || messageKey || `creator-${application.id}`,
      messageId: messageKey,
      providerMessageId: messageKey || `creator-email:${inserted.id}`,
      direction: "inbound",
      fromEmail: email.from,
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
