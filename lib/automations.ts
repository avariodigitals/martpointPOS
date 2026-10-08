/* ───────────────────────────  Automation engine (server-only)  ───────────────────────────
 * A deliberately small trigger → delay → action engine so sales/admin can build
 * follow-up sequences (questionnaire nudges, quote reminders, win-backs) without
 * shipping new cron code for each one.
 *
 * Model (see migration 080):
 *   automations       — definition: trigger + delay + action template + caps
 *   automation_runs   — one live occurrence per subject, with a due `scheduled_for`
 *   automation_events — append-only log of every fire/send/skip
 *
 * Flow:
 *   1. Something happens (questionnaire sent, quote sent) → `enqueueAutomation()`.
 *   2. The cron `/api/cron/reminders` calls `runAutomationSweep()`, which picks
 *      due, pending runs and executes each one's action.
 *   3. After a successful send, the run is rescheduled (+interval) until it hits
 *      `max_steps`, then marked `sent` (complete).
 *   4. Any cancellation (submitted / accepted) → `cancelAutomationRuns()`.
 *
 * All sends are customer-facing; no internal `route` is used, so the recipient
 * is always the lead. Marketing email gets a List-Unsubscribe header.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { sendEmail, REPLY_TO } from "./email"
import { renderEmailTemplate } from "./email-templates"
import { getBaseUrl, getSuppressedEmails } from "./marketing"
import { getPublicSiteSettings } from "./settings"
import { buildQuotePublicUrl } from "./quotations"
import { formatMoney } from "./money-format"

/** Build the public questionnaire URL. Inlined to avoid a circular import with
 *  lib/lead-questionnaire.ts (which imports this module to enqueue reminders). */
function questionnaireUrl(token: string): string {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng").replace(/\/$/, "")
  return `${base}/questionnaire/${token}`
}

export type AutomationTrigger =
  | "questionnaire.sent"
  | "quote.sent"
  | "estimate.sent"
  | "lead.created"
  | "meeting.no_show"
  | "manual"

export type AutomationSubjectType = "lead" | "quotation" | "estimate"

export interface Automation {
  id: string
  key: string
  name: string
  description: string | null
  trigger: AutomationTrigger
  subjectType: AutomationSubjectType
  delayMinutes: number
  intervalMinutes: number
  maxSteps: number
  actionTemplate: string
  conditions: Record<string, unknown>
  enabled: boolean
}

export interface AutomationRun {
  id: string
  automationId: string
  subjectType: AutomationSubjectType
  subjectId: string
  recipientEmail: string | null
  status: "pending" | "sent" | "skipped" | "failed" | "cancelled"
  step: number
  scheduledFor: string
  lastSentAt: string | null
  attempts: number
}

const MAX_ATTEMPTS = 3

export type NextRunState =
  | { action: "complete"; status: "sent" }
  | { action: "reschedule"; step: number; scheduledFor: string }
  | { action: "retry"; attempts: number; scheduledFor: string }
  | { action: "fail"; attempts: number }

/**
 * Pure decision for what to do with a run after an execution attempt.
 * Kept separate so the cadence logic is unit-testable without a database.
 */
export function decideNextRunState(input: {
  sent: boolean
  done?: boolean
  currentStep: number
  maxSteps: number
  intervalMinutes: number
  attempts: number
  maxAttempts?: number
  now?: number
  retryBackoffMinutes?: number
}): NextRunState {
  const maxAttempts = input.maxAttempts ?? MAX_ATTEMPTS
  const now = input.now ?? Date.now()

  if (input.sent) {
    if (input.currentStep >= input.maxSteps) {
      return { action: "complete", status: "sent" }
    }
    return {
      action: "reschedule",
      step: input.currentStep + 1,
      scheduledFor: new Date(now + input.intervalMinutes * 60_000).toISOString(),
    }
  }

  // Goal met / no longer applicable — stop quietly (handled by caller as cancel).
  if (input.done) return { action: "fail", attempts: input.attempts }

  const attempts = input.attempts + 1
  if (attempts >= maxAttempts) return { action: "fail", attempts }
  const backoff = input.retryBackoffMinutes ?? 30
  return { action: "retry", attempts, scheduledFor: new Date(now + backoff * 60_000).toISOString() }
}

