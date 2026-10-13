/* ───────────────────  Client founder check-ins (server-only)  ───────────────────
 * Day 0 is the moment a client receives their access/credentials email
 * (businesses.access_sent_at). Right after that we send the founder welcome
 * note and schedule the monthly check-in sequence (30/60/90/120 days) on the
 * automation engine (key `client_checkin_monthly`, migration 089). The hourly
 * /api/cron/reminders sweep executes the scheduled milestones.
 *
 * This module also backs the admin UI (Settings → Client Check-ins):
 *   • overview()        — per-client day count + live run state
 *   • startCheckins()   — begin/restart a client's sequence, positioning the
 *                         run at the correct milestone for legacy clients
 *   • runCheckinNow()   — the manual "send the next check-in now" button
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import {
  getAutomationByKey,
  enqueueAutomation,
  getClientCheckinConfig,
  sendClientCheckinEmail,
  decideNextRunState,
  type Automation,
} from "./automations"

export const CLIENT_CHECKIN_KEY = "client_checkin_monthly"

const DAY_MS = 86_400_000
const MILESTONE_DAYS = 30

interface BusinessRow {
  id: string
  business_name: string
  primary_contact_name: string | null
  primary_email: string
  status: string
  created_at: string
  access_sent_at: string | null
}

async function getBusiness(businessId: string): Promise<BusinessRow | null> {
  const { data } = await supabase
    .from("businesses")
    .select("id, business_name, primary_contact_name, primary_email, status, created_at, access_sent_at")
    .eq("id", businessId)
    .maybeSingle()
  return (data as BusinessRow | null) ?? null
}

async function logManualEvent(
  automation: Automation,
  runId: string | null,
  event: string,
  businessId: string,
  detail: Record<string, unknown>,
): Promise<void> {
  try {
    await supabase.from("automation_events").insert({
      automation_id: automation.id,
      run_id: runId,
      event,
      subject_type: "business",
      subject_id: businessId,
      detail,
    })
  } catch (err) {
    console.error("[client-checkins] event log failed:", err)
  }
}

/**
 * Which milestone should go next, given the connection date. A client 95 days
 * in has passed milestones 1-3, so the pending run sits at step 4, due now.
 */
export function positionForElapsed(
  anchorMs: number,
  nowMs: number,
  maxSteps: number,
): { step: number; scheduledFor: string } {
  const days = Math.max(0, (nowMs - anchorMs) / DAY_MS)
  const passed = Math.floor(days / MILESTONE_DAYS)
  const step = Math.min(Math.max(passed + 1, 1), maxSteps)
  const dueMs = anchorMs + step * MILESTONE_DAYS * DAY_MS
  // Future milestones stay on their anchor-based date; already-passed ones go due now.
  return { step, scheduledFor: new Date(Math.max(dueMs, nowMs)).toISOString() }
}

