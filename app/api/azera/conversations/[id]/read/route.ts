import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "azera")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })

  const { id } = await params
  const { error } = await supabase
    .from("azera_messages")
    .update({ read_at: new Date().toISOString() })
    .eq("conversation_id", id)
    .eq("direction", "inbound")
    .neq("author_type", "agent")
    .is("read_at", null)

  if (error) {
    console.error("[Azera mark read error]", error)
    return NextResponse.json({ error: "Could not mark conversation as read" }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}
