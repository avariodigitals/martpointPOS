import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/* POST {candidateId, role?, dailyRateKobo?, applicationId?} — assign worker. */
export async function POST(request: Request, ctx: Ctx) {
  const { denied } = await authorizeAdmin("careers.deployments.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { id } = await ctx.params

  const body = await request.json().catch(() => ({}))
  if (!body.candidateId) return NextResponse.json({ error: "candidateId is required" }, { status: 400 })

  const { error } = await supabase.from("career_deployment_workers").upsert(
    {
      deployment_id: id,
      candidate_id: body.candidateId,
      application_id: body.applicationId || null,
      role: body.role === "TEAM_LEAD" ? "TEAM_LEAD" : "WORKER",
      daily_rate_kobo: body.dailyRateKobo != null ? Number(body.dailyRateKobo) : null,
      status: "ASSIGNED",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "deployment_id,candidate_id" }
  )
  if (error) return NextResponse.json({ error: "Failed to assign worker" }, { status: 500 })
  return NextResponse.json({ success: true })
}

/* PATCH {candidateId, status} — update worker status. */
export async function PATCH(request: Request, ctx: Ctx) {
  const { denied } = await authorizeAdmin("careers.deployments.manage")
  if (denied) return denied
  const { id } = await ctx.params
  const body = await request.json().catch(() => ({}))
  const allowed = ["ASSIGNED", "INVITED", "CONFIRMED", "ACTIVE", "COMPLETED", "REMOVED"]
  if (!body.candidateId || !allowed.includes(body.status)) {
    return NextResponse.json({ error: "candidateId and a valid status are required" }, { status: 400 })
  }
  const { error } = await supabase
    .from("career_deployment_workers")
    .update({ status: body.status, updated_at: new Date().toISOString() })
    .eq("deployment_id", id)
    .eq("candidate_id", body.candidateId)
  if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  return NextResponse.json({ success: true })
}

/* DELETE ?candidateId= — remove worker from deployment. */
export async function DELETE(request: Request, ctx: Ctx) {
  const { denied } = await authorizeAdmin("careers.deployments.manage")
  if (denied) return denied
  const { id } = await ctx.params
  const candidateId = new URL(request.url).searchParams.get("candidateId")
  if (!candidateId) return NextResponse.json({ error: "candidateId required" }, { status: 400 })
  const { error } = await supabase
    .from("career_deployment_workers")
    .delete()
    .eq("deployment_id", id)
    .eq("candidate_id", candidateId)
  if (error) return NextResponse.json({ error: "Failed to remove" }, { status: 500 })
  return NextResponse.json({ success: true })
}
