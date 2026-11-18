import crypto from "node:crypto"
import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { canOfferGrowthAward, hashOfferToken } from "@/lib/business-growth-programme"
import { sendEmail, REPLY_TO } from "@/lib/email"
import { notifyAllAdmins } from "@/lib/admin-notifications"

export const dynamic = "force-dynamic"
type Context = { params: Promise<{ id: string }> }

const actionSchema = z.object({
  action: z.enum(["shortlist", "ready", "ineligible", "needs_clarification", "withdraw", "retry_assessment", "waitlist", "not_selected", "offer"]),
  reason: z.string().trim().min(5).max(1500),
  clarificationQuestions: z.array(z.string().trim().min(4).max(400)).max(8).optional(),
})

function safeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c)
}

async function notifyApplicant(to: string, subject: string, text: string) {
  const result = await sendEmail({ to, subject, text, html: `<p>${safeHtml(text).replace(/\n/g, "<br>")}</p>`, route: "business_growth_programme", replyTo: REPLY_TO.noreply })
  return result
}

export async function PATCH(request: Request, context: Context) {
  const { session, denied } = await authorizeAdmin("business_growth.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: "An action and reason are required." }, { status: 400 })
  const { id } = await context.params
  const { data: app } = await supabase.from("business_growth_applications").select("*, business_growth_programmes(*)").eq("id", id).maybeSingle()
  if (!app) return NextResponse.json({ error: "Application not found" }, { status: 404 })
  const programme = app.business_growth_programmes as Record<string, unknown>
  const latest = await supabase.from("business_growth_assessments").select("*").eq("application_id", id).order("version", { ascending: false }).limit(1).maybeSingle()
  const { action, reason } = parsed.data
  const now = new Date().toISOString()

  if (action === "shortlist") {
    if (app.assessment_status !== "COMPLETED") return NextResponse.json({ error: "Wait for a completed AI assessment before shortlisting." }, { status: 409 })
    if (!(["READY", "NEEDS_CLARIFICATION", "SHORTLISTED"].includes(String(app.application_status))) || ["COMPLETED", "ARCHIVED"].includes(String(programme.status))) return NextResponse.json({ error: "This application is not in a reviewable programme state." }, { status: 409 })
    if ((latest.data?.eligibility_flags as unknown[] | undefined)?.length && !reason.trim()) return NextResponse.json({ error: "A reason is required to override assessment flags." }, { status: 400 })
    await supabase.from("business_growth_applications").update({ application_status: "SHORTLISTED", updated_at: now }).eq("id", id)
    await supabase.from("business_growth_jobs").insert({ programme_id: app.programme_id, application_id: id, job_type: "SEND_NOTIFICATION", dedupe_key: `shortlisted:${id}:${now.slice(0, 10)}`, payload: { template: "SHORTLISTED" } })
  } else if (action === "ready") {
    if (app.assessment_status !== "COMPLETED") return NextResponse.json({ error: "A completed assessment is required before marking this application ready." }, { status: 409 })
    if (["WITHDRAWN", "INELIGIBLE"].includes(String(app.application_status))) return NextResponse.json({ error: "A withdrawn or ineligible application cannot be moved back to review." }, { status: 409 })
    await supabase.from("business_growth_applications").update({ application_status: "READY", updated_at: now }).eq("id", id)
    await supabase.from("business_growth_jobs").insert({ programme_id: app.programme_id, application_id: id, job_type: "SEND_NOTIFICATION", dedupe_key: `ready:${id}:${now.slice(0, 10)}`, payload: { template: "READY" } })
  } else if (action === "ineligible") {
    const { data: currentAward } = await supabase.from("business_growth_awards").select("id,status").eq("application_id", id).maybeSingle()
    if (currentAward && ["OFFERED", "ACCEPTED", "ACTIVATED"].includes(currentAward.status)) return NextResponse.json({ error: "An offered or active place cannot be overwritten." }, { status: 409 })
    if (["WITHDRAWN", "INELIGIBLE"].includes(String(app.application_status))) return NextResponse.json({ error: "This application already has a final review state." }, { status: 409 })
    await supabase.from("business_growth_applications").update({ application_status: "INELIGIBLE", clarification_token_hash: null, updated_at: now }).eq("id", id)
    const { error } = await supabase.from("business_growth_awards").upsert({ programme_id: app.programme_id, application_id: id, status: "NOT_SELECTED", fulfilment_status: "NOT_STARTED", created_by: session!.userId, updated_at: now }, { onConflict: "application_id" })
    if (error) return NextResponse.json({ error: "Could not save the application outcome." }, { status: 500 })
    await supabase.from("business_growth_jobs").insert({ programme_id: app.programme_id, application_id: id, job_type: "SEND_NOTIFICATION", dedupe_key: `ineligible:${id}:${now.slice(0, 10)}`, payload: { template: "INELIGIBLE" } })
  } else if (action === "retry_assessment") {
    if (app.assessment_status === "COMPLETED") return NextResponse.json({ error: "This application already has a completed assessment." }, { status: 409 })
    if (["WITHDRAWN", "INELIGIBLE"].includes(String(app.application_status))) return NextResponse.json({ error: "A withdrawn or ineligible application cannot be reassessed." }, { status: 409 })
    await supabase.from("business_growth_applications").update({ assessment_status: "QUEUED", updated_at: now }).eq("id", id)
    await supabase.from("business_growth_jobs").insert({ programme_id: app.programme_id, application_id: id, job_type: "ASSESS_APPLICATION", dedupe_key: `admin-assess:${id}:${crypto.randomUUID()}`, payload: { requested_by: session!.userId } })
  } else if (action === "needs_clarification") {
    if (["COMPLETED", "ARCHIVED"].includes(String(programme.status))) return NextResponse.json({ error: "Clarification cannot be requested after programme outcomes are final." }, { status: 409 })
    const { data: currentAward } = await supabase.from("business_growth_awards").select("status").eq("application_id", id).maybeSingle()
    if (["WITHDRAWN", "INELIGIBLE"].includes(String(app.application_status)) || (currentAward && ["OFFERED", "ACCEPTED", "ACTIVATED"].includes(currentAward.status))) return NextResponse.json({ error: "Clarification cannot replace a final or offered decision." }, { status: 409 })
    const questions = parsed.data.clarificationQuestions || []
    if (!questions.length) return NextResponse.json({ error: "Add at least one question for the applicant." }, { status: 400 })
    const token = crypto.randomBytes(32).toString("base64url")
    const tokenHash = hashOfferToken(token)
    const expiresAt = new Date(Date.now() + 7 * 86400_000).toISOString()
    const { error } = await supabase.from("business_growth_applications").update({ application_status: "NEEDS_CLARIFICATION", clarification_token_hash: tokenHash, clarification_expires_at: expiresAt, updated_at: now }).eq("id", id)
    if (error) return NextResponse.json({ error: "Could not prepare clarification request." }, { status: 500 })
    const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng").replace(/\/$/, "")
    const text = `Thank you for applying to ${programme.name}. Please answer these questions by ${new Date(expiresAt).toLocaleDateString("en-NG")}:\n\n${questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}\n\nSecure update link: ${base}/programmes/clarification/${token}\nThis request does not confirm selection.`
    const sent = await notifyApplicant(String(app.email), `More information needed for ${app.business_name}'s application`, text)
    await supabase.from("business_growth_events").insert({ programme_id: app.programme_id, application_id: id, actor_admin_user_id: session!.userId, event_type: "CLARIFICATION_REQUESTED", reason, details: { questions, expires_at: expiresAt, email_sent: sent } })
    if (!sent) await notifyAllAdmins({ type: "BUSINESS_GROWTH_EMAIL_FAILED", title: "Programme clarification email failed", message: `Application ${app.reference} needs a clarification message sent manually.`, deep_link: `/admin/programmes/${app.programme_id}`, source_type: "BUSINESS_GROWTH_APPLICATION", source_id: id })
    return NextResponse.json({ success: true, emailSent: sent })
  } else if (action === "withdraw") {
    const { data: currentAward } = await supabase.from("business_growth_awards").select("status").eq("application_id", id).maybeSingle()
    if (currentAward && ["OFFERED", "ACCEPTED", "ACTIVATED"].includes(currentAward.status)) return NextResponse.json({ error: "An offered or active place cannot be withdrawn from the admin review." }, { status: 409 })
    await supabase.from("business_growth_applications").update({ application_status: "WITHDRAWN", clarification_token_hash: null, updated_at: now }).eq("id", id)
  } else if (action === "offer") {
    if (!canOfferGrowthAward(String(programme.status), String(app.application_status), String(app.assessment_status))) return NextResponse.json({ error: "Only shortlisted applications with a completed assessment can receive an offer after the application window closes." }, { status: 409 })
    const { data: existingAward } = await supabase.from("business_growth_awards").select("id,status").eq("application_id", id).maybeSingle()
    const acceptanceToken = crypto.randomBytes(32).toString("base64url")
    const expiresAt = new Date(Date.now() + Number(programme.offer_acceptance_days || 7) * 86400_000).toISOString()
    let awardId = existingAward?.id as string | undefined
    if (existingAward && existingAward.status === "OFFERED") {
      const { error } = await supabase.from("business_growth_awards").update({ acceptance_token_hash: hashOfferToken(acceptanceToken), offer_expires_at: expiresAt, updated_at: now }).eq("id", existingAward.id)
      if (error) return NextResponse.json({ error: "Could not renew the offer link." }, { status: 500 })
      await supabase.from("business_growth_jobs").update({ run_after: expiresAt, status: "QUEUED", attempts: 0, last_error: null, updated_at: now }).eq("dedupe_key", `expire:${existingAward.id}`)
    } else {
      if (existingAward) return NextResponse.json({ error: "This application already has an award decision." }, { status: 409 })
      const { data, error } = await supabase.rpc("reserve_business_growth_award", { p_programme_id: app.programme_id, p_application_id: id, p_token_hash: hashOfferToken(acceptanceToken), p_expires_at: expiresAt, p_actor: session!.userId })
      if (error || !data) return NextResponse.json({ error: error?.message.includes("AWARD_LIMIT") ? "All sponsored places are already offered or active." : "The offer could not be reserved. Confirm the programme is closed and the applicant is shortlisted." }, { status: 409 })
      awardId = data as string
    }
    const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng").replace(/\/$/, "")
    const url = `${base}/programme-offer/${encodeURIComponent(acceptanceToken)}`
    const text = `We’re pleased to offer ${app.business_name} a sponsored MartPoint Basic licence for one store for ${programme.sponsored_duration_months} months. Please review and accept by ${new Date(expiresAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}: ${url}\n\n${programme.onboarding_scope}\n\nHardware and custom development are excluded. Optional messaging credits and payment processing charges are separate. Renewal is optional and no future charge is authorised.`
    const sent = await notifyApplicant(String(app.email), `${app.business_name} has an offer for a sponsored MartPoint licence`, text)
    if (!sent) await notifyAllAdmins({ type: "BUSINESS_GROWTH_EMAIL_FAILED", title: "Programme offer email failed", message: `The offer for ${app.business_name} was reserved, but its email could not be sent. Use the resend action in the programme detail.`, deep_link: `/admin/programmes/${app.programme_id}`, source_type: "BUSINESS_GROWTH_AWARD", source_id: awardId })
    await supabase.from("business_growth_events").insert({ programme_id: app.programme_id, application_id: id, award_id: awardId, actor_admin_user_id: session!.userId, event_type: sent ? "AWARD_OFFER_SENT" : "AWARD_OFFER_EMAIL_FAILED", reason, details: { expires_at: expiresAt } })
    return NextResponse.json({ success: true, awardId, emailSent: sent })
  } else {
    const status = action === "waitlist" ? "WAITLISTED" : "NOT_SELECTED"
    if (!["CLOSED", "REVIEWING", "COMPLETED"].includes(String(programme.status))) return NextResponse.json({ error: "Close the application window before recording a final outcome." }, { status: 409 })
    if (["WITHDRAWN", "INELIGIBLE"].includes(String(app.application_status))) return NextResponse.json({ error: "This application already has a final review state." }, { status: 409 })
    const { data: existingAward } = await supabase.from("business_growth_awards").select("id,status").eq("application_id", id).maybeSingle()
    if (existingAward && ["OFFERED", "ACCEPTED", "ACTIVATED"].includes(existingAward.status)) return NextResponse.json({ error: "An offered or active place cannot be overwritten." }, { status: 409 })
    const { error } = await supabase.from("business_growth_awards").upsert({ programme_id: app.programme_id, application_id: id, status, fulfilment_status: "NOT_STARTED", created_by: session!.userId, updated_at: now }, { onConflict: "application_id" })
    if (error) return NextResponse.json({ error: "Could not save the award decision." }, { status: 500 })
    await supabase.from("business_growth_jobs").insert({ programme_id: app.programme_id, application_id: id, job_type: "SEND_NOTIFICATION", dedupe_key: `${status.toLowerCase()}:${id}:${now.slice(0, 10)}`, payload: { template: status } })
  }

  await supabase.from("business_growth_events").insert({ programme_id: app.programme_id, application_id: id, actor_admin_user_id: session!.userId, event_type: `APPLICATION_${action.toUpperCase()}`, reason, details: {} })
  return NextResponse.json({ success: true })
}
