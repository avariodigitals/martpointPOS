import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { SessionPayload, UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getSettings } from "@/lib/settings"

async function requireSession(): Promise<SessionPayload | null> {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "support")) {
    return null
  }
  return session
}

function ok<T>(data: T) {
  return NextResponse.json({ success: true, data })
}
function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/[^\d+]/g, "")
  if (digits.startsWith("+")) return digits
  if (digits.startsWith("0")) return "+234" + digits.slice(1)
  if (digits.startsWith("234")) return "+" + digits
  return "+234" + digits
}

export async function POST(request: Request) {
  const session = await requireSession()
  if (!session) return err("Forbidden", 403)

  if (!isSupabaseConfigured()) return err("Supabase not configured", 500)

  try {
    const body = await request.json()
    const {
      business_id,
      conversation_id,
      customer_phone,
      customer_name,
      provider = "generic",
    } = body

    if (!business_id) return err("business_id is required")
    if (!customer_phone) return err("customer_phone is required")

    const settings = await getSettings()
    const sip = settings.sip as any || {}

    const now = new Date().toISOString()
    const to = normalizePhone(customer_phone)

    // Create the call record
    const { data: call, error: callError } = await supabase
      .from("azera_calls")
      .insert({
        business_id,
        conversation_id,
        call_type: "sip",
        direction: "outbound",
        status: "ringing",
        agent_user_id: session.userId,
        agent_name: session.name,
        customer_name,
        customer_phone: to,
        sip_provider: provider,
        sip_from_number: sip.sip_number || "",
        sip_to_number: to,
        started_at: now,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (callError || !call) return err("Failed to create call record", 500)

    // Log event
    await supabase.from("azera_call_events").insert({
      call_id: call.id,
      event_type: "call_initiated",
      actor_type: "agent",
      actor_id: session.userId,
      metadata: { call_type: "sip", provider, to },
      created_at: now,
    })

    // Dial via the configured SIP provider
    let sipResult: any = null
    try {
      if (provider === "africas_talking" || sip.provider === "africas_talking") {
        sipResult = await dialAfricaTalking(sip, to, call.id)
      } else if (provider === "twilio" || sip.provider === "twilio") {
        sipResult = await dialTwilio(sip, to, call.id)
      } else {
        // Generic provider - webhook-based dialing
        sipResult = await dialGeneric(sip, to, call.id)
      }
    } catch (e) {
      console.error("[SIP dial error]", e)
      // Mark call as failed but keep the record
      await supabase
        .from("azera_calls")
        .update({ status: "failed", updated_at: now })
        .eq("id", call.id)
      return ok({ ...call, status: "failed", sip_error: String(e) })
    }

    // Store provider call reference
    if (sipResult?.call_sid || sipResult?.call_id) {
      await supabase
        .from("azera_calls")
        .update({ sip_call_sid: sipResult.call_sid || sipResult.call_id })
        .eq("id", call.id)
    }

    return ok({ ...call, sip_result: sipResult })
  } catch (e) {
    return err(String(e), 500)
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   SIP PROVIDER DIALERS
   ───────────────────────────────────────────────────────────────────────────── */

async function dialAfricaTalking(sip: any, to: string, callId: string) {
  const apiKey = sip.api_key || process.env.AFRICASTALKING_API_KEY
  const username = sip.username || process.env.AFRICASTALKING_USERNAME
  const from = sip.from_number || process.env.AFRICASTALKING_FROM

  if (!apiKey || !username || !from) {
    throw new Error("Africa's Talking credentials not configured")
  }

  const res = await fetch("https://api.africastalking.com/version1/call", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      apiKey,
    },
    body: new URLSearchParams({
      username,
      to,
      from,
    }),
  })

  const data = await res.json()
  return { provider: "africas_talking", ...data }
}

async function dialTwilio(sip: any, to: string, callId: string) {
  const accountSid = sip.account_sid || process.env.TWILIO_ACCOUNT_SID
  const authToken = sip.auth_token || process.env.TWILIO_AUTH_TOKEN
  const from = sip.from_number || process.env.TWILIO_FROM

  if (!accountSid || !authToken || !from) {
    throw new Error("Twilio credentials not configured")
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
      },
      body: new URLSearchParams({
        To: to,
        From: from,
        Url: `${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/azera/twiml?call_id=${callId}`,
      }),
    }
  )

  const data = await res.json()
  return { provider: "twilio", ...data }
}

async function dialGeneric(sip: any, to: string, callId: string) {
  const webhookUrl = sip.dial_webhook || process.env.SIP_DIAL_WEBHOOK
  if (!webhookUrl) {
    throw new Error("No SIP dial webhook configured")
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      to,
      from: sip.from_number,
      call_id: callId,
      webhook_url: `${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/azera/webhook/sip`,
    }),
  })

  if (!res.ok) throw new Error(`SIP dial failed: ${res.status}`)

  return { provider: "generic", ...(await res.json().catch(() => ({}))) }
}
