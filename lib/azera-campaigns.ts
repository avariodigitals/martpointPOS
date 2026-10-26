import { aiChat } from "@/lib/ai-chat"
import { africaBrowserConfig } from "@/lib/africa-browser-voice"
import { normalizeOutboundPhone } from "@/lib/azera-outbound"
import { resolveAfricaBusinessId } from "@/lib/africastalking"
import { supabase } from "@/lib/supabase"

export type CampaignPurpose = "estimate_followup" | "quote_followup" | "lead_reengagement"
type Lead = {
  id: string
  full_name: string | null
  business_name: string | null
  phone: string | null
  product_interest: string | null
  status: string
  estimate: Record<string, unknown> | null
  submitted_at: string
}

export async function resolveCampaignBusinessId() {
  const cfg = await africaBrowserConfig()
  return (await resolveAfricaBusinessId(cfg.phone)) || process.env.AFRICASTALKING_BUSINESS_ID || process.env.AZERA_PUBLIC_BUSINESS_ID || null
}

export async function getCampaignCandidates(purpose: CampaignPurpose, days: number) {
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString()
  const recentCutoff = new Date(Date.now() - 30 * 86_400_000).toISOString()
  const query = supabase.from("leads")
    .select("id,full_name,business_name,phone,product_interest,status,estimate,submitted_at")
    .not("phone", "is", null).not("status", "in", "(Won,Lost)")
    .lt("submitted_at", cutoff).order("submitted_at", { ascending: true }).limit(1000)
  const { data, error } = await query
  if (error) throw new Error("Could not load campaign audience")
  const leads = (data || []) as Lead[]
  if (!leads.length) return []
  const ids = leads.map((lead) => lead.id)
  const [{ data: businesses, error: businessError }, { data: quotes, error: quoteError }, { data: blocked, error: blockedError }, { data: recentCalls, error: recentError }] = await Promise.all([
    supabase.from("businesses").select("source_lead_id").in("source_lead_id", ids),
    supabase.from("lead_quotations").select("lead_id,status,valid_until").in("lead_id", ids),
    supabase.from("azera_call_suppressions").select("phone"),
    supabase.from("azera_calls").select("customer_phone").eq("sip_provider", "africas_talking_campaign").gte("created_at", recentCutoff),
  ])
  if (businessError || quoteError || blockedError || recentError) throw new Error("Could not verify converted leads, quotes and call preferences")
  const converted = new Set((businesses || []).map((row) => row.source_lead_id).filter(Boolean))
  const quotesByLead = new Map<string, { status: string; valid_until: string | null }[]>()
  for (const quote of quotes || []) {
    const items = quotesByLead.get(quote.lead_id) || []
    items.push({ status: quote.status, valid_until: quote.valid_until })
    quotesByLead.set(quote.lead_id, items)
  }
  const suppressed = new Set((blocked || []).map((row) => row.phone))
  const recentlyCalled = new Set((recentCalls || []).map((row) => row.customer_phone))
  const today = new Date().toISOString().slice(0, 10)
  return leads.flatMap((lead) => {
    if (!lead.phone || (purpose === "estimate_followup" && !lead.estimate)) return []
    const phone = normalizeOutboundPhone(lead.phone)
    const leadQuotes = quotesByLead.get(lead.id) || []
    const eligible = purpose === "estimate_followup"
      ? !leadQuotes.some((quote) => ["SENT", "ACCEPTED", "EXPIRED", "CONVERTED"].includes(quote.status))
      : purpose === "quote_followup"
        ? !leadQuotes.some((quote) => ["ACCEPTED", "CONVERTED"].includes(quote.status)) &&
          leadQuotes.some((quote) => quote.status === "EXPIRED" || (quote.status === "SENT" && Boolean(quote.valid_until) && quote.valid_until! < today))
        : true
    if (!phone || suppressed.has(phone) || recentlyCalled.has(phone) || converted.has(lead.id) || !eligible) return []
    return [{
      leadId: lead.id,
      phone,
      contactName: lead.full_name?.trim() || "there",
      businessName: lead.business_name?.trim() || "your business",
      productInterest: lead.product_interest?.trim() || "MartPoint",
      estimate: purpose === "quote_followup" ? {} : lead.estimate || {},
    }]
  })
}

export async function buildCampaignScript(input: { purpose: CampaignPurpose; goal: string; product: string }) {
  const purpose = input.purpose === "estimate_followup" ? "a website estimate" : input.purpose === "quote_followup" ? "an expired quote" : "an earlier enquiry"
  const fallback = `Hello, this is Azera, MartPoint's automated assistant. I’m following up about ${purpose} for {business}. Would you still like help with {product}?`
  try {
    const result = await aiChat({
      messages: [
        { role: "system", content: "Write a short, courteous outbound call opening for Azera, MartPoint's AI assistant. Clearly disclose that this is an automated AI call. Do not invent prices, dates, features, promises, or claim a person requested a call. Only use the supplied purpose and product. Keep placeholders {name}, {business}, and {product} exactly as written. Ask one question. Return only spoken text under 45 words." },
        { role: "user", content: `Purpose: follow up on ${purpose}. Product category: ${input.product || "MartPoint"}. Campaign objective: ${input.goal}.` },
      ], temperature: 0.2, maxTokens: 100, timeoutMs: 8_000,
    })
    const copy = result.content.replace(/[\r\n]+/g, " ").trim()
    if (copy && copy.length <= 500 && /azera|automated|ai assistant/i.test(copy) && copy.includes("{business}") && copy.includes("{product}")) return copy
  } catch {
    // Use a predictable, fact-safe script when an AI provider is unavailable.
  }
  return fallback
}

export function personalizeCampaignScript(template: string, recipient: { contact_name: string; business_name: string; product_interest: string; estimate_snapshot: Record<string, unknown> }) {
  const retail = recipient.estimate_snapshot?.retail as Record<string, unknown> | undefined
  const plan = typeof retail?.planName === "string" ? retail.planName : recipient.product_interest
  return template.replaceAll("{name}", recipient.contact_name || "there")
    .replaceAll("{business}", recipient.business_name || "your business")
    .replaceAll("{product}", plan || "MartPoint").slice(0, 500)
}

export async function placeAfricaCampaignCall(input: { phone: string; from: string; username: string; apiKey: string; clientRequestId: string }) {
  const body = new URLSearchParams({ username: input.username, from: input.from, to: input.phone, clientRequestId: `azera-campaign:${input.clientRequestId}` })
  const response = await fetch("https://voice.africastalking.com/call", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", apiKey: input.apiKey },
    body, signal: AbortSignal.timeout(15_000),
  })
  const text = await response.text()
  let parsed: Record<string, unknown> = {}
  try { parsed = JSON.parse(text) as Record<string, unknown> } catch { /* provider can return text on errors */ }
  if (!response.ok || parsed.errorMessage || parsed.error) throw new Error("Africa’s Talking did not accept the call")
  const rows = parsed.recipients as Record<string, unknown>[] | undefined
  const first = rows?.[0]
  const status = String(first?.status || "Queued").toLowerCase()
  if (first && !["queued", "success", "sent", "pending"].includes(status)) throw new Error("Africa’s Talking did not queue the call")
  return { sessionId: String(first?.sessionId || ""), status }
}
