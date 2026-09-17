import { NextResponse } from "next/server"
import QRCode from "qrcode"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { sendEmail } from "@/lib/email"
import type { EmailAttachment } from "@/lib/email"
import { renderEmailTemplate } from "@/lib/email-templates"
import { getPublicSiteSettings } from "@/lib/settings"

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

export async function POST(request: Request) {
  const denied = await guardOnboardingAccess()
  if (denied) return denied

  try {
    const body = await request.json()
    const {
      recordId,
      recipients,
      softwareUrl,
      adminUsername,
      tempPassword,
      onlineStoreUrl,
      supportGroupUrl,
      supportContact,
      trainingSchedule,
      attachStoreQr,
      attachLoginQr,
      additionalUsers,
      attachments,
      message,
    } = body

    if (!recordId || !softwareUrl || !adminUsername || !tempPassword) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
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

    const to = typeof recipients === "string" && recipients.trim() ? recipients.trim() : record.email
    if (!to) {
      return NextResponse.json({ error: "No recipient email" }, { status: 400 })
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

    const emailText = message || accessTpl.text

    // Build attachment list: uploaded kit files + generated QR codes
    const MAX_ATTACHMENTS = 10
    const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024
    const MAX_TOTAL_BYTES = 10 * 1024 * 1024
    const emailAttachments: EmailAttachment[] = []

    if (Array.isArray(attachments)) {
      let totalBytes = 0
      for (const a of attachments.slice(0, MAX_ATTACHMENTS)) {
        const name = String(a?.name || "").slice(0, 120) || "attachment"
        const content = String(a?.content || "")
        const approxBytes = Math.floor((content.length * 3) / 4)
        if (!content || approxBytes > MAX_ATTACHMENT_BYTES || totalBytes + approxBytes > MAX_TOTAL_BYTES) continue
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
      }
    }

    const siteSettings = await getPublicSiteSettings()
    const logoUrl = siteSettings.logo || "/logo.webp"
    const emailHtml = `<div style="font-family:sans-serif;max-width:600px">
      <img src="${logoUrl}" alt="MartPoint" style="max-height:48px;margin-bottom:16px;" />
      <div style="background:#f8fafc;padding:16px;border-radius:8px;margin:16px 0">${escapeHtml(emailText).replace(/\n/g, "<br>")}</div>
      <p>Best regards,<br>MartPoint Team</p>
    </div>`

    const sent = await sendEmail({
      to,
      subject: accessTpl.subject,
      text: emailText,
      html: emailHtml,
      route: "onboarding_access",
      attachments: emailAttachments.length ? emailAttachments : undefined,
    })

    // Persist the payload so the modal can be reopened prefilled for resends
    await supabase
      .from("onboarding")
      .update({
        updated_at: new Date().toISOString(),
        access_details: {
          recipients: to,
          softwareUrl,
          adminUsername,
          tempPassword,
          onlineStoreUrl: onlineStoreUrl || "",
          supportGroupUrl: supportGroupUrl || "",
          supportContact: supportContact || "",
          trainingSchedule: trainingSchedule || "",
          attachStoreQr: !!attachStoreQr,
          attachLoginQr: !!attachLoginQr,
          additionalUsers: additionalUsers || "",
          message: emailText,
          lastSentAt: new Date().toISOString(),
        },
      })
      .eq("id", recordId)

    return NextResponse.json({ success: true, sent })
  } catch {
    return NextResponse.json({ error: "Failed to send access details" }, { status: 500 })
  }
}
