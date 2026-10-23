/* ───────────────────────────  Referral notifications  ───────────────────────────
 * One emit path for the whole workflow: partner in-app feed
 * (partner_notifications), internal admin alerts (admin_notifications) and a
 * best-effort email. Every delivery is non-throwing — notifications must never
 * block a status change, approval or payout.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { createAdminNotification } from "./admin-notifications"
import { sendEmail } from "./email"
import { getPartnerSession } from "./partner-auth"

export const REFERRAL_NOTIFICATION_EVENTS = [
  "APPLICATION_SUBMITTED",
  "ADDITIONAL_INFORMATION_REQUESTED",
  "PARTNER_ACTIVATED",
  "REFERRAL_SUBMITTED",
  "REFERRAL_INFORMATION_PROVIDED",
  "REFERRAL_ACCEPTED",
  "REFERRAL_CONVERTED_TO_CUSTOMER",
  "REFERRAL_REJECTED",
  "REFERRAL_DUPLICATE",
  "PROTECTION_EXPIRING_14D",
  "PROTECTION_EXPIRING_3D",
  "PROTECTION_EXTENDED",
  "REFERRAL_EXPIRED",
  "CUSTOMER_PAYMENT_CLEARED",
  "LICENCE_ACTIVATED",
  "HOLDING_PERIOD_COMPLETED",
  "COMMISSION_ELIGIBLE",
  "COMMISSION_HELD_OR_ADJUSTED",
  "COMMISSION_APPROVED",
  "PAYOUT_COMPLETED",
  "AGREEMENT_OR_PAYOUT_INFO_EXPIRING",
  "BANK_CHANGE_REQUESTED",
  "BANK_CHANGE_DECIDED",
  "QUARTERLY_GRADE_REVIEW",
  "SUSPENSION_OR_TERMINATION",
] as const

export type ReferralNotificationEvent = (typeof REFERRAL_NOTIFICATION_EVENTS)[number]

type InternalRole = "Admin" | "Sales" | "Finance"

const INTERNAL_AUDIENCE: Record<ReferralNotificationEvent, InternalRole[]> = {
  APPLICATION_SUBMITTED: ["Admin", "Sales"],
  ADDITIONAL_INFORMATION_REQUESTED: ["Admin", "Sales"],
  PARTNER_ACTIVATED: ["Admin", "Sales"],
  REFERRAL_SUBMITTED: ["Admin", "Sales"],
  REFERRAL_INFORMATION_PROVIDED: ["Admin", "Sales"],
  REFERRAL_ACCEPTED: ["Admin", "Sales"],
  REFERRAL_CONVERTED_TO_CUSTOMER: ["Admin", "Sales"],
  REFERRAL_REJECTED: ["Admin", "Sales"],
  REFERRAL_DUPLICATE: ["Admin", "Sales"],
  PROTECTION_EXPIRING_14D: ["Admin", "Sales"],
  PROTECTION_EXPIRING_3D: ["Admin", "Sales"],
  PROTECTION_EXTENDED: ["Admin", "Sales"],
  REFERRAL_EXPIRED: ["Admin", "Sales"],
  CUSTOMER_PAYMENT_CLEARED: ["Admin", "Finance"],
  LICENCE_ACTIVATED: ["Admin", "Finance"],
  HOLDING_PERIOD_COMPLETED: ["Admin", "Finance"],
  COMMISSION_ELIGIBLE: ["Admin", "Finance"],
  COMMISSION_HELD_OR_ADJUSTED: ["Admin", "Finance"],
  COMMISSION_APPROVED: ["Admin", "Finance"],
  PAYOUT_COMPLETED: ["Admin", "Finance"],
  AGREEMENT_OR_PAYOUT_INFO_EXPIRING: ["Admin", "Sales", "Finance"],
  BANK_CHANGE_REQUESTED: ["Admin", "Finance"],
  BANK_CHANGE_DECIDED: ["Admin", "Finance"],
  QUARTERLY_GRADE_REVIEW: ["Admin"],
  SUSPENSION_OR_TERMINATION: ["Admin"],
}

export interface ReferralNotificationInput {
  event: ReferralNotificationEvent
  title: string
  body?: string
  /** Partner the notification belongs to (in-app feed). */
  partnerId?: string | null
  /** Deep link inside the portal or admin. */
  link?: string | null
  sourceType?: string | null
  sourceId?: string | null
  /** Direct email recipient (partner contact); omit to skip email. */
  emailTo?: string | null
  emailSubject?: string | null
  /** Skip the internal admin alert (e.g. partner-only echoes). */
  skipInternal?: boolean
}

