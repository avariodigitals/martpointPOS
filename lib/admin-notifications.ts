import { supabase, isSupabaseConfigured } from "./supabase"
import { getAllUsers } from "./admin-auth"
import { getEmailRoute, getEmailSettings, sendEmail } from "./email"
import type { UserRole } from "./admin-types"

export type AdminNotification = {
  id: string
  admin_user_id: string
  type: string
  title: string
  message?: string | null
  deep_link?: string | null
  is_read: boolean
  source_type?: string | null
  source_id?: string | null
  created_at: string
  read_at?: string | null
}

function now() {
  return new Date().toISOString()
}

export async function createAdminNotification(input: {
  admin_user_id: string
  type: string
  title: string
  message?: string
  deep_link?: string
  source_type?: string
  source_id?: string
}): Promise<AdminNotification> {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const { data, error } = await supabase
    .from("admin_notifications")
    .insert({
      admin_user_id: input.admin_user_id,
      type: input.type,
      title: input.title,
      message: input.message,
      deep_link: input.deep_link,
      is_read: false,
      source_type: input.source_type,
      source_id: input.source_id,
      created_at: now(),
    })
    .select()
    .single()

  if (error || !data) throw new Error(`Notification create failed: ${error?.message || "unknown"}`)
  return data as AdminNotification
}

/**
 * Fan an operational event out to every active admin account.
 * Notification delivery is deliberately best-effort: an alert must never
 * make the customer-facing request fail.
 */
export async function notifyAllAdmins(input: {
  type: string
  title: string
  message?: string
  deep_link?: string
  source_type?: string
  source_id?: string
  exclude_admin_user_id?: string
  /** If supplied, only active admin-portal users in these roles get the bell. */
  roles?: UserRole[]
  /** Optional internal email sent alongside the per-admin bell alerts. */
  email?: {
    route?: string
    to?: string | string[]
    subject: string
    text: string
    html?: string
    replyTo?: string
  }
}): Promise<void> {
  if (!isSupabaseConfigured()) return

  const users = (await getAllUsers()).filter(
    (user) =>
      user.status === "ACTIVE" &&
      user.id !== input.exclude_admin_user_id &&
      (!input.roles || input.roles.includes(user.role)),
  )

  const bellDelivery = Promise.all(
    users.map((user) =>
      createAdminNotification({
        admin_user_id: user.id,
        type: input.type,
        title: input.title,
        message: input.message,
        deep_link: input.deep_link,
        source_type: input.source_type,
        source_id: input.source_id,
      }).catch((error) => {
        console.error("[admin notifications] fan-out failed", error)
      }),
    ),
  )

  const emailDelivery = input.email
    ? (async () => {
        const configuredRecipients = input.email?.to
          ? Array.isArray(input.email.to) ? input.email.to : [input.email.to]
          : input.email?.route
            ? await getEmailRoute(input.email.route)
            : []
        const settings = await getEmailSettings()
        const fallback = settings.notifyEmail || process.env.NOTIFY_EMAIL || ""
        const recipients = [...new Set(configuredRecipients.length > 0 ? configuredRecipients : (fallback ? [fallback] : []))]
          .map((email) => email.trim())
          .filter((email) => email.includes("@"))
        if (recipients.length === 0) {
          console.warn(`[admin notifications] no email recipient for ${input.type}`)
          return
        }
        const email = input.email!
        const sent = await sendEmail({
          to: recipients,
          subject: email.subject,
          text: email.text,
          html: email.html,
          replyTo: email.replyTo,
        })
        if (!sent) console.error(`[admin notifications] email delivery failed for ${input.type}`)
      })().catch((error) => {
        console.error(`[admin notifications] email fan-out failed for ${input.type}`, error)
      })
    : Promise.resolve()

  await Promise.all([bellDelivery, emailDelivery])
}

export async function listAdminNotifications(adminUserId: string, options?: { read?: boolean }): Promise<AdminNotification[]> {
  if (!isSupabaseConfigured()) return []
  let q = supabase
    .from("admin_notifications")
    .select("*")
    .eq("admin_user_id", adminUserId)
    .order("created_at", { ascending: false })

  if (options?.read !== undefined) q = q.eq("is_read", options.read)

  const { data, error } = await q
  if (error) throw new Error(`Notification list failed: ${error.message}`)
  return (data || []) as AdminNotification[]
}

export async function markNotificationRead(notificationId: string, adminUserId: string): Promise<void> {
  if (!isSupabaseConfigured()) return
  await supabase
    .from("admin_notifications")
    .update({ is_read: true, read_at: now() })
    .eq("id", notificationId)
    .eq("admin_user_id", adminUserId)
}

export async function markAllNotificationsRead(adminUserId: string): Promise<void> {
  if (!isSupabaseConfigured()) return
  await supabase
    .from("admin_notifications")
    .update({ is_read: true, read_at: now() })
    .eq("admin_user_id", adminUserId)
    .eq("is_read", false)
}
