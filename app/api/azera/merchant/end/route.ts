import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { isConversationIdentityMatch } from "@/lib/azera-identity"
import { tokenFromRequest, verifyConversationToken } from "@/lib/azera-public-auth"

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: false, error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const { business_id, external_id, conversation_token } = await request.json()
    const claims = verifyConversationToken(tokenFromRequest(request, conversation_token))
    if (!claims || !business_id || !external_id) return NextResponse.json({ success: false, error: "Conversation authorization is required" }, { status: 401 })

    const { data: conversation, error: findError } = await supabase
      .from("azera_conversations")
      .select("id, business_id, external_id, status")
      .eq("id", claims.conversationId)
      .eq("channel", "website")
      .maybeSingle()

    if (findError) {
      return NextResponse.json({ success: false, error: "Failed to find conversation" }, { status: 500 })
    }
    if (!conversation) {
      return NextResponse.json({ success: true, conversation: null })
    }
    if (!isConversationIdentityMatch(claims, conversation) || conversation.business_id !== business_id || conversation.external_id !== external_id) {
      return NextResponse.json({ success: false, error: "Conversation not found" }, { status: 404 })
    }

    const { data, error } = await supabase
      .from("azera_conversations")
      .update({ status: "closed", updated_at: new Date().toISOString() })
      .eq("id", conversation.id)
      .select("id, status, updated_at")
      .single()

    if (error || !data) {
      return NextResponse.json({ success: false, error: "Failed to end conversation" }, { status: 500 })
    }

    return NextResponse.json({ success: true, conversation: data })
  } catch (error) {
    console.error("[Azera merchant end error]", error)
    return NextResponse.json({ success: false, error: "Failed to end conversation" }, { status: 500 })
  }
}
