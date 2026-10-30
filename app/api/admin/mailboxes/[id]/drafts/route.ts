import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { canAccessMailbox } from "@/lib/admin-mailbox"
import { supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const draftSchema = z.object({
  to: z.string().max(5000).default(""),
  cc: z.string().max(5000).default(""),
  subject: z.string().max(998).default(""),
  body: z.string().max(1_000_000).default(""),
  showCc: z.boolean().optional(),
})

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("mailbox")
  if (denied) return denied
  const { id } = await params
  try {
    if (!(await canAccessMailbox(id, session.userId, session.role === "Admin"))) return NextResponse.json({ error: "You do not have access to this mailbox." }, { status: 403 })
    const { data, error } = await supabase.from("admin_mailbox_drafts").select("id,mailbox_id,thread_id,draft,updated_at").eq("mailbox_id", id).eq("user_id", session.userId).order("updated_at", { ascending: false })
    if (error) throw new Error(error.message)
    return NextResponse.json({ drafts: data || [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load drafts." }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("mailbox")
  if (denied) return denied
  const { id } = await params
  try {
    if (!(await canAccessMailbox(id, session.userId, session.role === "Admin"))) return NextResponse.json({ error: "You do not have access to this mailbox." }, { status: 403 })
    const body = await request.json()
    const parsed = draftSchema.safeParse(body.draft)
    if (!parsed.success) return NextResponse.json({ error: "Draft fields are invalid or too long." }, { status: 400 })
    const draftId = typeof body.id === "string" ? body.id : ""
    const values = { mailbox_id: id, user_id: session.userId, thread_id: typeof body.threadId === "string" ? body.threadId : null, draft: parsed.data, updated_at: new Date().toISOString() }
    if (draftId) {
      const { data, error } = await supabase.from("admin_mailbox_drafts").update(values).eq("id", draftId).eq("mailbox_id", id).eq("user_id", session.userId).select("id,updated_at").maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) return NextResponse.json({ error: "Draft not found." }, { status: 404 })
      return NextResponse.json({ draft: data })
    }
    const { data, error } = await supabase.from("admin_mailbox_drafts").insert(values).select("id,updated_at").single()
    if (error) throw new Error(error.message)
    return NextResponse.json({ draft: data }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not save draft." }, { status: 500 })
  }
}
