import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { isConversationIdentityMatch, resolveChatBusinessId } from "@/lib/azera-identity"
import { issueConversationToken, tokenFromRequest, verifyConversationToken } from "@/lib/azera-public-auth"

function ok<T>(data: T) {
  return NextResponse.json({ success: true, data })
}
function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

type ChatMessage = Record<string, unknown> & { attachment_path?: string | null }

/**
 * Public endpoint for MartPoint merchants (PHP app) to fetch their own
 * support conversation messages. No admin session required — access is
 * scoped by business_id + external_id which the merchant knows from their
 * own session.
 *
 * Query params are retained for compatibility, but they are not credentials.
 * A server-issued X-Azera-Chat-Token is required for every private read.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const externalId = searchParams.get("external_id")
  const businessId = searchParams.get("business_id")

  if (!isSupabaseConfigured()) {
    return err("Supabase not configured", 500)
  }

  try {
    let claims = verifyConversationToken(tokenFromRequest(request))
    let bridgeBusinessId: string | undefined
    if (!claims) {
      // The PHP application may bootstrap a token for an existing merchant
      // thread. It is accepted only with the server-to-server bridge secret
      // and the authenticated PHP store identity headers.
      const resolved = await resolveChatBusinessId(request, "retail_app", request.headers.get("x-martpoint-store-id"), {
        email: request.headers.get("x-martpoint-store-email"),
        phone: request.headers.get("x-martpoint-store-phone"),
        name: request.headers.get("x-martpoint-store-name"),
      })
      if (resolved.id) bridgeBusinessId = resolved.id
      else return err("Conversation authorization required", 401)
    }
    const lookupExternalId = externalId || claims?.externalId || ""
    if (!lookupExternalId) return err("Conversation identity is required", 400)
    const lookupBusinessId = claims ? claims.businessId : bridgeBusinessId!

    const { data: conv, error: convError } = await supabase
      .from("azera_conversations")
      .select("id, business_id, external_id, status, customer_name, customer_phone, last_message_at, created_at, queue, waiting_for_agent")
      .eq(claims ? "id" : "business_id", claims ? claims.conversationId : lookupBusinessId)
      .eq("external_id", lookupExternalId)
      .maybeSingle()

    if (convError || !conv) {
      return err("Conversation not found", 404)
    }
    if (claims && (!isConversationIdentityMatch(claims, conv) || (businessId && businessId !== conv.business_id && businessId !== "martpoint-support") || (externalId && externalId !== conv.external_id))) {
      return err("Conversation not found", 404)
    }
    if (!claims) {
      const issued = issueConversationToken({ conversationId: conv.id, businessId: conv.business_id, externalId: conv.external_id })
      claims = verifyConversationToken(issued)
      if (!claims) return err("Conversation authorization could not be issued", 500)
    }

    // Fetch messages for this conversation
    // Closed chats remain available to Azera as context, but the public widget
    // only receives the last-chat timestamp, never the prior transcript.
    const { data: messages, error: msgError } = conv.status === "closed"
      ? { data: [], error: null }
      : await supabase
        .from("azera_messages")
        .select("*")
        .eq("conversation_id", conv.id)
        .order("created_at", { ascending: true })

    if (msgError) {
      return err("Failed to load messages", 500)
    }

    let queuePosition: number | null = null
    if (conv.status === "open" && conv.waiting_for_agent && conv.queue) {
      const { data: queuedConversations, error: queueError } = await supabase
        .from("azera_conversations")
        .select("id")
        .eq("business_id", conv.business_id)
        .eq("queue", conv.queue)
        .eq("status", "open")
        .eq("waiting_for_agent", true)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
      if (queueError) return err("Failed to load queue position", 500)
      const index = (queuedConversations || []).findIndex((queued) => queued.id === conv.id)
      if (index >= 0) queuePosition = index + 1
    }

    const enrichedMessages = await Promise.all((messages || []).map(async (message: ChatMessage) => {
      const metadata = message.metadata as Record<string, unknown> | undefined
      const safeMessage = metadata?.escalation_reason === "no_approved_knowledge"
        ? { ...message, message: "I want to make sure you receive accurate MartPoint information. I’ve sent this to a specialist who can help. Is your question about sales, a technical issue, or how to use MartPoint?" }
        : message
      if (!message.attachment_path) return safeMessage
      const { data: signed } = await supabase.storage.from("azera-chat-attachments").createSignedUrl(message.attachment_path, 3600)
      return { ...safeMessage, attachment_url: signed?.signedUrl || null }
    }))

    return ok({
      conversation: { ...conv, queue_position: queuePosition },
      conversation_token: tokenFromRequest(request) || issueConversationToken({ conversationId: conv.id, businessId: conv.business_id, externalId: conv.external_id }),
      messages: enrichedMessages,
    })
  } catch (err_) {
    return err(String(err_), 500)
  }
}
