import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

function ok<T>(data: T) {
  return NextResponse.json({ success: true, data })
}
function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

/**
 * Public endpoint for MartPoint merchants (PHP app) to fetch their own
 * support conversation messages. No admin session required — access is
 * scoped by business_id + external_id which the merchant knows from their
 * own session.
 *
 * Query params:
 *   external_id  — the merchant's chat session ID (from PHP session)
 *   business_id  — the merchant's store ID
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const externalId = searchParams.get("external_id")
  const businessId = searchParams.get("business_id")

  if (!externalId || !businessId) {
    return err("external_id and business_id are required", 400)
  }

  if (!isSupabaseConfigured()) {
    return err("Supabase not configured", 500)
  }

  try {
    // Find the conversation for this merchant
    const { data: conv, error: convError } = await supabase
      .from("azera_conversations")
      .select("id, business_id, external_id, status, customer_name, customer_phone")
      .eq("business_id", businessId)
      .eq("external_id", externalId)
      .maybeSingle()

    if (convError || !conv) {
      return err("Conversation not found", 404)
    }

    // Fetch messages for this conversation
    const { data: messages, error: msgError } = await supabase
      .from("azera_messages")
      .select("*")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: true })

    if (msgError) {
      return err("Failed to load messages", 500)
    }

    return ok({
      conversation: conv,
      messages: messages || [],
    })
  } catch (err_) {
    return err(String(err_), 500)
  }
}
