import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { isConversationIdentityMatch } from "@/lib/azera-identity"
import { tokenFromRequest, verifyConversationToken } from "@/lib/azera-public-auth"

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif", "application/pdf", "text/plain",
  "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg",
])

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 160) || "upload"
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return NextResponse.json({ success: false, error: "Supabase not configured" }, { status: 500 })
  try {
    const form = await request.formData()
    const businessId = String(form.get("business_id") || "")
    const externalId = String(form.get("external_id") || "")
    const claims = verifyConversationToken(tokenFromRequest(request, form.get("conversation_token")))
    const messageType = String(form.get("message_type") || "file")
    const file = form.get("file")
    if (!claims || !businessId || !externalId || !(file instanceof File)) return NextResponse.json({ success: false, error: "A valid conversation authorization and file are required" }, { status: 401 })
    if (file.size > MAX_BYTES) return NextResponse.json({ success: false, error: "File exceeds 10MB" }, { status: 400 })
    if (!ALLOWED.has(file.type)) return NextResponse.json({ success: false, error: "Unsupported file type" }, { status: 400 })

    const { data: conversation, error: conversationError } = await supabase
      .from("azera_conversations").select("id, business_id, external_id, status").eq("id", claims.conversationId).eq("channel", "website").maybeSingle()
    if (conversationError || !conversation) return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 })
    if (!isConversationIdentityMatch(claims, conversation) || conversation.status === "closed") return NextResponse.json({ success: false, error: "Conversation not available" }, { status: 403 })

    // File uploads are deliberately a one-time, agent-approved action. Voice
    // notes remain available through the existing microphone flow, but a
    // customer cannot push arbitrary files into storage until an authorised
    // agent has sent a file_request message for this conversation. A request
    // is consumed by the next file upload, so every subsequent file needs a
    // fresh approval.
    if (messageType !== "voice") {
      const [{ data: approval, error: approvalError }, { data: lastUpload, error: uploadLookupError }] = await Promise.all([
        supabase.from("azera_messages")
          .select("created_at")
          .eq("conversation_id", conversation.id)
          .eq("author_type", "agent")
          .eq("direction", "outbound")
          .eq("message_type", "file_request")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("azera_messages")
          .select("created_at")
          .eq("conversation_id", conversation.id)
          .eq("author_type", "customer")
          .neq("message_type", "voice")
          .not("attachment_path", "is", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])
      if (approvalError || uploadLookupError) return NextResponse.json({ success: false, error: "Upload approval could not be verified" }, { status: 503 })
      const approvedAt = approval?.created_at ? Date.parse(String(approval.created_at)) : 0
      const lastUploadedAt = lastUpload?.created_at ? Date.parse(String(lastUpload.created_at)) : 0
      if (!approvedAt || approvedAt <= lastUploadedAt) {
        return NextResponse.json({ success: false, error: "An agent must approve a file upload first" }, { status: 403 })
      }
    }

    const path = `${businessId}/${externalId}/${crypto.randomUUID()}-${safeName(file.name)}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { error: uploadError } = await supabase.storage.from("azera-chat-attachments").upload(path, bytes, { contentType: file.type, upsert: false })
    if (uploadError) return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 })

    const { data: message, error: messageError } = await supabase.from("azera_messages").insert({
      conversation_id: conversation.id, author_type: "customer", direction: "inbound",
      message: messageType === "voice" ? "Voice message" : `Uploaded file: ${file.name}`,
      message_type: messageType, attachment_path: path, attachment_name: file.name,
      attachment_mime: file.type, attachment_size: file.size, created_at: new Date().toISOString(),
    }).select().single()
    if (messageError || !message) return NextResponse.json({ success: false, error: "Could not save upload" }, { status: 500 })

    await supabase.from("azera_conversations").update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conversation.id)
    const { data: signed } = await supabase.storage.from("azera-chat-attachments").createSignedUrl(path, 3600)
    return NextResponse.json({ success: true, message: { ...message, attachment_url: signed?.signedUrl || null } })
  } catch (error) {
    console.error("[Azera merchant upload error]", error)
    return NextResponse.json({ success: false, error: "Upload failed" }, { status: 500 })
  }
}
