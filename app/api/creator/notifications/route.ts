import { NextResponse } from "next/server"
import { authorizeCreator } from "@/lib/creator-auth"
import {
  listCreatorNotifications,
  markCreatorNotificationRead,
  markCreatorNotificationsRead,
} from "@/lib/creator-notifications"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await authorizeCreator()
  if (auth.denied) return auth.denied

  const notifications = await listCreatorNotifications(auth.creator!.id, 50)
  return NextResponse.json({
    notifications,
    unread: notifications.filter((item) => !item.readAt).length,
  })
}

export async function PATCH(request: Request) {
  const auth = await authorizeCreator()
  if (auth.denied) return auth.denied

  const body = await request.json().catch(() => ({})) as { id?: string; all?: boolean }
  if (body.all) await markCreatorNotificationsRead(auth.creator!.id)
  else if (body.id) await markCreatorNotificationRead(auth.creator!.id, body.id)
  else return NextResponse.json({ error: "id or all is required" }, { status: 400 })
  return NextResponse.json({ success: true })
}
