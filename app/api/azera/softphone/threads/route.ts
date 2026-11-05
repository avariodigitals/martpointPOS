import { NextResponse } from "next/server"
import { z } from "zod"
import { getSession, hasPermissionForUser } from "@/lib/admin-auth"
import { mapLeadEmail } from "@/lib/lead-email-outbound"
import { normalizeDialNumber } from "@/lib/browser-phone-target"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"

const querySchema = z.object({
  kind: z.enum(["message", "email"]),
  source: z.enum(["lead", "business", "marketing", "creator", "partner", "partner_lead"]),
  id: z.string().uuid(),
})

function responseError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session || !await hasPermissionForUser(session.userId, session.role, "azera"))
    return responseError("Forbidden", 403)
  if (!isSupabaseConfigured()) return responseError("Contact history is unavailable right now.", 503)

  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
  if (!parsed.success) return responseError("Choose a valid contact thread.", 400)
  const { kind, source, id } = parsed.data

  try {
    let phone: string | null = null
    let email: string | null = null
    let leadId: string | null = null
    let creatorApplicationId: string | null = null
    let partnerId: string | null = null

    if (source === "lead") {
      if (!await hasPermissionForUser(session.userId, session.role, "leads")) return responseError("Forbidden", 403)
      const { data, error } = await supabase.from("leads").select("id,email,additional_email,phone").eq("id", id).maybeSingle()
      if (error || !data) return responseError("Contact not found.", 404)
      leadId = data.id
      email = data.email || data.additional_email || null
      phone = data.phone || null
    } else if (source === "business") {
      if (!await hasPermissionForUser(session.userId, session.role, "businesses")) return responseError("Forbidden", 403)
      const { data, error } = await supabase.from("businesses").select("id,primary_email,primary_phone,source_lead_id").eq("id", id).maybeSingle()
      if (error || !data) return responseError("Contact not found.", 404)
      leadId = data.source_lead_id || null
      email = data.primary_email || null
      phone = data.primary_phone || null
    } else if (source === "marketing") {
      if (!await hasPermissionForUser(session.userId, session.role, "marketing")) return responseError("Forbidden", 403)
      const { data, error } = await supabase.from("marketing_contacts").select("id,email,phone").eq("id", id).maybeSingle()
      if (error || !data) return responseError("Contact not found.", 404)
      email = data.email || null
      phone = data.phone || null
    } else if (source === "creator") {
      if (!await hasPermissionForUser(session.userId, session.role, "creator.view")) return responseError("Forbidden", 403)
      const { data, error } = await supabase.from("creators").select("id,application_id,email,phone").eq("id", id).maybeSingle()
      if (error || !data) return responseError("Contact not found.", 404)
      creatorApplicationId = data.application_id || null
      email = data.email || null
      phone = data.phone || null
    } else if (source === "partner") {
      if (!await hasPermissionForUser(session.userId, session.role, "partners")) return responseError("Forbidden", 403)
      const { data, error } = await supabase.from("partners").select("id,public_email,public_phone,application_id").eq("id", id).maybeSingle()
      if (error || !data) return responseError("Contact not found.", 404)
      email = data.public_email || null
      phone = data.public_phone || null
      partnerId = data.id
      if ((!email || !phone) && data.application_id) {
        const { data: application } = await supabase.from("partner_applications").select("email,phone").eq("id", data.application_id).maybeSingle()
        email ||= application?.email || null
        phone ||= application?.phone || null
      }
    } else {
      if (!await hasPermissionForUser(session.userId, session.role, "partners")) return responseError("Forbidden", 403)
      const { data, error } = await supabase.from("partner_leads").select("id,email,phone,matched_lead_id").eq("id", id).maybeSingle()
      if (error || !data) return responseError("Contact not found.", 404)
      email = data.email || null
      phone = data.phone || null
      leadId = data.matched_lead_id || null
    }

    if (kind === "email") {
      if (partnerId) {
        const { data, error } = await supabase.from("partner_emails").select("id,direction,from_email,to_email,subject,body_text,created_at")
          .eq("partner_id", partnerId).order("created_at", { ascending: true }).limit(100)
        if (error) return responseError("Email history could not load.", 503)
        return NextResponse.json({ emails: (data || []).map(row => ({ id: row.id, direction: row.direction, fromEmail: row.from_email, toEmail: row.to_email, subject: row.subject, bodyText: row.body_text, createdAt: row.created_at })) }, { headers: { "Cache-Control": "private, no-store" } })
      }
      if (creatorApplicationId) {
        const { data, error } = await supabase.from("creator_application_emails").select("id,direction,from_email,to_email,subject,body_text,body_html,created_at")
          .eq("application_id", creatorApplicationId).order("created_at", { ascending: true }).limit(100)
        if (error) return responseError("Email history could not load.", 503)
        return NextResponse.json({ emails: (data || []).map(row => ({ id: row.id, direction: row.direction, fromEmail: row.from_email, toEmail: row.to_email, subject: row.subject, bodyText: row.body_text, bodyHtml: row.body_html, createdAt: row.created_at })) }, { headers: { "Cache-Control": "private, no-store" } })
      }
      let leadIds = leadId ? [leadId] : []
      if (!leadIds.length && email && await hasPermissionForUser(session.userId, session.role, "leads")) {
        const [byPrimary, byAdditional] = await Promise.all([
          supabase.from("leads").select("id").eq("email", email).limit(100),
          supabase.from("leads").select("id").eq("additional_email", email).limit(100),
        ])
        if (byPrimary.error || byAdditional.error) return responseError("Email history could not load.", 503)
        leadIds = [...new Set([...(byPrimary.data || []), ...(byAdditional.data || [])].map(row => row.id))]
      }
      if (leadIds.length) {
        const { data, error } = await supabase.from("lead_emails").select("*").in("lead_id", leadIds).order("created_at", { ascending: true }).limit(100)
        if (error) return responseError("Email history could not load.", 503)
        const emails = (data || []).map(row => mapLeadEmail(row as Record<string, unknown>))
        return NextResponse.json({ emails }, { headers: { "Cache-Control": "private, no-store" } })
      }
      if (!email) return NextResponse.json({ emails: [] }, { headers: { "Cache-Control": "private, no-store" } })
      const { data, error } = await supabase.from("communication_messages")
        .select("id,channel,subject,body,status,recipient,sent_at,created_at")
        .eq("channel", "email").eq("recipient", email)
        .order("created_at", { ascending: true }).limit(100)
      if (error) return responseError("Email history could not load.", 503)
      return NextResponse.json({ emails: (data || []).map(row => ({
        id: row.id, direction: "outbound", fromEmail: null, toEmail: row.recipient,
        subject: row.subject || "", bodyText: row.body || "", createdAt: row.sent_at || row.created_at,
      })) }, { headers: { "Cache-Control": "private, no-store" } })
    }

    const normalizedPhone = phone ? normalizeDialNumber(phone) : null
    const phoneKeys = [...new Set([phone, normalizedPhone, normalizedPhone?.replace(/^\+/, "")].filter((value): value is string => Boolean(value)))]
    let conversations: { id: string; channel: string; customer_name: string | null; last_message_at: string }[] = []
    let messages: Record<string, unknown>[] = []
    if (phoneKeys.length) {
      const { data, error } = await supabase.from("azera_conversations")
        .select("id,channel,customer_name,last_message_at")
        .in("customer_phone", phoneKeys).order("last_message_at", { ascending: false }).limit(5)
      if (error) return responseError("Message history could not load.", 503)
      conversations = data || []
      const ids = conversations.map(row => row.id)
      if (ids.length) {
        const { data: rows, error: messageError } = await supabase.from("azera_messages")
          .select("id,conversation_id,author_type,direction,message,created_at")
          .in("conversation_id", ids).order("created_at", { ascending: true }).limit(300)
        if (messageError) return responseError("Message history could not load.", 503)
        messages = rows || []
      }
    }
    const { data: sentTexts, error: sentError } = phoneKeys.length ? await supabase.from("communication_messages")
      .select("id,body,status,recipient,sent_at,created_at")
      .eq("channel", "sms").in("recipient", phoneKeys)
      .order("created_at", { ascending: true }).limit(100) : { data: [], error: null }
    if (sentError) return responseError("Message history could not load.", 503)
    messages.push(...(sentTexts || []).map(row => ({
      id: row.id, conversation_id: null, author_type: "agent", direction: "outbound",
      message: row.body, status: row.status, created_at: row.sent_at || row.created_at,
    })))
    messages.sort((a, b) => new Date(String(a.created_at)).getTime() - new Date(String(b.created_at)).getTime())
    return NextResponse.json({ conversations, messages }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (error) {
    console.error("[Azera softphone contact history failed]", error)
    return responseError("Contact history could not load. Please try again.", 503)
  }
}
