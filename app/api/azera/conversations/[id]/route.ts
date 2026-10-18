import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { SessionPayload, UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

async function requireSession(): Promise<SessionPayload | null> {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "support")) {
    return null
  }
  return session
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const { data, error } = await supabase
      .from("azera_conversations")
      .select("*")
      .eq("id", id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    return NextResponse.json({ conversation: data })
  } catch (err) {
    console.error("[Azera conversation get error]", err)
    return NextResponse.json({ error: "Failed to load conversation" }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { status, assigned_admin_user_id, customer_name, customer_phone, ai_enabled } = body

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status !== undefined) updates.status = status
    if (assigned_admin_user_id !== undefined) updates.assigned_admin_user_id = assigned_admin_user_id
    if (customer_name !== undefined) updates.customer_name = customer_name
    if (customer_phone !== undefined) updates.customer_phone = customer_phone
    if (ai_enabled !== undefined) updates.ai_enabled = ai_enabled

    const { data, error } = await supabase
      .from("azera_conversations")
      .update(updates)
      .eq("id", id)
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 })
    }

    return NextResponse.json({ conversation: data })
  } catch (err) {
    console.error("[Azera conversation patch error]", err)
    return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 })
  }
}
