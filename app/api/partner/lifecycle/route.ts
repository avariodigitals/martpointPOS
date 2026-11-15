import { NextResponse } from "next/server"
import { z } from "zod"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getPartnerLifecycle, sendPartnerLifecycleNotice } from "@/lib/partner-lifecycle"
import { auditContextFromPartnerSession } from "@/lib/audit"
import { checkRateLimit } from "@/lib/rate-limit"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { notifyAllAdmins } from "@/lib/admin-notifications"

const activitySchema = z.object({ activityType: z.enum(["qualified_lead", "attended_demo", "proposal_submitted", "closed_won", "documented_client_meeting"]), description: z.string().trim().min(12).max(1000), occurredAt: z.string().datetime(), evidenceUrl: z.string().url().optional().nullable(), sourceRecordId: z.string().uuid().optional(), consentConfirmed: z.boolean().optional(), lawfulBasis: z.enum(["consent", "contract", "legitimate_interest", "other"]).optional() })
const responseSchema = z.object({ caseId: z.string().uuid(), response: z.string().trim().min(10).max(3000), evidenceUrl: z.string().url().optional().nullable() })

export async function GET() {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const [result, leads] = await Promise.all([getPartnerLifecycle(session.partnerId), supabase.from("partner_leads").select("id,business_name,status,protection_status").eq("partner_id", session.partnerId).in("status", ["QUALIFIED", "DEMO", "PROPOSAL", "NEGOTIATION", "WON"]).eq("protection_status", "PROTECTED").order("updated_at", { ascending: false }).limit(100)])
  return NextResponse.json({ ...(result || { lifecycle: null, activities: [], notices: [], cases: [], policy: null }), qualifyingLeads: leads.data || [] })
}

