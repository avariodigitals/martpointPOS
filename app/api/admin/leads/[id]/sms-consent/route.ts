import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { auditContextFromSession, recordAudit } from "@/lib/audit"
import { normalizeCommunicationPhone } from "@/lib/communications-policy"

const consentSchema = z.object({
  source: z.enum(["web_form", "verbal", "written", "inbound_sms", "other"]),
  note: z.string().trim().max(500).optional().default(""),
  confirmed: z.literal(true),
})

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("leads")
  if (auth.denied) return auth.denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })

  try {
    const { id } = await props.params
    const parsed = consentSchema.parse(await request.json())
    const { data: lead, error: leadError } = await supabase.from("leads")
      .select("id,phone")
      .eq("id", id)
      .maybeSingle()
    if (leadError || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })

    const phone = normalizeCommunicationPhone(String(lead.phone || ""))
    if (!phone) return NextResponse.json({ error: "Add a valid lead phone number before recording SMS consent" }, { status: 400 })

    const consentAt = new Date().toISOString()
    const { error } = await supabase.from("leads").update({
      sms_consent_at: consentAt,
      sms_consent_phone: phone,
      sms_consent_source: parsed.source,
      sms_consent_note: parsed.note || null,
      sms_consent_recorded_by: auth.session.userId,
      updated_at: consentAt,
    }).eq("id", id)
    if (error) throw error

    await recordAudit(auditContextFromSession(auth.session, request), {
      action: "LEAD_SMS_CONSENT_RECORDED",
      entityType: "LEAD",
      entityId: id,
      metadata: { phone, source: parsed.source },
    })
    return NextResponse.json({ success: true, consent: { at: consentAt, phone, source: parsed.source, note: parsed.note || "" } })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: error.issues[0]?.message || "Invalid SMS consent details" }, { status: 400 })
    console.error("[Lead SMS consent POST]", error)
    return NextResponse.json({ error: "Could not save SMS consent. Apply the lead SMS consent migration and try again." }, { status: 500 })
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("leads")
  if (auth.denied) return auth.denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })

  try {
    const { id } = await props.params
    const { data: lead, error: leadError } = await supabase.from("leads")
      .select("id,phone")
      .eq("id", id)
      .maybeSingle()
    if (leadError || !lead) return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    const phone = normalizeCommunicationPhone(String(lead.phone || ""))
    if (!phone) return NextResponse.json({ error: "Lead has no valid phone number" }, { status: 400 })

    const existingSuppression = await supabase.from("communication_suppressions")
      .select("address")
      .eq("channel", "sms")
      .eq("address", phone)
      .maybeSingle()
    if (existingSuppression.error) throw existingSuppression.error
    if (!existingSuppression.data) {
      const suppression = await supabase.from("communication_suppressions").insert({
        channel: "sms",
        address: phone,
        reason: "Lead SMS consent withdrawn by admin",
      })
      if (suppression.error) throw suppression.error
    }

    const revokedAt = new Date().toISOString()
    const { error } = await supabase.from("leads").update({
      sms_consent_at: null,
      sms_consent_phone: null,
      sms_consent_source: null,
      sms_consent_note: null,
      sms_consent_recorded_by: null,
      updated_at: revokedAt,
    }).eq("id", id)
    if (error) throw error

    await recordAudit(auditContextFromSession(auth.session, request), {
      action: "LEAD_SMS_CONSENT_WITHDRAWN",
      entityType: "LEAD",
      entityId: id,
      metadata: { phone },
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[Lead SMS consent DELETE]", error)
    return NextResponse.json({ error: "Could not withdraw SMS consent" }, { status: 500 })
  }
}
