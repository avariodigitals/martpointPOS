import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { SessionPayload, UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

type ConversationRow = {
  azera_messages?: Array<{ created_at: string; direction: string; author_type: string; message: string }>
  [key: string]: unknown
}

async function requireSession(): Promise<SessionPayload | null> {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "azera")) {
    return null
  }
  return session
}

export async function GET(request: Request) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ conversations: [] })
  }

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get("business_id")
  const status = searchParams.get("status")
  const channel = searchParams.get("channel")
  const assignedToMe = searchParams.get("assigned_to_me") === "1"

  try {
    let query = supabase
      .from("azera_conversations")
      .select(`
        *,
        azera_messages (
          id, author_type, author_id, message, direction, created_at
        )
      `)
      .order("last_message_at", { ascending: false })

    if (businessId) query = query.eq("business_id", businessId)
    if (status) query = query.eq("status", status)
    if (channel) query = query.eq("channel", channel)
    if (assignedToMe) query = query.eq("assigned_admin_user_id", session.userId)

    const { data, error } = await query.limit(200)

    if (error) {
      console.error("[Azera conversations error]", error)
      return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 })
    }

    const conversations = ((data || []) as ConversationRow[]).map((c) => {
      const msgs = c.azera_messages || []
      const last = msgs
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      const unread = msgs.filter(
        (m) => m.direction === "inbound" && m.author_type !== "agent"
      ).length
      return {
        id: c.id,
        business_id: c.business_id,
        channel: c.channel,
        external_id: c.external_id,
        customer_name: c.customer_name,
        customer_phone: c.customer_phone,
        status: c.status,
        assigned_admin_user_id: c.assigned_admin_user_id,
        ticket_id: c.ticket_id,
        ai_enabled: c.ai_enabled,
        queue: c.queue || "customer_support",
        triage_state: c.triage_state || "needs_triage",
        waiting_for_agent: Boolean(c.waiting_for_agent),
        handoff_summary: c.handoff_summary || null,
        escalation_reason: c.escalation_reason || null,
        knowledge_refs: c.knowledge_refs || [],
        last_message_at: c.last_message_at,
        created_at: c.created_at,
        last_message: last
          ? { message: last.message, author_type: last.author_type, created_at: last.created_at }
          : null,
        unread_count: unread,
      }
    })

    return NextResponse.json({ conversations })
  } catch (err) {
    console.error("[Azera conversations error]", err)
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()
    const {
      business_id,
      channel = "website",
      external_id,
      customer_name,
      customer_phone,
      ai_enabled = true,
    } = body

    if (!business_id || !external_id) {
      return NextResponse.json(
        { error: "business_id and external_id are required" },
        { status: 400 }
      )
    }

    const { data: existing } = await supabase
      .from("azera_conversations")
      .select("*")
      .eq("business_id", business_id)
      .eq("channel", channel)
      .eq("external_id", external_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json({ conversation: existing })
    }

    const { data, error } = await supabase
      .from("azera_conversations")
      .insert({
        business_id,
        channel,
        external_id,
        customer_name,
        customer_phone,
        status: "open",
        ai_enabled,
        last_message_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 })
    }

    return NextResponse.json({ conversation: data })
  } catch (err) {
    console.error("[Azera create conversation error]", err)
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 })
  }
}
