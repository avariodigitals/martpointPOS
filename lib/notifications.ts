import { sendEmail } from "./email"

export type NotificationEvent =
  | "PARTNER_LEAD_SUBMITTED"
  | "PARTNER_LEAD_PROTECTION_APPROVED"
  | "PARTNER_LEAD_PROTECTION_REJECTED"
  | "PARTNER_LEAD_PROTECTION_EXPIRING"
  | "PARTNER_CUSTOMER_ASSIGNED"
  | "PARTNER_ASSIGNMENT_REVOKED"
  | "ONBOARDING_READY"
  | "ONBOARDING_SUBMITTED"
  | "ONBOARDING_CORRECTIONS_REQUIRED"
  | "ONBOARDING_APPROVED"
  | "QUOTE_SENT"
  | "INVOICE_ISSUED"
  | "PAYMENT_RECEIVED"
  | "RECEIPT_ISSUED"
  | "RENEWAL_REMINDER"
  | "COMMISSION_ELIGIBLE"
  | "COMMISSION_APPROVED"
  | "COMMISSION_PAID"
  | "OVERDUE_INVOICE"
  | "RENEWAL_APPROACHING"
  | "PAYMENT_AWAITING_CONFIRMATION"
  | "COMMISSION_APPROVAL_PENDING"

interface NotificationContext {
  to: string
  subject: string
  text: string
  html?: string
}

export async function queueNotification(_event: NotificationEvent, ctx: NotificationContext): Promise<boolean> {
  try {
    await sendEmail({
      to: ctx.to,
      subject: ctx.subject,
      text: ctx.text,
      html: ctx.html ?? ctx.text,
    })
    return true
  } catch (err) {
    console.error("[notifications] failed:", err)
    return false
  }
}
