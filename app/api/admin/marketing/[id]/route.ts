import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

async function guardMarketingAccess() {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "marketing")) {
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

  const { data: sends } = await supabase
    .from("marketing_sends")
    .select("id, email, name, status, error_message, sent_at, opened_at, open_count, clicked_at, click_count")
    .eq("campaign_id", id)
    .order("created_at", { ascending: true })

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      name: campaign.name,
      subject: campaign.subject,
      preheader: campaign.preheader || "",
      html: campaign.html,
      text: campaign.text,
      audience: campaign.audience,
      provider: campaign.provider,
      status: campaign.status,
      recipientCount: campaign.recipient_count,
      createdBy: campaign.created_by,
      createdAt: campaign.created_at,
      sentAt: campaign.sent_at,
    },
    sends: sends || [],
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
