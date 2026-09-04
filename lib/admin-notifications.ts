import { supabase, isSupabaseConfigured } from "./supabase"

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
