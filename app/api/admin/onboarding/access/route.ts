import { NextResponse } from "next/server"
import QRCode from "qrcode"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { sendEmail, REPLY_TO } from "@/lib/email"
import type { EmailAttachment } from "@/lib/email"
import { renderEmailTemplate, brandedEmailHtml, getEmailWhiteLogoUrl } from "@/lib/email-templates"
import { markAccessSent, startCheckins } from "@/lib/client-checkins"
import { getClientCheckinConfig } from "@/lib/automations"
import { accessEmailText, recipientEmails, accessLink, accessMessageLinks } from "@/lib/access-email"

async function guardOnboardingAccess() {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "onboarding")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}

export async function GET(request: Request) {
  const denied = await guardOnboardingAccess()
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
  const id = new URL(request.url).searchParams.get("recordId")
  if (!id) return NextResponse.json({ error: "Choose an onboarding record" }, { status: 400 })
  try {
    const { data: record, error } = await supabase.from("onboarding").select("id,business_id,lead_id").eq("id", id).single()
    if (error || !record) return NextResponse.json({ error: "Onboarding record not found" }, { status: 404 })
    let businessId = record.business_id
    if (!businessId && record.lead_id) {
      const result = await supabase.from("businesses").select("id").eq("source_lead_id", record.lead_id).maybeSingle()
      if (result.error) throw new Error("Business lookup failed")
      businessId = result.data?.id
    }
    if (!businessId) return NextResponse.json({ softwareUrl: "", onlineStoreUrl: "" }, { headers: { "Cache-Control": "private, no-store" } })
    const result = await supabase.from("business_deployments").select("admin_url,online_store_url").eq("business_id", businessId).maybeSingle()
    if (result.error) throw new Error("Deployment lookup failed")
    return NextResponse.json({ softwareUrl: result.data?.admin_url || "", onlineStoreUrl: result.data?.online_store_url || "" }, { headers: { "Cache-Control": "private, no-store" } })
  } catch {
    return NextResponse.json({ error: "Could not load deployment links. Enter and confirm the actual login address manually." }, { status: 503 })
  }
}

