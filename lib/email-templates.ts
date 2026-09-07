/* ───────────────────────────  Email templates  ───────────────────────────
 * Predefined outbound-email copy. Each template has a subject + plain-text
 * body with {{variable}} placeholders. Admins can override any template in
 * /admin/settings/email-templates; overrides are stored in
 * settings.data.email.templates and merged over the defaults at send time.
 */

import { supabase, isSupabaseConfigured } from "./supabase"

export interface EmailTemplate {
  subject: string
  text: string
  /** Optional HTML body; if empty the text body is used. */
  html?: string
}

export interface TemplateDefinition extends EmailTemplate {
  key: string
  label: string
  description: string
  variables: string[]
}

export const EMAIL_TEMPLATES: TemplateDefinition[] = [
  {
    key: "partner_application_received",
    label: "Application Received (applicant)",
    description: "Sent to the applicant right after they submit a partner application.",
    variables: ["fullName", "reference", "statusUrl"],
    subject: "MartPoint Partner Application Received — {{reference}}",
    text: `Hi {{fullName}},

Thank you for applying to become a MartPoint partner. Your application has been received.

Application Reference: {{reference}}

You can check your application status anytime at:
{{statusUrl}}

You will need your application reference and the email used to apply.

Best regards,
MartPoint Partner Team`,
  },
  {
    key: "partner_application_admin",
    label: "Application Received (internal copy)",
    description: "Notification to the team when a new partner application arrives.",
    variables: ["fullName", "reference", "email"],
    subject: "New Partner Application — {{reference}}",
    text: `A new partner application was submitted.

Reference: {{reference}}
Applicant: {{fullName}}
Email: {{email}}

Review it in the Control Centre.`,
  },
  {
    key: "application_status_change",
    label: "Application Status Update",
    description: "Sent to the applicant whenever the application status changes.",
    variables: ["fullName", "reference", "statusLabel", "previousLabel", "message", "statusUrl"],
    subject: "MartPoint Partner Application Update — {{reference}}",
    text: `Hi {{fullName}},

Your MartPoint partner application (Reference: {{reference}}) has been updated.

Current status: {{statusLabel}}{{previousLabelBlock}}{{messageBlock}}

You can view the latest status and any required actions at:
{{statusUrl}}

Best regards,
MartPoint Partner Team`,
  },
  {
    key: "compliance_doc_request",
    label: "Compliance Document Request",
    description: "One-time upload link emailed when admin requests a compliance document.",
    variables: ["fullName", "reference", "docType", "uploadUrl"],
    subject: "Action required: submit your {{docType}} for MartPoint partner application {{reference}}",
    text: `Hi {{fullName}},

Thank you for your interest in partnering with MartPoint. Before we can proceed, please submit the following compliance document:

Document: {{docType}}
Application reference: {{reference}}

Upload here (one-time link, expires in 7 days):
{{uploadUrl}}

Once submitted, this link will become invalid. If you need to submit a revised document, the MartPoint team will send you a new link.

Best regards,
MartPoint Partner Team`,
  },
  {
    key: "compliance_doc_reminder",
    label: "Compliance Document Reminder",
    description: "New one-time upload link when admin resends a document request.",
    variables: ["fullName", "reference", "docType", "uploadUrl"],
    subject: "Reminder: submit your {{docType}} for MartPoint partner application {{reference}}",
    text: `Hi {{fullName}},

Please submit the following document using this one-time upload link:

Document: {{docType}}
Upload link (expires in 7 days):
{{uploadUrl}}

Best regards,
MartPoint Partner Team`,
  },
  {
    key: "partner_user_invite",
    label: "Partner Portal Invitation",
    description: "Sent when a partner user is invited to the partner portal.",
    variables: ["fullName", "businessName", "link"],
    subject: "Invitation to join the MartPoint Partner Portal",
    text: `Hi {{fullName}},

You have been invited to join the MartPoint Partner Portal for {{businessName}}.

Click the link below to accept your invitation and set your password. This link expires in 7 days and can only be used once.

{{link}}

Welcome,
MartPoint Partner Team`,
  },
  {
    key: "partner_user_invite_resent",
    label: "Partner Portal Invitation (resend)",
    description: "Sent when a partner portal invitation link is re-issued.",
    variables: ["fullName", "businessName", "link"],
    subject: "Your MartPoint Partner Portal invitation",
    text: `Hi {{fullName}},

Here is your new invitation link to join the MartPoint Partner Portal for {{businessName}}.

{{link}}

This link expires in 7 days and can only be used once.

MartPoint Partner Team`,
  },
  {
    key: "partner_password_reset",
    label: "Partner Password Reset",
    description: "Password-reset link for partner portal users.",
    variables: ["fullName", "link"],
    subject: "Reset your MartPoint Partner Portal password",
    text: `Hi {{fullName}},

You requested a password reset for your MartPoint Partner Portal account.

Click the link below to set a new password. This link expires in 1 hour and can only be used once.

{{link}}

If you did not request this, please ignore this email.

MartPoint Partner Team`,
  },
  {
    key: "partner_lead_invite",
    label: "Partner Lead — Invite to Apply",
    description: "Sent when an admin invites a partner lead or prospect to complete the partner application form.",
    variables: ["contactName", "businessName", "inviteLink"],
    subject: "Let's grow together — your MartPoint Partner invitation",
    text: `Hi {{contactName}},

Thank you for your interest in partnering with MartPoint. We help ambitious businesses across Africa sell smarter, manage inventory, and delight their customers — and we're building a partner ecosystem to make that impact even bigger.

We'd love to invite you to formally apply to the MartPoint Partner Program. We have pre-filled some of the information you shared with us, so the application should only take a few minutes.

Complete your application here:
{{inviteLink}}

If you have any questions before applying, simply reply to this email and our Partner Team will be happy to help.

Looking forward to building something great together.

Warm regards,
The MartPoint Partner Team`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your MartPoint Partner invitation</title>
</head>
<body style="margin:0; padding:0; background-color:#f5f6f7; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color:#111827;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f6f7; padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06); max-width:600px; width:100%;">
          <tr>
            <td style="padding:48px 40px 32px; text-align:center; background:linear-gradient(135deg, #0057FF 0%, #003BB3 100%);">
              <div style="color:#ffffff; font-size:24px; font-weight:700; letter-spacing:-0.5px;">MartPoint</div>
              <div style="color:#E0EAFF; font-size:12px; text-transform:uppercase; letter-spacing:2px; margin-top:6px;">Partner Programme</div>
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <p style="font-size:18px; font-weight:600; margin:0 0 16px;">Hi {{contactName}},</p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 24px; color:#374151;">
                Thank you for your interest in partnering with MartPoint. We help ambitious businesses across Africa sell smarter, manage inventory, and delight their customers — and we're growing a partner ecosystem to make that impact even bigger.
              </p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 32px; color:#374151;">
                We'd love to invite you to formally apply to the <strong>MartPoint Partner Program</strong>. We've pre-filled some of the details you shared, so the application should only take a few minutes.
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 32px;">
                <tr>
                  <td style="border-radius:8px; background-color:#0057FF; text-align:center;">
                    <a href="{{inviteLink}}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Complete Your Application</a>
                  </td>
                </tr>
              </table>
              <p style="font-size:13px; line-height:1.5; margin:0 0 24px; color:#6b7280; word-break:break-all;">
                Or copy and paste this link into your browser:<br />
                <a href="{{inviteLink}}" style="color:#0057FF; text-decoration:underline;">{{inviteLink}}</a>
              </p>
              <p style="font-size:15px; line-height:1.6; margin:0 0 8px; color:#374151;">
                If you have any questions before applying, simply reply to this email — our Partner Team will be happy to help.
              </p>
              <p style="font-size:15px; line-height:1.6; margin:0; color:#374151;">
                Looking forward to building something great together.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px; background-color:#f9fafb; text-align:center; border-top:1px solid #e5e7eb;">
              <p style="font-size:12px; color:#6b7280; margin:0;">Warm regards,<br/><strong>The MartPoint Partner Team</strong></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  },
  {
    key: "lead_submission",
    label: "New Website Lead (internal)",
    description: "Internal notification when a public lead form is submitted. Recipient is controlled by the lead_submission email route.",
    variables: ["fullName", "businessName", "email", "phone", "productInterest", "branches", "staffSize", "challenge", "message", "source", "referringPartnerBlock"],
    subject: "New Lead: {{fullName}} — {{businessName}}",
    text: `New lead submitted via {{source}}{{referringPartnerBlock}}

Name: {{fullName}}
Business: {{businessName}}
Email: {{email}}
Phone: {{phone}}
Product: {{productInterest}}
Branches: {{branches}}
Staff: {{staffSize}}

Challenge: {{challenge}}
Message: {{message}}`,
  },
  {
    key: "career_application",
    label: "Career Application (internal)",
    description: "Notification for a new job application. The CV is attached to the email. Recipient is controlled by the career_application email route.",
    variables: ["fullName", "email", "phone", "linkedin"],
    subject: "New Career Application: {{fullName}}",
    text: `New career application received.

Full Name: {{fullName}}
Email: {{email}}
Phone: {{phone}}
LinkedIn: {{linkedin}}

Reply to this candidate at {{email}}.`,
  },
  {
    key: "payout_request_admin",
    label: "Partner Payout Request (internal)",
    description: "Notification to the finance team when a partner requests a withdrawal.",
    variables: ["partnerId", "amount", "notes"],
    subject: "Partner payout request — ₦{{amount}}",
    text: `A partner has requested a commission payout.

Partner: {{partnerId}}
Amount: ₦{{amount}}
Notes: {{notes}}

Review it in the Control Centre under Partners → Payout Requests.`,
  },
  {
    key: "payout_approved",
    label: "Payout Request Approved",
    description: "Sent to the partner user when a withdrawal request is approved.",
    variables: ["fullName", "amount", "payoutReference"],
    subject: "Your MartPoint payout request was approved",
    text: `Hi {{fullName}},

Your payout request for ₦{{amount}} has been approved and scheduled for payment (reference {{payoutReference}}).

MartPoint Partner Team`,
  },
  {
    key: "payout_rejected",
    label: "Payout Request Declined",
    description: "Sent to the partner user when a withdrawal request is rejected.",
    variables: ["fullName", "amount", "reasonBlock"],
    subject: "Your MartPoint payout request was declined",
    text: `Hi {{fullName}},

Your payout request for ₦{{amount}} was declined.{{reasonBlock}}

Contact your partner manager if you have questions.

MartPoint Partner Team`,
  },
  {
    key: "onboarding_welcome",
    label: "Onboarding Welcome",
    description: "Sent when an onboarding record is created. Note: a custom message entered in the admin UI overrides this body.",
    variables: ["fullName", "setupQuestions", "formLink"],
    subject: "Welcome to MartPoint — Action Required: Setup Your Account",
    text: `Hi {{fullName}},

Welcome to MartPoint! To get your system up and running, we need a few critical details.

{{setupQuestions}}

Complete your onboarding form:
{{formLink}}

Best regards,
MartPoint Team`,
  },
  {
    key: "onboarding_invoice",
    label: "Onboarding Invoice",
    description: "Invoice email for onboarding customers. Note: a custom message entered in the admin UI overrides this body.",
    variables: ["fullName", "businessName", "description", "amount", "tax", "total", "dueDate", "formLink"],
    subject: "Your MartPoint Invoice — {{businessName}}",
    text: `Hi {{fullName}},

Thank you for choosing MartPoint. Please find your invoice below:

Description: {{description}}
Amount: ₦{{amount}}
Tax: ₦{{tax}}
Total Due: ₦{{total}}
Due Date: {{dueDate}}

You can complete your onboarding here: {{formLink}}

Best regards,
MartPoint Team`,
  },
  {
    key: "support_magic_link",
    label: "Support Sign-in Link",
    description: "Magic-link email for the customer support portal.",
    variables: ["contactName", "businessName", "link"],
    subject: "Your MartPoint Support sign-in link",
    text: `Hi {{contactName}},

Click the link below to sign in to the MartPoint customer support portal for {{businessName}}:

{{link}}

This link expires in 15 minutes and can only be used from this device.
If you did not request this link, you can ignore this email.`,
  },
  {
    key: "quotation_subject",
    label: "Quotation Email — Subject",
    description: "Subject line for quotation emails (the quotation body is generated from the quote line items).",
    variables: ["quoteNumber", "titleBlock"],
    subject: "Quotation {{quoteNumber}}{{titleBlock}} from MartPoint",
    text: "",
  },
  {
    key: "lead_questionnaire",
    label: "Lead Requirements Questionnaire",
    description: "Sent to a lead before a quotation is issued. Contains a unique per-client questionnaire link.",
    variables: ["fullName", "businessName", "questionnaireLink"],
    subject: "MartPoint Requirements Questionnaire — {{businessName}}",
    text: `Hi {{fullName}},

To prepare an accurate quote for {{businessName}}, please complete this short requirements questionnaire:

{{questionnaireLink}}

It only takes a few minutes and the details you provide will help us tailor the right MartPoint package for your business.

Best regards,
MartPoint Sales Team`,
  },
]

