import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin, getUserById } from "@/lib/admin-auth"
import { canAccessMailbox, getMailbox } from "@/lib/admin-mailbox"
import { supabase } from "@/lib/supabase"
import { sendEmail } from "@/lib/email"
import { appendSignatureToHtml, buildSignatureHtml, htmlToText, textToHtml } from "@/lib/email-html"
import { sanitizeSupportHtml } from "@/lib/support-html"
import { resolveUniqueLeadIdByAddress } from "@/lib/lead-emails-inbound"

export const dynamic = "force-dynamic"

const schema = z.object({
  threadId: z.uuid().optional(),
  to: z.array(z.email()).min(1).max(50),
  cc: z.array(z.email()).max(50).default([]),
  subject: z.string().trim().min(1).max(998),
  bodyHtml: z.string().max(200_000),
  attachments: z.array(z.object({ filename: z.string().trim().min(1).max(180), contentType: z.string().max(120).default("application/octet-stream"), content: z.string().min(1) })).max(10).default([]),
  replyToMessageId: z.uuid().optional(),
  requestId: z.uuid(),
})

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("mailbox")
  if (denied) return denied
  const { id } = await params
  try {
    if (!(await canAccessMailbox(id, session.userId, session.role === "Admin"))) return NextResponse.json({ error: "You do not have access to this mailbox." }, { status: 403 })
    const mailbox = await getMailbox(id)
    if (!mailbox) return NextResponse.json({ error: "Mailbox not found." }, { status: 404 })
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: "Add a valid recipient, subject, and message." }, { status: 400 })
    const payload = parsed.data
    const bodyHtml = sanitizeSupportHtml(payload.bodyHtml)
    const bodyText = htmlToText(bodyHtml)
    if (!bodyText.trim()) return NextResponse.json({ error: "Write a message before sending." }, { status: 400 })
    const storedSignature = String(mailbox.signature_html || "")
    const signatureHtml = mailbox.signature_format === "plain" ? textToHtml(storedSignature) : sanitizeSupportHtml(storedSignature)
    const signatureText = mailbox.signature_format === "plain" ? storedSignature.trim() : htmlToText(signatureHtml)
    const signatureBlock = signatureText ? buildSignatureHtml(signatureHtml, "") : ""
    const sentHtml = appendSignatureToHtml(bodyHtml, signatureBlock)
    const sentText = `${bodyText}${signatureText ? `\n\n--\n${signatureText}` : ""}`
    const totalAttachmentBytes = payload.attachments.reduce((total, item) => total + Math.floor(item.content.length * 0.75), 0)
    if (totalAttachmentBytes > 15 * 1024 * 1024) return NextResponse.json({ error: "Attachments must total 15 MB or less." }, { status: 413 })
    const existing = await supabase.from("admin_mailbox_messages").select("id,thread_id,send_status").eq("mailbox_id", id).eq("client_request_id", payload.requestId).maybeSingle()
    if (existing.data) return NextResponse.json({ success: existing.data.send_status === "sent", threadId: existing.data.thread_id, messageId: existing.data.id, duplicate: true })
    const user = await getUserById(session.userId)
    if (!user?.email) return NextResponse.json({ error: "Add your sender email under Admin → Users → your profile. Mailbox sends from that address, and replies go to this shared inbox." }, { status: 400 })

    const attachments: { id: string; filename: string; contentType: string; size: number; storagePath: string }[] = []
    const emailAttachments: { filename: string; content: string }[] = []
    for (const [index, attachment] of payload.attachments.entries()) {
      const filename = attachment.filename.replace(/[\\/\0]/g, "_")
      const bytes = Buffer.from(attachment.content, "base64")
      const storagePath = `${id}/outbound-${payload.requestId}/${index}-${filename}`
      const uploaded = await supabase.storage.from("admin-mailbox-attachments").upload(storagePath, bytes, { contentType: attachment.contentType || "application/octet-stream", upsert: true })
      if (uploaded.error) throw new Error(`Could not save attachment ${filename}: ${uploaded.error.message}`)
      attachments.push({ id: String(index), filename, contentType: attachment.contentType || "application/octet-stream", size: bytes.length, storagePath })
      emailAttachments.push({ filename, content: attachment.content })
    }

    let threadId = payload.threadId
    let leadId: string | null = null
    let parent: Record<string, unknown> | null = null
    if (threadId) {
      const { data: thread } = await supabase.from("admin_mailbox_threads").select("*").eq("mailbox_id", id).eq("id", threadId).maybeSingle()
      if (!thread || thread.status === "deleted") return NextResponse.json({ error: "Conversation not found." }, { status: 404 })
      if (thread.assigned_to && thread.assigned_to !== session.userId) return NextResponse.json({ error: "This conversation is assigned to another teammate. Claim it before replying." }, { status: 409 })
      leadId = typeof thread.lead_id === "string" ? thread.lead_id : null
      if (!leadId) {
        const matchedLeadIds = new Set<string>()
        for (const address of payload.to) {
          const match = await resolveUniqueLeadIdByAddress(address)
          if (match) matchedLeadIds.add(match)
        }
        leadId = matchedLeadIds.size === 1 ? [...matchedLeadIds][0] : null
        if (leadId) {
          const { error: linkError } = await supabase.from("admin_mailbox_threads").update({ lead_id: leadId }).eq("id", threadId).is("lead_id", null)
          if (linkError) throw new Error(linkError.message)
        }
      }
      const { data: prior } = await supabase.from("admin_mailbox_messages").select("message_id,references_header").eq("thread_id", threadId).order("created_at", { ascending: false }).limit(1).maybeSingle()
      parent = prior as Record<string, unknown> | null
    } else {
      const matchedLeadIds = new Set<string>()
      for (const address of payload.to) {
        const match = await resolveUniqueLeadIdByAddress(address)
        if (match) matchedLeadIds.add(match)
      }
      leadId = matchedLeadIds.size === 1 ? [...matchedLeadIds][0] : null
      const { data: thread, error } = await supabase.from("admin_mailbox_threads").insert({
        mailbox_id: id,
        thread_key: `outbound:${payload.requestId}`,
        subject: payload.subject,
        lead_id: leadId,
        participants: [...new Set([...payload.to, ...payload.cc, mailbox.email, user.email])],
        assigned_to: session.userId,
        status: "open",
        last_message_preview: bodyText.slice(0, 500),
      }).select("id").single()
      if (error || !thread) throw new Error(error?.message || "Could not create conversation.")
      threadId = thread.id
    }

    const messageId = `<mailbox-${payload.requestId}@martpoint.com.ng>`
    const { data: message, error: insertError } = await supabase.from("admin_mailbox_messages").insert({
      mailbox_id: id,
      thread_id: threadId,
      direction: "outbound",
      from_email: user.email.toLowerCase(),
      from_name: user.name || user.username,
      to_emails: payload.to.map((item) => item.toLowerCase()),
      cc_emails: payload.cc.map((item) => item.toLowerCase()),
      subject: payload.subject,
      body_text: sentText,
      body_html: sentHtml,
      message_id: messageId,
      in_reply_to: parent?.message_id || null,
      references_header: [parent?.references_header, parent?.message_id].filter(Boolean).join(" ") || null,
      provider: "resend",
      send_status: "pending",
      sent_by: session.userId,
      sent_by_name: user.name || user.username,
      client_request_id: payload.requestId,
      attachment_names: attachments.map((item) => item.filename),
      attachments,
    }).select("id").single()
    if (insertError || !message) throw new Error(insertError?.message || "Could not save message.")

    const sent = await sendEmail({
      to: payload.to.map((item) => item.toLowerCase()),
      cc: payload.cc.map((item) => item.toLowerCase()),
      attachments: emailAttachments,
      subject: payload.subject,
      text: sentText,
      html: sentHtml,
      from: `${user.name || user.username} <${user.email}>`,
      replyTo: mailbox.email,
      skipBranding: true,
      headers: {
        "Message-ID": messageId,
        ...(parent?.message_id ? {
          "In-Reply-To": String(parent.message_id),
          ...(parent.references_header ? { References: `${String(parent.references_header)} ${String(parent.message_id)}` } : { References: String(parent.message_id) }),
        } : {}),
      },
    })
    await supabase.from("admin_mailbox_messages").update({ send_status: sent ? "sent" : "failed" }).eq("id", message.id)
    await supabase.from("admin_mailbox_threads").update({
      subject: payload.subject,
      participants: [...new Set([...payload.to, ...payload.cc, mailbox.email, user.email])],
      assigned_to: session.userId,
      status: "open",
      last_message_at: new Date().toISOString(),
      last_message_preview: bodyText.slice(0, 500),
      updated_at: new Date().toISOString(),
    }).eq("id", threadId)
    if (!sent) return NextResponse.json({ error: "Resend could not send this message. It is saved in the conversation as failed." }, { status: 502 })
    await supabase.from("admin_mailbox_thread_state").upsert({ thread_id: threadId, user_id: session.userId, is_read: true }, { onConflict: "thread_id,user_id" })
    let historyWarning: string | null = null
    if (leadId) {
      const { error: historyError } = await supabase.from("lead_emails").insert({
        lead_id: leadId,
        direction: "outbound",
        from_email: user.email.toLowerCase(),
        to_email: payload.to.map((address) => address.toLowerCase()).join(", "),
        subject: payload.subject,
        body_text: sentText,
        body_html: sentHtml,
        status: "sent",
        provider: "mailbox",
        provider_message_id: messageId,
        metadata: {
          cc: payload.cc.map((address) => address.toLowerCase()).join(", ") || null,
          in_reply_to: parent?.message_id || null,
          references: [parent?.references_header, parent?.message_id].filter(Boolean).join(" ") || null,
          mailbox_id: id,
          mailbox_thread_id: threadId,
          mailbox_message_id: message.id,
          sent_by: session.userId,
          sent_by_name: user.name || user.username,
          attachments: attachments.map(({ filename, size }) => ({ filename, size })),
        },
      })
      if (historyError) {
        console.error("[mailbox] could not mirror sent message to lead history:", historyError.message)
        historyWarning = "Message sent, but it could not be copied into the lead’s Email history."
      }
    }
    return NextResponse.json({ success: true, threadId, messageId: message.id, historyWarning })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send email." }, { status: 500 })
  }
}
