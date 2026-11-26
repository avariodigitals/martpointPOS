import { supabase, isSupabaseConfigured } from "./supabase"
import { sendEmail, REPLY_TO } from "./email"
import { escapeHtml } from "./email-templates"
import { addBusinessDays, canAutomaticallyReinstate, decidePartnerLifecycle, lifecycleNoticeKey, type LifecycleInput } from "./partner-lifecycle-policy"

type LifecycleDbRow = {
  partner_id: string
  accepted_at: string | null
  effective_at: string | null
  onboarding_status: string
  compliance_status: string
  listing_status: string
  directory_eligible: boolean
  performance_status: string
  probation_start_at: string | null
  probation_end_at: string | null
  transition_start_at: string | null
  last_verified_activity_at: string | null
  response_deadline_at: string | null
  review_hold_until: string | null
  extension_until: string | null
  account_status: string
  version_counter: number
  policy_version_id: string | null
  partners?: { status?: string }
}
type OutboxRow = { partner_id: string; notice_type: string; idempotency_key: string; body: string; response_deadline_at: string | null }
type EmailRow = { email?: string | null }
type ConfigValue = unknown
type PolicyConfig = { probation_days?: number; activity_threshold?: number; inactivity_reminder_days?: number; inactivity_warning_days?: number; pending_suspension_days?: number; notice_response_business_days?: number }
/* Database query rows are checked at the point where values enter policy decisions. */
export async function getPartnerLifecycle(partnerId: string) {
  if (!isSupabaseConfigured()) return null
  const [life, acts, notices, cases, version] = await Promise.all([
    supabase.from("partner_lifecycle").select("*").eq("partner_id", partnerId).maybeSingle(),
    supabase.from("partner_activities").select("id,activity_type,description,occurred_at,verification_status,verified_at,rejection_reason").eq("partner_id", partnerId).order("occurred_at", { ascending: false }).limit(30),
    supabase.from("partner_notices").select("notice_type,due_at,sent_at,delivery_status,response_deadline_at").eq("partner_id", partnerId).order("created_at", { ascending: false }).limit(20),
    supabase.from("partner_cases").select("id,case_type,status,opened_at,response_deadline_at,partner_response").eq("partner_id", partnerId).in("status", ["open", "under_review"]).order("opened_at", { ascending: false }),
    supabase.from("partner_policy_versions").select("version,config_json,effective_at").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ])
  const lifecycle = life.data ? { ...life.data, days_remaining: life.data.probation_end_at ? Math.max(0, Math.ceil((new Date(life.data.probation_end_at).getTime() - Date.now()) / 86_400_000)) : null } : null
  return { lifecycle, activities: acts.data || [], notices: notices.data || [], cases: cases.data || [], policy: version.data }
}

export async function sendPartnerLifecycleNotice(partnerId: string, noticeType: string, key: string, body: string, responseDeadlineAt?: string): Promise<boolean> {
  const { data: inserted } = await supabase.from("partner_notices").upsert({ partner_id: partnerId, notice_type: noticeType, idempotency_key: key, subject: lifecycleSubject(noticeType), body, delivery_status: "queued", response_deadline_at: responseDeadlineAt || null }, { onConflict: "idempotency_key", ignoreDuplicates: true }).select("id").maybeSingle()
  let notice = inserted
  if (!notice) {
    const { data } = await supabase.from("partner_notices").select("id,delivery_status,sent_at,attempt_count,last_attempt_at").eq("idempotency_key", key).maybeSingle()
    if (!data || data.delivery_status === "sent" || data.delivery_status === "permanent_failure") return data?.delivery_status === "sent"
    if (data.delivery_status === "sending") {
      const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString()
      if (!data.last_attempt_at || data.last_attempt_at > staleBefore) return false
      const { data: reset } = await supabase.from("partner_notices").update({ delivery_status: "queued" }).eq("id", data.id).eq("delivery_status", "sending").lte("last_attempt_at", staleBefore).select("id").maybeSingle()
      if (!reset) return false
    }
    notice = data
    if (data.delivery_status === "failed") await supabase.from("partner_notices").update({ delivery_status: "queued", response_deadline_at: responseDeadlineAt || null }).eq("id", data.id).eq("delivery_status", "failed")
  }
  const { data: claim } = await supabase.from("partner_notices").update({ delivery_status: "sending", last_attempt_at: new Date().toISOString() }).eq("id", notice.id).eq("delivery_status", "queued").select("id,attempt_count").maybeSingle()
  if (!claim) return false
  const { data: users } = await supabase.from("partner_users").select("email").eq("partner_id", partnerId).eq("status", "ACTIVE").in("role", ["PARTNER_OWNER", "PARTNER_MANAGER"])
  const recipients = Array.from(new Set(((users || []) as EmailRow[]).map((u) => String(u.email || "").trim()).filter(Boolean)))
  const deadlineText = responseDeadlineAt ? `\n\nResponse deadline: ${new Intl.DateTimeFormat("en-NG", { dateStyle: "long", timeZone: "Africa/Lagos" }).format(new Date(responseDeadlineAt))} (Africa/Lagos).` : ""
  const supportUrl = `${process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng"}/partner/support`
  let success = false
  if (recipients.length > 0) {
    try {
      success = await sendEmail({ to: recipients, subject: lifecycleSubject(noticeType), text: `${lifecycleSubject(noticeType)}\n\n${body}${deadlineText}\n\nOpen your partner dashboard: ${process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng"}/partner\nContact partner support: ${supportUrl}`, html: `<p>${escapeHtml(body)}</p>${responseDeadlineAt ? `<p><strong>Response deadline:</strong> ${escapeHtml(deadlineText.replace(/^\n\nResponse deadline: /, "").replace(".", ""))}</p>` : ""}<p><a href="${escapeHtml((process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng") + "/partner")}">Open partner portal</a> · <a href="${escapeHtml(supportUrl)}">Partner support</a></p>`, replyTo: REPLY_TO.partners })
    } catch (err) {
      console.error("[partner-lifecycle-notice] delivery failed", err)
    }
  }
  const attempts = Number(claim.attempt_count || 0) + 1
  await supabase.from("partner_notices").update({ delivery_status: success ? "sent" : attempts >= 5 ? "permanent_failure" : "failed", attempt_count: attempts, sent_at: success ? new Date().toISOString() : null }).eq("id", notice.id)
  return success
}