const templateMap = new Map(EMAIL_TEMPLATES.map((t) => [t.key, t]))

/**
 * Render a template: admin overrides from settings.data.email.templates are
 * merged over the defaults, then {{variables}} are substituted.
 * `{{xBlock}}` is a special variable containing a pre-built block (or "").
 */
export async function renderEmailTemplate(
  key: string,
  vars: Record<string, string | number | null | undefined>
): Promise<EmailTemplate> {
  const def = templateMap.get(key)
  if (!def) throw new Error(`Unknown email template: ${key}`)

  let override: Partial<EmailTemplate> = {}
  if (isSupabaseConfigured()) {
    try {
      const { data } = await supabase.from("settings").select("data").eq("id", 1).single()
      const overrides = ((data?.data as Record<string, unknown>)?.email as Record<string, unknown>)?.templates as
        | Record<string, { subject?: string; text?: string; html?: string }>
        | undefined
      override = overrides?.[key] || {}
    } catch {
      // fall back to defaults
    }
  }

  const tpl: EmailTemplate = {
    subject: override.subject || def.subject,
    text: override.text || def.text,
    html: override.html ?? def.html,
  }

  const substitute = (s: string) =>
    s.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(vars[name] ?? ""))

  return {
    subject: substitute(tpl.subject),
    text: substitute(tpl.text),
    html: tpl.html ? substitute(tpl.html) : undefined,
  }
}
