import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { getPartnerSession, authorizePartner, canPartnerAccessBusiness, getPartnerById } from "@/lib/partner-auth"
import { auditContextFromPartnerSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { sendEmail, REPLY_TO } from "@/lib/email"
import type { EmailAttachment } from "@/lib/email"
import { renderEmailTemplate, escapeHtml } from "@/lib/email-templates"
import { getPublicSiteSettings } from "@/lib/settings"
import { checkRateLimit } from "@/lib/rate-limit"

const MAX_ATTACHMENTS = 10
const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024
const MAX_TOTAL_BYTES = 10 * 1024 * 1024

const sendSchema = z.object({
  recipients: z.string().min(3).max(500),
  softwareUrl: z.string().url().max(500),
  adminUsername: z.string().min(1).max(200),
  tempPassword: z.string().min(1).max(200),
  message: z.string().max(5000).optional(),
  supportContact: z.string().max(300).optional(),
  attachments: z
    .array(z.object({ name: z.string().max(120), content: z.string() }))
    .max(MAX_ATTACHMENTS)
    .optional(),
})

async function guardHandover(businessId: string) {
  const session = await getPartnerSession()
  if (!session) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  const auth = await authorizePartner({
    session,
    permission: "onboarding:manage_assigned",
    capability: "CUSTOMER_ONBOARDING",
  })
  if (!auth.authorized) return { error: auth.response! }

  const access = await canPartnerAccessBusiness(session.partnerId, businessId, {
    partnerUserId: session.partnerUserId,
    userPermission: "onboarding:manage_assigned",
    orgCapability: "CUSTOMER_ONBOARDING",
    requiredAccessLevel: "ONBOARDING_MANAGER",
  })
  if (!access.allowed) {
    return { error: NextResponse.json({ error: "Access denied" }, { status: 403 }) }
  }

  if (!isSupabaseConfigured()) {
    return { error: NextResponse.json({ error: "Database not configured" }, { status: 500 }) }
  }

  return { session }
}

async function loadContext(businessId: string) {
  const [{ data: business }, { data: deployment }] = await Promise.all([
    supabase
      .from("businesses")
      .select("id, business_name, primary_contact_name, primary_email")
      .eq("id", businessId)
      .maybeSingle(),
    supabase
      .from("business_deployments")
      .select("environment_url, admin_url, online_store_url, handover_details")
      .eq("business_id", businessId)
      .maybeSingle(),
  ])
  return { business, deployment }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params
  const guard = await guardHandover(businessId)
  if (guard.error) return guard.error

  const { business, deployment } = await loadContext(businessId)
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 })

  const last = (deployment?.handover_details as Record<string, unknown> | null) ?? null
  return NextResponse.json({
    businessName: business.business_name,
    contactName: business.primary_contact_name || "",
    recipient: business.primary_email || "",
    softwareUrl: (last?.softwareUrl as string) || deployment?.admin_url || deployment?.environment_url || "",
    adminUsername: (last?.adminUsername as string) || "",
    supportContact: (last?.supportContact as string) || "",
    lastSentAt: (last?.lastSentAt as string) || null,
    lastRecipients: (last?.recipients as string) || null,
  })
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params
  const guard = await guardHandover(businessId)
  if (guard.error) return guard.error
  const session = guard.session!

  const limit = await checkRateLimit(request, {
    key: "partner-handover-send",
    max: 10,
    windowSeconds: 3600,
  })
  if (!limit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  try {
    const body = await request.json()
    const parsed = sendSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }
    const { recipients, softwareUrl, adminUsername, tempPassword, message, supportContact, attachments } = parsed.data

    const { business } = await loadContext(businessId)
    if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 })

    const to = recipients.trim() || (business.primary_email as string) || ""
    if (!to) {
      return NextResponse.json({ error: "No recipient email" }, { status: 400 })
    }

    const partner = await getPartnerById(session.partnerId)
    const partnerName = partner?.displayName || partner?.businessName || "Your MartPoint partner"
    const contactName = (business.primary_contact_name as string) || "there"
    const businessName = (business.business_name as string) || "your business"
    const messageBlock = message?.trim() ? `${message.trim()}\n\n` : ""
    const supportBlock = supportContact?.trim()
      ? `Your support contact: ${supportContact.trim()}\n\n`
      : "Questions? Reply to this email and the team will help.\n\n"

    const tpl = await renderEmailTemplate("partner_installation_handover", {
      contactName,
      businessName,
      partnerName,
      softwareUrl,
      adminUsername,
      tempPassword,
      messageBlock,
      supportBlock,
    })

    const emailAttachments: EmailAttachment[] = []
    if (attachments) {
      let totalBytes = 0
      for (const a of attachments.slice(0, MAX_ATTACHMENTS)) {
        const name = String(a?.name || "").slice(0, 120) || "attachment"
        const content = String(a?.content || "")
        const approxBytes = Math.floor((content.length * 3) / 4)
        if (!content || approxBytes > MAX_ATTACHMENT_BYTES || totalBytes + approxBytes > MAX_TOTAL_BYTES) continue
        totalBytes += approxBytes
        emailAttachments.push({ filename: name, content })
      }
    }

    const siteSettings = await getPublicSiteSettings()
    const logoUrl = siteSettings.logo || "/logo.webp"
    const emailHtml = `<div style="font-family:sans-serif;max-width:600px">
      <img src="${logoUrl}" alt="MartPoint" style="max-height:48px;margin-bottom:16px;" />
      <div style="background:#f8fafc;padding:16px;border-radius:8px;margin:16px 0">${escapeHtml(tpl.text).replace(/\n/g, "<br>")}</div>
      <p>Best regards,<br>${escapeHtml(partnerName)}<br>MartPoint Partner</p>
    </div>`

    const sent = await sendEmail({
      to,
      subject: tpl.subject,
      text: tpl.text,
      html: emailHtml,
      route: "partner_installation_handover",
      replyTo: REPLY_TO.partners,
      attachments: emailAttachments.length ? emailAttachments : undefined,
    })

    // Persist the handover payload for resends and the audit trail
    await supabase
      .from("business_deployments")
      .update({
        updated_at: new Date().toISOString(),
        admin_url: softwareUrl,
        handover_details: {
          recipients: to,
          softwareUrl,
          adminUsername,
          tempPassword,
          supportContact: supportContact?.trim() || "",
          message: message?.trim() || "",
          attachmentCount: emailAttachments.length,
          sentByPartnerUserId: session.partnerUserId,
          lastSentAt: new Date().toISOString(),
        },
      })
      .eq("business_id", businessId)

    const ctx = auditContextFromPartnerSession(session, request)
    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.PARTNER_HANDOVER_EMAIL_SENT,
      entityType: AUDIT_ENTITIES.BUSINESS,
      entityId: businessId,
      metadata: {
        partnerId: session.partnerId,
        partnerUserId: session.partnerUserId,
        recipients: to,
        softwareUrl,
        attachmentCount: emailAttachments.length,
      },
    })

    return NextResponse.json({ success: true, sent })
  } catch {
    return NextResponse.json({ error: "Failed to send handover email" }, { status: 500 })
  }
}
