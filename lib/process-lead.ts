import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { sendEmail } from "@/lib/email"
import { renderEmailTemplate } from "@/lib/email-templates"
import {
  CREATOR_REF_PATTERN,
  resolveCreatorRef,
  recordCreatorReferral,
} from "@/lib/creator-attribution"
import { resolveSubmissionToken } from "@/lib/creator-challenges"

export interface LeadInput {
  fullName: string
  businessName: string
  email: string
  phone: string
  businessType: string
  productInterest: string
  branches: string
  staffSize: string
  challenge?: string
  message?: string
  source: string
  partnerCode?: string | null
  /** Creator referral code (MP-<digits>) — disjoint from partner codes. */
  creatorCode?: string | null
  /** Submission-level tracking token (?s=sub_…) — resolves to the exact
   *  challenge submission the visitor came from. */
  creatorSubmissionToken?: string | null
  utm?: { source?: string | null; medium?: string | null; campaign?: string | null; content?: string | null } | null
  /** Platform-scoped dedupe key, e.g. "tiktok:12345". Requires migration 061. */
  externalId?: string | null
}

export type ProcessLeadResult =
  | { success: true; leadId: string; duplicate?: boolean }
  | { success: false; error: string; status: number }

/**
 * Shared lead intake pipeline: Supabase -> RelaviCX CRM -> webhook -> email -> WhatsApp.
 * Used by the public /api/leads form endpoint and the ad-platform webhook routes.
 */
