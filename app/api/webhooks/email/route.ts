import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

/* ───────────────────────────  Inbound email webhook  ───────────────────────────
 * Receives inbound email from the provider's inbound-parse service and files it
 * into lead_emails when the sender matches a lead. Point your provider's inbound
 * webhook (e.g. Resend Inbound, Brevo Inbound Parse, or an MX-forwarding service)
 * at POST /api/webhooks/email.
 *
 * Auth: if INBOUND_EMAIL_WEBHOOK_SECRET is set, requests must send it via the
 * `x-webhook-secret` header or `?secret=` query param.
 */

interface NormalizedEmail {
  from: string
  to: string
  subject: string
  text: string
  html: string
  messageId: string | null
}

function extractAddress(value: unknown): string {
  if (!value) return ""
  if (typeof value === "string") {
    const match = value.match(/<([^>]+)>/)
    const addr = (match ? match[1] : value).trim().toLowerCase()
    return addr.includes("@") ? addr : ""
  }
  if (Array.isArray(value)) return extractAddress(value[0])
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    return extractAddress(obj.address || obj.email || obj.Address || obj.Email)
  }
  return ""
}

function extractAllAddresses(value: unknown): string {
  if (!value) return ""
  if (typeof value === "string") return value
  if (Array.isArray(value)) return value.map(extractAddress).filter(Boolean).join(", ")
  return extractAddress(value)
}

function pick(obj: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k]
  }
  return undefined
}

function normalizeOne(raw: Record<string, unknown>): NormalizedEmail {
  // Unwrap provider envelopes (Resend: { type: "email.received", data: {...} })
  const data = (raw.data && typeof raw.data === "object" ? raw.data : raw) as Record<string, unknown>

  const headers = (data.headers && typeof data.headers === "object" ? data.headers : {}) as Record<string, unknown>

  return {
    from: extractAddress(pick(data, "from", "From", "sender", "Sender")),
    to: extractAllAddresses(pick(data, "to", "To", "recipients")),
    subject: String(pick(data, "subject", "Subject") ?? headers.subject ?? "(no subject)"),
    text: String(pick(data, "text", "text_body", "textBody", "RawTextBody", "plain", "body") ?? ""),
    html: String(pick(data, "html", "html_body", "htmlBody", "RawHtmlBody") ?? ""),
    messageId: (pick(data, "message_id", "messageId", "MessageId", "email_id", "id") as string) ?? (headers["message-id"] as string) ?? null,
  }
}

function normalizePayload(payload: unknown): NormalizedEmail[] {
  if (!payload || typeof payload !== "object") return []
  const obj = payload as Record<string, unknown>

  // Brevo inbound parse posts { items: [...] }
  if (Array.isArray(obj.items)) return obj.items.map((i) => normalizeOne(i as Record<string, unknown>))
  // Generic batched payloads
  if (Array.isArray(obj.emails)) return obj.emails.map((i) => normalizeOne(i as Record<string, unknown>))
  if (Array.isArray(obj.messages)) return obj.messages.map((i) => normalizeOne(i as Record<string, unknown>))
  if (Array.isArray(payload)) return (payload as Record<string, unknown>[]).map(normalizeOne)

  return [normalizeOne(obj)]
}

export async function POST(request: Request) {
  const secret = process.env.INBOUND_EMAIL_WEBHOOK_SECRET
  if (secret) {
    const provided = request.headers.get("x-webhook-secret") || new URL(request.url).searchParams.get("secret")
    if (provided !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true })
  }

  try {
    const payload = await request.json()
    const emails = normalizePayload(payload)

    let matched = 0
    for (const email of emails) {
      if (!email.from) continue

      const { data: lead } = await supabase
        .from("leads")
        .select("id")
        .ilike("email", email.from)
        .limit(1)
        .maybeSingle()

      if (!lead) continue

      if (email.messageId) {
        const { data: existing } = await supabase
          .from("lead_emails")
          .select("id")
          .eq("lead_id", lead.id)
          .eq("provider_message_id", email.messageId)
          .limit(1)
          .maybeSingle()
        if (existing) continue
      }

      await supabase.from("lead_emails").insert({
        lead_id: lead.id,
        direction: "inbound",
        from_email: email.from,
        to_email: email.to || null,
        subject: email.subject,
        body_text: email.text || null,
        body_html: email.html || null,
        status: "received",
        provider_message_id: email.messageId,
      })
      matched++
    }

    return NextResponse.json({ ok: true, matched })
  } catch (err) {
    console.error("[Email webhook error]", err)
    return NextResponse.json({ ok: true })
  }
}
