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
import { resolveAfricaBusinessId } from "@/lib/africastalking"
import { checkRateLimit } from "@/lib/rate-limit"
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
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin)
    return err("Forbidden", 403)
  try {
    const body = await request.json()
    if (!body || typeof body !== "object") return err("Choose a contact or enter a phone number.", 400)
    const keys = ["conversationId", "creatorId", "applicationId", "phone"].filter(key => body[key] !== undefined)
    if (keys.length !== 1 || typeof body[keys[0]] !== "string" || !body[keys[0]].trim() || body[keys[0]].length > 200)
      return err("Choose one contact or enter one valid phone number.", 400)
    const limit = await checkRateLimit(request, { key: `azera-outbound:${session.userId}`, max: 20, windowSeconds: 3600 })
    if (!limit.allowed) return err("Too many call attempts. Please try again later.", 429)
    let conversation: { id: string; business_id: string; customer_phone: string; customer_name: string } | null = null
    let rawPhone = "", name = "", businessId = ""
    let sourceType = "manual", sourceId: string | null = null
    if (keys[0] === "conversationId") {
      const result = await supabase
      .from("azera_conversations")
      .select("id,business_id,customer_phone,customer_name")
      .eq("id", body.conversationId)
      .maybeSingle()
      if (result.error) return err("Could not load contact details.", 503)
      conversation = result.data
      if (!conversation) return err("Conversation not found.", 404)
      rawPhone = conversation.customer_phone || ""; name = conversation.customer_name || "Contact"; businessId = conversation.business_id
      sourceType = "conversation"; sourceId = conversation.id
    } else if (keys[0] === "creatorId" || keys[0] === "applicationId") {
      if (!hasPermission(session.role, "creator.view")) return err("Creator access is required to call this contact.", 403)
      const creator = keys[0] === "creatorId"
      let query = supabase.from(creator ? "creators" : "creator_applications")
        .select("id,full_name,phone,status").eq("id", body[keys[0]])
      if (!creator) query = query.is("deleted_at", null)
      const result = await query.maybeSingle()
      if (result.error) return err("Could not load creator contact details.", 503)
      if (!result.data || result.data.status === "REMOVED") return err("Creator contact not found.", 404)
      rawPhone = result.data.phone || ""; name = result.data.full_name || "Creator"
      sourceType = creator ? "creator" : "creator_application"; sourceId = result.data.id
    } else {
      rawPhone = body.phone
      if (body.name !== undefined && (typeof body.name !== "string" || body.name.length > 120 || /[\r\n]/.test(body.name))) return err("Enter a short contact name.", 400)
      name = body.name?.trim() || "Manual phone call"
    }
    const phone = normalizeOutboundPhone(rawPhone)
    if (!phone)
      return err("Add a valid country-coded phone number to this contact.", 400)
    const config = await africaBrowserConfig(businessId || undefined)
    if (!africaBrowserReady(config))
      return err(
        "Configure your Africa’s Talking API key, live username and virtual voice number in Azera Settings. LiveKit is not required.",
        503
      )
    if (!businessId) businessId = await resolveAfricaBusinessId(config.phone) || ""
    if (!businessId) return err("Map your Africa’s Talking virtual number to the MartPoint business in Azera Settings before making calls.", 503)
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
        business_id: businessId,
        conversation_id: conversation?.id || null,
        call_type: "sip",
        direction: "outbound",
        status: "ringing",
        agent_user_id: session.userId,
        agent_name: session.name,
        customer_name: name,
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
          metadata: { provider: "africas_talking_browser", stage: "prepared", source_type: sourceType, source_id: sourceId },
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
