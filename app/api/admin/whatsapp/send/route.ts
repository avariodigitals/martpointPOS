import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getSettings } from "@/lib/settings"

async function guard() {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "customers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

export async function POST(request: Request) {
  const denied = await guard()
  if (denied) return denied

  const settings = await getSettings()
  const { apiKey, baseUrl, phoneNumber } = settings.whatsapp

  if (!apiKey) {
    return NextResponse.json({ error: "WhatsApp not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { to, message } = body
    if (!to || !message) {
      return NextResponse.json({ error: "to and message are required" }, { status: 400 })
    }

    const res = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "D360-API-KEY": apiKey,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: message },
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      console.error("[360dialog send error]", data)
      return NextResponse.json({ error: "Failed to send message" }, { status: 502 })
    }

    if (isSupabaseConfigured()) {
      await supabase.from("whatsapp_messages").insert({
        wa_message_id: data.messages?.[0]?.id || null,
        wa_id: String(to),
        from_number: phoneNumber,
        to_number: String(to),
        body: message,
        direction: "outbound",
        status: "sent",
      })
    }

    return NextResponse.json({ ok: true, message: data })
  } catch (err) {
    console.error("[WhatsApp send error]", err)
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
  }
}