function mapAutomation(row: Record<string, unknown>): Automation {
  return {
    id: row.id as string,
    key: row.key as string,
    name: row.name as string,
    description: (row.description as string) ?? null,
    trigger: row.trigger as AutomationTrigger,
    subjectType: row.subject_type as AutomationSubjectType,
    delayMinutes: Number(row.delay_minutes ?? 2880),
    intervalMinutes: Number(row.interval_minutes ?? 2880),
    maxSteps: Number(row.max_steps ?? 3),
    actionTemplate: row.action_template as string,
    conditions: (row.conditions as Record<string, unknown>) ?? {},
    enabled: row.enabled !== false,
  }
}

function mapRun(row: Record<string, unknown>): AutomationRun {
  return {
    id: row.id as string,
    automationId: row.automation_id as string,
    subjectType: row.subject_type as AutomationSubjectType,
    subjectId: row.subject_id as string,
    recipientEmail: (row.recipient_email as string) ?? null,
    status: row.status as AutomationRun["status"],
    step: Number(row.step ?? 1),
    scheduledFor: row.scheduled_for as string,
    lastSentAt: (row.last_sent_at as string) ?? null,
    attempts: Number(row.attempts ?? 0),
  }
}

async function logEvent(
  event: string,
  opts: {
    automationId?: string | null
    runId?: string | null
    subjectType?: string | null
    subjectId?: string | null
    detail?: Record<string, unknown>
  } = {},
): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    await supabase.from("automation_events").insert({
      automation_id: opts.automationId ?? null,
      run_id: opts.runId ?? null,
      event,
      subject_type: opts.subjectType ?? null,
      subject_id: opts.subjectId ?? null,
      detail: opts.detail ?? {},
    })
  } catch (err) {
    console.error("[automations] event log failed:", err)
  }
}

export async function getAutomationByKey(key: string): Promise<Automation | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase.from("automations").select("*").eq("key", key).maybeSingle()
  return data ? mapAutomation(data as Record<string, unknown>) : null
}

export interface EnqueueInput {
  automationKey: string
  subjectType: AutomationSubjectType
  subjectId: string
  recipientEmail?: string | null
}

/**
 * Schedule (or refresh) the first run for a subject. Idempotent per
 * (automation, subject) — a subject can only have one live run at a time.
 */
export async function enqueueAutomation(input: EnqueueInput): Promise<{ ok: boolean; runId?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const automation = await getAutomationByKey(input.automationKey)
  if (!automation) return { ok: false, error: `Unknown automation: ${input.automationKey}` }
  if (!automation.enabled) return { ok: false, error: "Automation disabled" }

  const now = Date.now()
  const scheduledFor = new Date(now + automation.delayMinutes * 60_000).toISOString()

  // Upsert by the unique (automation_id, subject_type, subject_id) constraint:
  // re-sending a questionnaire/quote restarts the clock and clears a cancelled run.
  const { data, error } = await supabase
    .from("automation_runs")
    .upsert(
      {
        automation_id: automation.id,
        subject_type: input.subjectType,
        subject_id: input.subjectId,
        recipient_email: input.recipientEmail ?? null,
        status: "pending",
        step: 1,
        scheduled_for: scheduledFor,
        last_sent_at: null,
        attempts: 0,
        last_error: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "automation_id,subject_type,subject_id" },
    )
    .select("id")
    .single()

  if (error || !data) {
    console.error("[automations] enqueue failed:", error?.message)
    return { ok: false, error: "Failed to schedule reminder" }
  }

  await logEvent("run.scheduled", {
    automationId: automation.id,
    runId: data.id as string,
    subjectType: input.subjectType,
    subjectId: input.subjectId,
    detail: { scheduledFor, step: 1 },
  })

  return { ok: true, runId: data.id as string }
}

