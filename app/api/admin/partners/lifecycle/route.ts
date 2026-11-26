import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { notifyAllAdmins } from "@/lib/admin-notifications"
import { sendPartnerLifecycleNotice } from "@/lib/partner-lifecycle"
import { CHANNEL_QUALIFYING_COMMISSION_STATUSES } from "@/lib/partner-performance-grading"

type LifecycleExportRow = { partner_id: string; partners?: { partner_id?: string; business_name?: string }; account_status?: string; onboarding_status?: string; performance_status?: string; listing_status?: string; compliance_status?: string; accepted_version?: string | null; last_verified_activity_at?: string | null; updated_at?: string; pipeline_count?: number }

const schema = z.object({
  action: z.enum(["settings", "approve_onboarding", "verify_activity", "reject_activity", "verify_delivery", "extend", "hold", "listing", "case_response", "open_case", "resolve_case", "retry_notice"]),
  partnerId: z.string().uuid().optional(), activityId: z.string().uuid().optional(), caseId: z.string().uuid().optional(), noticeId: z.string().uuid().optional(),
  reason: z.string().trim().min(5).max(1000).optional(), days: z.coerce.number().int().min(1).max(180).optional(),
  listingStatus: z.enum(["hidden", "eligible", "published", "suspended"]).optional(),
  deliveryType: z.enum(["channel_sale", "implementation_acceptance", "referral_conversion", "technology_acceptance", "payment_activation", "approved_business_delivery"]).optional(),
  evidenceReference: z.string().trim().min(3).max(300).optional(),
  evidenceSummary: z.string().trim().min(10).max(2000).optional(),
  caseOutcome: z.enum(["clear", "confirmed_violation", "under_review"]).optional(),
  featureEnabled: z.boolean().optional(), dryRun: z.boolean().optional(), autoSuspensionEnabled: z.boolean().optional(), autoReinstateEnabled: z.boolean().optional(),
})

