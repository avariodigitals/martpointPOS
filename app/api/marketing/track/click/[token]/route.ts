import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/marketing/track/click/[token]">
) {
  const { token } = await ctx.params
  const { searchParams } = new URL(request.url)
  const target = searchParams.get("u") || ""

  // Only allow http(s) redirect targets
  let safeTarget = ""
  try {
    const parsed = new URL(target)
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      safeTarget = parsed.toString()
    }
  } catch {
    // invalid URL — fall through
  }

  if (token && isSupabaseConfigured()) {
    try {
      const { data } = await supabase
        .from("marketing_sends")
        .select("id, clicked_at, click_count")
        .eq("token", token)
        .single()

      if (data) {
        await supabase
          .from("marketing_sends")
          .update({
            clicked_at: data.clicked_at || new Date().toISOString(),
            click_count: (data.click_count || 0) + 1,
          })
          .eq("id", data.id)
      }
    } catch (err) {
      console.error("[marketing click track]", err)
    }
  }

  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "https://www.martpoint.com.ng").replace(/\/$/, "")
  return NextResponse.redirect(safeTarget || baseUrl, 302)
}
