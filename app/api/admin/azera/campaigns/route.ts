import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { africaBrowserConfig } from "@/lib/africa-browser-voice"
import { buildCampaignScript, getCampaignCandidates, resolveCampaignBusinessId, type CampaignPurpose } from "@/lib/azera-campaigns"
import { getAiProviderStatus } from "@/lib/ai-chat"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"
const purposeSchema = z.enum(["estimate_followup", "quote_followup", "lead_reengagement"])
const createSchema = z.object({
  name: z.string().trim().min(3).max(100),
  purpose: purposeSchema,
  goal: z.string().trim().min(8).max(500),
  audienceDays: z.number().int().min(1).max(365).default(14),
  maxCalls: z.number().int().min(1).max(100).default(25),
})

export async function GET(request: Request) {
  const { denied } = await authorizeAdmin("azera")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Call campaigns need the database configured." }, { status: 503 })
  try {
    const businessId = await resolveCampaignBusinessId()
    if (!businessId) return NextResponse.json({ error: "Map the Africa’s Talking virtual number to a MartPoint business in Azera Settings first." }, { status: 409 })
    const url = new URL(request.url)
    const campaignId = url.searchParams.get("id")
    if (campaignId) {
      const [{ data: campaign, error }, { data: recipients, error: recipientError }] = await Promise.all([
        supabase.from("azera_call_campaigns").select("*").eq("business_id", businessId).eq("id", campaignId).maybeSingle(),
        supabase.from("azera_call_campaign_recipients").select("id,lead_id,contact_name,business_name,phone,product_interest,status,response_label,notes,provider_error,created_at,completed_at").eq("campaign_id", campaignId).order("created_at", { ascending: true }).limit(100),
      ])
      if (error || recipientError) return NextResponse.json({ error: "Could not load campaign progress." }, { status: 503 })
      if (!campaign) return NextResponse.json({ error: "Campaign not found." }, { status: 404 })
      return NextResponse.json({ campaign, recipients }, { headers: { "Cache-Control": "private, no-store" } })
    }
    const purpose = url.searchParams.get("purpose")
    if (purpose) {
      const parsedPurpose = purposeSchema.safeParse(purpose)
      const days = Math.max(1, Math.min(365, Number.parseInt(url.searchParams.get("days") || "14", 10) || 14))
      if (!parsedPurpose.success) return NextResponse.json({ error: "Choose a valid campaign purpose." }, { status: 400 })
      const contacts = await getCampaignCandidates(parsedPurpose.data, days)
      return NextResponse.json({ total: contacts.length, preview: contacts.slice(0, 12).map(({ contactName, businessName, phone, productInterest }) => ({ contactName, businessName, phone: `${phone.slice(0, 5)}••••${phone.slice(-2)}`, productInterest })) }, { headers: { "Cache-Control": "private, no-store" } })
    }
    const [{ data: campaigns, error }, aiStatus] = await Promise.all([
      supabase.from("azera_call_campaigns").select("id,name,purpose,goal,status,target_count,max_calls,started_at,completed_at,created_at").eq("business_id", businessId).order("created_at", { ascending: false }).limit(20),
      getAiProviderStatus(),
    ])
    if (error) return NextResponse.json({ error: "Could not load campaigns." }, { status: 503 })
    const cfg = await africaBrowserConfig(businessId)
    return NextResponse.json({ campaigns, ready: Boolean(cfg.apiKey && cfg.username && cfg.username !== "sandbox" && cfg.phone), callWindow: "configured voice business hours", aiProviderConfigured: aiStatus.configured }, { headers: { "Cache-Control": "private, no-store" } })
  } catch {
    return NextResponse.json({ error: "Campaign data is temporarily unavailable." }, { status: 503 })
  }
}

export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("azera")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Call campaigns need the database configured." }, { status: 503 })
  try {
    const body = createSchema.parse(await request.json())
    const businessId = await resolveCampaignBusinessId()
    if (!businessId) return NextResponse.json({ error: "Map the Africa’s Talking virtual number to a MartPoint business in Azera Settings first." }, { status: 409 })
    const candidates = await getCampaignCandidates(body.purpose as CampaignPurpose, body.audienceDays)
    if (!candidates.length) return NextResponse.json({ error: "No eligible contacts match this campaign. Check the age, estimate/quote status, phone number, and suppression list." }, { status: 422 })
    const bounded = candidates.slice(0, body.maxCalls)
    const script = await buildCampaignScript({ purpose: body.purpose, goal: body.goal, product: bounded[0]?.productInterest || "MartPoint" })
    const { data: campaign, error } = await supabase.from("azera_call_campaigns").insert({
      business_id: businessId,
      name: body.name,
      purpose: body.purpose,
      goal: body.goal,
      script_template: script,
      audience_days: body.audienceDays,
      max_calls: body.maxCalls,
      target_count: bounded.length,
      created_by: session?.userId || null,
    }).select("id,name,purpose,goal,status,target_count,max_calls,script_template,created_at").single()
    if (error || !campaign) return NextResponse.json({ error: "Could not create campaign. Apply migration 140 first." }, { status: 503 })
    const { error: recipientsError } = await supabase.from("azera_call_campaign_recipients").insert(bounded.map((candidate) => ({
      campaign_id: campaign.id,
      lead_id: candidate.leadId,
      phone: candidate.phone,
      contact_name: candidate.contactName,
      business_name: candidate.businessName,
      product_interest: candidate.productInterest,
      estimate_snapshot: candidate.estimate,
    })))
    if (recipientsError) {
      await supabase.from("azera_call_campaigns").delete().eq("id", campaign.id)
      return NextResponse.json({ error: "Could not save the campaign contact list." }, { status: 503 })
    }
    return NextResponse.json({ campaign, count: bounded.length }, { status: 201, headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Check campaign name, objective and audience settings." }, { status: 400 })
    console.error("[Azera campaign create]", error)
    return NextResponse.json({ error: "Could not prepare the campaign." }, { status: 503 })
  }
}
