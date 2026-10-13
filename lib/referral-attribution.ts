/* ───────────────────────────  Attribution protection  ───────────────────────────
 * Acceptance starts protection (never submission). Standard window is 90 days
 * from the signed Commission Schedule. Extensions always record a reason,
 * approver and immutable history entry.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditContext } from "./audit"
import { transitionReferral, type ReferralActor } from "./referral"
import { attributionProtected } from "./referral-status"
import { emitReferralNotification } from "./referral-notifications"

const DAY_MS = 86_400_000

export async function extendReferralProtection(
  leadId: string,
  extraDays: number,
  reason: string,
  actor: ReferralActor,
  ctx: AuditContext
): Promise<{ ok: boolean; error?: string; newExpiry?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }
  if (!reason || !reason.trim()) return { ok: false, error: "An extension reason is required" }
  if (!Number.isFinite(extraDays) || extraDays <= 0) return { ok: false, error: "Extension days must be positive" }

  const { data: lead } = await supabase.from("partner_leads").select("*").eq("id", leadId).single()
  if (!lead) return { ok: false, error: "Referral not found" }
  if (!attributionProtected(lead.status as string)) {
    return { ok: false, error: "Only an accepted referral can be extended" }
  }

  const base = lead.protection_expires_at ? new Date(lead.protection_expires_at as string).getTime() : Date.now()
  const newExpiry = new Date(base + extraDays * DAY_MS).toISOString()
  const nowIso = new Date().toISOString()

  const { error } = await supabase
    .from("partner_leads")
    .update({
      protection_expires_at: newExpiry,
      protection_extended_at: nowIso,
      protection_extension_reason: reason,
      updated_at: nowIso,
    })
    .eq("id", leadId)
  if (error) return { ok: false, error: `Extension failed: ${error.message}` }

  // Same-status history entry keeps the full attribution trail.
  await supabase.from("referral_status_history").insert({
    referral_id: leadId,
    previous_status: lead.status,
    new_status: lead.status,
    actor_type: actor.actorType,
    actor_id: actor.actorId ?? null,
    actor_name: actor.actorName ?? null,
    reason: `Protection extended by ${extraDays} days: ${reason}`,
    metadata: { extendedByDays: extraDays, newExpiry },
  })

  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.REFERRAL_PROTECTION_EXTENDED,
    entityType: AUDIT_ENTITIES.REFERRAL,
    entityId: leadId,
    metadata: { reference: lead.referral_reference, extraDays, reason, newExpiry },
  })

  const partnerId = (lead.partner_id as string) || null
  await emitReferralNotification({
    event: "PROTECTION_EXTENDED",
    title: `Protection extended: ${lead.referral_reference}`,
    body: `MartPoint extended your protection on ${lead.business_name} by ${extraDays} days — now until ${newExpiry.slice(0, 10)}.`,
    partnerId,
    link: `/partner/referrals/${leadId}`,
    sourceType: "referral",
    sourceId: leadId,
  })

  // The acceptance notice is the controlled record of the window, so a changed
  // window re-issues it; the previous copy is superseded, never overwritten.
  try {
    const { issueReferralAcceptanceNotice } = await import("./referral-documents")
    const { getActiveSchedule } = await import("./referral-agreements")
    const { row } = partnerId ? await getActiveSchedule(partnerId) : { row: null }
    await issueReferralAcceptanceNotice(
      leadId,
      { id: actor.actorId || "system", name: actor.actorName ?? null, title: "Sales / Partner Operations" },
      {
        protectionDays: null,
        protectionSource: row
          ? `Signed Commission Schedule ${row.reference_number} (version ${row.version}), extended by ${extraDays} days: ${reason}`
          : `Standard protection window, extended by ${extraDays} days: ${reason}`,
      }
    )
  } catch (err) {
    console.error("[extendReferralProtection] acceptance notice", err)
  }

  return { ok: true, newExpiry }
}

/* ─── Sweeps (called from the partner-ops cron) ─── */