export async function GET(request: Request) {
  const auth = await authorizeAdmin("partners", "view")
  if (auth.denied) return auth.denied
  if (!isSupabaseConfigured()) return NextResponse.json({ rows: [], settings: null })
  const [lifecycle, settings, activities, cases, notices, evaluations, pipeline, history] = await Promise.all([
    supabase.from("partner_lifecycle").select("*,partners(id,partner_id,business_name,status,public_profile_enabled,partner_type,current_grade)").order("updated_at", { ascending: false }).limit(500),
    supabase.from("partner_lifecycle_settings").select("*").eq("id", true).maybeSingle(),
    supabase.from("partner_activities").select("*,partners(partner_id,business_name)").eq("verification_status", "pending").order("created_at", { ascending: false }).limit(100),
    supabase.from("partner_cases").select("*,partners(partner_id,business_name)").in("status", ["open", "under_review"]).order("opened_at", { ascending: false }).limit(100),
    supabase.from("partner_notices").select("*,partners(partner_id,business_name)").order("created_at", { ascending: false }).limit(200),
    supabase.from("partner_evaluations").select("*,partners(partner_id,business_name)").order("evaluated_at", { ascending: false }).limit(200),
    supabase.from("partner_leads").select("partner_id,status").in("status", ["REGISTERED", "UNDER_REVIEW", "QUALIFIED", "DEMO", "PROPOSAL", "NEGOTIATION"]),
    supabase.from("partner_status_history").select("partner_id,previous_status,new_status,reason,changed_by_name,created_at").not("partner_id", "is", null).order("created_at", { ascending: false }).limit(200),
  ])
  const pipelineCounts = new Map<string, number>()
  for (const lead of pipeline.data || []) if (lead.partner_id) pipelineCounts.set(lead.partner_id, (pipelineCounts.get(lead.partner_id) || 0) + 1)
  const result = { rows: (lifecycle.data || []).map((r) => ({ ...r, pipeline_count: pipelineCounts.get(r.partner_id) || 0 })), settings: settings.data, activities: activities.data || [], cases: cases.data || [], notices: notices.data || [], evaluations: evaluations.data || [], history: history.data || [] }
  if (new URL(request.url).searchParams.get("export") === "csv") {
    const cell = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`
    const lines = ["record_type,partner_id,business_name,recorded_at,field,from_value,to_value,reason,dry_run"]
    for (const r of result.rows as LifecycleExportRow[]) lines.push(["lifecycle", r.partners?.partner_id, r.partners?.business_name, r.updated_at, "statuses", "", [r.account_status, r.onboarding_status, r.performance_status, r.listing_status, r.compliance_status, r.accepted_version, `pipeline:${r.pipeline_count || 0}`, `last_verified:${r.last_verified_activity_at || ""}`].join("|"), "", ""].map(cell).join(","))
    for (const h of result.history) lines.push(["status_history", h.partner_id, "", h.created_at, "status", h.previous_status, h.new_status, h.reason, ""].map(cell).join(","))
    for (const e of result.evaluations) lines.push(["evaluation", e.partner_id, "", e.evaluated_at, e.decision, "", e.explanation, e.explanation, e.dry_run].map(cell).join(","))
    for (const n of result.notices) lines.push(["notice", n.partner_id, "", n.sent_at || n.created_at, n.notice_type, "", n.delivery_status, n.body, ""].map(cell).join(","))
    const csv = lines.join("\n")
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=partner-lifecycle-audit.csv", "cache-control": "no-store" } })
  }
  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const auth = await authorizeAdmin("partners", "manage")
  if (auth.denied) return auth.denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Lifecycle service unavailable" }, { status: 503 })
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request" }, { status: 400 })
  const input = parsed.data
  const reason = input.reason?.trim()
  if (!reason) return NextResponse.json({ error: "A reason is required for lifecycle actions" }, { status: 400 })
  const actorId = auth.session.userId
  const now = new Date()
  let error: { message: string } | null = null
  if (input.action === "settings") {
    const { error: updateError } = await supabase.from("partner_lifecycle_settings").update({ feature_enabled: input.featureEnabled, dry_run: input.dryRun, auto_suspension_enabled: input.autoSuspensionEnabled, auto_reinstate_enabled: input.autoReinstateEnabled, updated_at: now.toISOString(), updated_by: actorId }).eq("id", true)
    error = updateError
    if (!error) await recordAudit(auditContextFromSession(auth.session, request), { action: AUDIT_ACTIONS.PARTNER_UPDATED, entityType: AUDIT_ENTITIES.PARTNER, metadata: { lifecycleAction: "rollout_settings", featureEnabled: input.featureEnabled, dryRun: input.dryRun, autoSuspensionEnabled: input.autoSuspensionEnabled, autoReinstateEnabled: input.autoReinstateEnabled, reason } })
  } else if (input.action === "retry_notice") {
    if (!input.noticeId) return NextResponse.json({ error: "Notice is required" }, { status: 400 })
    const { data: notice } = await supabase.from("partner_notices").select("id,partner_id,delivery_status").eq("id", input.noticeId).maybeSingle()
    if (!notice || !["failed", "permanent_failure"].includes(notice.delivery_status)) return NextResponse.json({ error: "Only failed notices can be retried" }, { status: 409 })
    const { error: updateError } = await supabase.from("partner_notices").update({ delivery_status: "queued", due_at: now.toISOString() }).eq("id", notice.id)
    error = updateError
    input.partnerId = notice.partner_id
  } else if (input.action === "verify_activity" || input.action === "reject_activity") {
    if (!input.activityId) return NextResponse.json({ error: "Activity is required" }, { status: 400 })
    const { data: activity } = await supabase.from("partner_activities").select("id,partner_id,verification_status,occurred_at").eq("id", input.activityId).maybeSingle()
    if (!activity || activity.verification_status !== "pending") return NextResponse.json({ error: "Pending activity not found" }, { status: 404 })
    const approved = input.action === "verify_activity"
    const { error: updateError } = await supabase.from("partner_activities").update({ verification_status: approved ? "verified" : "rejected", verified_at: approved ? now.toISOString() : null, verified_by: actorId, rejection_reason: approved ? null : reason }).eq("id", activity.id).eq("verification_status", "pending")
    error = updateError
    if (!error && approved) await supabase.from("partner_lifecycle").update({ last_verified_activity_at: activity.occurred_at, updated_at: now.toISOString() }).eq("partner_id", activity.partner_id)
    input.partnerId = activity.partner_id
  } else {
    if (!input.partnerId) return NextResponse.json({ error: "Partner is required" }, { status: 400 })
    const { data: life } = await supabase.from("partner_lifecycle").select("*,partners(status,partner_type)").eq("partner_id", input.partnerId).maybeSingle()
    if (!life) return NextResponse.json({ error: "Partner lifecycle not found" }, { status: 404 })
    if (input.action === "verify_delivery") {
      if (!input.deliveryType || !input.evidenceReference || !input.evidenceSummary) return NextResponse.json({ error: "Delivery type, evidence reference, and evidence summary are required" }, { status: 400 })
      const type = String(life.partners?.partner_type || "")
      const allowed = type === "CHANNEL" ? ["channel_sale"]
        : type === "IMPLEMENTATION" ? ["implementation_acceptance"]
        : type === "CHANNEL_IMPLEMENTATION" ? ["channel_sale", "implementation_acceptance"]
        : type === "REFERRAL" ? ["referral_conversion"]
        : type === "TECHNOLOGY" ? ["technology_acceptance"]
        : type === "PAYMENT" ? ["payment_activation"]
        : ["approved_business_delivery"]
      if (!allowed.includes(input.deliveryType)) return NextResponse.json({ error: "The delivery evidence type does not match this Partner Type" }, { status: 400 })
      const gradedPartnerType = input.deliveryType === "channel_sale" && type.includes("CHANNEL") ? "CHANNEL"
        : input.deliveryType === "implementation_acceptance" && type.includes("IMPLEMENTATION") ? "IMPLEMENTATION"
        : input.deliveryType === "referral_conversion" && type === "REFERRAL" ? "REFERRAL"
        : input.deliveryType === "technology_acceptance" && type === "TECHNOLOGY" ? "TECHNOLOGY"
        : input.deliveryType === "payment_activation" && type === "PAYMENT" ? "PAYMENT" : null
      if (!gradedPartnerType) return NextResponse.json({ error: "Choose a qualifying outcome type defined for this Partner Type" }, { status: 409 })
      let outcomeReference = input.evidenceReference.trim()
      let evidenceReference = outcomeReference
      let evidenceSummary = input.evidenceSummary
      if (input.deliveryType === "channel_sale") {
        const commissionQuery = supabase.from("partner_commissions")
          .select("id,partner_id,business_id,payment_id,activation_at,status,attribution_type")
          .eq("partner_id", input.partnerId)
          .eq("attribution_type", "SALES")
          .in("status", [...CHANNEL_QUALIFYING_COMMISSION_STATUSES])
          .not("payment_id", "is", null)
          .not("activation_at", "is", null)
        const commissionLookup = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(outcomeReference)
          ? commissionQuery.eq("id", outcomeReference)
          : commissionQuery.eq("business_id", outcomeReference)
        const commissionResult = await commissionLookup.order("activation_at", { ascending: false }).limit(1).maybeSingle()
        const commission = commissionResult.data
        if (!commission) return NextResponse.json({ error: "Channel grading requires a MartPoint Sales commission record with a cleared payment, active licence and an eligible, approved or paid earning" }, { status: 409 })
        outcomeReference = String(commission.business_id)
        evidenceReference = String(commission.id)
        evidenceSummary = `${input.evidenceSummary} Verified against eligible Sales commission ${commission.id}, payment ${commission.payment_id}, active licence at ${commission.activation_at}.`
      }
      if (input.deliveryType === "implementation_acceptance") {
        const workOrderQuery = supabase.from("partner_work_orders")
          .select("id,work_order_ref,partner_id,assignment_id,business_id,status,issued_at,completed_at,closed_at")
          .eq("partner_id", input.partnerId)
          .in("status", ["COMPLETED", "CLOSED"])
          .not("business_id", "is", null)
        const workOrderResult = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(outcomeReference)
          ? await workOrderQuery.eq("id", outcomeReference).maybeSingle()
          : await workOrderQuery.eq("work_order_ref", outcomeReference).maybeSingle()
        const workOrder = workOrderResult.data
        if (!workOrder || !workOrder.issued_at || !workOrder.completed_at) return NextResponse.json({ error: "Implementation grading requires this Partner's issued Work Order to be completed with its deliverables formally accepted by MartPoint" }, { status: 409 })
        evidenceReference = String(workOrder.work_order_ref)
        // One assignment represents the same implementation even if multiple
        // Work Orders or change orders were recorded against it.
        outcomeReference = String(workOrder.assignment_id || workOrder.business_id)
        evidenceSummary = `${input.evidenceSummary} Verified against completed Work Order ${workOrder.work_order_ref}; accepted completion date ${workOrder.completed_at}.`
      }
      if (input.deliveryType === "referral_conversion") {
        const commissionQuery = supabase.from("partner_commissions")
          .select("id,partner_id,business_id,payment_id,activation_at,status,attribution_type")
          .eq("partner_id", input.partnerId)
          .eq("attribution_type", "ORIGINATING")
          .eq("business_id", outcomeReference)
          .in("status", [...CHANNEL_QUALIFYING_COMMISSION_STATUSES])
          .not("payment_id", "is", null)
          .not("activation_at", "is", null)
        const { data: commission } = await commissionQuery.order("activation_at", { ascending: false }).limit(1).maybeSingle()
        if (!commission) return NextResponse.json({ error: "Referral grading requires an originating Partner commission with cleared payment and an active licence" }, { status: 409 })
        outcomeReference = String(commission.business_id)
        evidenceReference = String(commission.id)
        evidenceSummary = `${input.evidenceSummary} Verified against originating Partner commission ${commission.id}, cleared payment ${commission.payment_id}, active licence at ${commission.activation_at}.`
      }
      const { error: evidenceError } = await supabase.from("partner_delivery_verifications").insert({ partner_id: input.partnerId, delivery_type: input.deliveryType, partner_type: gradedPartnerType, outcome_reference: outcomeReference, evidence_reference: evidenceReference, evidence_summary: evidenceSummary, verified_by: actorId, verified_at: now.toISOString(), approved: true })
      error = evidenceError
      if (!error) {
        const { error: eligibilityError } = await supabase.from("partner_lifecycle").update({ directory_eligible: true, directory_eligibility_verified_at: now.toISOString(), directory_eligibility_verified_by: actorId, listing_status: life.listing_status === "hidden" ? "eligible" : life.listing_status, updated_at: now.toISOString(), version_counter: Number(life.version_counter || 0) + 1 }).eq("partner_id", input.partnerId)
        error = eligibilityError
      }
    } else if (input.action === "approve_onboarding") {
      if (life.account_status !== "enabled" || life.compliance_status !== "clear" || life.partners?.status !== "ACTIVE") return NextResponse.json({ error: "Partner must have an enabled account, active partner approval, and clear compliance before onboarding approval" }, { status: 409 })
      const [{ data: requiredDocs }, { data: partnerType }, { data: agreements }] = await Promise.all([
        supabase.from("partner_documents").select("id,verification_status").eq("partner_id", input.partnerId).eq("required", true),
        supabase.from("partners").select("partner_type").eq("id", input.partnerId).maybeSingle(),
        supabase.from("partner_agreements").select("id,status,agreement_kind").eq("partner_id", input.partnerId).eq("agreement_kind", "REFERRAL_PARTNER_AGREEMENT").in("status", ["EXECUTED", "ACTIVE"]),
      ])
      if ((requiredDocs || []).some((d) => d.verification_status !== "VERIFIED")) return NextResponse.json({ error: "All required partner compliance documents must be verified" }, { status: 409 })
      if (partnerType?.partner_type === "REFERRAL" && !(agreements || []).length) return NextResponse.json({ error: "An executed referral partner agreement is required" }, { status: 409 })
      const { data: currentGradePolicy } = await supabase.from("partner_grading_policies").select("id").eq("status", "APPROVED").order("effective_at", { ascending: false }).limit(1).maybeSingle()
      if (currentGradePolicy) {
        const { data: acknowledgment } = await supabase.from("partner_grading_policy_acknowledgements").select("id").eq("partner_id", input.partnerId).eq("policy_id", currentGradePolicy.id).maybeSingle()
        if (!acknowledgment) return NextResponse.json({ error: "The Partner must acknowledge the current Grading Policy in Partner Portal Resources before onboarding is completed" }, { status: 409 })
      }
      const { data: version } = await supabase.from("partner_policy_versions").select("id,version,effective_at,config_json").order("created_at", { ascending: false }).limit(1).maybeSingle()
      const eligibleStart = life.accepted_at ? new Date(Math.max(now.getTime(), new Date(life.effective_at || version?.effective_at || now).getTime())) : null
      const { error: updateError } = await supabase.from("partner_lifecycle").update({ onboarding_status: "approved", ...(!life.probation_start_at && eligibleStart ? { probation_start_at: eligibleStart.toISOString(), probation_end_at: new Date(eligibleStart.getTime() + Number(version?.config_json?.probation_days || 90) * 86400000).toISOString(), performance_status: "probation" } : {}), updated_at: now.toISOString() }).eq("partner_id", input.partnerId)
      error = updateError
      if (!updateError && !life.probation_start_at && eligibleStart) await sendPartnerLifecycleNotice(input.partnerId, "probation_started", `partner-lifecycle:${input.partnerId}:probation-start:${eligibleStart.toISOString().slice(0, 10)}`, `Your activation period starts ${new Intl.DateTimeFormat("en-NG", { dateStyle: "long", timeZone: "Africa/Lagos" }).format(eligibleStart)}. Complete the activation criteria shown in your dashboard.`)
    } else if (input.action === "open_case") {
      const { data: holidays } = await supabase.from("partner_business_holidays").select("holiday_date").gte("holiday_date", now.toISOString().slice(0, 10)).limit(40)
      const { addBusinessDays } = await import("@/lib/partner-lifecycle-policy")
      const deadline = addBusinessDays(now, 10, (holidays || []).map((h) => String(h.holiday_date)))
      const { data: created, error: createError } = await supabase.from("partner_cases").insert({ partner_id: input.partnerId, case_type: "compliance_review", opening_reason: reason, opened_by: actorId, response_deadline_at: deadline.toISOString(), status: "open" }).select("id").single()
      error = createError
      if (!error && created) {
        await supabase.from("partner_lifecycle").update({ compliance_status: "open_case", updated_at: now.toISOString() }).eq("partner_id", input.partnerId)
        await supabase.from("partner_notifications").insert({ partner_id: input.partnerId, type: "LIFECYCLE_REVIEW", title: "Compliance review opened", body: "MartPoint has opened a compliance review. This is a review request, not a finding. Please provide your response and supporting evidence in your partner dashboard.", link: "/partner" })
        await sendPartnerLifecycleNotice(input.partnerId, "compliance_case_opened", `partner-lifecycle:${input.partnerId}:case:${created.id}`, `A compliance review has been opened. This is a review request, not a finding. Please respond with relevant evidence in your partner dashboard. Reason for review: ${reason}`, deadline.toISOString())
        await notifyAllAdmins({ type: "PARTNER_COMPLIANCE_CASE", title: "Partner compliance review opened", message: `${life.partners?.business_name || input.partnerId}: ${reason}`, deep_link: "/admin/partners/lifecycle", source_type: "partner_case", source_id: created.id, actor_admin_user_id: actorId })
      }
    } else if (input.action === "resolve_case") {
      if (!input.caseId) return NextResponse.json({ error: "Case is required" }, { status: 400 })
      const outcome = input.caseOutcome || "clear"
      const { error: updateError } = await supabase.from("partner_cases").update({ status: outcome === "under_review" ? "under_review" : "resolved", resolution: reason, resolved_by: actorId, resolved_at: outcome === "under_review" ? null : now.toISOString() }).eq("id", input.caseId).eq("partner_id", input.partnerId).in("status", ["open", "under_review"])
      error = updateError
      const { data: stillOpen } = await supabase.from("partner_cases").select("id").eq("partner_id", input.partnerId).in("status", ["open", "under_review"]).limit(1)
      if (!error) await supabase.from("partner_lifecycle").update({ compliance_status: outcome === "confirmed_violation" ? "confirmed_violation" : (stillOpen || []).length ? "under_review" : "clear", updated_at: now.toISOString() }).eq("partner_id", input.partnerId)
    } else if (input.action === "extend" || input.action === "hold") {
      const expires = new Date(now.getTime() + (input.days || 30) * 86400000).toISOString()
      const { error: updateError } = await supabase.from("partner_lifecycle").update(input.action === "extend" ? { extension_until: expires, updated_at: now.toISOString() } : { review_hold_until: expires, updated_at: now.toISOString() }).eq("partner_id", input.partnerId)
      error = updateError
      await supabase.from("partner_admin_overrides").insert({ partner_id: input.partnerId, override_type: input.action, reason, expires_at: expires, approved_by: actorId })
    } else if (input.action === "listing") {
      if (!input.listingStatus) return NextResponse.json({ error: "Listing status is required" }, { status: 400 })
      if (["eligible", "published"].includes(input.listingStatus) && !life.directory_eligible) return NextResponse.json({ error: "Verify at least one qualifying business delivery before marking a partner eligible or publishing the listing" }, { status: 409 })
      if (input.listingStatus === "published") {
        const { data: awardedGrades } = await supabase.from("partner_type_grades").select("current_grade").eq("partner_id", input.partnerId).in("current_grade", ["SILVER", "GOLD", "PLATINUM"])
        if (!awardedGrades?.length) return NextResponse.json({ error: "Public directory publication requires a formally awarded Silver, Gold or Platinum grade for an approved Partner Type" }, { status: 409 })
      }
      if (input.listingStatus === "published" && (life.account_status !== "enabled" || life.compliance_status !== "clear" || life.onboarding_status !== "approved" || life.partners?.status !== "ACTIVE" || !["eligible", "published", "pending_suspension", "suspended"].includes(life.listing_status))) return NextResponse.json({ error: "Partner must have verified delivery, approved onboarding, an enabled active account, and clear compliance before publication" }, { status: 409 })
      if (input.listingStatus === "published" && ["pending_suspension", "suspended"].includes(life.listing_status)) {
        const [activity, completedReview] = await Promise.all([
          supabase.from("partner_activities").select("id").eq("partner_id", input.partnerId).eq("verification_status", "verified").limit(1).maybeSingle(),
          supabase.from("partner_cases").select("id").eq("partner_id", input.partnerId).eq("case_type", "directory_suspension_notice").eq("status", "resolved").limit(1).maybeSingle(),
        ])
        if (!activity.data || !completedReview.data) return NextResponse.json({ error: "Reinstatement requires verified activity and a completed admin review" }, { status: 409 })
      }
      const { error: updateError } = await supabase.from("partner_lifecycle").update({ listing_status: input.listingStatus, updated_at: now.toISOString(), version_counter: Number(life.version_counter || 0) + 1 }).eq("partner_id", input.partnerId)
      error = updateError
      if (!error) await supabase.from("partners").update({ public_profile_enabled: ["published", "pending_suspension"].includes(input.listingStatus) && life.partners?.status === "ACTIVE" }).eq("id", input.partnerId)
      if (!error && input.listingStatus === "suspended") await sendPartnerLifecycleNotice(input.partnerId, "suspension_confirmed", `partner-lifecycle:${input.partnerId}:manual-suspended:${now.toISOString().slice(0, 10)}`, `An authorized MartPoint administrator suspended the directory listing. Reason: ${reason}`)
      if (!error && input.listingStatus === "published" && ["suspended", "pending_suspension"].includes(life.listing_status)) await sendPartnerLifecycleNotice(input.partnerId, "reinstated", `partner-lifecycle:${input.partnerId}:manual-reinstated:${now.toISOString().slice(0, 10)}`, `An authorized MartPoint administrator restored the directory listing. Reason: ${reason}`)
      await supabase.from("partner_admin_overrides").insert({ partner_id: input.partnerId, override_type: "listing_status", reason, approved_by: actorId })
    } else if (input.action === "case_response") {
      if (!input.caseId) return NextResponse.json({ error: "Case is required" }, { status: 400 })
      const { error: updateError } = await supabase.from("partner_cases").update({ status: "under_review", resolution: reason, resolved_by: actorId }).eq("id", input.caseId).eq("partner_id", input.partnerId)
      error = updateError
    }
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (input.partnerId) {
    await supabase.from("partner_status_history").insert({ partner_id: input.partnerId, previous_status: input.action === "listing" ? undefined : null, new_status: input.action === "listing" ? input.listingStatus : input.action, reason, changed_by: actorId, changed_by_name: auth.session.name || auth.session.username, event_type: "STATUS_CHANGE" })
    await recordAudit(auditContextFromSession(auth.session, request), { action: AUDIT_ACTIONS.PARTNER_UPDATED, entityType: AUDIT_ENTITIES.PARTNER, entityId: input.partnerId, metadata: { lifecycleAction: input.action, reason, activityId: input.activityId || null, deliveryType: input.deliveryType || null, evidenceReference: input.evidenceReference || null, listingStatus: input.listingStatus || null } })
  }
  return NextResponse.json({ ok: true })
}
