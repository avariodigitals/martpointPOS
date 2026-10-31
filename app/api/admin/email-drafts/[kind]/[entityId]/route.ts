import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { EMAIL_DRAFT_KINDS, emailDraftSchema } from "@/lib/email-drafts"
import { sanitizeSupportHtml } from "@/lib/support-html"

type Context = { params: Promise<{ kind: string; entityId: string }> }
async function contextFor({ params }: Context) {
  const parsed = z.object({ kind: z.enum(EMAIL_DRAFT_KINDS), entityId: z.uuid() }).safeParse(await params)
  if (!parsed.success) return { denied: NextResponse.json({ error: "Invalid draft destination" }, { status: 400 }) }
  const { kind, entityId } = parsed.data
  const auth = kind === "partners" ? await authorizeAdmin("partners", "manage")
    : kind === "creators" ? await authorizeAdmin("creator.application.review") : await authorizeAdmin("leads")
  if (auth.denied) return { denied: auth.denied }
  if (!isSupabaseConfigured()) return { denied: NextResponse.json({ error: "Database not configured" }, { status: 503 }) }
  let entity = supabase.from(kind === "creators" ? "creator_applications" : kind).select("id").eq("id", entityId)
  if (kind === "creators") entity = entity.is("deleted_at", null)
  const result = await entity.maybeSingle()
  if (result.error) return { denied: NextResponse.json({ error: "Could not load the draft destination" }, { status: 500 }) }
  if (!result.data) return { denied: NextResponse.json({ error: "Draft destination not found" }, { status: 404 }) }
  return { kind, entityId, userId: auth.session.userId }
}

function unavailable() {
  return NextResponse.json({ error: "Could not access saved drafts. Check that migration 152 has been applied." }, { status: 500 })
}

function changedDraft() {
  return NextResponse.json({ error: "This draft changed in another tab or was deleted. Reload the page before saving again." }, { status: 409 })
}

export async function GET(_: Request, context: Context) {
  const ctx = await contextFor(context)
  if (ctx.denied) return ctx.denied
  const { data, error } = await supabase.from("email_composer_drafts")
    .select("draft, updated_at").eq("user_id", ctx.userId!).eq("entity_type", ctx.kind!).eq("entity_id", ctx.entityId!).maybeSingle()
  if (error) return unavailable()
  return NextResponse.json({ saved: data ? { draft: data.draft, updatedAt: data.updated_at } : null })
}

export async function PUT(request: Request, context: Context) {
  const ctx = await contextFor(context)
  if (ctx.denied) return ctx.denied
  const body = await request.json().catch(() => null)
  const reuse = z.object({ attachmentsRevision: z.string().min(1).max(64) }).safeParse(body)
  let input = body
  if (reuse.success) {
    if (body.attachments !== undefined) return NextResponse.json({ error: "Supply attachments or a saved attachment revision, not both." }, { status: 400 })
    const { data, error } = await supabase.from("email_composer_drafts")
      .select("draft").eq("user_id", ctx.userId!).eq("entity_type", ctx.kind!).eq("entity_id", ctx.entityId!)
      .eq("updated_at", reuse.data.attachmentsRevision).maybeSingle()
    if (error) return unavailable()
    if (!data) return changedDraft()
    input = { ...body, attachments: data.draft?.attachments || [] }
  } else if (body && typeof body === "object" && "attachmentsRevision" in body) {
    return NextResponse.json({ error: "Invalid saved attachment revision." }, { status: 400 })
  }
  const parsed = emailDraftSchema.safeParse(input)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const draft = { ...parsed.data, bodyHtml: sanitizeSupportHtml(parsed.data.bodyHtml) }
  const values = {
    user_id: ctx.userId, entity_type: ctx.kind, entity_id: ctx.entityId,
    draft, updated_at: new Date().toISOString(),
  }
  const { data, error } = reuse.success
    ? await supabase.from("email_composer_drafts").update(values)
      .eq("user_id", ctx.userId!).eq("entity_type", ctx.kind!).eq("entity_id", ctx.entityId!)
      .eq("updated_at", reuse.data.attachmentsRevision).select("updated_at").maybeSingle()
    : await supabase.from("email_composer_drafts").upsert(values, { onConflict: "user_id,entity_type,entity_id" }).select("updated_at").single()
  if (error) return unavailable()
  if (!data) return reuse.success ? changedDraft() : unavailable()
  if (request.headers.get("prefer") === "return=minimal") {
    return NextResponse.json({ saved: { bodyHtml: draft.bodyHtml, updatedAt: data.updated_at } })
  }
  return NextResponse.json({ saved: { draft, updatedAt: data.updated_at } })
}

export async function DELETE(_: Request, context: Context) {
  const ctx = await contextFor(context)
  if (ctx.denied) return ctx.denied
  const { error } = await supabase.from("email_composer_drafts")
    .delete().eq("user_id", ctx.userId!).eq("entity_type", ctx.kind!).eq("entity_id", ctx.entityId!)
  if (error) return unavailable()
  return NextResponse.json({ success: true })
}