export async function emitReferralNotification(input: ReferralNotificationInput): Promise<void> {
  if (!isSupabaseConfigured()) return

  let actorPartnerUserId: string | null = null
  try {
    actorPartnerUserId = (await getPartnerSession())?.partnerUserId || null
  } catch {
    actorPartnerUserId = null
  }

  // 1. Partner in-app feed
  if (input.partnerId) {
    try {
      await supabase.from("partner_notifications").insert({
        partner_id: input.partnerId,
        type: input.event,
        title: input.title,
        body: input.body || "",
        link: input.link || null,
        source_type: input.sourceType || null,
        source_id: input.sourceId || null,
        actor_partner_user_id: actorPartnerUserId,
      })
    } catch (err) {
      console.error("[referral-notifications] partner feed insert failed:", err)
    }
  }

  // 2. Internal admin alert
  if (!input.skipInternal) {
    try {
      const roles = INTERNAL_AUDIENCE[input.event] || ["Admin"]
      const { data: users } = await supabase.from("users").select("id, role").in("role", roles)
      for (const u of (users as { id: string; role: string }[] | null) || []) {
        await createAdminNotification({
          admin_user_id: u.id,
          type: `referral_${input.event.toLowerCase()}`,
          title: input.title,
          message: input.body || "",
          deep_link: input.link || undefined,
          source_type: input.sourceType || undefined,
          source_id: input.sourceId || undefined,
        })
      }
    } catch (err) {
      console.error("[referral-notifications] admin alert failed:", err)
    }
  }

  // 3. Best-effort email
  if (input.emailTo) {
    try {
      await sendEmail({
        to: input.emailTo,
        subject: input.emailSubject || input.title,
        text: [input.title, "", input.body || "", input.link ? `\n${input.link}` : ""].join("\n"),
        route: "partner_application",
      })
    } catch (err) {
      console.error("[referral-notifications] email failed:", err)
    }
  }
}

/* ─── Partner in-app feed helpers ─── */

export async function listPartnerNotifications(partnerId: string, limit = 50) {
  if (!isSupabaseConfigured()) return []
  let q = supabase
    .from("partner_notifications")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(limit)
  const actorPartnerUserId = await currentPartnerUserId()
  if (actorPartnerUserId) q = q.or(`actor_partner_user_id.is.null,actor_partner_user_id.neq.${actorPartnerUserId}`)
  const { data } = await q
  return (data as Record<string, unknown>[]) || []
}

export async function markPartnerNotificationRead(id: string, partnerId: string): Promise<void> {
  if (!isSupabaseConfigured()) return
  await supabase
    .from("partner_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("id", id)
    .eq("partner_id", partnerId)
}

export async function markAllPartnerNotificationsRead(partnerId: string): Promise<void> {
  if (!isSupabaseConfigured()) return
  let q = supabase
    .from("partner_notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .eq("partner_id", partnerId)
    .eq("is_read", false)
  const actorPartnerUserId = await currentPartnerUserId()
  if (actorPartnerUserId) q = q.or(`actor_partner_user_id.is.null,actor_partner_user_id.neq.${actorPartnerUserId}`)
  await q
}

async function currentPartnerUserId(): Promise<string | null> {
  try {
    return (await getPartnerSession())?.partnerUserId || null
  } catch {
    return null
  }
}
