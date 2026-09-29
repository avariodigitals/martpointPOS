import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { verifyCaptchaToken } from "@/lib/captcha"
import { checkRateLimit } from "@/lib/rate-limit"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { sendCareerNotification } from "@/lib/careers-notifications"
import { generateCandidateReference, PRIVACY_VERSION } from "@/lib/careers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/* Public talent-pool signup. Consent is required and recorded with the
 * privacy notice version. */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Temporarily unavailable." }, { status: 503 })
    }

    const rl = await checkRateLimit(request, { key: "careers_talent_pool", max: 10, windowSeconds: 3600 })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 })
    }

    const body = await request.json().catch(() => ({}))

    const turnstile = await verifyCaptchaToken(body.captchaToken ?? null, request)
    if (!turnstile.success) {
      return NextResponse.json({ error: turnstile.error }, { status: 403 })
    }

    const str = (k: string) => String(body[k] ?? "").trim()
    const email = str("email").toLowerCase()

    const errors: Record<string, string> = {}
    if (!str("fullName")) errors.fullName = "Full name is required"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Valid email is required"
    if (!str("state")) errors.state = "State of residence is required"
    if (!str("city")) errors.city = "City/town is required"
    if (body.consentTalentPool !== true) errors.consent = "Consent is required to join the Talent Pool"
    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Please correct the highlighted fields.", errors }, { status: 400 })
    }

    const skills: string[] = Array.isArray(body.skills)
      ? body.skills.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 30)
      : String(body.skills || "").split(",").map((s: string) => s.trim()).filter(Boolean).slice(0, 30)
    const roles: string[] = Array.isArray(body.qualifiedRoles)
      ? body.qualifiedRoles.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 20)
      : []

    const profile = {
      full_name: str("fullName"),
      email,
      phone: str("phone") || null,
      whatsapp: str("whatsapp") || null,
      state: str("state") || null,
      lga: str("lga") || null,
      city: str("city") || null,
      residential_area: str("residentialArea") || null,
      qualified_roles: roles,
      employment_preferences: body.employmentPreferences && typeof body.employmentPreferences === "object" ? body.employmentPreferences : {},
      availability_notes: str("availabilityNotes") || null,
      earliest_available_date: str("earliestAvailableDate") || null,
      other_work_cities: str("otherCities") || null,
      highest_qualification: str("highestQualification") || null,
      field_of_study: str("fieldOfStudy") || null,
      years_experience: str("yearsExperience") ? Number(str("yearsExperience")) : null,
      equipment: body.equipment && typeof body.equipment === "object" ? body.equipment : {},
      consent_talent_pool: true,
      consent_notifications: body.consentNotifications === true,
      privacy_version: PRIVACY_VERSION,
      consent_at: new Date().toISOString(),
      source: "talent_pool_form",
      updated_at: new Date().toISOString(),
    }

    const { data: existing } = await supabase
      .from("career_candidate_profiles")
      .select("id, reference_number")
      .ilike("email", email)
      .is("deleted_at", null)
      .maybeSingle()

    let reference: string
    let candidateId: string
    if (existing) {
      candidateId = existing.id
      reference = existing.reference_number
      await supabase.from("career_candidate_profiles").update(profile).eq("id", existing.id)
    } else {
      reference = generateCandidateReference()
      const { data: created, error } = await supabase
        .from("career_candidate_profiles")
        .insert({ ...profile, reference_number: reference })
        .select("id")
        .single()
      if (error || !created) {
        console.error("[careers] talent pool insert failed:", error?.message)
        return NextResponse.json({ error: "Could not save your profile. Please try again." }, { status: 500 })
      }
      candidateId = created.id
    }

    if (skills.length > 0) {
      await supabase.from("career_candidate_skills").upsert(
        skills.map((s) => ({ candidate_id: candidateId, skill: s })),
        { onConflict: "candidate_id,skill" }
      )
    }

    void sendCareerNotification({
      template: "career_talent_pool_welcome",
      to: email,
      candidateId,
      vars: { fullName: str("fullName"), reference },
    })

    await recordAudit(auditContextFromSession(null, request), {
      action: AUDIT_ACTIONS.CAREER_CANDIDATE_CREATED,
      entityType: AUDIT_ENTITIES.CAREER_CANDIDATE,
      entityId: candidateId,
      metadata: { reference, source: "talent_pool_form" },
    })

    return NextResponse.json({ success: true, reference })
  } catch (err) {
    console.error("[careers] talent pool error:", err)
    return NextResponse.json({ error: "Submission failed. Please try again." }, { status: 500 })
  }
}
