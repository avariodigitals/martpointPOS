import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { canAccessMailbox } from "@/lib/admin-mailbox"
import { supabase } from "@/lib/supabase"

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; draftId: string }> }) {
  const { session, denied } = await authorizeAdmin("mailbox")
  if (denied) return denied
  const { id, draftId } = await params
  try {
    if (!(await canAccessMailbox(id, session.userId, session.role === "Admin"))) return NextResponse.json({ error: "You do not have access to this mailbox." }, { status: 403 })
    const { error } = await supabase.from("admin_mailbox_drafts").delete().eq("id", draftId).eq("mailbox_id", id).eq("user_id", session.userId)
    if (error) throw new Error(error.message)
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not delete draft." }, { status: 500 })
  }
}