/** Cancel any live run for a subject — call when the goal is achieved. */
export async function cancelAutomationRuns(
  subjectType: AutomationSubjectType,
  subjectId: string,
  reason = "goal_achieved",
): Promise<number> {
  if (!isSupabaseConfigured()) return 0
  const { data, error } = await supabase
    .from("automation_runs")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("subject_type", subjectType)
    .eq("subject_id", subjectId)
    .eq("status", "pending")
    .select("id")

  if (error) {
    console.error("[automations] cancel failed:", error.message)
    return 0
  }
  const count = data?.length ?? 0
  if (count > 0) {
    for (const r of data || []) {
      await logEvent("run.cancelled", { runId: r.id as string, subjectType, subjectId, detail: { reason } })
    }
  }
  return count
}

/* ───────────────────────────  Action executors  ─────────────────────────── */

interface ActionContext {
  automation: Automation
  run: AutomationRun
}

interface ActionResult {
  sent: boolean
  error?: string
  /** Skip re-scheduling (goal met / no longer applicable). */
  done?: boolean
}

function unsubscribeHeaders(subjectId: string): Record<string, string> {
  const base = getBaseUrl()
  return {
    "List-Unsubscribe": `<${base}/unsubscribe?type=reminder&id=${encodeURIComponent(subjectId)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  }
}

/** Remove any globally suppressed addresses (opt-outs) from a recipient list. */
async function filterSuppressed(recipients: string[]): Promise<string[]> {
  if (recipients.length === 0) return recipients
  try {
    const suppressed = await getSuppressedEmails(recipients)
    return recipients.filter((e) => !suppressed.has(e.trim().toLowerCase()))
  } catch (err) {
    console.error("[automations] suppression check failed:", err)
    // Fail-open on error so a lookup failure doesn't block legitimate reminders.
    return recipients
  }
}

/** Questionnaire reminder — lead who has not submitted the questionnaire. */
async function actionQuestionnaireReminder(ctx: ActionContext): Promise<ActionResult> {
  const { data: lead } = await supabase
    .from("leads")
    .select("id, full_name, business_name, email, additional_email, questionnaire_token, questionnaire_status, reminders_paused")
    .eq("id", ctx.run.subjectId)
    .maybeSingle()

  if (!lead) return { sent: false, done: true, error: "Lead not found" }
  if (lead.reminders_paused) return { sent: false, done: true, error: "Paused" }
  // Goal met — questionnaire already submitted/reviewed.
  if (["Submitted", "Reviewed"].includes(String(lead.questionnaire_status))) {
    return { sent: false, done: true, error: "Questionnaire already submitted" }
  }
  if (!lead.questionnaire_token) return { sent: false, done: true, error: "No questionnaire token" }

  const recipients = await filterSuppressed(
    [...new Set([lead.email, lead.additional_email].filter((x): x is string => Boolean(x)))],
  )
  if (recipients.length === 0) return { sent: false, done: true, error: "No email (or suppressed)" }

  const url = questionnaireUrl(lead.questionnaire_token as string)
  const tpl = await renderEmailTemplate("lead_questionnaire_reminder", {
    fullName: (lead.full_name as string) || "there",
    businessName: (lead.business_name as string) || "your business",
    questionnaireLink: url,
  })

  const sent = await sendEmail({
    to: recipients,
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
    replyTo: REPLY_TO.sales,
    headers: unsubscribeHeaders(ctx.run.subjectId),
  })

  if (sent) {
    await supabase
      .from("leads")
      .update({
        reminder_count: Number((lead as { reminder_count?: number }).reminder_count || 0) + 1,
        last_reminder_at: new Date().toISOString(),
      })
      .eq("id", ctx.run.subjectId)
  }

  return { sent, error: sent ? undefined : "Delivery failed" }
}

/** Quote reminder — lead who has not accepted/declined a quotation. */
async function actionQuoteReminder(ctx: ActionContext): Promise<ActionResult> {
  const { data: quote } = await supabase
    .from("lead_quotations")
    .select("id, quote_number, title, total_amount, valid_until, public_token, token_expires_at, status, reminders_paused, reminder_count, lead:leads (full_name, business_name, email, additional_email)")
    .eq("id", ctx.run.subjectId)
    .maybeSingle()

  if (!quote) return { sent: false, done: true, error: "Quotation not found" }
  if (quote.reminders_paused) return { sent: false, done: true, error: "Paused" }
  if (quote.status !== "SENT") return { sent: false, done: true, error: `Quote is ${quote.status}` }
  if (quote.token_expires_at && new Date(quote.token_expires_at as string) < new Date()) {
    return { sent: false, done: true, error: "Quote link expired" }
  }

  const leadRaw = quote.lead as Record<string, unknown> | Record<string, unknown>[] | null
  const lead = Array.isArray(leadRaw) ? leadRaw[0] : leadRaw
  const recipients = await filterSuppressed(
    [...new Set([lead?.email, lead?.additional_email].filter((x): x is string => Boolean(x)))],
  )
  if (recipients.length === 0) return { sent: false, done: true, error: "No email (or suppressed)" }

  const url = buildQuotePublicUrl(quote.public_token as string)
  const validUntil = quote.valid_until
    ? new Date(quote.valid_until as string).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })
    : "Not specified"

  const tpl = await renderEmailTemplate("lead_quote_reminder", {
    fullName: (lead?.full_name as string) || "there",
    businessName: (lead?.business_name as string) || "your business",
    quoteNumber: quote.quote_number as string,
    title: quote.title ? ` — ${quote.title}` : "",
    total: formatMoney(Number(quote.total_amount) || 0, "NGN"),
    validUntil,
    quoteLink: url,
  })

  const sent = await sendEmail({
    to: recipients,
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
    replyTo: REPLY_TO.sales,
    headers: unsubscribeHeaders(ctx.run.subjectId),
  })

  if (sent) {
    await supabase
      .from("lead_quotations")
      .update({
        reminder_count: Number(quote.reminder_count || 0) + 1,
        last_reminder_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", ctx.run.subjectId)
  }

  return { sent, error: sent ? undefined : "Delivery failed" }
}

/** Estimate follow-up — visitor who received a cost estimate but has no quote yet. */
async function actionEstimateFollowup(ctx: ActionContext): Promise<ActionResult> {
  // subject_id is the lead id (the estimate is stored on the lead record).
  const { data: lead } = await supabase
    .from("leads")
    .select("id, full_name, business_name, email, additional_email, estimate, reminders_paused")
    .eq("id", ctx.run.subjectId)
    .maybeSingle()

  if (!lead) return { sent: false, done: true, error: "Lead not found" }
  if (lead.reminders_paused) return { sent: false, done: true, error: "Paused" }
  if (!lead.estimate) return { sent: false, done: true, error: "No estimate on record" }

  // Goal met — a quote already exists for this lead, or the lead became a business.
  const [{ data: quote }, { data: business }] = await Promise.all([
    supabase.from("lead_quotations").select("id").eq("lead_id", ctx.run.subjectId).limit(1).maybeSingle(),
    supabase.from("businesses").select("id").eq("source_lead_id", ctx.run.subjectId).limit(1).maybeSingle(),
  ])
  if (quote || business) return { sent: false, done: true, error: "Quote or business already exists" }

  const recipients = await filterSuppressed(
    [...new Set([lead.email, lead.additional_email].filter((x): x is string => Boolean(x)))],
  )
  if (recipients.length === 0) return { sent: false, done: true, error: "No email (or suppressed)" }

  const est = lead.estimate as { retail?: { planName?: string; range?: string }; erp?: { planName?: string; range?: string } } | null
  const retailPlan = est?.retail?.planName || "MartPoint Retail Cloud"
  const retailRange = est?.retail?.range || ""

  // Give the visitor three easy ways to move forward: refine/re-run the estimate,
  // chat on WhatsApp, or book a call. WhatsApp + booking are the highest-intent.
  const estimateLink = `${getBaseUrl()}/estimate`
  const bookCallLink = `${getBaseUrl()}/book-demo`

  const { whatsappNumber } = await getPublicSiteSettings()
  const waText = `Hi MartPoint, I got my cost estimate for ${lead.business_name || "my business"} and I'd like to turn it into a quote.`
  const waDigits = (whatsappNumber || "").replace(/[^\d]/g, "")
  const whatsappLink = waDigits ? `https://wa.me/${waDigits}?text=${encodeURIComponent(waText)}` : ""

  const tpl = await renderEmailTemplate("lead_estimate_followup", {
    fullName: (lead.full_name as string) || "there",
    businessName: (lead.business_name as string) || "your business",
    retailPlan,
    retailRange,
    erpBlock: est?.erp
      ? `<p style="font-size:13px; color:#6b7280; margin:12px 0 4px;">ERP interest</p><p style="font-size:15px; font-weight:600; color:#111827; margin:0;">${est.erp.planName || "MartPoint ERP"}${est.erp.range ? ` — ${est.erp.range}` : ""}</p>`
      : "",
    quoteLink: estimateLink,
    whatsappBlock: whatsappLink
      ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 12px;"><tr><td style="border-radius:8px; background-color:#25D366; text-align:center;"><a href="${whatsappLink}" target="_blank" style="display:inline-block; padding:13px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Chat on WhatsApp</a></td></tr></table>`
      : "",
    bookCallLink,
  })

  const sent = await sendEmail({
    to: recipients,
    subject: tpl.subject,
    text: tpl.text,
    html: tpl.html,
    replyTo: REPLY_TO.sales,
    headers: unsubscribeHeaders(ctx.run.subjectId),
  })

  if (sent) {
    await supabase
      .from("leads")
      .update({
        reminder_count: Number((lead as { reminder_count?: number }).reminder_count || 0) + 1,
        last_reminder_at: new Date().toISOString(),
      })
      .eq("id", ctx.run.subjectId)
  }

  return { sent, error: sent ? undefined : "Delivery failed" }
}

async function executeAction(ctx: ActionContext): Promise<ActionResult> {
  switch (ctx.automation.actionTemplate) {
    case "lead_questionnaire_reminder":
      return actionQuestionnaireReminder(ctx)
    case "lead_quote_reminder":
      return actionQuoteReminder(ctx)
    case "lead_estimate_followup":
      return actionEstimateFollowup(ctx)
    default:
      return { sent: false, done: true, error: `No executor for template ${ctx.automation.actionTemplate}` }
  }
}

/* ───────────────────────────  Sweep  ─────────────────────────── */

export interface AutomationSweepResult {
  processed: number
  sent: number
  failed: number
  completed: number
  skipped: number
}

/**
 * Pick up due, pending runs and execute them. Called by /api/cron/reminders.
 * Each successful send reschedules the next step until `max_steps` is reached.
 */
export async function runAutomationSweep(limit = 100): Promise<AutomationSweepResult> {
  const result: AutomationSweepResult = { processed: 0, sent: 0, failed: 0, completed: 0, skipped: 0 }
  if (!isSupabaseConfigured()) return result

  const nowIso = new Date().toISOString()
  const { data: runRows, error } = await supabase
    .from("automation_runs")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_for", nowIso)
    .order("scheduled_for", { ascending: true })
    .limit(limit)

  if (error) {
    console.error("[automations] sweep query failed:", error.message)
    return result
  }
  if (!runRows || runRows.length === 0) return result

  // Load the automations referenced by these runs in one query.
  const automationIds = [...new Set(runRows.map((r) => r.automation_id as string))]
  const { data: automationsData } = await supabase.from("automations").select("*").in("id", automationIds)
  const automations = new Map<string, Automation>(
    (automationsData || []).map((a) => [a.id as string, mapAutomation(a as Record<string, unknown>)]),
  )

  for (const row of runRows) {
    const run = mapRun(row as Record<string, unknown>)
    const automation = automations.get(run.automationId)
    result.processed++

    if (!automation || !automation.enabled) {
      await supabase.from("automation_runs").update({ status: "cancelled", updated_at: nowIso }).eq("id", run.id)
      await logEvent("run.cancelled", { runId: run.id, subjectType: run.subjectType, subjectId: run.subjectId, detail: { reason: "automation_missing_or_disabled" } })
      result.skipped++
      continue
    }

    let action: ActionResult
    try {
      action = await executeAction({ automation, run })
    } catch (err) {
      action = { sent: false, error: err instanceof Error ? err.message : "executor threw" }
    }

    if (action.sent) {
      await logEvent("run.sent", {
        automationId: run.automationId,
        runId: run.id,
        subjectType: run.subjectType,
        subjectId: run.subjectId,
        detail: { step: run.step },
      })
      result.sent++

      const next = decideNextRunState({
        sent: true,
        currentStep: run.step,
        maxSteps: automation.maxSteps,
        intervalMinutes: automation.intervalMinutes,
        attempts: run.attempts,
      })

      if (next.action === "complete") {
        await supabase
          .from("automation_runs")
          .update({ status: "sent", step: run.step, last_sent_at: nowIso, updated_at: nowIso })
          .eq("id", run.id)
        result.completed++
      } else if (next.action === "reschedule") {
        await supabase
          .from("automation_runs")
          .update({
            step: next.step,
            scheduled_for: next.scheduledFor,
            last_sent_at: nowIso,
            updated_at: nowIso,
          })
          .eq("id", run.id)
      }
      continue
    }

    // Not sent. If the goal is met / no longer applicable, stop quietly.
    if (action.done) {
      await supabase
        .from("automation_runs")
        .update({ status: "cancelled", last_error: action.error ?? "no longer applicable", updated_at: nowIso })
        .eq("id", run.id)
      await logEvent("run.cancelled", {
        automationId: run.automationId,
        runId: run.id,
        subjectType: run.subjectType,
        subjectId: run.subjectId,
        detail: { reason: action.error ?? "no longer applicable" },
      })
      result.skipped++
      continue
    }

    // Delivery failure — retry with backoff up to MAX_ATTEMPTS, then fail.
    const next = decideNextRunState({
      sent: false,
      currentStep: run.step,
      maxSteps: automation.maxSteps,
      intervalMinutes: automation.intervalMinutes,
      attempts: run.attempts,
    })

    if (next.action === "fail") {
      await supabase
        .from("automation_runs")
        .update({ status: "failed", attempts: next.attempts, last_error: action.error ?? "delivery failed", updated_at: nowIso })
        .eq("id", run.id)
      await logEvent("run.failed", {
        automationId: run.automationId,
        runId: run.id,
        subjectType: run.subjectType,
        subjectId: run.subjectId,
        detail: { attempts: next.attempts, error: action.error ?? "delivery failed" },
      })
      result.failed++
    } else if (next.action === "retry") {
      // Retry without advancing the step.
      await supabase
        .from("automation_runs")
        .update({ attempts: next.attempts, scheduled_for: next.scheduledFor, last_error: action.error ?? "delivery failed", updated_at: nowIso })
        .eq("id", run.id)
      result.failed++
    }
  }

  return result
}