/** Record day 0 for a business. Returns true only the first time (idempotent). */
export async function markAccessSent(businessId: string, at?: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { data } = await supabase
    .from("businesses")
    .update({ access_sent_at: at || new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", businessId)
    .is("access_sent_at", null)
    .select("id")
  return Boolean(data && data.length > 0)
}

export interface StartResult {
  ok: boolean
  error?: string
  welcomeSent?: boolean
  step?: number
  scheduledFor?: string
}

/**
 * Start (or restart, positioned) a client's check-in sequence. `anchorAt`
 * defaults to the stored access_sent_at, then the business creation date — so
 * legacy clients get counted from when they actually connected.
 */
export async function startCheckins(
  businessId: string,
  opts: { sendWelcome?: boolean; anchorAt?: string } = {},
): Promise<StartResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const automation = await getAutomationByKey(CLIENT_CHECKIN_KEY)
  if (!automation) return { ok: false, error: `Unknown automation: ${CLIENT_CHECKIN_KEY}` }

  const biz = await getBusiness(businessId)
  if (!biz) return { ok: false, error: "Business not found" }

  const anchorMs = Date.parse(opts.anchorAt || biz.access_sent_at || biz.created_at)
  if (Number.isNaN(anchorMs)) return { ok: false, error: "Invalid connection date" }

  // Day 0 must exist for the overview to make sense.
  if (!biz.access_sent_at) await markAccessSent(businessId, new Date(anchorMs).toISOString())

  let welcomeSent = false
  if (opts.sendWelcome) {
    const cfg = await getClientCheckinConfig()
    const res = await sendClientCheckinEmail(biz, "client_welcome", cfg)
    welcomeSent = res.sent
    if (!res.sent) console.warn("[client-checkins] welcome not sent:", res.error)
  }

  if (!automation.enabled) {
    return { ok: true, welcomeSent, error: "Sequence disabled — check-ins were not scheduled" }
  }

  const enq = await enqueueAutomation({
    automationKey: CLIENT_CHECKIN_KEY,
    subjectType: "business",
    subjectId: businessId,
    recipientEmail: biz.primary_email,
  })
  if (!enq.ok || !enq.runId) return { ok: false, error: enq.error || "Enqueue failed", welcomeSent }

  // Re-position the fresh run at the milestone the client has actually reached.
  const now = Date.now()
  const pos = positionForElapsed(anchorMs, now, automation.maxSteps)
  if (pos.step !== 1 || Date.parse(pos.scheduledFor) - now < automation.delayMinutes * 60_000 - 60_000) {
    await supabase
      .from("automation_runs")
      .update({ step: pos.step, scheduled_for: pos.scheduledFor, updated_at: new Date(now).toISOString() })
      .eq("id", enq.runId)
  }
  await logManualEvent(automation, enq.runId, "run.scheduled", businessId, {
    manual: true,
    anchorAt: new Date(anchorMs).toISOString(),
    step: pos.step,
    scheduledFor: pos.scheduledFor,
    welcomeSent,
  })

  return { ok: true, welcomeSent, step: pos.step, scheduledFor: pos.scheduledFor }
}

export interface RunNowResult {
  ok: boolean
  error?: string
  step?: number
  templateKey?: string
  nextScheduledFor?: string | null
  completed?: boolean
}

/** Manually send the client's next pending check-in immediately. */
export async function runCheckinNow(businessId: string): Promise<RunNowResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const automation = await getAutomationByKey(CLIENT_CHECKIN_KEY)
  if (!automation) return { ok: false, error: `Unknown automation: ${CLIENT_CHECKIN_KEY}` }

  const { data: runRow } = await supabase
    .from("automation_runs")
    .select("id, status, step, attempts, scheduled_for")
    .eq("automation_id", automation.id)
    .eq("subject_type", "business")
    .eq("subject_id", businessId)
    .maybeSingle()

  if (!runRow) return { ok: false, error: "No check-in sequence — start it first" }
  if (runRow.status !== "pending") return { ok: false, error: `Sequence is ${runRow.status}` }

  const biz = await getBusiness(businessId)
  if (!biz) return { ok: false, error: "Business not found" }

  const cfg = await getClientCheckinConfig()
  const step = Number(runRow.step || 1)
  const templateKey = cfg.milestoneTemplates[step - 1] || cfg.milestoneTemplates[cfg.milestoneTemplates.length - 1]

  const { sent, error } = await sendClientCheckinEmail(biz, templateKey, cfg)
  if (!sent) {
    await supabase
      .from("automation_runs")
      .update({ last_error: error || "send failed", updated_at: new Date().toISOString() })
      .eq("id", runRow.id)
    return { ok: false, error: error || "Send failed", step, templateKey }
  }

  const nowIso = new Date().toISOString()
  const next = decideNextRunState({
    sent: true,
    currentStep: step,
    maxSteps: automation.maxSteps,
    intervalMinutes: automation.intervalMinutes,
    attempts: 0,
  })

  let nextScheduledFor: string | null = null
  let completed = false
  if (next.action === "complete") {
    await supabase
      .from("automation_runs")
      .update({ status: "sent", last_sent_at: nowIso, last_error: null, updated_at: nowIso })
      .eq("id", runRow.id)
    completed = true
  } else if (next.action === "reschedule") {
    nextScheduledFor = next.scheduledFor
    await supabase
      .from("automation_runs")
      .update({ step: next.step, scheduled_for: next.scheduledFor, last_sent_at: nowIso, last_error: null, attempts: 0, updated_at: nowIso })
      .eq("id", runRow.id)
  }
  await logManualEvent(automation, runRow.id as string, "run.sent", businessId, { manual: true, step, templateKey })

  return { ok: true, step, templateKey, nextScheduledFor, completed }
}

