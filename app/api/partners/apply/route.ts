import { NextResponse, after } from "next/server"
import { z } from "zod"
import { checkRateLimit } from "@/lib/rate-limit"
import { verifyCaptchaToken } from "@/lib/captcha"
import { submitPartnerApplication, sendApplicationSubmittedEmail } from "@/lib/partners"
import { runPartnerAiReview } from "@/lib/partner-ai"
import { readSettings } from "@/lib/settings"
import { uploadPartnerDocument, validatePartnerFile } from "@/lib/partner-documents"
import { getLeadByInviteToken } from "@/lib/partner-leads"
import { getPartnerProspectByToken } from "@/lib/partner-prospects"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

const PARTNER_TYPES = ["REFERRAL", "CHANNEL", "IMPLEMENTATION", "CHANNEL_IMPLEMENTATION", "TECHNOLOGY", "PAYMENT"] as const
const APPLICANT_TYPES = ["INDIVIDUAL", "COMPANY"] as const

const applicationSchema = z.object({
  applicantType: z.enum(APPLICANT_TYPES),
  requestedPartnerType: z.enum(PARTNER_TYPES),
  fullName: z.string().min(2).max(120),
  businessName: z.string().max(200).optional().default(""),
  email: z.string().email().max(200),
  phone: z.string().min(5).max(40),
  whatsapp: z.string().max(40).optional().default(""),
  country: z.string().min(2).max(80),
  state: z.string().max(80).optional().default(""),
  city: z.string().max(80).optional().default(""),
  businessAddress: z.string().max(300).optional().default(""),
  website: z.string().max(200).optional().default(""),
  linkedin: z.string().max(200).optional().default(""),
  socialProfile: z.string().max(200).optional().default(""),
  registrationNumber: z.string().max(80).optional().default(""),
  yearEstablished: z.string().max(20).optional().default(""),
  teamSize: z.string().max(40).optional().default(""),
  estimatedCustomerBase: z.string().max(80).optional().default(""),
  industriesServed: z.array(z.string().max(80)).max(30).optional().default([]),
  geographicCoverage: z.array(z.string().max(80)).max(30).optional().default([]),
  currentProductsServices: z.string().max(2000).optional().default(""),
  reasonForApplying: z.string().min(10).max(3000),
  relevantExperience: z.string().max(3000).optional().default(""),
  expectedMonthlyOpportunities: z.string().max(80).optional().default(""),
  additionalAnswers: z.record(z.string(), z.string().max(2000)).optional().default({}),
  declaration: z.literal(true),
  inviteToken: z.string().max(100).optional(),
}).superRefine((data, ctx) => {
  // Individuals may only apply as referral partners.
  if (data.applicantType === "INDIVIDUAL" && data.requestedPartnerType !== "REFERRAL") {
    ctx.addIssue({
      code: "custom",
      path: ["requestedPartnerType"],
      message: "Individuals can only apply to be Referral Partners. Companies may apply for other partnership types.",
    })
  }

  // Non-referral partners must be registered businesses.
  if (data.applicantType === "COMPANY" && data.requestedPartnerType !== "REFERRAL") {
    if (!data.businessName || data.businessName.trim().length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["businessName"],
        message: "Business name is required for non-referral partnership applications",
      })
    }
    if (!data.registrationNumber || data.registrationNumber.trim().length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["registrationNumber"],
        message: "A valid business registration number is required for non-referral partnership applications",
      })
    }
  }
})

const MAX_DOCUMENTS = 6

