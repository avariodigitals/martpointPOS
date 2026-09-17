import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

/* ─── POST: opt-out via per-send token → suppression list ─── */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const token = String(body?.token || "").trim()

    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Service unavailable" }, { status: 500 })
    }

    const { data: send } = await supabase
      .from("marketing_sends")
      .select("email")
      .eq("token", token)
      .single()

    if (!send?.email) {
      return NextResponse.json({ error: "Invalid unsubscribe link" }, { status: 404 })
    }

    const email = send.email.trim().toLowerCase()
    const { error } = await supabase
      .from("marketing_unsubscribes")
      .upsert({ email, source: "unsubscribe_link" }, { onConflict: "email" })

    if (error) {
      console.error("[marketing unsubscribe]", error)
      return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 })
  }
}