export async function POST(request: Request) {
  const denied = await guardOnboardingAccess()
  if (denied) return denied

  try {
    const body = await request.json()
    const {
      recordId,
      recipients,
      softwareUrl: rawSoftwareUrl,
      adminUsername,
      tempPassword,
      onlineStoreUrl: rawOnlineStoreUrl,
      supportGroupUrl: rawSupportGroupUrl,
      supportContact,
      trainingSchedule,
      attachStoreQr,
      attachLoginQr,
      additionalUsers,
      attachments,
      message,
      subject,
      additionalNote,
      linksConfirmed,
    } = body

    if ([recordId, rawSoftwareUrl, adminUsername, tempPassword].some((value) => typeof value !== "string" || !value.trim() || value.length > 2048)) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }
    if (linksConfirmed !== true) return NextResponse.json({ error: "Open and confirm the business login link before sending access details." }, { status: 400 })
    let softwareUrl: string, onlineStoreUrl: string, supportGroupUrl: string
    try {
      softwareUrl = accessLink(rawSoftwareUrl)
      onlineStoreUrl = accessLink(rawOnlineStoreUrl, "online store URL", true)
      supportGroupUrl = accessLink(rawSupportGroupUrl, "support group URL", true)
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : "Check access links" }, { status: 400 })
    }
    if (recipients !== undefined && typeof recipients !== "string") {
      return NextResponse.json({ error: "Enter a recipient email address." }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const { data: record, error: recordError } = await supabase
      .from("onboarding")
      .select("*")
      .eq("id", recordId)
      .single()

    if (recordError || !record) {
      return NextResponse.json({ error: "Onboarding record not found" }, { status: 404 })
    }

    let to: string[]
    try { to = recipientEmails(typeof recipients === "string" ? recipients : String(record.email || "")) }
    catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid recipient email" }, { status: 400 }) }
    if ((subject !== undefined && (typeof subject !== "string" || !subject.trim() || subject.length > 300 || /[\r\n]/.test(subject)))
      || (message !== undefined && (typeof message !== "string" || !message.trim() || message.length > 50_000))
      || (additionalNote !== undefined && (typeof additionalNote !== "string" || additionalNote.length > 10_000))) {
      return NextResponse.json({ error: "Check the email subject and message lengths." }, { status: 400 })
    }

    const productLabel = record.product_interest === "erp" ? "ERP" : "Retail"
    const onlineStoreBlock = onlineStoreUrl ? `Online Store: ${onlineStoreUrl}\n\n` : ""
    const supportGroupBlock = supportGroupUrl
      ? `Your MartPoint Support Group\n\nJoin your dedicated support group here:\n${supportGroupUrl}\n\nThe group is used for:\n\n• MartPoint onboarding and training coordination\n• Guidance on using the MartPoint software\n• Reporting software-related issues\n• Updates on reported issues\n• Important MartPoint service information\n\n`
      : ""

    const accessTpl = await renderEmailTemplate("onboarding_access", {
      fullName: record.full_name,
      businessName: record.business_name || record.full_name,
      productLabel,
      softwareUrl,
      adminUsername,
      tempPassword,
      onlineStoreBlock,
      supportGroupBlock,
      supportContact: supportContact || "",
      trainingSchedule: trainingSchedule || "",
    })

    const emailSubject = subject?.trim() || accessTpl.subject
    const baseMessage = accessMessageLinks(message || accessTpl.text, softwareUrl, record.access_details?.softwareUrl || "", onlineStoreUrl, record.access_details?.onlineStoreUrl || "")
    const emailText = accessEmailText(baseMessage, additionalNote)

    // Build attachment list: uploaded kit files + generated QR codes
    const MAX_ATTACHMENTS = 10
    const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024
    const MAX_TOTAL_BYTES = 10 * 1024 * 1024
    const emailAttachments: EmailAttachment[] = []

    if (attachments !== undefined && (!Array.isArray(attachments) || attachments.length > MAX_ATTACHMENTS)) {
      return NextResponse.json({ error: "Attach no more than ten files." }, { status: 400 })
    }
    if (Array.isArray(attachments)) {
      let totalBytes = 0
      for (const a of attachments.slice(0, MAX_ATTACHMENTS)) {
        const name = String(a?.name || "").slice(0, 120) || "attachment"
        const content = String(a?.content || "")
        const approxBytes = Math.floor((content.length * 3) / 4)
        if (!content || approxBytes > MAX_ATTACHMENT_BYTES || totalBytes + approxBytes > MAX_TOTAL_BYTES) {
          return NextResponse.json({ error: "An attachment is empty or exceeds the size limit. Please check your files." }, { status: 400 })
        }
        totalBytes += approxBytes
        emailAttachments.push({ filename: name, content })
      }
    }

    const qrTargets: Array<{ url: string; filename: string }> = []
    if (attachStoreQr && onlineStoreUrl) {
      qrTargets.push({ url: String(onlineStoreUrl), filename: "martpoint-store-qr.png" })
    }
    if (attachLoginQr && softwareUrl) {
      qrTargets.push({ url: String(softwareUrl), filename: "martpoint-login-qr.png" })
    }
    for (const t of qrTargets) {
      try {
        const buf = await QRCode.toBuffer(t.url, { width: 512, margin: 2 })
        emailAttachments.push({ filename: t.filename, content: buf.toString("base64") })
      } catch (err) {
        console.error("[onboarding access] QR generation failed:", err)
        return NextResponse.json({ error: "Could not generate a selected QR attachment. Try again or deselect it." }, { status: 500 })
      }
    }

    const logoWhiteUrl = getEmailWhiteLogoUrl()
    const emailHtml = brandedEmailHtml(
      `<div style="font-size:15px;line-height:1.6;color:#374151;background:#f9fafb;padding:16px;border-radius:8px;margin:0;">${escapeHtml(emailText).replace(/\n/g, "<br>")}</div>`,
      { eyebrow: "Onboarding", title: emailSubject, signoff: "MartPoint Team", logoWhiteUrl }
    )

    const sent = await sendEmail({
      to,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
      route: "onboarding_access",
      useRouteRecipients: false,
      replyTo: REPLY_TO.sales,
      attachments: emailAttachments.length ? emailAttachments : undefined,
    })

    if (!sent) return NextResponse.json({ success: false, sent: false, error: "The email provider did not accept this message. Your edits are still open; check Email Settings and try again." }, { status: 502 })

    const accessDetails = {
      recipients: to.join(", "), subject: emailSubject,
      softwareUrl, adminUsername, tempPassword,
      onlineStoreUrl: onlineStoreUrl || "", supportGroupUrl: supportGroupUrl || "",
      supportContact: supportContact || "", trainingSchedule: trainingSchedule || "",
      attachStoreQr: !!attachStoreQr, attachLoginQr: !!attachLoginQr,
      additionalUsers: additionalUsers || "", message: baseMessage,
      attachmentNames: emailAttachments.map((attachment) => attachment.filename),
      additionalNote: additionalNote || "", lastSentAt: new Date().toISOString(),
      sendCount: Math.max(0, Number(record.access_details?.sendCount) || (record.access_details?.lastSentAt ? 1 : 0)) + 1,
      deliveryStatus: "PROVIDER_ACCEPTED",
    }
    // Only successful provider acceptance can advance lastSentAt. Returning
    // the saved snapshot also updates the current page without a full refresh.
    let persisted = false
    try {
      const { error } = await supabase.from("onboarding")
        .update({ updated_at: new Date().toISOString(), access_details: accessDetails })
        .eq("id", recordId)
      persisted = !error
    } catch {
      // An accepted email must not be reported as a failed send just because
      // saving its snapshot failed: that would encourage duplicate resends.
    }

    // Founder check-in sequence: the first time a client receives their
    // credentials, day 0 is stamped, the welcome note goes out right away and
    // the 30/60/90/120-day check-ins are scheduled. Resends do not re-trigger.
    let checkins: { welcomeSent?: boolean; scheduled?: boolean; note?: string } = {}
    if (sent && record.business_id) {
      try {
        const firstTime = await markAccessSent(record.business_id as string)
        if (firstTime) {
          const cfg = await getClientCheckinConfig()
          const res = await startCheckins(record.business_id as string, { sendWelcome: cfg.welcomeEnabled })
          checkins = { welcomeSent: res.welcomeSent, scheduled: res.ok && !res.error, note: res.error }
        } else {
          checkins = { note: "already started" }
        }
      } catch (err) {
        console.error("[onboarding access] failed to start client check-ins:", err)
      }
    }

    return NextResponse.json({ success: true, sent, checkins, accessDetails, persisted,
      warning: !persisted ? "The provider accepted the email, but its saved resend details could not be updated. Do not send it again just to retry saving." : undefined })
  } catch {
    return NextResponse.json({ error: "Failed to send access details" }, { status: 500 })
  }
}