export async function POST(request: Request) {
  // Rate limit: 3 submissions per hour per IP
  const limited = await checkRateLimit(request, { key: "partner-apply", max: 3, windowSeconds: 3600 })
  if (!limited.allowed) {
    return NextResponse.json(
      { error: "Too many submissions. Please try again later." },
      { status: 429 }
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const turnstile = await verifyCaptchaToken(
    form.get("captchaToken") as string | null,
    request
  )
  if (!turnstile.success) {
    return NextResponse.json({ error: turnstile.error }, { status: 403 })
  }

  const dataRaw = form.get("data")
  if (typeof dataRaw !== "string") {
    return NextResponse.json({ error: "Missing application data" }, { status: 400 })
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(dataRaw)
  } catch {
    return NextResponse.json({ error: "Invalid application data" }, { status: 400 })
  }

  const validation = applicationSchema.safeParse(parsed)
  if (!validation.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: validation.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 }
    )
  }

  // Collect document files
  const docTypeMapRaw = form.get("documentTypes")
  const docTypeMap: Record<string, string> = (() => {
    try { return typeof docTypeMapRaw === "string" ? JSON.parse(docTypeMapRaw) : {} } catch { return {} }
  })()

  const files = form.getAll("documents").filter((f): f is File => f instanceof File)
  if (files.length > MAX_DOCUMENTS) {
    return NextResponse.json({ error: `Maximum ${MAX_DOCUMENTS} documents allowed` }, { status: 400 })
  }

  // Validate files before doing any DB work
  for (const file of files) {
    const err = validatePartnerFile({ type: file.type, size: file.size })
    if (err) return NextResponse.json({ error: `${file.name}: ${err}` }, { status: 400 })
  }

  // Submit application (creates row, status history, audit)
  const result = await submitPartnerApplication(validation.data as Parameters<typeof submitPartnerApplication>[0])
  if (!result.ok || !result.reference) {
    return NextResponse.json({ error: result.error || "Failed to submit" }, { status: 500 })
  }

  // Upload documents + link them to the application; also resolve invite links
  const inviteToken = validation.data.inviteToken
  if ((files.length > 0 || inviteToken) && isSupabaseConfigured()) {
    const { data: appRow } = await supabase
      .from("partner_applications")
      .select("id")
      .eq("reference_number", result.reference)
      .single()
    const applicationId = appRow?.id as string | undefined

    if (applicationId && inviteToken) {
      const lead = await getLeadByInviteToken(inviteToken)
      if (lead) {
        await supabase
          .from("partner_applications")
          .update({ partner_lead_id: lead.id })
          .eq("id", applicationId)
        await supabase
          .from("partner_leads")
          .update({ status: "UNDER_REVIEW", updated_at: new Date().toISOString() })
          .eq("id", lead.id)
      } else {
        const prospect = await getPartnerProspectByToken(inviteToken)
        if (prospect) {
          await supabase
            .from("partner_prospects")
            .update({
              status: "APPLICATION_SUBMITTED",
              linked_application_id: applicationId,
              updated_at: new Date().toISOString(),
            })
            .eq("id", prospect.id)
        }
      }
    }

    if (applicationId && files.length > 0) {
      for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer())
        const upload = await uploadPartnerDocument(applicationId, file.name, file.type, buffer)
        if (upload.ok && upload.doc) {
          await supabase.from("partner_documents").insert({
            application_id: applicationId,
            document_type: docTypeMap[file.name] || "other",
            storage_path: upload.doc.storagePath,
            original_filename: upload.doc.originalFilename,
            mime_type: upload.doc.mimeType,
            file_size: upload.doc.fileSize,
            verification_status: "SUBMITTED",
            uploaded_at: new Date().toISOString(),
            required: false,
          })
        }
      }
    }
  }

  // Acknowledgement + admin notification. after() runs these post-response while
  // the platform keeps the function alive — a floating promise would be killed
  // when the serverless instance freezes after returning.
  const applicantEmail = validation.data.email
  const applicantName = validation.data.fullName
  const reference = result.reference
  const applicationId = result.applicationId
  after(() =>
    sendApplicationSubmittedEmail(applicantEmail, applicantName, reference).catch((err) =>
      console.error("[partner] submitted email failed:", err)
    )
  )

  // Automatic AI assessment when enabled (best-effort; never auto-decides).
  after(async () => {
    if (!applicationId) return
    try {
      const settings = await readSettings()
      const partner = (settings?.partner as Record<string, unknown> | undefined) || {}
      if (partner.autoAiReview !== false) {
        await runPartnerAiReview(applicationId, null)
      }
    } catch (err) {
      console.error("[partner] auto AI review failed:", err)
    }
  })

  return NextResponse.json({ success: true, reference: result.reference })
}

export const runtime = "nodejs"
