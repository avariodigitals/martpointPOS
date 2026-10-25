import { NextResponse } from "next/server"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

function isAuthorized(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const auth = request.headers.get("authorization")
  const provided = (auth?.startsWith("Bearer ") ? auth.slice(7) : null) || new URL(request.url).searchParams.get("secret")
  return provided === cronSecret
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isSupabaseConfigured()) return NextResponse.json({ ok: true, deleted: 0, skipped: ["supabase not configured"] })

  const { data: expired, error } = await supabase
    .from("azera_voicemails")
    .select("id, recording_path")
    .lt("retention_expires_at", new Date().toISOString())
    .limit(500)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })

  const paths = (expired || []).map((row) => row.recording_path).filter((path): path is string => Boolean(path))
  if (paths.length) await supabase.storage.from("azera-voicemails").remove(paths)
  const ids = (expired || []).map((row) => row.id)
  if (ids.length) {
    const { error: deleteError } = await supabase.from("azera_voicemails").delete().in("id", ids)
    if (deleteError) return NextResponse.json({ ok: false, error: deleteError.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, deleted: ids.length })
}

export const POST = GET
