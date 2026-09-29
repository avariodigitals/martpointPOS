import { supabase, isSupabaseConfigured } from "./supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "./audit"
import { expireDueCertifications } from "./partner-certifications"
import { sendEmail, REPLY_TO } from "./email"
import { escapeHtml } from "./email-templates"

/* ───────────────────────────  Partner operations sweep  ───────────────────────────
 * Scheduled, idempotent processing per the Portal Automation Blueprint:
 *
 * 1. Commission eligibility — PENDING commissions are promoted to ELIGIBLE
 *    only when every gate passes:
 *      a. The source payment is still CONFIRMED (refunded/reversed payments
 *         mark the commission REVERSED instead).
 *      b. The customer business is live (ACTIVE or GO_LIVE_APPROVED).
 *      c. The plan holding period (clawback_days) has elapsed since earned_at.
 *      d. The partner is ACTIVE.
 *    Finance approval remains a separate step downstream.
 *
 * 2. Lead protection expiry — PROTECTED leads past protection_expires_at are
 *    marked EXPIRED (idempotent; guarded on current status).
 *
 * 3. Certification expiry — CERTIFIED/SUPERVISED records past expires_at are
 *    marked EXPIRED (delegated to partner-certifications).
 *
 * 4. Reminders — one-shot emails to partner owner/manager users for:
 *      - lead protection expiring within 7 days
 *      - certifications expiring within 30 days
 *      - work-order milestones due within 3 days or overdue
 *    A `*_reminder_sent_at` timestamp on the row makes each reminder idempotent.
 */

function now() {
  return new Date().toISOString()
}

function daysFromNow(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
}

/** Partner owner/manager emails — notification recipients, never secrets. */
async function partnerNotifyEmails(partnerId: string): Promise<string[]> {
  const { data } = await supabase
    .from("partner_users")
    .select("email")
    .eq("partner_id", partnerId)
    .eq("status", "ACTIVE")
    .in("role", ["PARTNER_OWNER", "PARTNER_MANAGER"])
  return ((data || []) as { email: string }[]).map((r) => r.email).filter(Boolean)
}

async function sendPartnerReminder(
  partnerId: string,
  subject: string,
  heading: string,
  body: string
): Promise<void> {
  const emails = await partnerNotifyEmails(partnerId)
  if (emails.length === 0) return
  const html = `<p style="font-size:15px;font-weight:600;margin:0 0 12px;">${escapeHtml(heading)}</p><p style="font-size:14px;line-height:1.6;color:#374151;margin:0;">${escapeHtml(body)}</p>`
  await sendEmail({ to: emails, subject, text: `${heading}\n\n${body}`, html, replyTo: REPLY_TO.partners })
}

/* ─── 1. Commission eligibility gates ─── */

const LIVE_BUSINESS_STATUSES = ["ACTIVE", "GO_LIVE_APPROVED"]
const BAD_PAYMENT_STATUSES = ["REFUNDED", "REVERSED", "FAILED"]

/**
 * Pure eligibility decision for a PENDING commission. Exported for tests.
 * - REVERSE: the source payment was refunded, reversed or failed.
 * - PROMOTE: payment confirmed (or no payment linked, e.g. milestone fees),
 *   the customer is live, the partner is active, and the plan's holding
 *   period has elapsed.
 * - HOLD: anything else — stays PENDING for the next sweep.
 */
export function decideCommissionEligibility(input: {
  paymentStatus: string | null
  businessStatus: string | null
  partnerStatus: string | null
  earnedAt: string | null
  holdDays: number
  nowMs?: number
}): "PROMOTE" | "REVERSE" | "HOLD" {
  const { paymentStatus, businessStatus, partnerStatus, earnedAt, holdDays } = input
  const nowMs = input.nowMs ?? Date.now()

  if (paymentStatus && BAD_PAYMENT_STATUSES.includes(paymentStatus)) return "REVERSE"
  if (paymentStatus && paymentStatus !== "CONFIRMED") return "HOLD"
  if (!businessStatus || !LIVE_BUSINESS_STATUSES.includes(businessStatus)) return "HOLD"
  if (partnerStatus !== "ACTIVE") return "HOLD"
  if (holdDays > 0 && earnedAt) {
    if (new Date(earnedAt).getTime() + holdDays * 86400000 > nowMs) return "HOLD"
  }
  return "PROMOTE"
}

