import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { listAdminNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/admin-notifications"
import { supabase } from "@/lib/supabase"

const legacyFinanceRequestAction = (type: string): string | null => {
  const match = /^FINANCE_(INVOICES|PAYMENTS|SUBSCRIPTIONS|COMMISSIONS|PAYOUTS)_REQUEST_(.+)$/.exec(type)
  if (!match) return null
  const [, resource, action] = match
  const prefix: Record<string, string> = {
    INVOICES: "finance.invoice",
    PAYMENTS: "finance.payment",
    SUBSCRIPTIONS: "finance.subscription",
    COMMISSIONS: "finance.commission",
    PAYOUTS: "finance.payout",
  }
  return `${prefix[resource]}.${action.toLowerCase()}`
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const all = new URL(request.url).searchParams.get("all") === "1"
    let notifications = await listAdminNotifications(session.userId, all ? undefined : { read: false })
    const legacyRequestNotifications = notifications.filter((item) => legacyFinanceRequestAction(item.type))
    if (legacyRequestNotifications.length) {
      const actionKeys = [...new Set(legacyRequestNotifications.map((item) => legacyFinanceRequestAction(item.type)).filter((key): key is string => Boolean(key)))]
      const { data: policies } = await supabase.from("approval_policies").select("action_key,enabled,approver_roles,approver_user_ids").in("action_key", actionKeys)
      const policyByKey = new Map((policies || []).map((policy) => [policy.action_key, policy]))
      notifications = notifications.filter((item) => {
        const actionKey = legacyFinanceRequestAction(item.type)
        if (!actionKey) return true
        const policy = policyByKey.get(actionKey)
        return Boolean(policy?.enabled && (
          (Array.isArray(policy.approver_roles) && policy.approver_roles.includes(session.role)) ||
          (Array.isArray(policy.approver_user_ids) && policy.approver_user_ids.includes(session.userId))
        ))
      }).map((item) => legacyFinanceRequestAction(item.type) ? { ...item, deep_link: "/admin/approvals" } : item)
    }
    const unread = all ? notifications.filter((notification) => !notification.is_read).length : notifications.length
    return NextResponse.json({ success: true, notifications: notifications.slice(0, 50), unread })
  } catch (error) {
    console.error("[admin notifications] list failed", error)
    return NextResponse.json({ notifications: [], unread: 0 })
  }
}

export async function PATCH(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { id?: string; all?: boolean }
  if (body.all) await markAllNotificationsRead(session.userId)
  else if (body.id) await markNotificationRead(body.id, session.userId)
  else return NextResponse.json({ error: "id or all is required" }, { status: 400 })
  return NextResponse.json({ success: true })
}
