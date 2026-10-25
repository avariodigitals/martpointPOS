import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { SessionPayload, UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

async function requireSession(): Promise<SessionPayload | null> {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "azera")) {
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
    const { status, assigned_admin_user_id, customer_name, customer_phone, ai_enabled, queue } = body
    if (status !== undefined && !["open", "assigned", "closed"].includes(status)) return NextResponse.json({ error: "Invalid conversation status" }, { status: 400 })
    if (queue !== undefined && !["sales", "support", "customer_support"].includes(queue)) return NextResponse.json({ error: "Invalid support queue" }, { status: 400 })
    const { data: previous } = await supabase.from("azera_conversations").select("id,status,assigned_admin_user_id,queue").eq("id", id).maybeSingle()
    if (!previous) return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    if (previous.status === "closed" && (queue !== undefined || assigned_admin_user_id !== undefined)) return NextResponse.json({ error: "Reopen this chat before transferring it." }, { status: 409 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status !== undefined) updates.status = status
    if (queue !== undefined) { updates.queue = queue; updates.assigned_admin_user_id = null; updates.waiting_for_agent = true; updates.ai_enabled = false; updates.status = "open" }
    if (assigned_admin_user_id === null) { updates.assigned_admin_user_id = null; updates.waiting_for_agent = true; updates.status = "open" }
    else if (assigned_admin_user_id !== undefined) {
      const assignee = assigned_admin_user_id === "me" ? session.userId : assigned_admin_user_id
      if (assigned_admin_user_id === "me" && previous.assigned_admin_user_id && previous.assigned_admin_user_id !== session.userId) return NextResponse.json({ error: "This chat belongs to another agent. Use Transfer instead." }, { status: 409 })
      const { data: agent } = await supabase
        .from("azera_agent_presence")
        .select("user_id,queues")
        .eq("user_id", assignee)
        .eq("is_online", true)
        .gte("last_seen_at", new Date(Date.now() - 90_000).toISOString())
        .maybeSingle()
      if (!agent) return NextResponse.json({ error: "Only an online, explicitly enabled agent can take a chat" }, { status: 409 })
      if (!agent.queues?.includes(queue || previous.queue)) return NextResponse.json({ error: "This agent does not cover the selected queue." }, { status: 409 })
      updates.assigned_admin_user_id = assignee
      updates.waiting_for_agent = false
      updates.ai_enabled = false
      updates.status = "assigned"
    }
    if (customer_name !== undefined) updates.customer_name = customer_name
    if (customer_phone !== undefined) updates.customer_phone = customer_phone
    if (ai_enabled !== undefined) updates.ai_enabled = ai_enabled

    let query = supabase
      .from("azera_conversations")
      .update(updates)
      .eq("id", id)
    query = previous.assigned_admin_user_id ? query.eq("assigned_admin_user_id", previous.assigned_admin_user_id) : query.is("assigned_admin_user_id", null)
    const { data, error } = await query
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 })
    }
    if (queue !== undefined || assigned_admin_user_id !== undefined || status !== undefined) {
      await supabase.from("azera_conversation_events").insert({ conversation_id: id, actor_user_id: session.userId, event_type: "updated", metadata: { queue: data.queue, assigned_admin_user_id: data.assigned_admin_user_id, status: data.status } })
    }

    return NextResponse.json({ conversation: data })
  } catch (err) {
    console.error("[Azera conversation patch error]", err)
    return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 })
  }
}