export async function promotePendingCommissions(): Promise<{ promoted: number; reversed: number; held: number }> {
  if (!isSupabaseConfigured()) return { promoted: 0, reversed: 0, held: 0 }
  let promoted = 0
  let reversed = 0
  let held = 0

  const { data: pending } = await supabase
    .from("partner_commissions")
    .select("*, commission_plans(clawback_days), payments(status), businesses(status), partners(status)")
    .eq("status", "PENDING")

  for (const c of (pending || []) as Record<string, unknown>[]) {
    const payment = c.payments as { status: string } | null
    const business = c.businesses as { status: string } | null
    const partner = c.partners as { status: string } | null
    const plan = c.commission_plans as { clawback_days: number | null } | null
    const holdDays = Number(plan?.clawback_days) || 0

    const outcome = decideCommissionEligibility({
      paymentStatus: payment?.status ?? null,
      businessStatus: business?.status ?? null,
      partnerStatus: partner?.status ?? null,
      earnedAt: (c.earned_at as string | null) ?? null,
      holdDays,
    })

    if (outcome === "REVERSE") {
      const { error } = await supabase
        .from("partner_commissions")
        .update({ status: "REVERSED", reversal_reason: `Payment ${payment!.status.toLowerCase()}`, updated_at: now() })
        .eq("id", c.id as string)
        .eq("status", "PENDING")
      if (!error) reversed++
      continue
    }

    if (outcome === "HOLD") {
      held++
      continue
    }

    const { error } = await supabase
      .from("partner_commissions")
      .update({ status: "ELIGIBLE", updated_at: now() })
      .eq("id", c.id as string)
      .eq("status", "PENDING")
    if (!error) {
      promoted++
      await recordAudit(
        { actorType: "SYSTEM", actorId: "cron" },
        {
          action: AUDIT_ACTIONS.PARTNER_COMMISSION_ELIGIBILITY_EVALUATED,
          entityType: AUDIT_ENTITIES.PARTNER_COMMISSION,
          entityId: c.id as string,
          metadata: { partnerId: c.partner_id, outcome: "ELIGIBLE", holdDays },
        }
      )
    }
  }

  return { promoted, reversed, held }
}

/* ─── 2. Lead protection expiry ─── */

export async function expireLeadProtections(): Promise<{ expired: number }> {
  if (!isSupabaseConfigured()) return { expired: 0 }
  const { data } = await supabase
    .from("partner_leads")
    .select("id, partner_id")
    .eq("protection_status", "PROTECTED")
    .lt("protection_expires_at", now())
  const rows = (data || []) as Record<string, unknown>[]
  for (const r of rows) {
    const { error } = await supabase
      .from("partner_leads")
      .update({ protection_status: "EXPIRED", updated_at: now() })
      .eq("id", r.id as string)
      .eq("protection_status", "PROTECTED")
    if (!error) {
      await recordAudit(
        { actorType: "SYSTEM", actorId: "cron" },
        {
          action: AUDIT_ACTIONS.PARTNER_LEAD_PROTECTION_EXPIRED,
          entityType: AUDIT_ENTITIES.PARTNER_LEAD,
          entityId: r.id as string,
          metadata: { partnerId: r.partner_id },
        }
      )
    }
  }
  return { expired: rows.length }
}

/* ─── 3. Reminders (one-shot per record via *_reminder_sent_at) ─── */

