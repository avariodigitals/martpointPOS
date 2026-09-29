import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { ATTENDANCE_STATUSES } from "@/lib/careers"

export const dynamic = "force-dynamic"

/* POST {records: [{candidateId, workDate, status, checkIn?, checkOut?, notes?}]}
 * Upserts attendance per deployment/candidate/date. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("careers.deployments.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { id } = await ctx.params

  const body = await request.json().catch(() => ({}))
  const records = Array.isArray(body.records) ? body.records : []
  if (records.length === 0) return NextResponse.json({ error: "records[] required" }, { status: 400 })

  const rows = []
  for (const r of records.slice(0, 500)) {
    if (!r.candidateId || !r.workDate) continue
    const status = ATTENDANCE_STATUSES.includes(r.status) ? r.status : "PRESENT"
    rows.push({
      deployment_id: id,
      candidate_id: r.candidateId,
      work_date: r.workDate,
      status,
      check_in_at: r.checkIn || null,
      check_out_at: r.checkOut || null,
      notes: r.notes || null,
      recorded_by: session.userId,
    })
  }
  if (rows.length === 0) return NextResponse.json({ error: "No valid records" }, { status: 400 })

  const { error } = await supabase
    .from("career_deployment_attendance")
    .upsert(rows, { onConflict: "deployment_id,candidate_id,work_date" })
  if (error) {
    console.error("[careers] attendance upsert failed:", error.message)
    return NextResponse.json({ error: "Failed to save attendance" }, { status: 500 })
  }
  return NextResponse.json({ success: true, saved: rows.length })
}
