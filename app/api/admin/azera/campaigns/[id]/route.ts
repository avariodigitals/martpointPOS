import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { africaBrowserConfig } from "@/lib/africa-browser-voice"
import { resolveCampaignBusinessId } from "@/lib/azera-campaigns"
import { dispatchAzeraCampaignCall } from "@/lib/azera-campaign-worker"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"
const updateSchema = z.object({ status: z.enum(["running", "paused"]) })

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await authorizeAdmin("azera")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database unavailable." }, { status: 503 })
  try {
    const { id } = await params
    const { status } = updateSchema.parse(await request.json())
    const businessId = await resolveCampaignBusinessId()
    if (!businessId) return NextResponse.json({ error: "No campaign business is configured." }, { status: 409 })
    const { data: campaign, error: readError } = await supabase.from("azera_call_campaigns").select("id,status,target_count,max_calls").eq("id", id).eq("business_id", businessId).maybeSingle()
    if (readError || !campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 })
    if (status === "running") {
      if (campaign.status === "completed" || campaign.status === "failed") return NextResponse.json({ error: "This campaign has finished. Create a new campaign to call more contacts." }, { status: 409 })
      const cfg = await africaBrowserConfig(businessId)
      if (!cfg.apiKey || !cfg.username || cfg.username === "sandbox" || !cfg.phone) return NextResponse.json({ error: "Configure the live Africa’s Talking API key, application username and virtual number before starting." }, { status: 409 })
      if (campaign.target_count < 1 || campaign.target_count > campaign.max_calls) return NextResponse.json({ error: "Campaign contact limit is invalid." }, { status: 409 })
    }
    const now = new Date().toISOString()
    const updates = status === "running"
      ? { status, started_at: campaign.status === "draft" ? now : undefined, paused_at: null, updated_at: now }
      : { status, paused_at: now, updated_at: now }
    const { data, error } = await supabase.from("azera_call_campaigns").update(updates).eq("id", id).eq("business_id", businessId).in("status", ["draft", "running", "paused"]).select("id,status,started_at,paused_at").maybeSingle()
    if (error || !data) return NextResponse.json({ error: "Campaign status could not be changed." }, { status: 503 })
    let dispatch: Awaited<ReturnType<typeof dispatchAzeraCampaignCall>> | null = null
    if (status === "running") {
      try { dispatch = await dispatchAzeraCampaignCall() }
      catch (error) { console.error("[Azera campaign immediate dispatch]", error) }
    }
    return NextResponse.json({ campaign: data, dispatch }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof z.ZodError ? "Invalid campaign action." : "Campaign could not be updated." }, { status: 400 })
  }
}
