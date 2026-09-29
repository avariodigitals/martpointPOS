import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export const dynamic = "force-dynamic"

/* POST {records: [{candidateId, workDate, productsCaptured, verifiedProducts, errors, supervisorRating?, qualityNotes?, notes?}]}
 * Upserts daily performance per deployment/candidate/date. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("careers.deployments.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { id } = await ctx.params

  const body = await request.json().catch(() => ({}))
  const records = Array.isArray(body.records) ? body.records : []
  if (records.length === 0) return NextResponse.json({ error: "records[] required" }, { status: 400 })

  const int = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0
  }

  const rows = []
  for (const r of records.slice(0, 500)) {
    if (!r.candidateId || !r.workDate) continue
    rows.push({
      deployment_id: id,
      candidate_id: r.candidateId,
      work_date: r.workDate,
      products_captured: int(r.productsCaptured),
      verified_products: int(r.verifiedProducts),
      errors: int(r.errors),
      supervisor_rating: r.supervisorRating != null && r.supervisorRating !== "" ? Number(r.supervisorRating) : null,
      quality_notes: r.qualityNotes || null,
      notes: r.notes || null,
      recorded_by: session.userId,
      updated_at: new Date().toISOString(),
    })
  }
  if (rows.length === 0) return NextResponse.json({ error: "No valid records" }, { status: 400 })

  const { error } = await supabase
    .from("career_deployment_performance")
    .upsert(rows, { onConflict: "deployment_id,candidate_id,work_date" })
  if (error) {
    console.error("[careers] performance upsert failed:", error.message)
    return NextResponse.json({ error: "Failed to save performance" }, { status: 500 })
  }
  return NextResponse.json({ success: true, saved: rows.length })
}
