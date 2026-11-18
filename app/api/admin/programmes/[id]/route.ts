import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { growthQuestionnaireSchema } from "@/lib/business-growth-programme"

export const dynamic = "force-dynamic"
type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: Context) {
  const { denied } = await authorizeAdmin("business_growth.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { id } = await context.params
  const [{ data: programme, error }, { data: applications }, { data: awards }, { data: events }] = await Promise.all([
    supabase.from("business_growth_programmes").select("*").eq("id", id).maybeSingle(),
    supabase.from("business_growth_applications").select("*").eq("programme_id", id).order("submitted_at", { ascending: false }),
    supabase.from("business_growth_awards").select("*").eq("programme_id", id).order("created_at", { ascending: false }),
    supabase.from("business_growth_events").select("*").eq("programme_id", id).order("created_at", { ascending: false }).limit(200),
  ])
  if (error || !programme) return NextResponse.json({ error: "Programme not found" }, { status: 404 })
  const appIds = (applications || []).map((app) => app.id)
  const { data: assessments } = appIds.length ? await supabase.from("business_growth_assessments").select("*").in("application_id", appIds).order("version", { ascending: false }) : { data: [] }
  const latest = new Map<string, unknown>()
  for (const assessment of assessments || []) if (!latest.has(assessment.application_id)) latest.set(assessment.application_id, assessment)
  return NextResponse.json({ programme, applications: (applications || []).map((app) => ({ ...app, latestAssessment: latest.get(app.id) || null, award: (awards || []).find((award) => award.application_id === app.id) || null })), awards: awards || [], events: events || [] })
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.enum(["publish", "close", "complete", "archive"]), reason: z.string().trim().min(4).max(1000).optional() }),
  z.object({
    action: z.literal("update_draft"), name: z.string().trim().min(3).max(120),
    slug: z.string().trim().min(3).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    description: z.string().trim().min(20).max(4000), opensAt: z.string().datetime(), closesAt: z.string().datetime(),
    onboardingScope: z.string().trim().min(10).max(2000), exclusions: z.string().trim().min(10).max(1500),
    renewalPriceNote: z.string().trim().min(5).max(1000), termsText: z.string().trim().min(30).max(8000),
    privacyText: z.string().trim().min(30).max(8000), capabilityReference: z.string().trim().min(50).max(12000),
    questions: growthQuestionnaireSchema,
  }).refine((value) => new Date(value.closesAt) > new Date(value.opensAt), { path: ["closesAt"], message: "Closing date must be after opening date." }),
])

