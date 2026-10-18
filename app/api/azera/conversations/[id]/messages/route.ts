import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { SessionPayload, UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

type ChatMessage = Record<string, unknown> & { attachment_path?: string | null }

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
    return NextResponse.json({ messages: [] })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Number(searchParams.get("limit")) || 50, 100)

  try {
    const { data, error } = await supabase
      .from("azera_messages")
      .select("*")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true })
      .limit(limit)

    if (error) {
      console.error("[Azera messages error]", error)
      return NextResponse.json({ error: "Failed to load messages" }, { status: 500 })
    }

    const messages = await Promise.all((data || []).map(async (message: ChatMessage) => {
      if (!message.attachment_path) return message
      const { data: signed } = await supabase.storage.from("azera-chat-attachments").createSignedUrl(message.attachment_path, 3600)
      return { ...message, attachment_url: signed?.signedUrl || null }
    }))

    return NextResponse.json({ messages })
  } catch (err) {
    console.error("[Azera messages error]", err)
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 })
  }
}

export async function POST(
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
    const { message, author_type = "agent", direction = "outbound", author_id, message_type = "text", metadata = {} } = body

    if (!message || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
    }

    const { data: conv, error: convError } = await supabase
      .from("azera_conversations")
      .select("id, status, business_id")
      .eq("id", id)
      .single()

    if (convError || !conv) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    }

    const { data, error } = await supabase
      .from("azera_messages")
      .insert({
        conversation_id: id,
        author_type,
        author_id: author_id || session.userId,
        message: message.trim(),
        message_type,
        metadata,
        direction,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
    }

    await supabase
      .from("azera_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...(author_type === "agent" ? { waiting_for_agent: false, ai_enabled: false } : {}),
        status: direction === "inbound" && conv.status === "closed" ? "open" : conv.status,
      })
      .eq("id", id)

    return NextResponse.json({ message: data })
  } catch (err) {
    console.error("[Azera send message error]", err)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}
