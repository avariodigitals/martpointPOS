import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { checkRateLimit } from "@/lib/rate-limit"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { notifyAllAdmins } from "@/lib/admin-notifications"

export const dynamic = "force-dynamic"
type Context = { params: Promise<{ token: string }> }
const hash = (token: string) => crypto.createHash("sha256").update(token).digest("hex")

export async function GET(request: Request, context: Context) {
  const limit = await checkRateLimit(request, { key: "business-growth-offer", max: 20, windowSeconds: 3600 })
  if (!limit.allowed) return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "This offer is unavailable." }, { status: 503 })
  const { token } = await context.params
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return NextResponse.json({ error: "This offer link is invalid or expired." }, { status: 404 })
  const { data: award } = await supabase.from("business_growth_awards").select("id,programme_id,offer_expires_at,status, business_growth_programmes(name,sponsored_duration_months,activation_deadline_days,onboarding_scope,exclusions,renewal_price_note,plan_snapshot), business_growth_applications(business_name,applicant_name)").eq("acceptance_token_hash", hash(token)).maybeSingle()
  if (!award || award.status !== "OFFERED" || !award.offer_expires_at || new Date(award.offer_expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "This offer link is invalid or expired." }, { status: 404 })
  return NextResponse.json({ award })
}

const responseSchema = z.object({ decision: z.enum(["accept", "decline"]), nominatedStore: z.string().trim().min(2).max(200).optional(), publicAnnouncementConsent: z.boolean().default(false) })

export async function POST(request: Request, context: Context) {
  const limit = await checkRateLimit(request, { key: "business-growth-offer-submit", max: 5, windowSeconds: 3600 })
  if (!limit.allowed) return NextResponse.json({ error: "Please wait before trying again." }, { status: 429 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "This offer is unavailable." }, { status: 503 })
  const { token } = await context.params
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) return NextResponse.json({ error: "This offer link is invalid or expired." }, { status: 404 })
  const parsed = responseSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Choose whether to accept or decline this offer." }, { status: 400 })
  if (parsed.data.decision === "accept" && !parsed.data.nominatedStore) return NextResponse.json({ error: "Tell us which single store will use the licence." }, { status: 400 })
  const { data, error } = await supabase.rpc("respond_business_growth_offer", {
    p_token_hash: hash(token), p_accept: parsed.data.decision === "accept",
    p_nominated_store: parsed.data.nominatedStore || "",
    p_public_announcement_consent: parsed.data.decision === "accept" && parsed.data.publicAnnouncementConsent,
  })
  if (error || !data?.[0]) return NextResponse.json({ error: "This offer has expired, has already been answered, or is no longer available." }, { status: 409 })
  const result = data[0] as { award_id: string; programme_id: string; application_id: string; resulting_status: string }
  if (result.resulting_status === "ACCEPTED") {
    const { data: award } = await supabase.from("business_growth_awards").select("activation_deadline_at").eq("id", result.award_id).maybeSingle()
    await supabase.from("admin_tasks").insert({ task_type: "CUSTOMER_ONBOARDING_REVIEW", title: "Activate Business Growth Programme place", description: "Confirm the nominated store and activate the standard sponsored Basic licence. Do not record a payment.", entity_type: "BUSINESS_GROWTH_AWARD", entity_id: result.award_id, status: "OPEN", due_at: award?.activation_deadline_at, deep_link: `/admin/programmes/${result.programme_id}` })
    await notifyAllAdmins({ type: "BUSINESS_GROWTH_AWARD_ACCEPTED", title: "Sponsored place accepted", message: "A selected business accepted its sponsored place. Confirm the store and complete licence activation.", deep_link: `/admin/programmes/${result.programme_id}`, source_type: "BUSINESS_GROWTH_AWARD", source_id: result.award_id })
  }
  return NextResponse.json({ success: true, decision: result.resulting_status })
}
