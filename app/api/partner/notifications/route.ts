import { NextResponse } from "next/server"
import { authorizePartner, getPartnerSession } from "@/lib/partner-auth"
import {
  listPartnerNotifications,
  markAllPartnerNotificationsRead,
  markPartnerNotificationRead,
} from "@/lib/referral-notifications"

export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getPartnerSession()
  const auth = await authorizePartner({ session, permission: "partner:profile:view" })
  if (!auth.authorized) return auth.response!

  const notifications = await listPartnerNotifications(auth.partner!.id, 50)
  const unread = notifications.filter((item) => item.is_read !== true).length
  return NextResponse.json({
    notifications: notifications.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      body: item.body ?? null,
      link: item.link ?? null,
      readAt: item.read_at ?? null,
      createdAt: item.created_at,
    })),
    unread,
  })
}

export async function PATCH(request: Request) {
  const session = await getPartnerSession()
  const auth = await authorizePartner({ session, permission: "partner:profile:view" })
  if (!auth.authorized) return auth.response!

  const body = await request.json().catch(() => ({})) as { id?: string; all?: boolean }
  if (body.all) await markAllPartnerNotificationsRead(auth.partner!.id)
  else if (body.id) await markPartnerNotificationRead(body.id, auth.partner!.id)
  else return NextResponse.json({ error: "id or all is required" }, { status: 400 })
  return NextResponse.json({ success: true })
}
