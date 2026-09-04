import { NextResponse } from "next/server"
import { z } from "zod"
import { checkRateLimit } from "@/lib/rate-limit"
import { submitPartnerApplication, type PartnerType, type ApplicantType } from "@/lib/partners"
import { uploadPartnerDocument, validatePartnerFile, MAX_PARTNER_FILE_BYTES } from "@/lib/partner-documents"
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

  // Upload documents + link them to the application
  if (files.length > 0 && isSupabaseConfigured()) {
    const { data: appRow } = await supabase
      .from("partner_applications")
      .select("id")
      .eq("reference_number", result.reference)
      .single()
    const applicationId = appRow?.id as string | undefined

    if (applicationId) {
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
          })
        }
      }
    }
  }

  // Acknowledgement email + admin notification (best-effort)
  await sendAcknowledgementEmail(validation.data.email, validation.data.fullName, result.reference)

  return NextResponse.json({ success: true, reference: result.reference })
}

async function sendAcknowledgementEmail(email: string, fullName: string, reference: string) {
  const resendKey = process.env.RESEND_API_KEY
  const notifyEmail = process.env.NOTIFY_EMAIL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.martpoint.com.ng"
  if (!resendKey) return

  const statusLink = `${baseUrl}/partners/application-status`
  const text = `Hi ${fullName},\n\nThank you for applying to become a MartPoint partner. Your application has been received.\n\nApplication Reference: ${reference}\n\nYou can check your application status anytime at:\n${statusLink}\n\nYou will need your application reference and the email used to apply.\n\nBest regards,\nMartPoint Partner Team`
  const html = `<div style="font-family:sans-serif;max-width:600px">
    <h2 style="color:#0057FF">MartPoint Partner Application Received</h2>
    <p>Hi ${fullName},</p>
    <p>Thank you for applying to become a MartPoint partner. Your application has been received.</p>
    <p><strong>Application Reference:</strong> ${reference}</p>
    <p>You can check your application status anytime:</p>
    <p><a href="${statusLink}">${statusLink}</a></p>
    <p>You will need your application reference and the email used to apply.</p>
    <p>Best regards,<br>MartPoint Partner Team</p>
  </div>`

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "MartPoint Partners <partners@martpoint.com.ng>",
        to: email,
        subject: `MartPoint Partner Application Received — ${reference}`,
        text,
        html,
      }),
    })
    if (notifyEmail && notifyEmail !== email) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "MartPoint Partners <partners@martpoint.com.ng>",
          to: notifyEmail,
          subject: `New Partner Application — ${reference}`,
          text: `A new partner application was submitted.\n\nReference: ${reference}\nApplicant: ${fullName}\nEmail: ${email}\n\nReview it in the Control Centre.`,
          html: `<p>A new partner application was submitted.</p><p>Reference: ${reference}<br>Applicant: ${fullName}<br>Email: ${email}</p>`,
        }),
      })
    }
  } catch (err) {
    console.error("[partner] acknowledgement email failed:", err)
  }
}

export const runtime = "nodejs"
export { MAX_PARTNER_FILE_BYTES }
