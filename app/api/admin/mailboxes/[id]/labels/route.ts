import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { canAccessMailbox } from "@/lib/admin-mailbox"
import { supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("mailbox")
  if (denied) return denied
  const { id } = await params
  try {
    if (!(await canAccessMailbox(id, session.userId, session.role === "Admin"))) return NextResponse.json({ error: "You do not have access to this mailbox." }, { status: 403 })
    const { data, error } = await supabase.from("admin_mailbox_labels").select("id,name,color").eq("mailbox_id", id).order("name")
    if (error) throw new Error(error.message)
    return NextResponse.json({ labels: data || [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load labels." }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("mailbox")
  if (denied) return denied
  const { id } = await params
  try {
    if (!(await canAccessMailbox(id, session.userId, session.role === "Admin"))) return NextResponse.json({ error: "You do not have access to this mailbox." }, { status: 403 })
    const schema = z.object({ name: z.string().trim().min(1).max(40), color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0f766e") })
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: "Enter a label name of 1 to 40 characters." }, { status: 400 })
    const { data: label, error } = await supabase.from("admin_mailbox_labels").insert({ mailbox_id: id, name: parsed.data.name, color: parsed.data.color, created_by: session.userId }).select("id,name,color").single()
    if (error) return NextResponse.json({ error: error.code === "23505" ? "That label already exists in this mailbox." : error.message }, { status: error.code === "23505" ? 409 : 500 })
    return NextResponse.json({ label }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create label." }, { status: 500 })
  }
}