function lifecycleSubject(type: string): string {
  const labels: Record<string, string> = { probation_started: "Partner activation period started", probation_day_30: "Partner activation progress", probation_day_60: "Partner activation warning", probation_day_75: "Final partner activation reminder", probation_day_90: "Partner activation review required", inactivity_30: "Partner activity reminder", inactivity_60: "Partner activity warning", inactivity_90: "Partner directory listing review", suspension_confirmed: "Partner directory listing suspended", appeal_acknowledged: "Partner review response received", reinstated: "Partner directory listing restored", compliance_case_opened: "Partner compliance review" }
  return labels[type] || "Partner lifecycle update"
}

export async function runPartnerLifecycleSweep(opts: { forceDryRun?: boolean } = {}) {
  if (!isSupabaseConfigured()) return { evaluated: 0, changed: 0, notices: 0, dryRun: true, skipped: "supabase not configured" }
  const { data: settings } = await supabase.from("partner_lifecycle_settings").select("*").eq("id", true).maybeSingle()
  if (!settings?.feature_enabled) return { evaluated: 0, changed: 0, notices: 0, dryRun: true, skipped: "lifecycle feature disabled" }
  const dryRun = opts.forceDryRun === true || Boolean(settings.dry_run)
  let delivered = 0
  if (!dryRun) {
    const { data: queued } = await supabase.from("partner_notices").select("partner_id,notice_type,idempotency_key,body,response_deadline_at").in("delivery_status", ["queued", "failed"]).lte("due_at", new Date().toISOString()).limit(100)
    for (const notice of (queued || []) as OutboxRow[]) {
      if (await sendPartnerLifecycleNotice(notice.partner_id, notice.notice_type, notice.idempotency_key, notice.body, notice.response_deadline_at || undefined)) delivered++
    }
    const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString()
    const { data: stale } = await supabase.from("partner_notices").select("partner_id,notice_type,idempotency_key,body,response_deadline_at").eq("delivery_status", "sending").lte("last_attempt_at", staleBefore).limit(100)
    for (const notice of (stale || []) as OutboxRow[]) {
      if (await sendPartnerLifecycleNotice(notice.partner_id, notice.notice_type, notice.idempotency_key, notice.body, notice.response_deadline_at || undefined)) delivered++
    }
  }
  const { data: version } = await supabase.from("partner_policy_versions").select("id,version,config_json,effective_at").order("created_at", { ascending: false }).limit(1).maybeSingle()
  const { data: rows } = await supabase.from("partner_lifecycle").select("*,partners!inner(status,public_profile_enabled)").limit(1000)
  let evaluated = 0, changed = 0, notices = 0
  for (const row of (rows || []) as LifecycleDbRow[]) {
    const activitySince = row.transition_start_at || version?.effective_at || new Date().toISOString()
    const { count } = await supabase.from("partner_activities").select("id", { count: "exact", head: true }).eq("partner_id", row.partner_id).eq("verification_status", "verified").gte("occurred_at", activitySince)
    const { data: activity } = await supabase.from("partner_activities").select("occurred_at").eq("partner_id", row.partner_id).eq("verification_status", "verified").gte("occurred_at", activitySince).order("occurred_at", { ascending: false }).limit(1).maybeSingle()
    const { data: openCases } = await supabase.from("partner_cases").select("id,case_type,partner_response").eq("partner_id", row.partner_id).in("status", ["open", "under_review"])
    const { data: suspensionNotice } = await supabase.from("partner_notices").select("sent_at").eq("partner_id", row.partner_id).eq("notice_type", "inactivity_90").eq("delivery_status", "sent").order("sent_at", { ascending: false }).limit(1).maybeSingle()
    const { data: openLead } = await supabase.from("partner_leads").select("id").eq("partner_id", row.partner_id).in("status", ["REGISTERED", "UNDER_REVIEW", "QUALIFIED", "DEMO", "PROPOSAL", "NEGOTIATION"]).limit(1).maybeSingle()
    const appeal = (openCases || []).some((c) => c.case_type === "compliance_review" || Boolean(c.partner_response))
    const activityDuringResponse = Boolean(activity?.occurred_at && suspensionNotice?.sent_at && new Date(activity.occurred_at).getTime() > new Date(suspensionNotice.sent_at).getTime())
    const input: LifecycleInput = { acceptedAt: row.accepted_at, effectiveAt: row.effective_at, onboardingStatus: row.onboarding_status, complianceStatus: row.compliance_status, listingStatus: row.listing_status, directoryEligible: row.directory_eligible === true, performanceStatus: row.performance_status, probationStartAt: row.probation_start_at, probationEndAt: row.probation_end_at, transitionStartAt: row.transition_start_at, lastVerifiedActivityAt: activity?.occurred_at || null, responseDeadlineAt: row.response_deadline_at, reviewHoldUntil: row.review_hold_until, extensionUntil: row.extension_until, verifiedActivityCount: count || 0, activeAppeal: appeal, activityDuringResponse, hasOpportunityInProgress: Boolean(openLead), now: new Date() }
    const cfg = (version?.config_json || {}) as PolicyConfig
    let decision = decidePartnerLifecycle(input, { probationDays: cfg.probation_days, activityThreshold: cfg.activity_threshold, reminderDays: cfg.inactivity_reminder_days, warningDays: cfg.inactivity_warning_days, suspensionDays: cfg.pending_suspension_days, responseBusinessDays: cfg.notice_response_business_days })
    if (row.listing_status === "suspended" && row.directory_eligible === true && settings.auto_reinstate_enabled) {
      const [{ data: lastSuspension }, { data: completedReview }, { data: restrictions }] = await Promise.all([
        supabase.from("partner_status_history").select("created_at").eq("partner_id", row.partner_id).eq("new_status", "suspended").order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("partner_cases").select("id,resolved_at").eq("partner_id", row.partner_id).eq("case_type", "directory_suspension_notice").eq("status", "resolved").order("resolved_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("partner_agreements").select("id").eq("partner_id", row.partner_id).in("status", ["SUSPENDED", "TERMINATED"]).limit(1),
      ])
      const verifiedAfterSuspension = Boolean(lastSuspension && activity?.occurred_at && new Date(activity.occurred_at) > new Date(lastSuspension.created_at))
      const reviewAfterActivity = Boolean(completedReview?.resolved_at && activity?.occurred_at && new Date(completedReview.resolved_at) > new Date(activity.occurred_at))
      if (canAutomaticallyReinstate({ enabled: true, listingStatus: row.listing_status, accountStatus: row.account_status, onboardingStatus: row.onboarding_status, complianceStatus: row.compliance_status, hasNewVerifiedActivity: verifiedAfterSuspension, hasCompletedReview: reviewAfterActivity, hasOpenAppeal: appeal, hasContractualRestriction: Boolean((restrictions || []).length) })) {
        decision = { decision: "AUTO_REINSTATED", explanation: "A verified post-suspension activity and completed admin review satisfy the configured reinstatement safeguards.", listingStatus: "published", performanceStatus: "on_track" }
      }
    }
    evaluated++
    await supabase.from("partner_evaluations").insert({ partner_id: row.partner_id, policy_version_id: version?.id || row.policy_version_id, evaluation_period_start: row.transition_start_at, evaluation_period_end: new Date().toISOString(), metrics_json: { verifiedActivityCount: count || 0, lastVerifiedActivityAt: activity?.occurred_at || null, activeAppeal: appeal, hasOpportunityInProgress: Boolean(openLead) }, decision: decision.decision, explanation: decision.explanation, dry_run: dryRun, next_review_at: decision.nextReviewAt?.toISOString() || null })
    if (dryRun) continue
    if (decision.noticeType) {
      const anchor = row.probation_start_at || input.lastVerifiedActivityAt || row.transition_start_at || new Date().toISOString()
      const key = lifecycleNoticeKey(row.partner_id, decision.noticeType, anchor)
      const holidaysResult = decision.noticeType === "inactivity_90" ? await supabase.from("partner_business_holidays").select("holiday_date").gte("holiday_date", new Date().toISOString().slice(0, 10)).limit(40) : { data: [] as { holiday_date: string }[] }
      const deadline = decision.noticeType === "inactivity_90" ? addBusinessDays(new Date(), Number(cfg.notice_response_business_days || 10), ((holidaysResult.data || []) as { holiday_date: string }[]).map((h) => String(h.holiday_date))) : decision.noticeType === "probation_day_90" ? decision.nextReviewAt || null : null
      const sent = await sendPartnerLifecycleNotice(row.partner_id, decision.noticeType, key, decision.explanation, deadline?.toISOString())
      if (sent) notices++
      if (decision.noticeType === "inactivity_90" && sent) {
        const { data: moved } = await supabase.from("partner_lifecycle").update({ listing_status: "pending_suspension", performance_status: "at_risk", response_deadline_at: deadline?.toISOString(), updated_at: new Date().toISOString(), version_counter: Number(row.version_counter || 0) + 1 }).eq("partner_id", row.partner_id).eq("listing_status", row.listing_status).eq("version_counter", row.version_counter).select("partner_id").maybeSingle()
        if (moved) await supabase.from("partner_status_history").insert({ partner_id: row.partner_id, previous_status: row.listing_status, new_status: "pending_suspension", reason: decision.explanation, changed_by: null, event_type: "STATUS_CHANGE" })
        const { data: existing } = await supabase.from("partner_cases").select("id").eq("partner_id", row.partner_id).eq("case_type", "directory_suspension_notice").in("status", ["open", "under_review"]).limit(1)
        if (!(existing || []).length) await supabase.from("partner_cases").insert({ partner_id: row.partner_id, case_type: "directory_suspension_notice", idempotency_key: `suspension-review:${row.partner_id}:${key}`, opening_reason: decision.explanation, response_deadline_at: deadline?.toISOString() || null })
        if (moved) changed++
      }
      if (decision.noticeType === "probation_day_90" && sent) {
        const { data: existing } = await supabase.from("partner_cases").select("id").eq("partner_id", row.partner_id).eq("case_type", "probation_review").in("status", ["open", "under_review"]).limit(1)
        if (!(existing || []).length) await supabase.from("partner_cases").insert({ partner_id: row.partner_id, case_type: "probation_review", idempotency_key: `probation-review:${row.partner_id}:${row.probation_start_at || "unstarted"}`, response_deadline_at: decision.nextReviewAt?.toISOString() || null })
      }
    }
    const patch: Record<string, ConfigValue> = { updated_at: new Date().toISOString(), version_counter: Number(row.version_counter || 0) + 1 }
    if (decision.performanceStatus) patch.performance_status = decision.performanceStatus
    if (decision.listingStatus && decision.decision !== "SUSPENSION_DUE") patch.listing_status = decision.listingStatus
    // Directory enforcement is deliberately an independent, explicit rollout flag.
    if (decision.decision === "SUSPENSION_DUE" && settings.auto_suspension_enabled) {
      patch.listing_status = "suspended"
      patch.updated_at = new Date().toISOString()
    } else if (decision.decision === "SUSPENSION_DUE") continue
    const shouldUpdate = (Boolean(decision.performanceStatus) && decision.performanceStatus !== row.performance_status) || (Boolean(patch.listing_status) && patch.listing_status !== row.listing_status)
    if (shouldUpdate) {
      const { error } = await supabase.from("partner_lifecycle").update(patch).eq("partner_id", row.partner_id).eq("version_counter", row.version_counter)
      if (!error) {
        if (patch.listing_status && patch.listing_status !== row.listing_status) {
          const visible = typeof patch.listing_status === "string" && ["published", "pending_suspension"].includes(patch.listing_status)
          await supabase.from("partners").update({ public_profile_enabled: visible && row.partners?.status === "ACTIVE" }).eq("id", row.partner_id)
          await supabase.from("partner_status_history").insert({ partner_id: row.partner_id, previous_status: row.listing_status, new_status: patch.listing_status, reason: decision.explanation, changed_by: null, event_type: "STATUS_CHANGE" })
          if (patch.listing_status === "suspended") await sendPartnerLifecycleNotice(row.partner_id, "suspension_confirmed", `partner-lifecycle:${row.partner_id}:suspended:${new Date().toISOString().slice(0, 10)}`, decision.explanation)
          if (decision.decision === "AUTO_REINSTATED") await sendPartnerLifecycleNotice(row.partner_id, "reinstated", `partner-lifecycle:${row.partner_id}:reinstated:${new Date().toISOString().slice(0, 10)}`, decision.explanation)
        }
        changed++
      }
    }
  }
  return { evaluated, changed, notices: notices + delivered, dryRun }
}
