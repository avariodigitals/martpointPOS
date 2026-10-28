import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin, hasPermission } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession } from "@/lib/audit"

type Kind = "creator" | "application"
const uuid = z.string().uuid()
const noteSchema = z.object({
  callId: uuid,
  summary: z.string().trim().min(5).max(5000),
  outcome: z.enum(["discussed", "follow_up_required", "no_answer", "not_interested", "other"])
})
const fail = (error: string, status = 400) =>
  NextResponse.json({ error }, { status, headers: { "Cache-Control": "private, no-store" } })

export async function creatorCallHistory(request: Request, id: string, kind: Kind) {
  const { session, denied } = await authorizeAdmin("creator.view")
  if (denied) return denied
  if (!hasPermission(session.role, "azera")) return fail("Calling history access is required.", 403)
  if (!uuid.safeParse(id).success) return fail("Invalid profile ID")
  if (!isSupabaseConfigured()) return fail("Call history is temporarily unavailable.", 503)
  try {
    const table = kind === "creator" ? "creators" : "creator_applications"
    let profileQuery = supabase
      .from(table)
      .select(kind === "creator" ? "id,application_id" : "id,created_creator_id")
      .eq("id", id)
    if (kind === "application") profileQuery = profileQuery.is("deleted_at", null)
    const profile = await profileQuery.maybeSingle()
    if (profile.error) return fail("Could not load creator identity.", 503)
    if (!profile.data) return fail("Creator profile not found.", 404)
    const row = profile.data as unknown as {
      id: string
      application_id?: string
      created_creator_id?: string
    }
    const creatorId = kind === "creator" ? id : row.created_creator_id
    const applicationId = kind === "application" ? id : row.application_id
    const filters = [
      creatorId ? `creator_id.eq.${creatorId}` : "",
      applicationId ? `creator_application_id.eq.${applicationId}` : ""
    ]
      .filter(Boolean)
      .join(",")
    const canSummarize = hasPermission(
      session.role,
      kind === "creator" ? "creator.manage" : "creator.application.review"
    )
    if (request.method === "POST") {
      if (!canSummarize) return fail("You do not have permission to add creator call summaries.", 403)
      const origin = request.headers.get("origin")
      if (origin && origin !== new URL(request.url).origin) return fail("Forbidden", 403)
      const input = noteSchema.safeParse(await request.json().catch(() => null))
      if (!input.success) return fail("Choose a call, outcome and summary (5–5,000 characters).")
      const call = await supabase
        .from("azera_calls")
        .select("id")
        .eq("id", input.data.callId)
        .or(filters)
        .maybeSingle()
      if (call.error) return fail("Could not verify the call's creator link.", 503)
      if (!call.data) return fail("This call does not belong to this creator.", 404)
      const { data, error } = await supabase
        .from("creator_call_summaries")
        .insert({
          call_id: input.data.callId,
          summary: input.data.summary,
          outcome: input.data.outcome,
          author_user_id: session.userId,
          author_name: session.name || session.username
        })
        .select("id,call_id,summary,outcome,author_name,created_at")
        .single()
      if (error || !data) return fail("Could not save the audited summary. Verify migration 150.", 503)
      await recordAudit(auditContextFromSession(session, request), {
        action: "CREATOR_CALL_SUMMARY_ADDED",
        entityType: "azera_call",
        entityId: input.data.callId,
        metadata: { profileType: kind, profileId: id, summaryId: data.id, outcome: input.data.outcome }
      })
      return NextResponse.json(
        { summary: data },
        { status: 201, headers: { "Cache-Control": "private, no-store" } }
      )
    }
    const url = new URL(request.url)
    const rawPage = Number(url.searchParams.get("page") || 1)
    const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 10000) : 1
    const size = 20
    const { data, error, count } = await supabase
      .from("azera_calls")
      .select(
        "id,created_at,started_at,answered_at,ended_at,status,direction,duration_seconds,agent_name,customer_phone,sip_provider,sip_call_sid,follow_up_status,follow_up_notes,follow_up_at,final_outcome,creator_call_summaries(id,summary,outcome,author_name,created_at),azera_call_events(id,event_type,actor_type,created_at)",
        { count: "exact" }
      )
      .or(filters)
      .order("created_at", { ascending: false })
      .range((page - 1) * size, page * size - 1)
    if (error) return fail("Could not load call audit history. Verify migration 150.", 503)
    return NextResponse.json(
      { calls: data || [], page, total: count || 0, hasMore: page * size < (count || 0), canSummarize },
      { headers: { "Cache-Control": "private, no-store" } }
    )
  } catch (error) {
    console.error("[Creator call history]", error)
    return fail("Could not load creator call history.", 500)
  }
}