export async function POST(request: Request) {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Lifecycle service unavailable" }, { status: 503 })
  if (body?.action === "accept") {
    const { data: version } = await supabase.from("partner_policy_versions").select("id,version,effective_at").order("created_at", { ascending: false }).limit(1).maybeSingle()
    if (!version) return NextResponse.json({ error: "No active partner policy" }, { status: 503 })
    const acceptedAt = new Date()
    const { data: partner } = await supabase.from("partners").select("status").eq("id", session.partnerId).maybeSingle()
    const { data: lifecycle } = await supabase.from("partner_lifecycle").select("onboarding_status,accepted_at").eq("partner_id", session.partnerId).maybeSingle()
    if (!lifecycle) return NextResponse.json({ error: "Lifecycle record not found" }, { status: 404 })
    if (lifecycle.accepted_at) return NextResponse.json({ ok: true, alreadyAccepted: true })
    const effectiveAt = new Date(Math.max(acceptedAt.getTime(), new Date(version.effective_at).getTime()))
    const approved = lifecycle.onboarding_status === "approved" && partner?.status === "ACTIVE"
    const patch = { policy_version_id: version.id, accepted_version: version.version, accepted_at: acceptedAt.toISOString(), effective_at: effectiveAt.toISOString(), transition_start_at: effectiveAt.toISOString(), ...(approved ? { probation_start_at: effectiveAt.toISOString(), probation_end_at: new Date(effectiveAt.getTime() + 90 * 86400000).toISOString(), performance_status: "probation" } : {}), updated_at: new Date().toISOString() }
    const { error } = await supabase.from("partner_lifecycle").update(patch).eq("partner_id", session.partnerId).is("accepted_at", null)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    await supabase.from("partner_policy_acceptances").insert({ partner_id: session.partnerId, policy_version_id: version.id, actor_partner_user_id: session.partnerUserId })
    await recordAudit(auditContextFromPartnerSession(session, request), { action: AUDIT_ACTIONS.PARTNER_UPDATED, entityType: AUDIT_ENTITIES.PARTNER, entityId: session.partnerId, metadata: { action: "lifecycle_policy_accepted", version: version.version } })
    if (approved) await sendPartnerLifecycleNotice(session.partnerId, "probation_started", `partner-lifecycle:${session.partnerId}:probation-start:${effectiveAt.toISOString().slice(0, 10)}`, `Your activation period starts ${new Intl.DateTimeFormat("en-NG", { dateStyle: "long", timeZone: "Africa/Lagos" }).format(effectiveAt)}. Complete the activation criteria shown in your dashboard.`)
    return NextResponse.json({ ok: true, acceptedAt: acceptedAt.toISOString(), effectiveAt: effectiveAt.toISOString() })
  }
  const auth = await authorizePartner({ session, permission: "leads:create" })
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (body?.action === "activity") {
    const limit = await checkRateLimit(request, { key: `partner-lifecycle-activity:${session.partnerId}`, max: 8, windowSeconds: 86400 })
    if (!limit.allowed) return NextResponse.json({ error: "Daily submission limit reached" }, { status: 429 })
    const parsed = activitySchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid activity" }, { status: 400 })
    if (new Date(parsed.data.occurredAt).getTime() > Date.now() + 300000) return NextResponse.json({ error: "Activity date cannot be in the future" }, { status: 400 })
    const { data: lifecycleClock } = await supabase.from("partner_lifecycle").select("transition_start_at,policy_version_id").eq("partner_id", session.partnerId).maybeSingle()
    if (!lifecycleClock?.transition_start_at) return NextResponse.json({ error: "Accept the current lifecycle policy before submitting qualifying activity" }, { status: 409 })
    if (new Date(parsed.data.occurredAt) < new Date(lifecycleClock.transition_start_at)) return NextResponse.json({ error: "Activity before the effective transition date does not count" }, { status: 400 })
    const { data: version } = await supabase.from("partner_policy_versions").select("config_json").eq("id", lifecycleClock.policy_version_id).maybeSingle()
    const maxAgeDays = Number(version?.config_json?.activity_max_age_days || 30)
    if (Date.now() - new Date(parsed.data.occurredAt).getTime() > maxAgeDays * 86400000) return NextResponse.json({ error: `Activity must be submitted within ${maxAgeDays} days` }, { status: 400 })
    let sourceRecord: { id: string; email: string | null; phone: string | null } | null = null
    if (parsed.data.activityType === "qualified_lead") {
      if (!parsed.data.sourceRecordId || !parsed.data.consentConfirmed || !parsed.data.lawfulBasis) return NextResponse.json({ error: "A protected qualified lead, its existing pipeline record, and a lawful basis confirmation are required" }, { status: 400 })
      const { data: lead } = await supabase.from("partner_leads").select("id,partner_id,status,protection_status,email,phone").eq("id", parsed.data.sourceRecordId).maybeSingle()
      if (!lead || lead.partner_id !== session.partnerId || !["QUALIFIED", "DEMO", "PROPOSAL", "NEGOTIATION", "WON"].includes(lead.status) || lead.protection_status !== "PROTECTED") return NextResponse.json({ error: "Lead must belong to your partner account and be protected and qualified" }, { status: 409 })
      sourceRecord = { id: lead.id, email: lead.email, phone: lead.phone }
      const { data: similar } = await supabase.from("partner_leads").select("id,partner_id,email,phone").neq("id", lead.id)
      const email = String(lead.email || "").trim().toLowerCase(), phone = String(lead.phone || "").replace(/\D/g, "")
      if ((similar || []).some((r) => (email && String(r.email || "").trim().toLowerCase() === email) || (phone && String(r.phone || "").replace(/\D/g, "") === phone))) return NextResponse.json({ error: "This organization or contact is already registered to another lead record" }, { status: 409 })
      if (email) { const { data: crmMatches } = await supabase.from("leads").select("id").ilike("email", email).limit(1); if ((crmMatches || []).length) return NextResponse.json({ error: "A matching CRM lead already exists; ask MartPoint to review attribution" }, { status: 409 }) }
      if (phone) { const { data: crmMatches } = await supabase.from("leads").select("id").eq("phone", lead.phone).limit(1); if ((crmMatches || []).length) return NextResponse.json({ error: "A matching CRM contact already exists; ask MartPoint to review attribution" }, { status: 409 }) }
    }
    const { data, error } = await supabase.from("partner_activities").insert({ partner_id: session.partnerId, activity_type: parsed.data.activityType, source_record_type: sourceRecord ? "partner_lead" : null, source_record_id: sourceRecord?.id || null, unique_source_key: sourceRecord ? `partner_lead:${sourceRecord.id}` : null, consent_confirmed: parsed.data.consentConfirmed || false, lawful_basis: parsed.data.lawfulBasis || null, description: parsed.data.description, occurred_at: parsed.data.occurredAt, evidence_url: parsed.data.evidenceUrl || null, submitted_by: session.partnerUserId }).select("id").single()
    if (error) return NextResponse.json({ error: "Unable to submit activity" }, { status: 500 })
    await recordAudit(auditContextFromPartnerSession(session, request), { action: AUDIT_ACTIONS.PARTNER_UPDATED, entityType: AUDIT_ENTITIES.PARTNER, entityId: session.partnerId, metadata: { action: "lifecycle_activity_submitted", activityId: data.id } })
    return NextResponse.json({ ok: true, activityId: data.id }, { status: 201 })
  }
  if (body?.action === "respond") {
    const parsed = responseSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid response" }, { status: 400 })
    const { data: item } = await supabase.from("partner_cases").select("id,response_deadline_at").eq("id", parsed.data.caseId).eq("partner_id", session.partnerId).in("status", ["open", "under_review"]).maybeSingle()
    if (!item) return NextResponse.json({ error: "Review case not found" }, { status: 404 })
    const { error } = await supabase.from("partner_cases").update({ partner_response: parsed.data.response, response_evidence_url: parsed.data.evidenceUrl || null, responded_at: new Date().toISOString() }).eq("id", item.id)
    if (error) return NextResponse.json({ error: "Unable to save response" }, { status: 500 })
    await supabase.from("partner_notifications").insert({ partner_id: session.partnerId, type: "LIFECYCLE_REVIEW", title: "Response received", body: "MartPoint received your review response and supporting information.", link: "/partner" })
    await sendPartnerLifecycleNotice(session.partnerId, "appeal_acknowledged", `partner-lifecycle:${session.partnerId}:appeal-ack:${item.id}`, "MartPoint received your review response and supporting information.", item.response_deadline_at || undefined)
    await notifyAllAdmins({ type: "PARTNER_LIFECYCLE_RESPONSE", title: "Partner submitted a review response", message: `A partner submitted a response for review case ${item.id}.`, deep_link: "/admin/partners/lifecycle", source_type: "partner_case", source_id: item.id, actor_admin_user_id: null })
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