export async function PATCH(request: Request, context: Context) {
  const { session, denied } = await authorizeAdmin("business_growth.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "Invalid programme action" }, { status: 400 })
  const { id } = await context.params
  const { data: programme } = await supabase.from("business_growth_programmes").select("*").eq("id", id).maybeSingle()
  if (!programme) return NextResponse.json({ error: "Programme not found" }, { status: 404 })
  if (parsed.data.action === "update_draft") {
    if (programme.status !== "DRAFT") return NextResponse.json({ error: "Only draft programmes can be edited." }, { status: 409 })
    const { count, error: countError } = await supabase.from("business_growth_applications").select("id", { count: "exact", head: true }).eq("programme_id", id)
    if (countError) return NextResponse.json({ error: "Could not verify programme application state." }, { status: 500 })
    if ((count || 0) > 0) return NextResponse.json({ error: "This draft already has applications and cannot be changed." }, { status: 409 })
    const draft = parsed.data
    const { error } = await supabase.from("business_growth_programmes").update({
      name: draft.name, slug: draft.slug, description: draft.description, opens_at: draft.opensAt,
      closes_at: draft.closesAt, onboarding_scope: draft.onboardingScope, exclusions: draft.exclusions,
      renewal_price_note: draft.renewalPriceNote, terms_text: draft.termsText,
      terms_version: draft.termsText === programme.terms_text ? programme.terms_version : String(Number(programme.terms_version || 1) + 1),
      privacy_text: draft.privacyText,
      privacy_version: draft.privacyText === programme.privacy_text ? programme.privacy_version : String(Number(programme.privacy_version || 1) + 1),
      capability_reference: draft.capabilityReference, questions: draft.questions, updated_at: new Date().toISOString(),
    }).eq("id", id).eq("status", "DRAFT")
    if (error) return NextResponse.json({ error: error.message.includes("duplicate key") ? "That programme URL is already in use." : "Draft changes could not be saved." }, { status: 500 })
    await supabase.from("business_growth_events").insert({ programme_id: id, actor_admin_user_id: session!.userId, event_type: "PROGRAMME_DRAFT_UPDATED", details: { questions: draft.questions.length } })
    return NextResponse.json({ success: true, status: "DRAFT" })
  }
  const { action, reason } = parsed.data
  let nextStatus: string
  if (action === "publish") {
    if (programme.status !== "DRAFT" || !programme.closes_at || !programme.opens_at || !programme.onboarding_scope?.trim() || !programme.terms_text?.trim() || !programme.privacy_text?.trim() || !programme.capability_reference?.trim() || !Array.isArray(programme.questions) || !programme.questions.length) return NextResponse.json({ error: "Complete offer, dates, onboarding, terms, privacy, questions and verified Basic capabilities before opening applications." }, { status: 409 })
    nextStatus = new Date(programme.opens_at).getTime() > Date.now() ? "SCHEDULED" : "OPEN"
  } else if (action === "close") {
    if (!["OPEN", "SCHEDULED"].includes(programme.status)) return NextResponse.json({ error: "Only an open or scheduled programme can be closed." }, { status: 409 })
    nextStatus = "REVIEWING"
  } else if (action === "complete") {
    if (!["CLOSED", "REVIEWING"].includes(programme.status)) return NextResponse.json({ error: "Close applications before completing selection." }, { status: 409 })
    const { error } = await supabase.rpc("complete_business_growth_programme", { p_programme_id: id, p_actor: session!.userId, p_reason: reason || "Selection complete" })
    if (error) {
      const message = error.message.includes("OUTSTANDING_OFFERS")
        ? "Resolve every outstanding offer before completing and announcing programme outcomes."
        : error.message.includes("CLARIFICATION_REQUESTS")
          ? "Resolve open clarification requests before completing the programme. Applicants must have a chance to respond."
        : error.message.includes("ASSESSMENTS_MUST_BE_RESOLVED")
          ? "Resolve every pending or failed assessment before completing the programme. Retry AI assessment or record a human review outcome."
          : "Programme completion could not be saved. Refresh and try again."
      return NextResponse.json({ error: message }, { status: 409 })
    }
    return NextResponse.json({ success: true, status: "COMPLETED" })
  } else {
    const { data: liveAwards } = await supabase.from("business_growth_awards").select("id").eq("programme_id", id).in("status", ["OFFERED", "ACCEPTED", "ACTIVATED"])
    if (liveAwards?.length) return NextResponse.json({ error: "This programme has offered or active awards. Resolve them before archiving." }, { status: 409 })
    if (!["COMPLETED", "CLOSED", "REVIEWING", "DRAFT"].includes(programme.status)) return NextResponse.json({ error: "Programme cannot be archived in its current state." }, { status: 409 })
    nextStatus = "ARCHIVED"
  }
  const { error } = await supabase.from("business_growth_programmes").update({ status: nextStatus, updated_at: new Date().toISOString(), ...(action === "publish" ? { published_at: new Date().toISOString() } : {}) }).eq("id", id)
  if (error) return NextResponse.json({ error: "Programme state could not be changed" }, { status: 500 })
  await supabase.from("business_growth_events").insert({ programme_id: id, actor_admin_user_id: session!.userId, event_type: `PROGRAMME_${action.toUpperCase()}`, reason: reason || null, details: { from: programme.status, to: nextStatus } })
  return NextResponse.json({ success: true, status: nextStatus })
}
