import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { isSupabaseConfigured } from "@/lib/supabase"
import { createPartnerInvitation, listPartnerInvitations, listPartnerUsers } from "@/lib/partner-service"
import type { PartnerUserRole } from "@/lib/partner-auth"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied

  const { partnerId } = await params
  if (!isSupabaseConfigured()) return NextResponse.json({ users: [], invitations: [] })

  const [users, invitations] = await Promise.all([
    listPartnerUsers(partnerId),
    listPartnerInvitations(partnerId),
  ])

  return NextResponse.json({ users, invitations })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  const { partnerId } = await params

  try {
    const body = await request.json()
    const { fullName, email, role } = body
    if (!fullName || !email || !role) {
      return NextResponse.json({ error: "Full name, email and role are required" }, { status: 400 })
    }

    const result = await createPartnerInvitation({
      partnerId,
      fullName,
      email,
      role: role as PartnerUserRole,
      invitedBy: session!.userId,
      actorType: "ADMIN",
    })

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true, user: result.user })
  } catch {
    return NextResponse.json({ error: "Failed to invite user" }, { status: 500 })
  }
}