export async function processLead(input: LeadInput): Promise<ProcessLeadResult> {
  const {
    fullName,
    businessName,
    email,
    phone,
    businessType,
    productInterest,
    branches,
    staffSize,
    challenge,
    message,
    source,
    partnerCode,
    creatorCode,
    creatorSubmissionToken,
    utm,
    externalId,
  } = input

  // Validate partner attribution format (e.g. MP-NG-00001); ignore anything else
  const referringPartnerCode =
    typeof partnerCode === "string" && /^MP-[A-Z]{2,3}-\d{1,6}$/i.test(partnerCode.trim())
      ? partnerCode.trim().toUpperCase()
      : null

  // Creator attribution: code must match MP-<digits> and resolve to an ACTIVE creator.
  const creator =
    typeof creatorCode === "string" && CREATOR_REF_PATTERN.test(creatorCode.trim())
      ? await resolveCreatorRef(creatorCode.trim())
      : null

  // Submission-level attribution (?s=sub_…): resolves to the exact approved
  // submission + challenge the visitor came through, when present and still
  // owned by the referring creator.
  const submissionRef = creatorSubmissionToken ? await resolveSubmissionToken(creatorSubmissionToken) : null
  const validSubmissionRef = submissionRef && submissionRef.creatorId === creator?.id ? submissionRef : null

  const lead = {
    id: crypto.randomUUID(),
    fullName,
    businessName,
    email,
    phone,
    businessType,
    productInterest,
    branches,
    staffSize,
    challenge: challenge || "",
    message: message || "",
    source: source || "website",
    status: "New" as const,
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  if (isSupabaseConfigured()) {
    const { error } = await supabase.from("leads").insert({
      id: lead.id,
      full_name: lead.fullName,
      business_name: lead.businessName,
      email: lead.email,
      phone: lead.phone,
      business_type: lead.businessType,
      product_interest: lead.productInterest,
      branches: lead.branches,
      staff_size: lead.staffSize,
      challenge: lead.challenge,
      message: lead.message,
      source: lead.source,
      referring_partner_code: referringPartnerCode,
      referring_creator_code: creator?.referralCode ?? null,
      creator_id: creator?.id ?? null,
      creator_challenge_id: validSubmissionRef?.challengeId ?? null,
      creator_submission_id: validSubmissionRef?.submissionId ?? null,
      utm_source: utm?.source ?? null,
      utm_medium: utm?.medium ?? null,
      utm_campaign: utm?.campaign ?? null,
      utm_content: utm?.content ?? null,
      ...(externalId ? { external_id: externalId } : {}),
      status: lead.status,
      submitted_at: lead.submittedAt,
      updated_at: lead.updatedAt,
    })
    if (error) {
      // Unique-violation on external_id: platform retried a lead we already have
      if (error.code === "23505") {
        return { success: true, leadId: lead.id, duplicate: true }
      }
      console.error("[Supabase Lead Insert Error]", error)
    }
  }

  // Determine pipeline ID based on product interest
  const pipelineId =
    productInterest === "retail"
      ? process.env.RELAVICX_RETAIL_PIPELINE_ID
      : productInterest === "erp"
        ? process.env.RELAVICX_ERP_PIPELINE_ID
        : process.env.RELAVICX_GENERAL_PIPELINE_ID

  // Build RelaviCX payload
  const relaviPayload = {
    name: fullName,
    company: businessName,
    email,
    phone,
    pipeline_id: pipelineId,
    source: source || "website",
    custom: {
      referring_partner: referringPartnerCode || undefined,
      referring_creator: creator?.referralCode || undefined,
      business_type: businessType,
      product_interest: productInterest,
      branch_count: branches,
      staff_size: staffSize,
      current_challenge: challenge || "",
      external_id: externalId || undefined,
    },
    notes: message || "",
  }

  // Creator funnel event (best-effort, never blocks the lead pipeline).
  if (creator) {
    void recordCreatorReferral({
      creatorId: creator.id,
      referralCode: creator.referralCode,
      eventType: "LEAD",
      leadId: lead.id,
      challengeId: validSubmissionRef?.challengeId ?? null,
      submissionId: validSubmissionRef?.submissionId ?? null,
      utm,
      dedupeKey: `LEAD:${lead.id}`,
    })
  }

  const notificationPayload = {
    ...relaviPayload,
    submittedAt: new Date().toISOString(),
  }

  // 1. Send to RelaviCX CRM
  const apiKey = process.env.RELAVICX_API_KEY
  const apiUrl = process.env.RELAVICX_API_URL

  if (apiKey && apiUrl) {
    const relaviResponse = await fetch(`${apiUrl}/leads`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(relaviPayload),
    })

    if (!relaviResponse.ok) {
      const errorText = await relaviResponse.text().catch(() => "Unknown error")
      console.error("RelaviCX submission failed:", errorText)
      return { success: false, error: "Failed to submit to CRM. Please try again.", status: 502 }
    }
  } else {
    console.log("Lead submitted (RelaviCX not configured):", notificationPayload)
  }

  // 2. Webhook notification (Zapier, Make, Slack, etc.)
  const webhookUrl = process.env.LEAD_WEBHOOK_URL
  if (webhookUrl) {
    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notificationPayload),
      })
    } catch (err) {
      console.error("Webhook notification failed:", err)
    }
  }

  // 3. Email notification — route is configurable in /admin/settings/email-routes
  const leadTpl = await renderEmailTemplate("lead_submission", {
    fullName,
    businessName,
    email,
    phone,
    productInterest,
    branches,
    staffSize,
    challenge: challenge || "N/A",
    message: message || "N/A",
    source: source || "website",
    referringPartnerBlock: referringPartnerCode ? ` (referred by partner ${referringPartnerCode})` : "",
  })
  await sendEmail({ route: "lead_submission", subject: leadTpl.subject, text: leadTpl.text, html: leadTpl.html })

  // 4. WhatsApp Business API auto-send (requires Meta credentials)
  const waPhoneId = process.env.WHATSAPP_PHONE_ID
  const waToken = process.env.WHATSAPP_ACCESS_TOKEN
  if (waPhoneId && waToken) {
    try {
      await fetch(`https://graph.facebook.com/v18.0/${waPhoneId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${waToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: "+2348037978230",
          type: "text",
          text: {
            body: `New MartPoint Lead:\n${fullName} — ${businessName}\nPhone: ${phone}\nProduct: ${productInterest}\n\nReply to follow up.`,
          },
        }),
      })
    } catch (err) {
      console.error("WhatsApp API notification failed:", err)
    }
  }

  return { success: true, leadId: lead.id }
}
