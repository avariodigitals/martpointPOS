import { NextResponse } from "next/server"
import crypto from "crypto"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { sendEmail } from "@/lib/email"
import type { EmailProvider } from "@/lib/email"
import {
  getAudienceRecipients,
  getSavedAudienceRecipients,
  getSuppressedEmails,
  parseManualEmails,
  applyMergeTags,
  buildMarketingHtml,
  htmlToText,
  unsubscribeUrl,
} from "@/lib/marketing"
import type { MarketingRecipient } from "@/lib/marketing"

async function guardMarketingAccess() {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "marketing")) {
    return null
  }
  return session
}

/* ─── GET: campaigns with aggregated metrics ─── */
export async function GET() {
  const session = await guardMarketingAccess()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ campaigns: [] })
  }

  const { data: campaigns, error } = await supabase
    .from("marketing_campaigns")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[Marketing Campaigns GET Error]", error)
    return NextResponse.json({ error: "Failed to fetch campaigns" }, { status: 500 })
  }

  const { data: sends } = await supabase
    .from("marketing_sends")
    .select("campaign_id, status, opened_at, open_count, clicked_at, click_count")

  const metrics = new Map<string, { sent: number; failed: number; opens: number; openTotal: number; clicks: number; clickTotal: number }>()
  for (const s of sends || []) {
    const m = metrics.get(s.campaign_id) || { sent: 0, failed: 0, opens: 0, openTotal: 0, clicks: 0, clickTotal: 0 }
    if (s.status === "sent") m.sent += 1
    if (s.status === "failed") m.failed += 1
    if (s.opened_at) m.opens += 1
    m.openTotal += s.open_count || 0
    if (s.clicked_at) m.clicks += 1
    m.clickTotal += s.click_count || 0
    metrics.set(s.campaign_id, m)
  }

  return NextResponse.json({
    campaigns: (campaigns || []).map((c) => ({
      id: c.id,
      name: c.name,
      subject: c.subject,
      preheader: c.preheader || "",
      audience: c.audience,
      provider: c.provider,
      status: c.status,
      recipientCount: c.recipient_count,
      createdBy: c.created_by,
      createdAt: c.created_at,
      sentAt: c.sent_at,
      metrics: metrics.get(c.id) || { sent: 0, failed: 0, opens: 0, openTotal: 0, clicks: 0, clickTotal: 0 },
    })),
  })
}

/* ─── POST: send a campaign (or a test email) ─── */
export async function POST(request: Request) {
  const session = await guardMarketingAccess()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const body = await request.json()
    const {
      name,
      subject,
      preheader,
      html,
      text,
      audience,
      audienceId,
      provider,
      manualEmails,
      testEmail,
    } = body

    if (!subject || !html) {
      return NextResponse.json({ error: "Subject and HTML body are required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const providerOverride: EmailProvider | undefined =
      provider === "resend" || provider === "brevo" ? provider : undefined
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "https://www.martpoint.com.ng").replace(/\/$/, "")

    // ── Test send: no campaign, no suppression check, fake tracking token ──
    if (testEmail) {
      const to = String(testEmail).trim().toLowerCase()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        return NextResponse.json({ error: "Invalid test email address" }, { status: 400 })
      }
      const token = crypto.randomUUID()
      const recipient = { email: to, name: "Test User" }
      const trackedHtml = buildMarketingHtml(applyMergeTags(html, recipient), token, baseUrl, preheader)
      const sent = await sendEmail({
        to,
        subject: `[TEST] ${applyMergeTags(subject, recipient)}`,
        text: text || htmlToText(html),
        html: trackedHtml,
        provider: providerOverride,
        route: "marketing",
      })
      return NextResponse.json({ success: sent, test: true })
    }

    // ── Real campaign ──
    let recipients: MarketingRecipient[]
    if (audience === "manual") {
      recipients = parseManualEmails(String(manualEmails || ""))
    } else if (audience === "saved") {
      recipients = await getSavedAudienceRecipients(String(audienceId || ""))
    } else {
      recipients = await getAudienceRecipients(String(audience || "leads"))
    }

    if (recipients.length === 0) {
      return NextResponse.json({ error: "No recipients for this audience" }, { status: 400 })
    }

    const suppressed = await getSuppressedEmails(recipients.map((r) => r.email))
    const deliverable = recipients.filter((r) => !suppressed.has(r.email))
    const skippedCount = recipients.length - deliverable.length

    if (deliverable.length === 0) {
      return NextResponse.json({ error: `All ${recipients.length} recipients have unsubscribed` }, { status: 400 })
    }

    const campaignId = crypto.randomUUID()
    const now = new Date().toISOString()
    const plainText = text || htmlToText(html)

    const { error: insertError } = await supabase.from("marketing_campaigns").insert({
      id: campaignId,
      name: name || subject,
      subject,
      preheader: preheader || "",
      html,
      text: plainText,
      audience: audience || "manual",
      audience_id: audience === "saved" ? audienceId || null : null,
      provider: providerOverride || "default",
      status: "sent",
      recipient_count: deliverable.length,
      created_by: session.username || session.name || "admin",
      created_at: now,
      sent_at: now,
    })

    if (insertError) {
      console.error("[Marketing Campaign Insert Error]", insertError)
      return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
    }

    let sentCount = 0
    let failedCount = 0

    for (const recipient of deliverable) {
      const token = crypto.randomUUID()
      const mergedSubject = applyMergeTags(subject, recipient)
      const mergedHtml = applyMergeTags(html, recipient)
      const trackedHtml = buildMarketingHtml(mergedHtml, token, baseUrl, preheader)
      const unsubUrl = unsubscribeUrl(token, baseUrl)

      const ok = await sendEmail({
        to: recipient.email,
        subject: mergedSubject,
        text: applyMergeTags(plainText, recipient),
        html: trackedHtml,
        provider: providerOverride,
        route: "marketing",
        headers: { "List-Unsubscribe": `<${unsubUrl}>` },
      })

      await supabase.from("marketing_sends").insert({
        campaign_id: campaignId,
        email: recipient.email,
        name: recipient.name,
        token,
        status: ok ? "sent" : "failed",
        error_message: ok ? null : "send failed",
        sent_at: ok ? new Date().toISOString() : null,
      })

      if (ok) sentCount += 1
      else failedCount += 1
    }

    if (sentCount === 0) {
      await supabase.from("marketing_campaigns").update({ status: "failed" }).eq("id", campaignId)
    } else if (failedCount > 0) {
      await supabase.from("marketing_campaigns").update({ status: "partial" }).eq("id", campaignId)
    }

    return NextResponse.json({
      success: sentCount > 0,
      campaignId,
      sent: sentCount,
      failed: failedCount,
      skipped: skippedCount,
    })
  } catch {
    return NextResponse.json({ error: "Failed to send campaign" }, { status: 500 })
  }
}
