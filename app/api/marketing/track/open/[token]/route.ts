import { supabase, isSupabaseConfigured } from "@/lib/supabase"

// 1x1 transparent GIF
const PIXEL = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64")

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/marketing/track/open/[token]">
) {
  const { token } = await ctx.params

  if (token && isSupabaseConfigured()) {
    try {
      const { data } = await supabase
        .from("marketing_sends")
        .select("id, opened_at, open_count")
        .eq("token", token)
        .single()

      if (data) {
        await supabase
          .from("marketing_sends")
          .update({
            opened_at: data.opened_at || new Date().toISOString(),
            open_count: (data.open_count || 0) + 1,
          })
          .eq("id", data.id)
      }
    } catch (err) {
      console.error("[marketing open track]", err)
    }
  }

  return new Response(new Uint8Array(PIXEL), {
    headers: {
      "Content-Type": "image/gif",
      "Content-Length": String(PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
    },
  })
}
