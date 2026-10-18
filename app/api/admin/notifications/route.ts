import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { listAdminNotifications, markAllNotificationsRead, markNotificationRead } from "@/lib/admin-notifications"

export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const notifications = await listAdminNotifications(session.userId, { read: false })
    return NextResponse.json({ notifications: notifications.slice(0, 30), unread: notifications.length })
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
