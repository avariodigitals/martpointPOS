import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

async function guard() {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "customers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

interface WhatsAppMessageRow {
  id: string
  wa_message_id: string | null
  wa_id: string
  from_number: string
  to_number: string
  body: string
  direction: "inbound" | "outbound"
  status: string | null
  created_at: string
}

interface Conversation {
  wa_id: string
  phone: string
  lastMessage: string
  lastAt: string
  messages: WhatsAppMessageRow[]
}

export async function GET() {
  const denied = await guard()
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ conversations: [] })
  }

  try {
    const { data, error } = await supabase
      .from("whatsapp_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500)

    if (error) {
      console.error("[WhatsApp conversations error]", error)
      return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 })
    }

    const rows: WhatsAppMessageRow[] = (data as WhatsAppMessageRow[]) || []
    const grouped: Record<string, Conversation> = {}

    for (const msg of rows) {
      const key = msg.wa_id
      if (!grouped[key]) {
        grouped[key] = {
          wa_id: key,
          phone: key,
          lastMessage: msg.body,
          lastAt: msg.created_at,
          messages: [],
        }
      }
      grouped[key].messages.unshift(msg)
    }

    const conversations = Object.values(grouped)
      .map((c) => ({
        ...c,
        messages: c.messages.slice(0, 50).reverse(),
      }))
      .sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime())

    return NextResponse.json({ conversations })
  } catch (err) {
    console.error("[WhatsApp conversations error]", err)
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 })
  }
}