export async function sendExpiryReminders(): Promise<{ leadReminders: number; certificationReminders: number; milestoneReminders: number }> {
  if (!isSupabaseConfigured()) return { leadReminders: 0, certificationReminders: 0, milestoneReminders: 0 }
  let leadReminders = 0
  let certificationReminders = 0
  let milestoneReminders = 0

  // Lead protection expiring within 7 days
  const { data: expiringLeads } = await supabase
    .from("partner_leads")
    .select("id, partner_id, company_name, protection_expires_at")
    .eq("protection_status", "PROTECTED")
    .is("expiry_reminder_sent_at", null)
    .lte("protection_expires_at", daysFromNow(7))
    .gt("protection_expires_at", now())
  for (const l of (expiringLeads || []) as Record<string, unknown>[]) {
    await sendPartnerReminder(
      l.partner_id as string,
      "MartPoint — Opportunity protection expiring soon",
      "Opportunity protection expiring",
      `Protection on "${l.company_name}" expires on ${new Date(l.protection_expires_at as string).toDateString()}. Log in to the partner portal to extend or update the opportunity.`
    )
    await supabase.from("partner_leads").update({ expiry_reminder_sent_at: now() }).eq("id", l.id as string)
    leadReminders++
  }

  // Certifications expiring within 30 days
  const { data: expiringCerts } = await supabase
    .from("partner_certifications")
    .select("id, partner_id, programme, expires_at")
    .in("status", ["CERTIFIED", "SUPERVISED"])
    .is("expiry_reminder_sent_at", null)
    .lte("expires_at", daysFromNow(30))
    .gt("expires_at", now())
  for (const c of (expiringCerts || []) as Record<string, unknown>[]) {
    await sendPartnerReminder(
      c.partner_id as string,
      "MartPoint — Certification expiring soon",
      "Certification expiring",
      `Your ${c.programme} certification expires on ${new Date(c.expires_at as string).toDateString()}. Contact Partner Operations to schedule reassessment.`
    )
    await supabase.from("partner_certifications").update({ expiry_reminder_sent_at: now() }).eq("id", c.id as string)
    certificationReminders++
  }

  // Milestones due within 3 days or overdue (not yet accepted)
  const { data: dueMilestones } = await supabase
    .from("partner_work_order_milestones")
    .select("id, title, due_date, partner_work_orders(partner_id, work_order_ref, status)")
    .in("status", ["PENDING", "SUBMITTED", "REJECTED"])
    .is("reminder_sent_at", null)
    .lte("due_date", daysFromNow(3).split("T")[0])
  for (const m of (dueMilestones || []) as Record<string, unknown>[]) {
    const wo = m.partner_work_orders as Record<string, unknown> | null
    if (!wo || !["ACCEPTED", "IN_PROGRESS"].includes(wo.status as string)) continue
    const overdue = new Date(m.due_date as string).getTime() < Date.now()
    await sendPartnerReminder(
      wo.partner_id as string,
      `MartPoint — Milestone ${overdue ? "overdue" : "due soon"}: ${wo.work_order_ref}`,
      `Milestone ${overdue ? "overdue" : "due soon"}`,
      `Milestone "${m.title}" on work order ${wo.work_order_ref} ${overdue ? "was due" : "is due"} on ${m.due_date}. Submit evidence in the partner portal for MartPoint review.`
    )
    await supabase.from("partner_work_order_milestones").update({ reminder_sent_at: now() }).eq("id", m.id as string)
    milestoneReminders++
  }

  return { leadReminders, certificationReminders, milestoneReminders }
}

/* ─── Orchestrator ─── */

export async function runPartnerOpsSweep() {
  const [commissions, leads, certifications, reminders] = await Promise.all([
    promotePendingCommissions(),
    expireLeadProtections(),
    expireDueCertifications(),
    sendExpiryReminders(),
  ])
  return { commissions, leads, certifications, reminders }
}
