import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { africaBrowserConfig } from "@/lib/africa-browser-voice"
import { buildCampaignScript, getCampaignCandidates, resolveCampaignBusinessId, type CampaignPurpose } from "@/lib/azera-campaigns"
import { getAiProviderStatus } from "@/lib/ai-chat"
import { isNaijaTtsEnabled, NAIJA_VOICES, type NaijaLanguage } from "@/lib/naija-tts"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { normalizeOutboundPhone } from "@/lib/azera-outbound"

export const dynamic = "force-dynamic"
const purposeSchema = z.enum(["estimate_followup", "quote_followup", "lead_reengagement", "uploaded_contacts"])
const followUpPurposeSchema = z.enum(["estimate_followup", "quote_followup", "lead_reengagement"])
const uploadedContactSchema = z.object({ name: z.string().trim().max(120).default(""), phone: z.string().trim().min(5).max(40) })
const campaignQueues = ["sales", "support", "onboarding", "customer_support"] as const
const createSchema = z.object({
  name: z.string().trim().min(3).max(100),
  purpose: purposeSchema,
  goal: z.string().trim().min(8).max(500),
  audienceDays: z.number().int().min(1).max(365).default(14),
  maxCalls: z.number().int().min(1).max(100).default(25),
  speechProvider: z.enum(["africa_talking", "naija_speech"]).default("africa_talking"),
  speechLanguage: z.enum(["en", "ha", "ig", "yo"]).default("en"),
  speechVoice: z.string().trim().min(1).max(40).default("idera"),
  contacts: z.array(uploadedContactSchema).max(100).optional(),
  voiceConsentConfirmed: z.boolean().default(false),
  assignedUserId: z.string().uuid().nullable().optional(),
  assignedQueue: z.enum(campaignQueues).nullable().optional(),
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
      const parsedPurpose = followUpPurposeSchema.safeParse(purpose)
      const days = Math.max(1, Math.min(365, Number.parseInt(url.searchParams.get("days") || "14", 10) || 14))
      if (!parsedPurpose.success) return NextResponse.json({ error: "Choose a valid campaign purpose." }, { status: 400 })
      const contacts = await getCampaignCandidates(parsedPurpose.data, days)
      return NextResponse.json({ total: contacts.length, preview: contacts.slice(0, 12).map(({ contactName, businessName, phone, productInterest }) => ({ contactName, businessName, phone: `${phone.slice(0, 5)}••••${phone.slice(-2)}`, productInterest })) }, { headers: { "Cache-Control": "private, no-store" } })
    }
    const [{ data: campaigns, error }, aiStatus, { data: assignments }] = await Promise.all([
      supabase.from("azera_call_campaigns").select("id,name,purpose,goal,status,target_count,max_calls,started_at,completed_at,created_at,assigned_user_id,assigned_queue").eq("business_id", businessId).order("created_at", { ascending: false }).limit(20),
      getAiProviderStatus(),
      supabase.from("azera_voice_agent_assignments").select("user_id").eq("business_id", businessId).eq("enabled", true),
    ])
    if (error) return NextResponse.json({ error: "Could not load campaigns." }, { status: 503 })
    if (assignments === null && campaigns && !error) return NextResponse.json({ error: "Could not load voice team assignments." }, { status: 503 })
    const assignedIds = [...new Set((assignments || []).map(row => row.user_id).filter((id): id is string => Boolean(id)))]
    const { data: users, error: usersError } = assignedIds.length
      ? await supabase.from("users").select("id,name").in("id", assignedIds).eq("status", "ACTIVE").order("name")
      : { data: [], error: null }
    if (usersError) return NextResponse.json({ error: "Could not load voice team members." }, { status: 503 })
    const cfg = await africaBrowserConfig(businessId)
    return NextResponse.json({ campaigns, assignees: users || [], ready: Boolean(cfg.apiKey && cfg.username && cfg.username !== "sandbox" && cfg.phone), naijaTtsReady: isNaijaTtsEnabled(), callWindow: "configured voice business hours", aiProviderConfigured: aiStatus.configured }, { headers: { "Cache-Control": "private, no-store" } })
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
    if (body.purpose === "uploaded_contacts" && (!body.voiceConsentConfirmed || !body.contacts?.length))
      return NextResponse.json({ error: "Upload contacts and confirm they agreed to receive these calls." }, { status: 400 })
    if (body.purpose !== "uploaded_contacts" && body.contacts?.length)
      return NextResponse.json({ error: "Uploaded contacts can only be used with an uploaded-contact campaign." }, { status: 400 })
    if (Boolean(body.assignedUserId) === Boolean(body.assignedQueue))
      return NextResponse.json({ error: "Assign the campaign to one voice team member or one queue." }, { status: 400 })
    if (!NAIJA_VOICES[body.speechLanguage as NaijaLanguage]?.includes(body.speechVoice)) return NextResponse.json({ error: "Choose a supported voice for the selected language." }, { status: 400 })
    if (body.speechProvider === "naija_speech" && !isNaijaTtsEnabled()) return NextResponse.json({ error: "Add the Naija Speech API key to the server environment before creating this campaign." }, { status: 409 })
    if (body.speechProvider === "africa_talking" && body.speechLanguage !== "en") return NextResponse.json({ error: "Choose Naija Speech for Hausa, Igbo or Yoruba campaign audio." }, { status: 400 })
    const businessId = await resolveCampaignBusinessId()
    if (!businessId) return NextResponse.json({ error: "Map the Africa’s Talking virtual number to a MartPoint business in Azera Settings first." }, { status: 409 })
    if (body.assignedUserId) {
      const { data: assignment, error: assignmentError } = await supabase.from("azera_voice_agent_assignments")
        .select("user_id").eq("business_id", businessId).eq("user_id", body.assignedUserId).eq("enabled", true).maybeSingle()
      if (assignmentError) return NextResponse.json({ error: "Could not verify that team member’s voice access." }, { status: 503 })
      if (!assignment) return NextResponse.json({ error: "Choose an active voice team member with access to this business." }, { status: 400 })
    }
    type CampaignCandidate = Omit<Awaited<ReturnType<typeof getCampaignCandidates>>[number], "leadId"> & { leadId: string | null }
    let candidates: CampaignCandidate[]
    if (body.purpose === "uploaded_contacts") {
      const unique = new Map<string, { leadId: string | null; phone: string; contactName: string; businessName: string; productInterest: string; estimate: Record<string, unknown> }>()
      for (const contact of body.contacts || []) {
        const phone = normalizeOutboundPhone(contact.phone)
        if (!phone) return NextResponse.json({ error: "The upload contains an invalid phone number. Use international numbers or Nigerian numbers beginning with 0." }, { status: 400 })
        if (!unique.has(phone)) unique.set(phone, { leadId: null, phone, contactName: contact.name || "there", businessName: "your business", productInterest: "MartPoint", estimate: {} })
      }
      const phones = [...unique.keys()]
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString()
      const [{ data: blocked, error: blockedError }, { data: recent, error: recentError }] = await Promise.all([
        supabase.from("azera_call_suppressions").select("phone").in("phone", phones),
        supabase.from("azera_calls").select("customer_phone").eq("sip_provider", "africas_talking_campaign").in("customer_phone", phones).gte("created_at", since),
      ])
      if (blockedError || recentError) return NextResponse.json({ error: "Could not verify campaign contact preferences." }, { status: 503 })
      const excluded = new Set([...(blocked || []).map(row => row.phone), ...(recent || []).map(row => row.customer_phone)])
      candidates = [...unique.values()].filter(contact => !excluded.has(contact.phone))
      if (!candidates.length) return NextResponse.json({ error: "All uploaded contacts are opted out or were called recently." }, { status: 422 })
    } else {
      candidates = await getCampaignCandidates(body.purpose as CampaignPurpose, body.audienceDays)
    }
    if (!candidates.length) return NextResponse.json({ error: "No eligible contacts match this campaign. Check the age, estimate/quote status, phone number, and suppression list." }, { status: 422 })
    const bounded = candidates.slice(0, body.maxCalls)
    const script = await buildCampaignScript({ purpose: body.purpose, goal: body.goal, product: bounded[0]?.productInterest || "MartPoint", language: body.speechProvider === "naija_speech" ? body.speechLanguage as NaijaLanguage : "en" })
    const { data: campaign, error } = await supabase.from("azera_call_campaigns").insert({
      business_id: businessId,
      name: body.name,
      purpose: body.purpose,
      goal: body.goal,
      script_template: script,
      speech_provider: body.speechProvider,
      speech_language: body.speechLanguage,
      speech_voice: body.speechVoice,
      audience_days: body.audienceDays,
      max_calls: body.maxCalls,
      target_count: bounded.length,
      uploaded_audience_consent_confirmed: body.purpose === "uploaded_contacts" ? body.voiceConsentConfirmed : false,
      created_by: session?.userId || null,
      assigned_user_id: body.assignedUserId || null,
      assigned_queue: body.assignedQueue || null,
    }).select("id,name,purpose,goal,status,target_count,max_calls,script_template,created_at").single()
    if (error || !campaign) return NextResponse.json({ error: "Could not save this campaign. Please try again." }, { status: 503 })
    const { error: recipientsError } = await supabase.from("azera_call_campaign_recipients").insert(bounded.map((candidate) => ({
      campaign_id: campaign.id,
      lead_id: candidate.leadId || null,
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
