import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { text, href, pagePath, referrer } = body

    if (!text || !pagePath) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (isSupabaseConfigured()) {
      await supabase.from("clicks").insert({
        text: String(text).slice(0, 100),
        href: String(href || "").slice(0, 500),
        page_path: String(pagePath).slice(0, 200),
        referrer: String(referrer || "").slice(0, 500),
        timestamp: new Date().toISOString(),
        user_agent: request.headers.get("user-agent")?.slice(0, 200) || "",
        ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "",
      })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
}
