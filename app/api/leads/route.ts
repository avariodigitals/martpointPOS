import { NextResponse } from "next/server"
import crypto from "crypto"
import { checkRateLimit } from "@/lib/rate-limit"
import { verifyCaptchaToken } from "@/lib/captcha"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { sendEmail } from "@/lib/email"
import { renderEmailTemplate } from "@/lib/email-templates"

interface LeadRecord {
  id: string
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
  status: "New" | "Contacted" | "Qualified" | "Proposal" | "Won" | "Lost"
  assignedTo?: string
  notes?: string
  submittedAt: string
  updatedAt: string
}

export async function POST(request: Request) {
  const limit = await checkRateLimit(request, { key: "leads", max: 5, windowSeconds: 3600 })
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 }
    )
  }

  try {
    const body = await request.json()

    const turnstile = await verifyCaptchaToken(body.captchaToken, request)
    if (!turnstile.success) {
      return NextResponse.json({ error: turnstile.error }, { status: 403 })
    }

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
    } = body

    // Validate partner attribution format (e.g. MP-NG-00001); ignore anything else
    const referringPartnerCode =
      typeof partnerCode === "string" && /^MP-[A-Z]{2,3}-\d{1,6}$/i.test(partnerCode.trim())
        ? partnerCode.trim().toUpperCase()
        : null

    // Validate required fields
    if (!fullName || !businessName || !email || !phone || !businessType || !productInterest || !branches || !staffSize) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Save to Supabase
    const lead: LeadRecord = {
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
      status: "New",
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
        status: lead.status,
        submitted_at: lead.submittedAt,
        updated_at: lead.updatedAt,
      })
      if (error) {
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
        business_type: businessType,
        product_interest: productInterest,
        branch_count: branches,
        staff_size: staffSize,
        current_challenge: challenge || "",
      },
      notes: message || "",
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
        return NextResponse.json(
          { error: "Failed to submit to CRM. Please try again." },
          { status: 502 }
        )
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
      fullName, businessName, email, phone, productInterest, branches, staffSize,
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
            to: "+2348036028069",
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

    return NextResponse.json(
      {
        success: true,
        message: "Lead submitted successfully",
        pipeline: productInterest,
      },
      { status: 200 }
    )
  } catch {
    return NextResponse.json(
      { error: "Failed to process submission" },
      { status: 500 }
    )
  }
}
