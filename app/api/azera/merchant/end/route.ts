import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { isConversationIdentityMatch } from "@/lib/azera-identity"
import { tokenFromRequest, verifyConversationToken } from "@/lib/azera-public-auth"

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: false, error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const { business_id, external_id, conversation_token, rating } = await request.json()
    if (rating !== undefined && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
      return NextResponse.json({ success: false, error: "Rating must be between 1 and 5" }, { status: 400 })
    }
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

    if (rating !== undefined) {
      const labels: Record<number, string> = { 1: "Very unhappy", 2: "Unhappy", 3: "Okay", 4: "Happy", 5: "Very happy" }
      const { error: ratingError } = await supabase.from("azera_messages").insert({
        conversation_id: conversation.id,
        author_type: "system",
        message: `Customer rated this chat ${rating}/5 (${labels[rating]})`,
        direction: "inbound",
        message_type: "system",
        metadata: { event: "customer_rating", rating, rating_label: labels[rating] },
        created_at: new Date().toISOString(),
      })
      if (ratingError) {
        console.error("[Azera customer rating error]", ratingError)
        return NextResponse.json({ success: false, error: "Failed to save chat rating" }, { status: 500 })
      }
    }

    const { data, error } = await supabase
      .from("azera_conversations")
      .update({ status: "closed", waiting_for_agent: false, ai_enabled: true, updated_at: new Date().toISOString() })
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
