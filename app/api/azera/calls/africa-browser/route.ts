import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import {
  africaBrowserConfig,
  africaBrowserReady,
  africaCapability,
} from "@/lib/africa-browser-voice"
import { normalizeOutboundPhone } from "@/lib/azera-outbound"
const err = (error: string, status: number) =>
  NextResponse.json({ error }, { status })
export async function GET() {
  const session = await getSession()
  if (!session || !hasPermission(session.role, "azera"))
    return err("Forbidden", 403)
  const config = await africaBrowserConfig()
  return NextResponse.json(
    {
      ready: africaBrowserReady(config),
      provider: "africas_talking",
      setupUrl: "/admin/azera/settings",
    },
    { headers: { "Cache-Control": "no-store" } }
  )
}
export async function POST(request: Request) {
  const session = await getSession()
  if (!session || !hasPermission(session.role, "azera"))
    return err("Forbidden", 403)
  if (!isSupabaseConfigured())
    return err("Calling is temporarily unavailable.", 503)
  try {
    const { conversationId } = await request.json()
    if (typeof conversationId !== "string" || !conversationId)
      return err("Choose a contact first.", 400)
    const { data: conversation } = await supabase
      .from("azera_conversations")
      .select("id,business_id,customer_phone,customer_name")
      .eq("id", conversationId)
      .maybeSingle()
    if (!conversation) return err("Conversation not found.", 404)
    const phone = normalizeOutboundPhone(
      String(conversation.customer_phone || "")
    )
    if (!phone)
      return err("Add a valid country-coded phone number to this contact.", 400)
    const config = await africaBrowserConfig(conversation.business_id)
    if (!africaBrowserReady(config))
      return err(
        "Configure your Africa’s Talking API key, live username and virtual voice number in Azera Settings. LiveKit is not required.",
        503
      )
    const id = randomUUID(),
      clientName = `mp_${id.replaceAll("-", "")}`,
      now = new Date().toISOString()
    // Clear only abandoned preparations, never an active telephone connection.
    await supabase
      .from("azera_calls")
      .update({ status: "missed", ended_at: now, updated_at: now })
      .eq("agent_user_id", session.userId)
      .eq("sip_provider", "africas_talking_browser")
      .eq("status", "ringing")
      .lt("created_at", new Date(Date.now() - 120_000).toISOString())
    const { error } = await supabase
      .from("azera_calls")
      .insert({
        id,
        business_id: conversation.business_id,
        conversation_id: conversation.id,
        call_type: "sip",
        direction: "outbound",
        status: "ringing",
        agent_user_id: session.userId,
        agent_name: session.name,
        customer_name: conversation.customer_name,
        customer_phone: phone,
        sip_provider: "africas_talking_browser",
        sip_from_number: config.phone,
        sip_to_number: phone,
        webrtc_room: clientName,
        started_at: now,
        created_at: now,
        updated_at: now,
      })
    if (error)
      return err(
        error.code === "23505"
          ? "Finish your current phone call before starting another."
          : "Could not prepare call history. Apply the contact-centre migration and try again.",
        error.code === "23505" ? 409 : 500
      )
    try {
      const token = await africaCapability(config, clientName)
      await supabase
        .from("azera_call_events")
        .insert({
          call_id: id,
          event_type: "call_initiated",
          actor_type: "agent",
          actor_id: session.userId,
          metadata: { provider: "africas_talking_browser", stage: "prepared" },
        })
      return NextResponse.json(
        { id, token, phone, clientName, provider: "africas_talking" },
        { headers: { "Cache-Control": "no-store" } }
      )
    } catch (error) {
      await supabase
        .from("azera_calls")
        .update({ status: "failed", ended_at: now, updated_at: now })
        .eq("id", id)
      return err(
        error instanceof Error
          ? error.message
          : "Browser calling is temporarily unavailable.",
        502
      )
    }
  } catch {
    return err("Could not prepare browser calling. Please try again.", 500)
  }
}