async function hasNotification(partnerId: string, type: string, sourceId: string): Promise<boolean> {
  const { data } = await supabase
    .from("partner_notifications")
    .select("id")
    .eq("partner_id", partnerId)
    .eq("type", type)
    .eq("source_id", sourceId)
    .limit(1)
  return Boolean(data && data.length > 0)
}

/** Warn partners at T-14 days and T-3 days before protection expiry. */
export async function sweepProtectionExpiryWarnings(): Promise<{ warned: number }> {
  if (!isSupabaseConfigured()) return { warned: 0 }
  const now = Date.now()
  let warned = 0

  for (const days of [14, 3]) {
    const from = new Date(now + days * DAY_MS - 6 * 3600_000).toISOString()
    const to = new Date(now + days * DAY_MS + 6 * 3600_000).toISOString()
    const { data } = await supabase
      .from("partner_leads")
      .select("id, partner_id, referral_reference, business_name, protection_expires_at, status")
      .eq("status", "ACCEPTED")
      .not("protection_expires_at", "is", null)
      .gte("protection_expires_at", from)
      .lte("protection_expires_at", to)

    for (const r of (data as Record<string, unknown>[] | null) || []) {
      const partnerId = r.partner_id as string | null
      if (!partnerId) continue
      const type = days === 14 ? "PROTECTION_EXPIRING_14D" : "PROTECTION_EXPIRING_3D"
      if (await hasNotification(partnerId, type, r.id as string)) continue
      await emitReferralNotification({
        event: type,
        title: `Attribution expiring in ${days} days: ${r.referral_reference}`,
        body: `Protection for ${r.business_name} expires ${r.protection_expires_at}. MartPoint sales progression or an approved extension is required to keep it.`,
        partnerId,
        link: `/partner/referrals/${r.id}`,
        sourceType: "referral",
        sourceId: r.id as string,
      })
      warned++
    }
  }
  return { warned }
}

/** Expire accepted referrals whose protection lapsed with no conversion. */
export async function sweepExpiredReferrals(): Promise<{ expired: number }> {
  if (!isSupabaseConfigured()) return { expired: 0 }
  const nowIso = new Date().toISOString()
  const { data } = await supabase
    .from("partner_leads")
    .select("id, partner_id, referral_reference, business_name, status")
    .in("status", ["ACCEPTED", "QUALIFIED"])
    .not("protection_expires_at", "is", null)
    .lt("protection_expires_at", nowIso)

  let expired = 0
  for (const r of (data as Record<string, unknown>[] | null) || []) {
    const res = await transitionReferral(r.id as string, "EXPIRED", { actorType: "SYSTEM", actorName: "partner-ops sweep" }, {
      reason: "Attribution protection expired without conversion",
      metadata: { expiredAt: r.protection_expires_at ?? nowIso },
      patch: { protection_status: "EXPIRED", closure_reason: "Attribution expired" },
    })
    if (res.ok) {
      expired++
      await recordAudit(
        { actorType: "SYSTEM", actorName: "partner-ops sweep" } as AuditContext,
        {
          action: AUDIT_ACTIONS.REFERRAL_EXPIRED,
          entityType: AUDIT_ENTITIES.REFERRAL,
          entityId: r.id as string,
          metadata: { reference: r.referral_reference },
        }
      )
      if (r.partner_id) {
        await emitReferralNotification({
          event: "REFERRAL_EXPIRED",
          title: `Referral expired: ${r.referral_reference}`,
          body: `Attribution for ${r.business_name} expired without a conversion.`,
          partnerId: r.partner_id as string,
          link: `/partner/referrals/${r.id}`,
          sourceType: "referral",
          sourceId: r.id as string,
        })
        try {
          const { issueReferralDecisionNotice } = await import("./referral-documents")
          await issueReferralDecisionNotice(
            r.id as string,
            { id: "system", name: "MartPoint Partner Operations", title: "Partner Operations" },
            {
              kind: "LOST_OR_EXPIRED",
              safeReason: "The protection period ended without the prospect becoming a paying MartPoint customer.",
              requiredAction: null,
            }
          )
        } catch (err) {
          console.error("[sweepExpiredReferrals] closure notice", err)
        }
      }
    }
  }
  return { expired }
}
