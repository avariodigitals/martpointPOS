import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { canAccessMailbox } from "@/lib/admin-mailbox"
import { supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; messageId: string; index: string }> }) {
  const { session, denied } = await authorizeAdmin("mailbox")
  if (denied) return denied
  const { id, messageId, index } = await params
  try {
    if (!(await canAccessMailbox(id, session.userId, session.role === "Admin"))) return NextResponse.json({ error: "You do not have access to this mailbox." }, { status: 403 })
    const { data: message, error } = await supabase.from("admin_mailbox_messages").select("attachments").eq("mailbox_id", id).eq("id", messageId).maybeSingle()
    if (error || !message) return NextResponse.json({ error: error?.message || "Attachment not found." }, { status: 404 })
    const attachment = (Array.isArray(message.attachments) ? message.attachments : []).find((item: { id?: string }) => item.id === index)
    if (!attachment?.storagePath) return NextResponse.json({ error: "Attachment not found." }, { status: 404 })
    const { data, error: downloadError } = await supabase.storage.from("admin-mailbox-attachments").download(attachment.storagePath)
    if (downloadError || !data) return NextResponse.json({ error: "Attachment file is unavailable." }, { status: 404 })
    const filename = String(attachment.filename || "attachment").replace(/[\r\n\"]+/g, "_")
    return new Response(data.stream(), { headers: { "Content-Type": attachment.contentType || "application/octet-stream", "Content-Length": String(attachment.size || data.size), "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`, "Cache-Control": "private, no-store" } })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not download attachment." }, { status: 500 })
  }
}
