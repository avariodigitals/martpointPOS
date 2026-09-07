/* ───────────────────────────  Email helper  ───────────────────────────
 * All outbound email goes through Resend when configured in the backend.
 * Settings are read from the `settings` table (data.email) and fall back to
 * environment variables so you are not locked to Vercel env vars.
 *
 * Emails can be tagged with a `route`. Routes are configured in
 * /admin/settings/email-routes and let you control where form/notification
 * emails are sent without touching code.
 *
 * Every attempt (sent or failed) is persisted to email_logs.
 * If the email log table is not available, the operation still logs to console.
 */

import { supabase, isSupabaseConfigured } from "./supabase"

export interface EmailAttachment {
  filename: string
  content: string
}

export interface EmailMessage {
  to?: string | string[]
  subject: string
  text: string
  html?: string
  from?: string
  route?: string
  attachments?: EmailAttachment[]
}

export interface EmailSettings {
  resendApiKey: string
  fromEmail: string
  notifyEmail: string
  routes: Record<string, string>
}

interface EmailLogInsert {
  from: string
  to: string
  subject: string
  status: "pending" | "sent" | "failed"
  provider: string
  provider_response?: string | null
  error_message?: string | null
  metadata?: Record<string, unknown> | null
  sent_at?: string | null
}

const DEFAULT_ROUTES: Record<string, string> = {
  lead_submission: "sales@martpoint.com.ng",
  career_application: "careers@martpoint.com.ng",
  partner_application: "",
  onboarding_welcome: "",
  onboarding_invoice: "",
  support_ticket: "support@martpoint.com.ng",
  quotation: "",
}

let cachedSettings: EmailSettings | null = null
let cachedAt = 0
const CACHE_TTL_MS = 10_000

async function loadEmailSettingsFromDb(): Promise<EmailSettings> {
  const empty: EmailSettings = { resendApiKey: "", fromEmail: "", notifyEmail: "", routes: { ...DEFAULT_ROUTES } }

  if (!isSupabaseConfigured()) {
    return empty
  }

  try {
    const { data, error } = await supabase
      .from("settings")
      .select("data")
      .eq("id", 1)
      .single()

    if (error || !data) {
      console.error("[email] failed to load email settings:", error?.message)
      return empty
    }

    const settingsData = (data.data as Record<string, unknown> | undefined) || {}
    const email = (settingsData.email as Record<string, unknown> | undefined) || {}
    const routes = (email.routes as Record<string, unknown> | undefined) || {}

    return {
      resendApiKey: String(email.resendApiKey || ""),
      fromEmail: String(email.fromEmail || ""),
      notifyEmail: String(email.notifyEmail || ""),
      routes: { ...DEFAULT_ROUTES, ...Object.fromEntries(Object.entries(routes).map(([k, v]) => [k, String(v)])) },
    }
  } catch (err) {
    console.error("[email] failed to load email settings:", err)
    return empty
  }
}

export async function getEmailSettings(): Promise<EmailSettings> {
  const now = Date.now()
  if (cachedSettings && now - cachedAt < CACHE_TTL_MS) {
    return cachedSettings
  }

  const settings = await loadEmailSettingsFromDb()
  cachedSettings = settings
  cachedAt = now
  return settings
}

export function clearEmailSettingsCache(): void {
  cachedSettings = null
  cachedAt = 0
}

export async function getEmailRoute(route: string): Promise<string[]> {
  const settings = await getEmailSettings()
  const raw = settings.routes[route] || DEFAULT_ROUTES[route] || ""
  if (!raw) return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.includes("@"))
}

async function writeEmailLog(log: EmailLogInsert): Promise<void> {
  if (!isSupabaseConfigured()) return
  try {
    const { error } = await supabase.from("email_logs").insert(log)
    if (error) {
      console.error("[email] failed to write email log:", error.message)
    }
  } catch (err) {
    console.error("[email] failed to write email log:", err)
  }
}

function normalizeRecipients(value?: string | string[]): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value.map((s) => s.trim()).filter(Boolean)
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const settings = await getEmailSettings()

  const resendKey =
    settings.resendApiKey ||
    process.env.RESEND_API_KEY ||
    ""

  const from =
    message.from ||
    settings.fromEmail ||
    process.env.RESEND_FROM_EMAIL ||
    "MartPoint <hello@martpoint.com.ng>"

  const routeRecipients = message.route ? await getEmailRoute(message.route) : []
  const explicitRecipients = normalizeRecipients(message.to)

  let toList: string[]
  if (explicitRecipients.length === 0) {
    toList = routeRecipients
  } else {
    toList = explicitRecipients
    if (routeRecipients.length > 0) {
      toList = [...new Set([...toList, ...routeRecipients])]
    }
  }

  // If a route was used but produced no recipients, fall back to the general notify email.
  if (toList.length === 0 && message.route) {
    const notifyFallback = settings.notifyEmail || process.env.NOTIFY_EMAIL || ""
    if (notifyFallback) {
      toList = normalizeRecipients(notifyFallback)
    }
  }

  const to = toList.join(", ")

  const logBase: EmailLogInsert = {
    from,
    to,
    subject: message.subject,
    status: "pending",
    provider: "resend",
    metadata: { html: !!message.html, route: message.route || null },
  }

  if (toList.length === 0) {
    console.warn("[email] No recipients for email:", message.subject)
    await writeEmailLog({
      ...logBase,
      status: "failed",
      error_message: "No recipients",
    })
    return false
  }

  if (!resendKey) {
    console.warn("[email] RESEND_API_KEY not configured; email not sent.")
    await writeEmailLog({
      ...logBase,
      status: "failed",
      error_message: "RESEND_API_KEY not configured in backend or environment",
    })
    return false
  }

  try {
    const body: Record<string, unknown> = {
      from,
      to: toList,
      subject: message.subject,
      text: message.text,
    }
    if (message.html) body.html = message.html
    if (message.attachments?.length) body.attachments = message.attachments

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })

    const responseText = await res.text().catch(() => "unknown error")

    if (!res.ok) {
      console.error("[email] Resend error:", res.status, responseText)
      await writeEmailLog({
        ...logBase,
        status: "failed",
        provider_response: responseText,
        error_message: `Resend HTTP ${res.status}`,
      })
      return false
    }

    await writeEmailLog({
      ...logBase,
      status: "sent",
      provider_response: responseText,
      sent_at: new Date().toISOString(),
    })
    return true
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error("[email] send failed:", err)
    await writeEmailLog({
      ...logBase,
      status: "failed",
      error_message: errorMessage,
    })
    return false
  }
}
