import { loadMarketingSends } from "@/lib/marketing-sends"
import { NextResponse } from "next/server"
import { getSession, hasPermissionForUser } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

async function guardMarketingAccess() {
  const session = await getSession()
  if (!session || !await hasPermissionForUser(session.userId, session.role as UserRole, "marketing")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

/* ─── GET: campaign detail + per-recipient send metrics ─── */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/admin/marketing/[id]">
) {
  const denied = await guardMarketingAccess()
  if (denied) return denied

  const { id } = await ctx.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  const { data: campaign, error } = await supabase
    .from("marketing_campaigns")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !campaign) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 })
  }

  const { data: sends, error: sendsError } = await loadMarketingSends(id)

  if (sendsError) return NextResponse.json({ error: "Failed to load campaign activity" }, { status: 500 })

  let audienceName = ""
  if (campaign.audience_id) {
    const { data: audience } = await supabase.from("marketing_audiences").select("name").eq("id", campaign.audience_id).maybeSingle()
    audienceName = audience?.name || "Deleted audience"
  }

  const activity = [...(sends || [])]
  // Scheduled and in-progress reports also show recipients awaiting an attempt.
  if (["scheduled", "sending"].includes(campaign.status) && Array.isArray(campaign.recipients_snapshot)) {
    const recorded = new Set(activity.map(send => send.email))
    for (const recipient of campaign.recipients_snapshot) {
      if (!recipient?.email || recorded.has(recipient.email)) continue
      activity.push({ id: `queued-${recipient.email}`, campaign_id: id, email: recipient.email, name: recipient.name || "", status: "queued", error_message: null, sent_at: null, opened_at: null, open_count: 0, clicked_at: null, click_count: 0 })
    }
  }

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      name: campaign.name,
      subject: campaign.subject,
      preheader: campaign.preheader || "",
      html: campaign.html,
      text: campaign.text,
      audience: campaign.audience,
      audienceId: campaign.audience_id,
      audienceName: campaign.audience_name || audienceName,
      audienceSources: Array.isArray(campaign.audience_sources) ? campaign.audience_sources : [],
      fromAddress: campaign.from_address || null,
      replyTo: campaign.reply_to || null,
      scheduledFor: campaign.scheduled_for || null,
      provider: campaign.provider,
      status: campaign.status,
      recipientCount: campaign.recipient_count,
      createdBy: campaign.created_by,
      createdAt: campaign.created_at,
      sentAt: campaign.sent_at,
    },
    sends: activity,
    recipients: campaign.recipients_snapshot || [],
  })
}

/* ─── DELETE: remove a campaign and its sends ─── */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/admin/marketing/[id]">
) {
  const denied = await guardMarketingAccess()
  if (denied) return denied

  const { id } = await ctx.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  const { error } = await supabase.from("marketing_campaigns").delete().eq("id", id)

  if (error) {
    console.error("[Marketing Campaign Delete Error]", error)
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
