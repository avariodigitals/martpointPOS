/* ───────────────────────────  Email helper  ───────────────────────────
 * All outbound email goes through Resend when RESEND_API_KEY is configured.
 * If not configured, the operation logs and returns false; it never throws.
 */

export interface EmailMessage {
  to: string | string[]
  subject: string
  text: string
  html?: string
  from?: string
}

export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) {
    console.warn("[email] RESEND_API_KEY not configured; email not sent.")
    return false
  }

  const from =
    message.from ||
    process.env.RESEND_FROM_EMAIL ||
    "MartPoint <hello@martpoint.com.ng>"

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "unknown error")
      console.error("[email] Resend error:", res.status, text)
      return false
    }
    return true
  } catch (err) {
    console.error("[email] send failed:", err)
    return false
  }
}
