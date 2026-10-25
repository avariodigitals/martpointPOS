/* ───────────────────  Resend a failed outbound email  ───────────────────
 * Email Logs records every attempt. When one fails the admin can replay it
 * from the logs screen, using the `metadata.resend` payload written at send
 * time by lib/email.ts.
 *
 * Two deliberate limits:
 *  - Logs written before that payload existed cannot be replayed from here.
 *  - Messages that carried attachments are not replayable, because the file
 *    itself is not kept. Both cases return a reason instead of a silent
 *    half-send.
 */

import { sendEmail, type EmailMessage, type ResendPayload } from "./email"
import { supabase, isSupabaseConfigured } from "./supabase"

export interface EmailLogRow {
  id: string
  to: string | null
  subject: string | null
  status: string
  metadata: Record<string, unknown> | null
}

export type ResendReadiness = { ok: true; payload: ResendPayload } | { ok: false; reason: string }

const str = (value: unknown): string => (typeof value === "string" ? value : "")
const optional = (value: unknown): string | null => {
  const s = str(value).trim()
  return s ? s : null
}

/** Validates and normalises the replay payload stored on a log row. */
export function resendPayloadFromLog(log: Pick<EmailLogRow, "metadata"> | null | undefined): ResendReadiness {
  const raw = log?.metadata?.resend
  if (!raw || typeof raw !== "object") {
    return {
      ok: false,
      reason:
        "This entry predates resend history, so the original message was not stored. Resend it from the screen that sent it.",
    }
  }

  const candidate = raw as Partial<ResendPayload>
  const to = str(candidate.to).trim()
  const subject = str(candidate.subject).trim()
  if (!to.includes("@")) return { ok: false, reason: "The original message has no usable recipient." }
  if (!subject) return { ok: false, reason: "The original message has no subject." }

  return {
    ok: true,
    payload: {
      to,
      cc: str(candidate.cc),
      subject,
      text: str(candidate.text),
      html: str(candidate.html),
      from: optional(candidate.from),
      replyTo: optional(candidate.replyTo),
      route: optional(candidate.route),
      useRouteRecipients: typeof candidate.useRouteRecipients === "boolean" ? candidate.useRouteRecipients : undefined,
      skipBranding: candidate.skipBranding === true,
    },
  }
}

/** Rebuilds the EmailMessage that sendEmail() should replay. */
export function messageFromPayload(payload: ResendPayload): EmailMessage {
  return {
    to: payload.to,
    cc: payload.cc || undefined,
    subject: payload.subject,
    text: payload.text,
    html: payload.html || undefined,
    from: payload.from || undefined,
    replyTo: payload.replyTo || undefined,
    route: payload.route || undefined,
    useRouteRecipients: payload.useRouteRecipients,
    skipBranding: payload.skipBranding,
  }
}

export interface ResendResult {
  ok: boolean
  error?: string
  /** HTTP status the API route should answer with. */
  status: number
}

/** Replays one failed log entry. Writes a fresh log row, like any other send. */
export async function resendLoggedEmail(id: string): Promise<ResendResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured", status: 503 }

  const { data, error } = await supabase
    .from("email_logs")
    .select("id, to, subject, status, metadata")
    .eq("id", id)
    .maybeSingle()

  if (error) return { ok: false, error: error.message, status: 500 }
  if (!data) return { ok: false, error: "Email log not found", status: 404 }

  const log = data as EmailLogRow
  if (log.status !== "failed") {
    return { ok: false, error: "Only failed emails can be resent.", status: 409 }
  }

  const ready = resendPayloadFromLog(log)
  if (!ready.ok) return { ok: false, error: ready.reason, status: 409 }

  const sent = await sendEmail(messageFromPayload(ready.payload))
  if (!sent) {
    return {
      ok: false,
      error: "The provider refused it again — open the new entry below for the reason.",
      status: 502,
    }
  }
  return { ok: true, status: 200 }
}
