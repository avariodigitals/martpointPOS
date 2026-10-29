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
  const parsed = emailDraftSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  const draft = { ...parsed.data, bodyHtml: sanitizeSupportHtml(parsed.data.bodyHtml) }
  const { data, error } = await supabase.from("email_composer_drafts").upsert({
    user_id: ctx.userId, entity_type: ctx.kind, entity_id: ctx.entityId,
    draft, updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,entity_type,entity_id" }).select("updated_at").single()
  if (error || !data) return unavailable()
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
