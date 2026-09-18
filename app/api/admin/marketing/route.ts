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
  executeCampaign,
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
      scheduledFor: c.scheduled_for || null,
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
      scheduledFor,
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

    // Scheduled send — snapshot recipients now, suppression is re-checked at send time
    const scheduledDate = scheduledFor ? new Date(String(scheduledFor)) : null
    const isScheduled = scheduledDate && !isNaN(scheduledDate.getTime()) && scheduledDate.getTime() > Date.now()

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
      status: isScheduled ? "scheduled" : "sending",
      recipient_count: deliverable.length,
      recipients_snapshot: deliverable,
      scheduled_for: isScheduled ? scheduledDate.toISOString() : null,
      created_by: session.username || session.name || "admin",
      created_at: now,
      sent_at: isScheduled ? null : now,
    })

    if (insertError) {
      console.error("[Marketing Campaign Insert Error]", insertError)
      return NextResponse.json({ error: "Failed to create campaign" }, { status: 500 })
    }

    if (isScheduled) {
      return NextResponse.json({
        success: true,
        campaignId,
        scheduled: true,
        scheduledFor: scheduledDate.toISOString(),
        recipients: deliverable.length,
        skipped: skippedCount,
      })
    }

    const result = await executeCampaign(campaignId)

    return NextResponse.json({
      success: result.sent > 0,
      campaignId,
      sent: result.sent,
      failed: result.failed,
      skipped: result.skipped + skippedCount,
    })
  } catch {
    return NextResponse.json({ error: "Failed to send campaign" }, { status: 500 })
  }
}
