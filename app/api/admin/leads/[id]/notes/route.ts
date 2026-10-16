import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"

export const dynamic = "force-dynamic"

const NOTE_SELECT = "id, note, author_name, created_at"

function mapNote(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    note: row.note as string,
    authorName: (row.author_name as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}

/* GET — internal note history for a lead (newest first). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { denied } = await authorizeAdmin("leads")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { id } = await params

  const [round, leadRow] = await Promise.all([
    supabase
      .from("lead_notes")
      .select(NOTE_SELECT)
      .eq("lead_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("leads").select("notes, updated_at").eq("id", id).single(),
  ])
  const { data, error } = round
  if (error) {
    console.error("[Lead notes GET]", error)
    return NextResponse.json({ error: "Failed to load notes" }, { status: 500 })
  }
  const notes = (data || []).map(mapNote)
  // Intake forms (website quote, demo booking) still drop their text into the old
  // single `leads.notes` column, so show it instead of leaving it unreadable.
  const legacy = String(leadRow.data?.notes ?? "").trim()
  if (legacy && !notes.some((n) => n.note.trim() === legacy)) {
    notes.push({
      id: "submission",
      note: legacy,
      authorName: "From intake form",
      createdAt: String(leadRow.data?.updated_at ?? new Date(0).toISOString()),
    })
  }
  return NextResponse.json({ notes })
}

const postSchema = z.object({
  note: z.string().trim().min(1, "Write a note before saving").max(5000, "Note is too long"),
})

/* POST {note} — append one internal note (never shown to the lead). */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("leads")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { id } = await params

  const parsed = postSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid note" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("lead_notes")
    .insert({
      lead_id: id,
      note: parsed.data.note,
      author_id: session.userId,
      author_name: session.name || session.username,
    })
    .select(NOTE_SELECT)
    .single()
  if (error || !data) {
    console.error("[Lead notes POST]", error)
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 })
  }

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.LEAD_NOTE_ADDED,
    entityType: AUDIT_ENTITIES.LEAD,
    entityId: id,
  })

  return NextResponse.json({ success: true, note: mapNote(data as unknown as Record<string, unknown>) })
}
