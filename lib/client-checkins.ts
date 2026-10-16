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
  type Automation,
} from "./automations"

export const CLIENT_CHECKIN_KEY = "client_checkin_monthly"

const DAY_MS = 86_400_000
const DORMANT_AFTER_DAYS = 30

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
 * Which milestone should go next, given the connection date and the ordered
 * milestone days (30/60/90/120/180/270/365). A client 95 days in has passed
 * milestones 1-3, so the pending run sits at step 4, due on day 120.
 */
export function positionForElapsed(
  anchorMs: number,
  nowMs: number,
  milestoneDays: number[],
): { step: number; scheduledFor: string } {
  const maxSteps = milestoneDays.length
  const days = Math.max(0, (nowMs - anchorMs) / DAY_MS)
  let step = maxSteps
  for (let i = 0; i < maxSteps; i++) {
    if (days < milestoneDays[i]) {
      step = i + 1
      break
    }
  }
  const dueMs = anchorMs + milestoneDays[step - 1] * DAY_MS
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

  const cfg = await getClientCheckinConfig()
  let welcomeSent = false
  if (opts.sendWelcome) {
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
  const pos = positionForElapsed(anchorMs, now, cfg.milestoneDays)
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

  const nowMs = Date.now()
  const nowIso = new Date(nowMs).toISOString()
  // Advance to the next milestone pinned to the connection date (anchor-based).
  const anchorMs = Date.parse(biz.access_sent_at || biz.created_at)
  const nextDay = cfg.milestoneDays[step]

  let nextScheduledFor: string | null = null
  let completed = false
  if (nextDay === undefined || Number.isNaN(anchorMs)) {
    await supabase
      .from("automation_runs")
      .update({ status: "sent", last_sent_at: nowIso, last_error: null, updated_at: nowIso })
      .eq("id", runRow.id)
    completed = true
  } else {
    nextScheduledFor = new Date(Math.max(anchorMs + nextDay * DAY_MS, nowMs + 60_000)).toISOString()
    await supabase
      .from("automation_runs")
      .update({ step: step + 1, scheduled_for: nextScheduledFor, last_sent_at: nowIso, last_error: null, attempts: 0, updated_at: nowIso })
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
  lastSeenAt: string | null
  lastUsageAt: string | null
  lastLoginAt: string | null
  daysSinceLogin: number | null
  retentionStatus: "no_login_recorded" | "active" | "at_risk"
  renewalDate: string | null
  subscriptionAmount: number | null
  subscriptionCurrency: string | null
  subscriptionInterval: string | null
  lastSystemPingAt: string | null
  connectionStatus: ConnectionStatus
  dormancyPaused: boolean
  token: string | null
  dormantLast: { status: string; at: string; error: string | null } | null
  run: { status: string; step: number; scheduledFor: string | null; lastSentAt: string | null } | null
}

/** Client-by-client state for the settings screen. */
export async function getCheckinOverview(): Promise<CheckinOverviewRow[]> {
  if (!isSupabaseConfigured()) return []

  const automation = await getAutomationByKey(CLIENT_CHECKIN_KEY)
  const { data: businesses, error: businessError } = await supabase
    .from("businesses")
    .select("id, business_name, primary_contact_name, primary_email, status, created_at, access_sent_at, last_seen_at, last_usage_at, last_login_at, last_system_ping_at, dormancy_paused")
    .in("status", ["ONBOARDING", "ACTIVE", "SUSPENDED"])
    .order("access_sent_at", { ascending: false, nullsFirst: false })
    .limit(300)

  if(businessError)throw new Error("Retention schema unavailable; apply migration 096_install_retention.sql.")
  if (!businesses || businesses.length === 0) return []

  const ids = businesses.map((b) => b.id as string)
  const [runsRes, tokensRes, deliveriesRes, subscriptionsRes] = await Promise.all([
    supabase
      .from("automation_runs")
      .select("subject_id, status, step, scheduled_for, last_sent_at")
      .eq("subject_type", "business")
      .in("subject_id", ids)
      .eq("automation_id", automation?.id ?? "00000000-0000-0000-0000-000000000000"),
    supabase
      .from("install_tokens")
      .select("business_id, token")
      .eq("status", "active")
      .in("business_id", ids),
    supabase
      .from("dormancy_deliveries")
      .select("business_id, status, error, created_at")
      .in("business_id", ids)
      .order("created_at", { ascending: false })
      .limit(600),
    supabase.from("subscriptions").select("business_id, renewal_date, price_at_activation, currency, billing_interval")
      .in("business_id",ids).in("status",["ACTIVE","PAST_DUE","SUSPENDED"]).order("renewal_date",{ascending:true,nullsFirst:false}),
  ])

  if(tokensRes.error || subscriptionsRes.error)throw new Error("Unable to load retention credentials or renewal information.")
  const { data: runs } = runsRes
  const runByBusiness = new Map<string, Record<string, unknown>>()
  for (const r of runs || []) runByBusiness.set(r.subject_id as string, r as Record<string, unknown>)

  const tokenByBusiness = new Map<string, string>()
  for (const t of tokensRes.data || []) tokenByBusiness.set(t.business_id as string, t.token as string)

  const dormantByBusiness = new Map<string, { status: string; at: string; error: string | null }>()
  for (const d of deliveriesRes.data || []) {
    const key = d.business_id as string
    if (!dormantByBusiness.has(key)) {
      dormantByBusiness.set(key, { status: d.status as string, at: d.created_at as string, error: (d.error as string) ?? null })
    }
  }

  const now = Date.now()
  return businesses.map((b) => {
    const connected = (b.access_sent_at as string) || (b.created_at as string)
    const run = runByBusiness.get(b.id as string)
    const subscription=(subscriptionsRes.data || []).find((row) => row.business_id===b.id)
    const login=(b.last_login_at as string) || null
    const retention=retentionState(login,now)
    const lastUsage = (b.last_usage_at as string) ?? (b.last_seen_at as string) ?? null
    return {
      id: b.id as string,
      businessName: b.business_name as string,
      contactName: (b.primary_contact_name as string) ?? null,
      email: b.primary_email as string,
      status: b.status as string,
      connectedAt: connected,
      daysUsing: Math.max(0, Math.floor((now - Date.parse(connected)) / DAY_MS)),
      lastSeenAt: (b.last_seen_at as string) ?? null,
      lastUsageAt: lastUsage,
      lastLoginAt: login,
      ...retention,
      renewalDate: subscription?.renewal_date ?? null,
      subscriptionAmount: subscription ? Number(subscription.price_at_activation) : null,
      subscriptionCurrency: subscription?.currency ?? null,
      subscriptionInterval: subscription?.billing_interval ?? null,
      lastSystemPingAt: (b.last_system_ping_at as string) ?? null,
      connectionStatus: computeConnectionStatus(lastUsage, now),
      dormancyPaused: b.dormancy_paused === true,
      token: tokenByBusiness.get(b.id as string) ?? null,
      dormantLast: dormantByBusiness.get(b.id as string) ?? null,
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
  const firstMilestone = (await getClientCheckinConfig()).milestoneDays[0] ?? 30
  const targets = overview.filter(
    (r) => r.daysUsing >= firstMilestone && (!r.run || r.run.status === "cancelled" || r.run.status === "failed"),
  )
  const results: Array<{ id: string; ok: boolean; error?: string }> = []
  for (const t of targets) {
    const res = await startCheckins(t.id, { sendWelcome: opts.sendWelcome, anchorAt: t.connectedAt ?? undefined })
    results.push({ id: t.id, ok: res.ok, error: res.error })
  }
  return { started: results.filter((r) => r.ok).length, results }
}

/* ───────────────────  Install check-ins (usage heartbeat) + dormancy  ─────────────────── */

function hostOf(value: string): string {
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).hostname.toLowerCase().replace(/^www\./, "")
  } catch {
    return ""
  }
}

export type PingOutcome = "saved" | "unmatched" | "ambiguous" | "save_failed" | "invalid"

/**
 * Record a usage heartbeat from an installed POS by its install URL/domain.
 * This is the LEGACY identification path — private tokens
 * (install_tokens, migration 092) are the primary identity. The hostname is
 * only trusted when it matches exactly one business. Returns matched=true
 * only after the row is confirmed saved.
 */
export async function recordUsagePing(key: string): Promise<{ matched: boolean; outcome: PingOutcome; businessId?: string }> {
  if (!isSupabaseConfigured()) return { matched: false, outcome: "invalid" }
  const host = hostOf(String(key || "").trim())
  if (!host || host.length > 253) return { matched: false, outcome: "invalid" }

  const { data: deps, error: deploymentError } = await supabase
    .from("business_deployments")
    .select("business_id, environment_url, admin_url, online_store_url")

  if (deploymentError) return { matched: false, outcome: "save_failed" }
  const candidates = new Set<string>()
  for (const d of deps || []) {
    const urls = [d.environment_url, d.admin_url, d.online_store_url].filter(Boolean) as string[]
    if (urls.some((u) => hostOf(String(u)) === host)) {
      candidates.add(d.business_id as string)
    }
  }
  // A hostname shared by different clients is not an installation identity.
  // Refuse ambiguity rather than crediting whichever row the DB returned first.
  if (candidates.size > 1) return { matched: false, outcome: "ambiguous" }
  if (candidates.size === 0) {
    const { data: withSite, error: websiteError } = await supabase.from("businesses").select("id, website").not("website", "is", null).limit(1000)
    if (websiteError) return { matched: false, outcome: "save_failed" }
    for (const b of withSite || []) {
      if (hostOf(String(b.website)) === host) candidates.add(b.id as string)
    }
  }
  if (candidates.size > 1) return { matched: false, outcome: "ambiguous" }
  if (candidates.size === 0) return { matched: false, outcome: "unmatched" }
  const businessId = [...candidates][0]

  const nowIso = new Date().toISOString()
  const { data: saved, error: saveError } = await supabase.from("businesses")
    .update({ last_seen_at: nowIso, last_usage_at: nowIso }).eq("id", businessId).select("id")
  return { matched: !saveError && !!saved?.length, outcome: !saveError && saved?.length ? "saved" : "save_failed", businessId }
}

async function logPing(entry: {
  businessId?: string | null
  source: "token" | "hostname"
  pingType: "usage" | "system"
  outcome: PingOutcome
  detail?: string | null
}): Promise<void> {
  try {
    await supabase.from("usage_ping_log").insert({
      business_id: entry.businessId ?? null,
      source: entry.source,
      ping_type: entry.pingType,
      outcome: entry.outcome,
      // Never store tokens; a host is public information already.
      detail: entry.detail ? String(entry.detail).slice(0, 253) : null,
    })
  } catch (err) {
    console.error("[client-checkins] ping log failed:", err)
  }
}

/**
 * Primary check-in entry point for installed POS apps.
 *   • `token` (preferred): the install's private token from install_tokens.
 *     type=usage stamps last_usage_at; type=system (server health / cron /
 *     maintenance) only stamps last_system_ping_at — a running server is NOT
 *     app usage and can never mark a client "recently active".
 *   • `key` (legacy): install URL/hostname, always treated as usage; system
 *     pings without a token are rejected rather than credited as usage.
 * Acknowledges only confirmed-saved activity; never reveals why a check-in
 * failed (invalid vs unknown vs ambiguous all look the same to the caller).
 */
export async function recordInstallCheckin(opts: {
  token?: string
  key?: string
  type?: "usage" | "system"
  loginAt?: string
  activityAt?: string
  systemAt?: string
}): Promise<{ matched: boolean }> {
  if (!isSupabaseConfigured()) return { matched: false }
  const type = opts.type === "system" ? "system" : "usage"
  const token = String(opts.token || "").trim()
  if(opts.loginAt || opts.activityAt || opts.systemAt){
    const valid=(v: string | undefined)=>!v || (Number.isFinite(Date.parse(v)) && Date.parse(v)>=Date.parse("2000-01-01") && Date.parse(v)<=Date.now()+300000)
    if(!token || ![opts.loginAt,opts.activityAt,opts.systemAt].every(valid) || (type==="system" && opts.activityAt))return {matched:false}
    const {data,error}=await supabase.rpc("record_install_retention",{
      p_token:token,p_login_at:opts.loginAt || null,p_activity_at:opts.activityAt || null,p_system_at:opts.systemAt || null,
    })
    const matched=!error&&data===true
    await logPing({source:"token",pingType:type,outcome:matched?"saved":"invalid"})
    return {matched}
  }

  if (token) {
    const { data: tok } = await supabase
      .from("install_tokens")
      .select("id, business_id")
      .eq("token", token)
      .eq("status", "active")
      .maybeSingle()
    if (!tok) {
      await logPing({ source: "token", pingType: type, outcome: "invalid" })
      return { matched: false }
    }
    const nowIso = new Date().toISOString()
    const fields = type === "system"
      ? { last_system_ping_at: nowIso }
      : { last_usage_at: nowIso, last_seen_at: nowIso }
    const { data: saved, error } = await supabase
      .from("businesses")
      .update(fields)
      .eq("id", tok.business_id)
      .select("id")
    const matched = !error && !!saved?.length
    // Best-effort token activity stamp (diagnostics only, never gates anything).
    await supabase.from("install_tokens").update({ last_used_at: nowIso }).eq("id", tok.id)
    await logPing({ businessId: tok.business_id as string, source: "token", pingType: type, outcome: matched ? "saved" : "save_failed" })
    return { matched }
  }

  if (type === "system") {
    // Health beats must be attributable; anonymous ones are not credited.
    await logPing({ source: "hostname", pingType: "system", outcome: "invalid" })
    return { matched: false }
  }

  const key = String(opts.key || "").trim()
  if (!key) {
    await logPing({ source: "hostname", pingType: "usage", outcome: "invalid" })
    return { matched: false }
  }
  const res = await recordUsagePing(key)
  await logPing({
    businessId: res.businessId ?? null,
    source: "hostname",
    pingType: "usage",
    outcome: res.outcome,
    detail: hostOf(key) || String(key).slice(0, 253),
  })
  return { matched: res.matched }
}

/** Issue (or rotate) the install's private check-in token. Admin-only. */
export async function rotateInstallToken(businessId: string): Promise<{ ok: boolean; token?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const {data,error}=await supabase.rpc("issue_install_checkin_token",{p_business_id:businessId,p_rotate:true})
  return !error&&typeof data==="string" ? {ok:true,token:data} : {ok:false,error:"Token rotation failed"}
}

export async function setDormancyPaused(businessId: string, paused: boolean): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  const { error } = await supabase
    .from("businesses")
    .update({ dormancy_paused: paused, updated_at: new Date().toISOString() })
    .eq("id", businessId)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Login recency is separate from activity in a long-lived signed-in session. */
export function retentionState(lastLoginAt: string | null,nowMs=Date.now()): {daysSinceLogin:number|null;retentionStatus:"no_login_recorded"|"active"|"at_risk"} {
  const stamp=lastLoginAt?Date.parse(lastLoginAt):NaN
  if(!Number.isFinite(stamp))return {daysSinceLogin:null,retentionStatus:"no_login_recorded"}
  return {daysSinceLogin:Math.max(0,Math.floor((nowMs-stamp)/DAY_MS)),retentionStatus:nowMs-stamp>=30*DAY_MS?"at_risk":"active"}
}

export type ConnectionStatus = "not_connected" | "recently_active" | "no_checkin_30d"

/**
 * Client-facing connection state. Only genuine POS usage counts: installs
 * that have never reported stay "not_connected" and are excluded from
 * dormancy emails — we never guess about clients we cannot see.
 */
export function computeConnectionStatus(
  lastUsageAt: string | null,
  nowMs: number,
  quietDays = DORMANT_AFTER_DAYS,
): ConnectionStatus {
  const seen = lastUsageAt ? Date.parse(lastUsageAt) : NaN
  if (Number.isNaN(seen)) return "not_connected"
  return nowMs - seen <= quietDays * DAY_MS ? "recently_active" : "no_checkin_30d"
}

export interface PingIssueRow {
  id: number
  businessId: string | null
  businessName: string | null
  source: string
  pingType: string
  outcome: string
  detail: string | null
  createdAt: string
}

/** Recent failed/ambiguous/unmatched check-ins — connection diagnostics. */
export async function getRecentPingIssues(limit = 50): Promise<PingIssueRow[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("usage_ping_log")
    .select("id, business_id, source, ping_type, outcome, detail, created_at")
    .neq("outcome", "saved")
    .order("created_at", { ascending: false })
    .limit(limit)
  if (!data || data.length === 0) return []
  const ids = [...new Set(data.map((r) => r.business_id).filter(Boolean) as string[])]
  const nameById = new Map<string, string>()
  if (ids.length) {
    const { data: biz } = await supabase.from("businesses").select("id, business_name").in("id", ids)
    for (const b of biz || []) nameById.set(b.id as string, b.business_name as string)
  }
  return data.map((r) => ({
    id: Number(r.id),
    businessId: (r.business_id as string) ?? null,
    businessName: r.business_id ? nameById.get(r.business_id as string) ?? null : null,
    source: r.source as string,
    pingType: r.ping_type as string,
    outcome: r.outcome as string,
    detail: (r.detail as string) ?? null,
    createdAt: r.created_at as string,
  }))
}

export interface DormancySweepResult {
  checked: number
  sent: number
  failed: number
  skipped: boolean
}

/**
 * The "no recent check-in" founder note. A client whose install used to send
 * check-ins but has been quiet for 30+ days gets ONE caring email per quiet
 * period; the clock resets the next time the install reports in.
 *
 * Guards (migration 092):
 *   • automatic sending is OFF unless clientCheckins.dormantEnabled is on;
 *   • clients with dormancy_paused are skipped;
 *   • never-reported installs are never emailed (last_usage_at must exist);
 *   • each send is claimed with a database compare-and-set BEFORE sending, so
 *     overlapping cron runs cannot double-send; a failed send releases the
 *     claim for the next sweep and lands in dormancy_deliveries as 'failed'.
 */
export async function runDormancySweep(limit = 25): Promise<DormancySweepResult> {
  const empty = { checked: 0, sent: 0, failed: 0, skipped: true }
  if (!isSupabaseConfigured()) return empty
  const cfg = await getClientCheckinConfig()
  if (!cfg.dormantEnabled) return { ...empty }

  const cutoff = new Date(Date.now() - DORMANT_AFTER_DAYS * DAY_MS).toISOString()
  const { data: rows } = await supabase
    .from("businesses")
    .select("id, business_name, primary_contact_name, primary_email, status, last_usage_at, last_dormant_email_at")
    .in("status", ["ONBOARDING", "ACTIVE"])
    .eq("dormancy_paused", false)
    .not("last_usage_at", "is", null)
    .lt("last_usage_at", cutoff)
    .order("last_usage_at", { ascending: true })
    .limit(limit)

  let sent = 0
  let failed = 0
  for (const b of rows || []) {
    const prev = (b.last_dormant_email_at as string) ?? null
    const claimIso = new Date().toISOString()
    // DB-backed claim: only the sweep that flips THIS row's previous value wins.
    const claimBase = supabase
      .from("businesses")
      .update({ last_dormant_email_at: claimIso })
      .eq("id", b.id)
    const claim = prev
      ? await claimBase.eq("last_dormant_email_at", prev).select("id")
      : await claimBase.is("last_dormant_email_at", null).select("id")
    if (!claim.data || claim.data.length === 0) continue

    const res = await sendClientCheckinEmail(
      {
        id: b.id as string,
        business_name: b.business_name as string,
        primary_contact_name: (b.primary_contact_name as string) ?? null,
        primary_email: b.primary_email as string,
        status: b.status as string,
      },
      "client_dormant",
      cfg,
    )
    if (res.sent) {
      sent++
      await supabase.from("dormancy_deliveries").insert({
        business_id: b.id, status: "sent", quiet_since: b.last_usage_at,
      })
    } else {
      failed++
      // Release the claim (only if nobody else moved it) so the next sweep retries.
      await supabase
        .from("businesses")
        .update({ last_dormant_email_at: prev })
        .eq("id", b.id)
        .eq("last_dormant_email_at", claimIso)
      await supabase.from("dormancy_deliveries").insert({
        business_id: b.id, status: "failed", error: res.error || "send failed", quiet_since: b.last_usage_at,
      })
    }
  }
  return { checked: (rows || []).length, sent, failed, skipped: false }
}