export interface CheckinOverviewRow {
  id: string
  businessName: string
  contactName: string | null
  email: string
  status: string
  connectedAt: string | null
  daysUsing: number
  run: { status: string; step: number; scheduledFor: string | null; lastSentAt: string | null } | null
}

/** Client-by-client state for the settings screen. */
export async function getCheckinOverview(): Promise<CheckinOverviewRow[]> {
  if (!isSupabaseConfigured()) return []

  const automation = await getAutomationByKey(CLIENT_CHECKIN_KEY)
  const { data: businesses } = await supabase
    .from("businesses")
    .select("id, business_name, primary_contact_name, primary_email, status, created_at, access_sent_at")
    .in("status", ["ONBOARDING", "ACTIVE", "SUSPENDED"])
    .order("access_sent_at", { ascending: false, nullsFirst: false })
    .limit(300)

  if (!businesses || businesses.length === 0) return []

  const ids = businesses.map((b) => b.id as string)
  const { data: runs } = await supabase
    .from("automation_runs")
    .select("subject_id, status, step, scheduled_for, last_sent_at")
    .eq("subject_type", "business")
    .in("subject_id", ids)
    .eq("automation_id", automation?.id ?? "00000000-0000-0000-0000-000000000000")

  const runByBusiness = new Map<string, Record<string, unknown>>()
  for (const r of runs || []) runByBusiness.set(r.subject_id as string, r as Record<string, unknown>)

  const now = Date.now()
  return businesses.map((b) => {
    const connected = (b.access_sent_at as string) || (b.created_at as string)
    const run = runByBusiness.get(b.id as string)
    return {
      id: b.id as string,
      businessName: b.business_name as string,
      contactName: (b.primary_contact_name as string) ?? null,
      email: b.primary_email as string,
      status: b.status as string,
      connectedAt: connected,
      daysUsing: Math.max(0, Math.floor((now - Date.parse(connected)) / DAY_MS)),
      run: run
        ? {
            status: run.status as string,
            step: Number(run.step || 1),
            scheduledFor: (run.scheduled_for as string) ?? null,
            lastSentAt: (run.last_sent_at as string) ?? null,
          }
        : null,
    }
  })
}

/** Backfill every client already past their first milestone with no live run. */
export async function backfillOverdueCheckins(opts: { sendWelcome: boolean }): Promise<{ started: number; results: Array<{ id: string; ok: boolean; error?: string }> }> {
  const overview = await getCheckinOverview()
  const targets = overview.filter(
    (r) => r.daysUsing >= MILESTONE_DAYS && (!r.run || r.run.status === "cancelled" || r.run.status === "failed"),
  )
  const results: Array<{ id: string; ok: boolean; error?: string }> = []
  for (const t of targets) {
    const res = await startCheckins(t.id, { sendWelcome: opts.sendWelcome, anchorAt: t.connectedAt ?? undefined })
    results.push({ id: t.id, ok: res.ok, error: res.error })
  }
  return { started: results.filter((r) => r.ok).length, results }
}
