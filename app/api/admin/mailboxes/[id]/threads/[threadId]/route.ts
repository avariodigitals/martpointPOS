import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { canAccessMailbox } from "@/lib/admin-mailbox"
import { supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; threadId: string }> }) {
  const { session, denied } = await authorizeAdmin("mailbox")
  if (denied) return denied
  const { id, threadId } = await params
  try {
    if (!(await canAccessMailbox(id, session.userId, session.role === "Admin"))) return NextResponse.json({ error: "You do not have access to this mailbox." }, { status: 403 })
    const { data: thread, error } = await supabase.from("admin_mailbox_threads").select("*").eq("mailbox_id", id).eq("id", threadId).maybeSingle()
    if (error || !thread) return NextResponse.json({ error: error?.message || "Conversation not found." }, { status: 404 })
    const { data: messages, error: messagesError } = await supabase.from("admin_mailbox_messages").select("*").eq("thread_id", threadId).order("created_at", { ascending: true })
    if (messagesError) throw new Error(messagesError.message)
    const { data: labelLinks, error: labelsError } = await supabase.from("admin_mailbox_thread_labels").select("label:admin_mailbox_labels(id,name,color)").eq("thread_id", threadId)
    if (labelsError) throw new Error(labelsError.message)
    await supabase.from("admin_mailbox_thread_state").upsert({ thread_id: threadId, user_id: session.userId, is_read: true }, { onConflict: "thread_id,user_id" })
    return NextResponse.json({ thread: { ...thread, labels: (labelLinks || []).flatMap((link) => Array.isArray(link.label) ? link.label : [link.label]).filter(Boolean) }, messages: messages || [] })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load conversation." }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; threadId: string }> }) {
  const { session, denied } = await authorizeAdmin("mailbox")
  if (denied) return denied
  const { id, threadId } = await params
  try {
    if (!(await canAccessMailbox(id, session.userId, session.role === "Admin"))) return NextResponse.json({ error: "You do not have access to this mailbox." }, { status: 403 })
    const body = await request.json()
    const { data: thread } = await supabase.from("admin_mailbox_threads").select("id,assigned_to").eq("id", threadId).eq("mailbox_id", id).maybeSingle()
    if (!thread) return NextResponse.json({ error: "Conversation not found." }, { status: 404 })
    const fields: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (typeof body.starred === "boolean") fields.is_starred = body.starred
    if (body.status === "open" || body.status === "closed" || body.status === "deleted") fields.status = body.status
    if (body.assignToMe === true) {
      fields.assigned_to = session.userId
    }
    if (body.unassign === true) fields.assigned_to = null
    if (body.assignTo === null) fields.assigned_to = null
    if (typeof body.assignTo === "string") {
      const membership = await supabase.from("admin_mailbox_members").select("user_id").eq("mailbox_id", id).eq("user_id", body.assignTo).maybeSingle()
      if (membership.error) throw new Error(membership.error.message)
      if (!membership.data) return NextResponse.json({ error: "That teammate does not have access to this mailbox." }, { status: 400 })
      fields.assigned_to = body.assignTo
    }
    if (Array.isArray(body.labelIds)) {
      const labelIds = [...new Set(body.labelIds.map(String))]
      const validLabels = labelIds.length ? await supabase.from("admin_mailbox_labels").select("id").eq("mailbox_id", id).in("id", labelIds) : { data: [], error: null }
      if (validLabels.error) throw new Error(validLabels.error.message)
      if ((validLabels.data || []).length !== labelIds.length) return NextResponse.json({ error: "One or more labels do not belong to this mailbox." }, { status: 400 })
      const { error: clearError } = await supabase.from("admin_mailbox_thread_labels").delete().eq("thread_id", threadId)
      if (clearError) throw new Error(clearError.message)
      if (labelIds.length) {
        const { error: insertError } = await supabase.from("admin_mailbox_thread_labels").insert(labelIds.map((label_id) => ({ thread_id: threadId, label_id })))
        if (insertError) throw new Error(insertError.message)
      }
      const { data: links, error: linksError } = await supabase.from("admin_mailbox_thread_labels").select("label:admin_mailbox_labels(id,name,color)").eq("thread_id", threadId)
      if (linksError) throw new Error(linksError.message)
      const labels = (links || []).flatMap((link) => Array.isArray(link.label) ? link.label : [link.label]).filter(Boolean)
      const { error: updateError } = await supabase.from("admin_mailbox_threads").update(fields).eq("id", threadId).eq("mailbox_id", id)
      if (updateError) throw new Error(updateError.message)
      return NextResponse.json({ success: true, labels })
    }
    const { error } = await supabase.from("admin_mailbox_threads").update(fields).eq("id", threadId).eq("mailbox_id", id)
    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update conversation." }, { status: 500 })
  }
}
