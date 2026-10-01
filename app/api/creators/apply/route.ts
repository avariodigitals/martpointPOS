import { NextResponse } from "next/server"
import { z } from "zod"
import { checkRateLimit } from "@/lib/rate-limit"
import { verifyCaptchaToken } from "@/lib/captcha"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { submitCreatorApplication } from "@/lib/creator-applications"
import { sendCreatorNotification } from "@/lib/creator-notifications"
import { uploadCreatorFile, validateCreatorPhoto } from "@/lib/creator-storage"
import { runCreatorAiReview } from "@/lib/creator-ai"
import { readSettings } from "@/lib/settings"
import { recordAudit, auditContextFromCreatorSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { CONTENT_CATEGORIES, CREATOR_PLATFORMS, EXPERIENCE_OPTIONS } from "@/lib/creators"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const socialProfileSchema = z.object({
  platform: z.enum(CREATOR_PLATFORMS),
  profileUrl: z.string().url().max(500),
  username: z.string().max(100).optional().default(""),
  followers: z.number().int().min(0).max(1_000_000_000).optional(),
  typicalViews: z.number().int().min(0).max(10_000_000_000).optional(),
  typicalEngagement: z.string().max(80).optional().default(""),
  isPrimary: z.boolean().optional(),
})

const applicationSchema = z.object({
  // Personal
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(7).max(40),
  whatsapp: z.string().max(40).optional().default(""),
  state: z.string().max(80).optional().default(""),
  city: z.string().max(80).optional().default(""),
  dateOfBirth: z.string().max(20).optional().default(""),
  ageConfirmed: z.literal(true, { error: "You must confirm you meet the minimum age requirement" }),

  // Creator info
  primaryCategory: z.enum(CONTENT_CATEGORIES as unknown as [string, ...string[]]),
  secondaryCategory: z.string().max(80).optional().default(""),
  languages: z.array(z.string().max(40)).min(1).max(10),
  bio: z.string().max(1500).optional().default(""),
  experienceYears: z.enum(EXPERIENCE_OPTIONS as unknown as [string, ...string[]]).optional(),

  // Social accounts — at least one public creator profile required
  socialProfiles: z.array(socialProfileSchema).min(1).max(7),

  // Audience
  primaryAudience: z.string().max(200).optional().default(""),
  audienceLocations: z.array(z.string().max(80)).max(20).optional().default([]),
  audienceAgeRange: z.string().max(40).optional().default(""),
  audienceHasBusinessOwners: z.boolean().optional(),
  audienceIndustries: z.array(z.string().max(80)).max(20).optional().default([]),

  // Portfolio — 2–5 example content URLs
  portfolioLinks: z
    .array(z.object({ url: z.string().url().max(500), note: z.string().max(200).optional() }))
    .min(2, "Provide at least 2 examples of your content")
    .max(5),

  // Creator statement
  whyCreator: z.string().min(20).max(3000),
  introduceMartpoint: z.string().min(20).max(3000),

  // Consent — all four confirmations required
  consentAccurate: z.literal(true),
  consentPublicReview: z.literal(true),
  consentRules: z.literal(true),
  consentNoGuarantee: z.literal(true),

  captchaToken: z.string().optional(),
})

export async function POST(request: Request) {
  const limited = await checkRateLimit(request, { key: "creator-apply", max: 3, windowSeconds: 3600 })
  if (!limited.allowed) {
    return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 })
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Applications are temporarily unavailable" }, { status: 503 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const captcha = await verifyCaptchaToken(form.get("captchaToken") as string | null, request)
  if (!captcha.success) {
    return NextResponse.json({ error: captcha.error }, { status: 403 })
  }

  const dataRaw = form.get("data")
  if (typeof dataRaw !== "string") {
    return NextResponse.json({ error: "Missing application data" }, { status: 400 })
  }

  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(dataRaw)
  } catch {
    return NextResponse.json({ error: "Invalid application data" }, { status: 400 })
  }

  const parsed = applicationSchema.safeParse(parsedJson)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) },
      { status: 400 }
    )
  }
  const data = parsed.data

  // Minimum age check against settings (default 18).
  let minimumAge = 18
  try {
    const settings = await readSettings()
    const creator = (settings?.creator as Record<string, unknown> | undefined) || {}
    if (typeof creator.minimumAge === "number") minimumAge = creator.minimumAge
  } catch { /* defaults */ }

  if (data.dateOfBirth) {
    const dob = new Date(data.dateOfBirth)
    if (!Number.isNaN(dob.getTime())) {
      const age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000))
      if (age < minimumAge) {
        return NextResponse.json(
          { error: `Applicants must be at least ${minimumAge} years old.` },
          { status: 400 }
        )
      }
    }
  }

  const result = await submitCreatorApplication({
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    whatsapp: data.whatsapp,
    state: data.state,
    city: data.city,
    dateOfBirth: data.dateOfBirth || undefined,
    ageConfirmed: data.ageConfirmed,
    primaryCategory: data.primaryCategory,
    secondaryCategory: data.secondaryCategory || undefined,
    languages: data.languages,
    bio: data.bio || undefined,
    experienceYears: data.experienceYears,
    primaryAudience: data.primaryAudience || undefined,
    audienceLocations: data.audienceLocations,
    audienceAgeRange: data.audienceAgeRange || undefined,
    audienceHasBusinessOwners: data.audienceHasBusinessOwners,
    audienceIndustries: data.audienceIndustries,
    portfolioLinks: data.portfolioLinks,
    whyCreator: data.whyCreator,
    introduceMartpoint: data.introduceMartpoint,
    socialProfiles: data.socialProfiles.map((p) => ({
      platform: p.platform,
      profileUrl: p.profileUrl,
      username: p.username || undefined,
      followers: p.followers,
      typicalViews: p.typicalViews,
      typicalEngagement: p.typicalEngagement || undefined,
      isPrimary: p.isPrimary,
    })),
  })

  if (!result.ok || !result.applicationId) {
    return NextResponse.json({ error: result.error || "Failed to submit" }, { status: 500 })
  }

  // Optional profile photo (private bucket, scoped by application id).
  const photo = form.get("photo")
  if (photo instanceof File && photo.size > 0) {
    const invalid = validateCreatorPhoto({ type: photo.type, size: photo.size })
    if (!invalid) {
      const upload = await uploadCreatorFile(
        `applications/${result.applicationId}`,
        photo.name || "photo",
        photo.type,
        Buffer.from(await photo.arrayBuffer())
      )
      if (upload.ok && upload.storagePath) {
        await supabase
          .from("creator_applications")
          .update({ profile_photo_path: upload.storagePath })
          .eq("id", result.applicationId)
      }
    }
  }

  await recordAudit(auditContextFromCreatorSession(null, request), {
    action: AUDIT_ACTIONS.CREATOR_APPLICATION_SUBMITTED,
    entityType: AUDIT_ENTITIES.CREATOR_APPLICATION,
    entityId: result.applicationId,
    metadata: { reference: result.reference, email: data.email },
  })

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://martpoint.com.ng").replace(/\/$/, "")

  // Applicant acknowledgement + internal notification (non-blocking).
  void sendCreatorNotification({
    template: "creator_application_received",
    to: data.email,
    applicationId: result.applicationId,
    vars: {
      fullName: data.fullName,
      reference: result.reference,
      statusUrl: `${siteUrl}/creators/application-status`,
    },
  })
  void sendCreatorNotification({
    template: "creator_application_admin",
    to: "",
    route: "creator_application",
    applicationId: result.applicationId,
    vars: {
      fullName: data.fullName,
      reference: result.reference,
      category: data.primaryCategory,
      state: data.state || "—",
      profilesSummary: data.socialProfiles.map((p) => `${p.platform}: ${p.profileUrl}`).join(", "),
      reviewUrl: `${siteUrl}/admin/creators/applications/${result.applicationId}`,
    },
  }).catch(() => {})

  // Automatic AI assessment when enabled (best-effort; never auto-decides).
  void (async () => {
    try {
      const settings = await readSettings()
      const creator = (settings?.creator as Record<string, unknown> | undefined) || {}
      if (creator.autoAiReview !== false) {
        await runCreatorAiReview(result.applicationId as string, null)
      }
    } catch (err) {
      console.error("[creators] auto AI review failed:", err)
    }
  })()

  return NextResponse.json({ success: true, reference: result.reference })
}
