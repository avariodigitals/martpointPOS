import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Unavailable" }, { status: 503 })
  }

  try {
    const body = await request.json()
    const token = typeof body.token === "string" ? body.token : ""
    if (!token) {
      return NextResponse.json({ error: "Invalid link" }, { status: 400 })
    }

    const { error } = await supabase
      .from("status_subscribers")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("token", token)

    if (error) {
      console.error("[status/unsubscribe]", error)
      return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
