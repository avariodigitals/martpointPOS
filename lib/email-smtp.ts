/* ───────────────────  SMTP sender (server-only)  ───────────────────
 * Sends mail through the admin's own mailbox via nodemailer. Used by the lead
 * Email tab so threads live on a real mailbox and replies can be pulled back
 * by the IMAP sync (/api/cron/email-sync).
 *
 * IMPORTANT: this file imports nodemailer (Node builtins: net/tls). Only
 * import it from server-side code — never from lib/email.ts or anything that
 * reaches a client bundle.
 */

import nodemailer from "nodemailer"
import type { EmailMessage, EmailSettings } from "./email"
import { writeEmailLog } from "./email"
import { ensureBrandedHtml } from "./email-templates"

export async function sendEmailViaSmtp(
  message: EmailMessage,
  settings: EmailSettings,
  from: string,
  toList: string[],
): Promise<boolean> {
  const smtp = settings.smtp
  const sender = from || smtp.fromEmail || smtp.user

  const logBase = {
    from: sender,
    to: toList.join(", "),
    subject: message.subject,
    status: "pending" as const,
    provider: "smtp",
    metadata: { html: !!message.html, route: message.route || null },
  }

  if (!smtp.host || !smtp.user || !sender) {
    console.warn("[email] SMTP not configured; email not sent.")
    await writeEmailLog({
      ...logBase,
      status: "failed",
      error_message: "SMTP host/user not configured in backend settings or environment",
    })
    return false
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined,
    })

    const info = await transporter.sendMail({
      from: sender,
      to: toList.join(", "),
      subject: message.subject,
      text: message.text,
      html: message.skipBranding ? message.html : ensureBrandedHtml(message.html, { text: message.text }),
      replyTo: message.replyTo,
      attachments: message.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        encoding: "base64",
      })),
      headers: message.headers,
    })

    await writeEmailLog({
      ...logBase,
      status: "sent",
      provider_response: `messageId=${info.messageId || ""} ${info.response || ""}`.trim(),
      sent_at: new Date().toISOString(),
    })
    return true
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error("[email] SMTP send failed:", err)
    await writeEmailLog({
      ...logBase,
      status: "failed",
      error_message: errorMessage,
    })
    return false
  }
}
