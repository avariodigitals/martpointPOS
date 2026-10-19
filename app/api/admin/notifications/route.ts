import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { listAdminNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/admin-notifications"

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const all = new URL(request.url).searchParams.get("all") === "1"
    const notifications = await listAdminNotifications(session.userId, all ? undefined : { read: false })
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
