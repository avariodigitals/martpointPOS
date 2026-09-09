import { NextResponse } from "next/server"
import crypto from "crypto"
import { checkRateLimit } from "@/lib/rate-limit"
import { verifyCaptchaToken } from "@/lib/captcha"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { sendEmail } from "@/lib/email"
import { renderEmailTemplate } from "@/lib/email-templates"
import { readSettings } from "@/lib/settings"
import {
  buildEstimate,
  buildPricingFromSettings,
  formatRange,
  type EstimateSubmission,
} from "@/lib/estimate-calculator"

export async function POST(request: Request) {
  const limit = await checkRateLimit(request, { key: "estimate", max: 5, windowSeconds: 3600 })
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 },
    )
  }

  try {
    const body = (await request.json()) as EstimateSubmission & {
      recommendation?: never
      captchaToken?: string
    }

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
      country,
      branches,
      staffSize,
      productCount,
      productOrService,
      onlineStore,
      hardwareAvailable,
      receiptHardware,
      dataMigration,
      offlineOperation,
      erpModules,
      trainingPreference,
      notes,
      partnerCode,
    } = body

    // Validate required contact + core facts
    if (!fullName || !email || !phone || !businessType || !branches || !staffSize) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const referringPartnerCode =
      typeof partnerCode === "string" && /^MP-[A-Z]{2,3}-\d{1,6}$/i.test(partnerCode.trim())
        ? partnerCode.trim().toUpperCase()
        : null

    // Compute recommendation server-side (single source of truth) for the email/lead
    const settings = await readSettings()
    const pricing = buildPricingFromSettings((settings?.pricing as Record<string, unknown>) || {})
    const answers = {
      businessName: businessName || "",
      businessType,
      country: country || "",
      branches,
      staffSize,
      productCount: productCount || "",
      productOrService: productOrService || "",
      onlineStore: onlineStore || "",
      hardwareAvailable: hardwareAvailable || "",
      receiptHardware: receiptHardware || "",
      dataMigration: dataMigration || "",
      offlineOperation: offlineOperation || "",
      erpModules: erpModules || "",
      trainingPreference: trainingPreference || "",
    }
    const result = buildEstimate(answers, pricing)

    const leadId = crypto.randomUUID()
    const now = new Date().toISOString()
    const productInterest = "not-sure"

    // 1. Persist to Supabase leads table (so it appears in the Leads dashboard)
    if (isSupabaseConfigured()) {
      const { error } = await supabase.from("leads").insert({
        id: leadId,
        full_name: fullName,
        business_name: businessName || "",
        email,
        phone,
        business_type: businessType,
        product_interest: productInterest,
        branches,
        staff_size: staffSize,
        challenge: `Estimate — Retail: ${result.retail.planName} (${formatRange(result.retail)}); ERP: ${result.erp.planName} (${formatRange(result.erp)})`,
        message: notes || "",
        source: referringPartnerCode ? `estimate-calculator:partner:${referringPartnerCode}` : "estimate-calculator",
        referring_partner_code: referringPartnerCode,
        status: "New",
        submitted_at: now,
        updated_at: now,
      })
      if (error) {
        console.error("[estimate] Supabase lead insert error:", error.message)
      }
    }

    // 2. Forward to RelaviCX CRM (general pipeline)
    const apiKey = process.env.RELAVICX_API_KEY
    const apiUrl = process.env.RELAVICX_API_URL
    if (apiKey && apiUrl) {
      try {
        await fetch(`${apiUrl}/leads`, {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            name: fullName,
            company: businessName || "",
            email,
            phone,
            pipeline_id: process.env.RELAVICX_GENERAL_PIPELINE_ID,
            source: "estimate-calculator",
            custom: {
              referring_partner: referringPartnerCode || undefined,
              business_type: businessType,
              country: country || undefined,
              branches,
              staff_size: staffSize,
              product_count: productCount || undefined,
              online_store: onlineStore || undefined,
              offline_operation: offlineOperation || undefined,
              erp_modules: erpModules || undefined,
              retail_plan: result.retail.planName,
              erp_plan: result.erp.planName,
              retail_tier: result.retail.internalTier,
              erp_tier: result.erp.internalTier,
            },
            notes: notes || "",
          }),
        })
      } catch (err) {
        console.error("[estimate] RelaviCX submission failed:", err)
      }
    }

    // 3. Email notification to the sales team (route-controlled recipient)
    const tpl = await renderEmailTemplate("estimate_submission", {
      fullName,
      businessName: businessName || "—",
      email,
      phone,
      businessType,
      country: country || "—",
      branches,
      staffSize,
      productCount: productCount || "—",
      productOrService: productOrService || "—",
      onlineStore: onlineStore || "—",
      hardwareAvailable: hardwareAvailable || "—",
      receiptHardware: receiptHardware || "—",
      dataMigration: dataMigration || "—",
      offlineOperation: offlineOperation || "—",
      erpModules: erpModules || "—",
      trainingPreference: trainingPreference || "—",
      retailPlan: result.retail.planName,
      retailRange: formatRange(result.retail),
      retailTier: result.retail.internalTier,
      erpPlan: result.erp.planName,
      erpRange: formatRange(result.erp),
      erpTier: result.erp.internalTier,
      notes: notes || "—",
    })
    await sendEmail({ route: "estimate_submission", subject: tpl.subject, text: tpl.text, html: tpl.html })

    // 4. WhatsApp Business API auto-notify (requires Meta credentials)
    const waPhoneId = process.env.WHATSAPP_PHONE_ID
    const waToken = process.env.WHATSAPP_ACCESS_TOKEN
    if (waPhoneId && waToken) {
      try {
        await fetch(`https://graph.facebook.com/v18.0/${waPhoneId}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${waToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: "+2348036028069",
            type: "text",
            text: {
              body: `New MartPoint Estimate Request:\n${fullName} — ${businessName || "—"}\nPhone: ${phone}\nRetail: ${result.retail.planName} (${formatRange(result.retail)})\nERP: ${result.erp.planName} (${formatRange(result.erp)})\n\nReply to follow up.`,
            },
          }),
        })
      } catch (err) {
        console.error("[estimate] WhatsApp API notification failed:", err)
      }
    }

    return NextResponse.json({
      success: true,
      message: "Estimate submitted successfully",
      recommendation: {
        retail: { planName: result.retail.planName, range: formatRange(result.retail) },
        erp: { planName: result.erp.planName, range: formatRange(result.erp) },
      },
    })
  } catch {
    return NextResponse.json({ error: "Failed to process estimate" }, { status: 500 })
  }
}
