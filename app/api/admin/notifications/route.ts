import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { listAdminNotifications, markNotificationRead, markAllNotificationsRead } from "@/lib/admin-notifications"

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { searchParams } = new URL(request.url)
    const readParam = searchParams.get("read")
    const read = readParam === "true" ? true : readParam === "false" ? false : undefined

    const notifications = await listAdminNotifications(session.userId, { read })
    return NextResponse.json({ success: true, notifications })
  } catch (e) {
    console.error("[admin/notifications] GET", e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const body = await request.json()
    const { action, notificationId } = body as { action?: string; notificationId?: string }

    if (action === "mark_all_read") {
      await markAllNotificationsRead(session.userId)
    } else if (action === "mark_read" && notificationId) {
      await markNotificationRead(notificationId, session.userId)
    } else {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error("[admin/notifications] POST", e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
