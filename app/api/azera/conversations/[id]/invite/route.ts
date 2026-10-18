import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { SessionPayload, UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { createAdminNotification } from "@/lib/admin-notifications"

async function requireSession(): Promise<SessionPayload | null> {
  const value = await getSession()
  return value && hasPermission(value.role as UserRole, "azera") ? value : null
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSession()
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  let userId = typeof body.user_id === "string" ? body.user_id : ""

  if (!userId) {
    const { data: candidate } = await supabase
      .from("azera_agent_presence")
      .select("user_id")
      .eq("is_online", true)
      .contains("queues", ["support"])
      .neq("user_id", session.userId)
      .limit(1)
      .maybeSingle()
    userId = candidate?.user_id || ""
  }
  if (!userId) return NextResponse.json({ error: "No online technical agent is available" }, { status: 409 })

  const { error } = await supabase.from("azera_conversation_participants").upsert({
    conversation_id: id,
    user_id: userId,
    invited_by: session.userId,
    participant_role: "technical",
    status: "invited",
  }, { onConflict: "conversation_id,user_id" })
  if (error) return NextResponse.json({ error: "Could not invite technical agent" }, { status: 500 })

  await createAdminNotification({
    admin_user_id: userId,
    type: "OMNICHANNEL_INBOUND",
    title: "Technical agent invited",
    message: `${session.name} invited you to collaborate on an Azera chat.`,
    deep_link: `/admin/azera?conversation=${id}`,
    source_type: "azera_conversation",
    source_id: id,
  })
  return NextResponse.json({ invited: true, user_id: userId })
}
