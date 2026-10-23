import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { resolveIndustryName } from "@/lib/industries"
import { sendEmail } from "@/lib/email"
import { renderEmailTemplate } from "@/lib/email-templates"
import {
  CREATOR_REF_PATTERN,
  resolveCreatorRef,
  recordCreatorReferral,
} from "@/lib/creator-attribution"
import { resolveSubmissionToken } from "@/lib/creator-challenges"
import { notifyAllAdmins } from "@/lib/admin-notifications"
import { notifyPartnerLeadReceived } from "@/lib/partner-notifications"

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
  | { success: true; leadId: string; duplicate?: boolean; notificationEmailSent?: boolean }
  | { success: false; error: string; status: number }

export interface AttributedLeadInput {
  leadId: string
  partnerCode?: string | null
  fullName: string
  businessName: string
  email: string
  phone: string
  businessType: string
  productInterest: string
  branches?: string | number | null
  staffSize?: string | number | null
  challenge?: string | null
  message?: string | null
  submittedAt?: string
  updatedAt?: string
}

function normalizePartnerCode(value?: string | null): string | null {
  return typeof value === "string" && /^MP-[A-Z]{2,3}-\d{1,6}$/i.test(value.trim())
    ? value.trim().toUpperCase()
    : null
}

async function resolveActivePartnerId(partnerCode: string | null): Promise<string | null> {
  if (!partnerCode || !isSupabaseConfigured()) return null
  const { data: partner } = await supabase
    .from("partners")
    .select("id")
    .eq("partner_id", partnerCode)
    .eq("status", "ACTIVE")
    .maybeSingle()
  return (partner?.id as string | undefined) || null
}

function wholeNumber(value: string | number | null | undefined): number | null {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null
}

/**
 * Bring a lead created by a specialised public form (estimate/demo) into the
 * same partner-owned workflow as the main quote form. The matched lead id is
 * the stable link back to the canonical leads table.
 */
export async function createAttributedPartnerLead(input: AttributedLeadInput): Promise<{
  partnerId: string
  partnerLeadId: string
} | null> {
  const partnerCode = normalizePartnerCode(input.partnerCode)
  const partnerId = await resolveActivePartnerId(partnerCode)
  if (!partnerId) return null

  const { data: existing } = await supabase
    .from("partner_leads")
    .select("id")
    .eq("partner_id", partnerId)
    .eq("matched_lead_id", input.leadId)
    .maybeSingle()
  if (existing?.id) return { partnerId, partnerLeadId: String(existing.id) }

  const now = input.updatedAt || input.submittedAt || new Date().toISOString()
  const createdAt = input.submittedAt || now
  const { data: partnerLead, error } = await supabase
    .from("partner_leads")
    .insert({
      partner_id: partnerId,
      submitted_by_partner_user_id: null,
      business_name: input.businessName.trim(),
      contact_name: input.fullName.trim(),
      phone: input.phone.trim(),
      email: input.email.trim().toLowerCase() || null,
      country: "Nigeria",
      state: "",
      city: "",
      industry: resolveIndustryName(input.businessType),
      business_type: input.businessType,
      estimated_branches: wholeNumber(input.branches),
      estimated_users: wholeNumber(input.staffSize),
      interested_product: input.productInterest,
      notes: [input.challenge, input.message].filter((value) => Boolean(value?.trim())).join("\n\n") || null,
      status: "REGISTERED",
      protection_status: "PENDING",
      protection_expires_at: null,
      matched_lead_id: input.leadId,
      matched_business_id: null,
      created_at: createdAt,
      updated_at: now,
    })
    .select("id")
    .single()

  if (error || !partnerLead) {
    console.error("[partner-leads] attributed lead insert failed:", error?.message)
    return null
  }

  try {
    await notifyPartnerLeadReceived(partnerId, {
      leadId: String(partnerLead.id),
      businessName: input.businessName,
      contactName: input.fullName,
      productInterest: input.productInterest,
    })
  } catch (notificationError) {
    console.error("[partner-leads] partner notification failed:", notificationError)
  }

  return { partnerId, partnerLeadId: String(partnerLead.id) }
}

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
  const referringPartnerCode = normalizePartnerCode(partnerCode)

  // The public form stores the human-facing partner code on `leads`. Resolve
  // the internal partner UUID as well so the same enquiry can enter the
  // partner-owned lead workflow and appear in the Partner Portal.
  let referringPartnerId: string | null = null
  referringPartnerId = await resolveActivePartnerId(referringPartnerCode)

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

  let leadPersisted = false
  if (isSupabaseConfigured()) {
    const { error } = await supabase.from("leads").insert({
      id: lead.id,
      full_name: lead.fullName,
      business_name: lead.businessName,
      email: lead.email,
      phone: lead.phone,
      business_type: lead.businessType,
      industry: resolveIndustryName(lead.businessType),
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
      return { success: false, error: "We could not save your enquiry. Please try again.", status: 503 }
    } else {
      leadPersisted = true
    }
  }

  let partnerLeadId: string | null = null
  if (leadPersisted && referringPartnerId) {
    const attributed = await createAttributedPartnerLead({
      leadId: lead.id,
      partnerCode: referringPartnerCode,
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
      submittedAt: lead.submittedAt,
      updatedAt: lead.updatedAt,
    })
    partnerLeadId = attributed?.partnerLeadId || null
  }

  if (leadPersisted) {
    try {
      await notifyAllAdmins({
        type: referringPartnerId ? "PARTNER_REFERRED_LEAD_RECEIVED" : "LEAD_RECEIVED",
        title: referringPartnerId ? "New partner-referred lead" : "New website lead",
        message: `${businessName} · ${fullName} · ${email}${referringPartnerCode ? ` · partner ${referringPartnerCode}` : ""}`,
        deep_link: partnerLeadId ? "/admin/partners/leads" : `/admin/leads?lead=${encodeURIComponent(lead.id)}`,
        source_type: partnerLeadId ? "partner_lead" : "lead",
        source_id: partnerLeadId || lead.id,
      })
    } catch (notificationError) {
      console.error("[leads] admin notification failed:", notificationError)
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
  const notificationEmailSent = await sendEmail({ route: "lead_submission", subject: leadTpl.subject, text: leadTpl.text, html: leadTpl.html })
  if (!notificationEmailSent && leadPersisted) {
    try {
      await notifyAllAdmins({
        type: "LEAD_NOTIFICATION_EMAIL_FAILED",
        title: "Lead saved — notification email failed",
        message: `${businessName} · ${fullName} was saved, but the sales notification email could not be delivered. Check Email Logs.`,
        deep_link: partnerLeadId ? "/admin/partners/leads" : `/admin/leads?lead=${encodeURIComponent(lead.id)}`,
        source_type: partnerLeadId ? "partner_lead" : "lead",
        source_id: partnerLeadId || lead.id,
      })
    } catch (notificationError) {
      console.error("[leads] email failure alert failed:", notificationError)
    }
  }

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

  return { success: true, leadId: lead.id, notificationEmailSent }
}
