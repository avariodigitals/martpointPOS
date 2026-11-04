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
  const { data: expiredRecordings, error: recordingError } = await supabase
    .from("azera_call_recordings")
    .select("id,call_id,recording_path")
    .lt("retention_expires_at", new Date().toISOString())
    .limit(500)
  if (recordingError) return NextResponse.json({ ok: true, deletedVoicemails: ids.length, callRecordingCleanup: "Apply recording retention migration before cleanup." })
  const callIds = [...new Set((expiredRecordings || []).map((row) => row.call_id))]
  const { data: summaries } = callIds.length
    ? await supabase.from("azera_call_summaries").select("call_id,transcript_path").in("call_id", callIds)
    : { data: [] }
  const recordingPaths = (expiredRecordings || []).map((row) => row.recording_path).filter((path): path is string => Boolean(path))
  const transcriptPaths = (summaries || []).map((row) => row.transcript_path).filter((path): path is string => Boolean(path))
  if (recordingPaths.length) await supabase.storage.from("call-recordings").remove(recordingPaths)
  if (transcriptPaths.length) await supabase.storage.from("call-transcripts").remove(transcriptPaths)
  const expiredCallIds = (expiredRecordings || []).map((row) => row.call_id)
  if (expiredCallIds.length) {
    await supabase.from("azera_call_recordings").update({ recording_path: null, file_size_bytes: null }).in("call_id", expiredCallIds).lt("retention_expires_at", new Date().toISOString())
    await supabase.from("azera_call_summaries").update({ transcript: null, transcript_path: null, updated_at: new Date().toISOString() }).in("call_id", callIds)
  }
  return NextResponse.json({ ok: true, deletedVoicemails: ids.length, expiredCallRecordings: expiredRecordings?.length || 0, expiredTranscripts: transcriptPaths.length })
}

export const POST = GET
