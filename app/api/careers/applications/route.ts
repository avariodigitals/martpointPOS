import { NextResponse } from "next/server"
import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { verifyCaptchaToken } from "@/lib/captcha"
import { checkRateLimit } from "@/lib/rate-limit"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS } from "@/lib/audit"
import { sendCareerNotification } from "@/lib/careers-notifications"
import { escapeHtml } from "@/lib/email-html"
import { uploadCareerDocument, validateCareerFile } from "@/lib/careers-storage"
import {
  generateApplicationReference,
  generateCandidateReference,
  vacancyAcceptsApplications,
  validateScreeningAnswers,
  scoreScreeningAnswers,
  renderConfirmationMessage,
  getDefaultConfirmationMessage,
  PRIVACY_VERSION,
  type ScreeningQuestion,
  type ScreeningAnswerInput,
  type CareerVacancy,
} from "@/lib/careers"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/* Accepts a multi-step, vacancy-scoped application (multipart/form-data).
 * The applicant never supplies the vacancy title — only vacancyId. */
export async function POST(request: Request) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Applications are temporarily unavailable." }, { status: 503 })
    }

    const rl = await checkRateLimit(request, { key: "careers_apply", max: 10, windowSeconds: 3600 })
    if (!rl.allowed) {
      return NextResponse.json({ error: "Too many submissions. Please try again later." }, { status: 429 })
    }

    const formData = await request.formData()

    const turnstile = await verifyCaptchaToken(formData.get("captchaToken") as string | null, request)
    if (!turnstile.success) {
      return NextResponse.json({ error: turnstile.error }, { status: 403 })
    }

    const vacancyId = String(formData.get("vacancyId") || "")
    if (!vacancyId) {
      return NextResponse.json({ error: "Missing vacancy." }, { status: 400 })
    }

    // Load vacancy + questions
    const { data: vacancy } = await supabase
      .from("career_vacancies")
      .select("*")
      .eq("id", vacancyId)
      .is("deleted_at", null)
      .maybeSingle()
    if (!vacancy) {
      return NextResponse.json({ error: "This vacancy is no longer available." }, { status: 404 })
    }
    const v = vacancy as CareerVacancy

    const { count } = await supabase
      .from("career_applications")
      .select("id", { count: "exact", head: true })
      .eq("vacancy_id", v.id)
    if (!vacancyAcceptsApplications(v, count ?? 0)) {
      return NextResponse.json({ error: "Applications for this vacancy are closed." }, { status: 410 })
    }

    // Parse structured payloads
    let fields: Record<string, unknown>
    let answers: ScreeningAnswerInput[]
    try {
      fields = JSON.parse(String(formData.get("fields") || "{}"))
      answers = JSON.parse(String(formData.get("answers") || "[]"))
    } catch {
      return NextResponse.json({ error: "Malformed submission." }, { status: 400 })
    }

    const str = (k: string) => {
      const val = fields[k]
      return typeof val === "string" ? val.trim() : ""
    }
    const bool = (k: string) => (fields[k] === true ? true : fields[k] === false ? false : null)

    // Server-side validation
    const errors: Record<string, string> = {}
    if (!str("fullName")) errors.fullName = "Full name is required"
    const email = str("email").toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = "Valid email is required"
    if (!str("phone") || str("phone").length < 7) errors.phone = "Valid phone number is required"
    if (!str("state")) errors.state = "State of residence is required"
    if (!str("city")) errors.city = "City/town is required"
    if (str("linkedinUrl") && !str("linkedinUrl").includes("linkedin.com")) {
      errors.linkedinUrl = "Enter a valid LinkedIn URL"
    }
    if (fields.consentAccuracy !== true || fields.consentPrivacy !== true) {
      errors.consent = "Please confirm accuracy and accept the privacy notice"
    }
    // Vacancy-specific consent: required only when the vacancy sets consent_text.
    if (v.consent_text && fields.consentVacancy !== true) {
      errors.consent = "Please accept the role-specific terms"
    }

    const cvFile = formData.get("cv") as File | null
    if (v.cv_required && (!cvFile || cvFile.size === 0)) {
      errors.cvFile = "Please upload your CV"
    }
    for (const f of [cvFile, formData.get("coverLetter") as File | null]) {
      if (f && f.size > 0) {
        const ferr = validateCareerFile(f)
        if (ferr) errors[f === cvFile ? "cvFile" : "coverLetterFile"] = ferr
      }
    }

    const { data: questionRows } = await supabase
      .from("career_screening_questions")
      .select("*, career_question_options(id, option_text, sort_order)")
      .eq("vacancy_id", v.id)
      .order("sort_order")
    const questions: ScreeningQuestion[] = (questionRows || []).map((q) => ({
      ...(q as ScreeningQuestion),
      options: ((q.career_question_options as { id: string; option_text: string }[] | null) || []).map((o) => ({
        id: o.id,
        option_text: o.option_text,
      })),
    }))

    const answerErrors = validateScreeningAnswers(questions, answers)
    for (const [qid, msg] of Object.entries(answerErrors)) errors[`q_${qid}`] = msg

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ error: "Please correct the highlighted fields.", errors }, { status: 400 })
    }

    // Duplicate protection
    const { data: dup } = await supabase
      .from("career_applications")
      .select("reference_number")
      .eq("vacancy_id", v.id)
      .ilike("email", email)
      .not("status", "in", "(REJECTED,WITHDRAWN,BLACKLISTED)")
      .limit(1)
    if (dup && dup.length > 0) {
      return NextResponse.json(
        { error: `You have already applied for this vacancy (reference ${dup[0].reference_number}).`, existingReference: dup[0].reference_number },
        { status: 409 }
      )
    }

    // Insert application
    const applicationId = crypto.randomUUID()
    const reference = generateApplicationReference()
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || null

    const { error: insertErr } = await supabase.from("career_applications").insert({
      id: applicationId,
      reference_number: reference,
      vacancy_id: v.id,
      full_name: str("fullName"),
      email,
      phone: str("phone"),
      whatsapp: str("whatsapp") || null,
      state: str("state") || null,
      lga: str("lga") || null,
      city: str("city") || null,
      residential_area: str("residentialArea") || null,
      employment_status: str("employmentStatus") || null,
      earliest_available_date: str("earliestAvailableDate") || null,
      available_working_hours: bool("availableWorkingHours"),
      available_full_duration: bool("availableFullDuration"),
      can_travel_to_location: bool("canTravel"),
      requires_accommodation: bool("requiresAccommodation"),
      other_work_cities: str("otherCities") || null,
      highest_qualification: str("highestQualification") || null,
      field_of_study: str("fieldOfStudy") || null,
      current_occupation: str("currentOccupation") || null,
      years_experience: str("yearsExperience") ? Number(str("yearsExperience")) : null,
      work_history: str("workHistory") || null,
      skills: str("skills")
        ? str("skills").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30)
        : [],
      excel_proficiency: str("excelProficiency") || null,
      inventory_software_experience: str("inventorySoftwareExperience") || null,
      owns_android: bool("ownsAndroid"),
      smartphone_model: str("smartphoneModel") || null,
      has_mobile_data: bool("hasMobileData"),
      owns_laptop: bool("ownsLaptop"),
      owns_power_bank: bool("ownsPowerBank"),
      transportation: str("transportation") || null,
      linkedin_url: str("linkedinUrl") || null,
      portfolio_url: str("portfolioUrl") || null,
      status: "NEW",
      consent_accuracy: true,
      consent_privacy: true,
      consent_talent_pool: fields.consentTalentPool === true,
      consent_notifications: fields.consentNotifications === true,
      consent_vacancy: v.consent_text ? fields.consentVacancy === true : false,
      consent_vacancy_text: v.consent_text ? v.consent_text : null,
      privacy_version: PRIVACY_VERSION,
      consent_at: new Date().toISOString(),
      ip_address: ip,
      user_agent: request.headers.get("user-agent") || null,
    })
    if (insertErr) {
      console.error("[careers] application insert failed:", insertErr.message)
      return NextResponse.json({ error: "Failed to save your application. Please try again." }, { status: 500 })
    }

    // Upload documents (private bucket)
    const uploadDoc = async (file: File | null, kind: string) => {
      if (!file || file.size === 0) return null
      const bytes = Buffer.from(await file.arrayBuffer())
      const res = await uploadCareerDocument(applicationId, file.name, file.type, bytes)
      if (!res.ok || !res.storagePath) return null
      const { data: doc } = await supabase
        .from("career_application_documents")
        .insert({
          application_id: applicationId,
          kind,
          storage_path: res.storagePath,
          original_filename: file.name.slice(0, 200),
          mime_type: file.type,
          file_size: file.size,
        })
        .select("id")
        .single()
      return doc?.id as string | undefined
    }

    await uploadDoc(cvFile, "CV")
    await uploadDoc(formData.get("coverLetter") as File | null, "COVER_LETTER")

    // Screening answers (file answers uploaded too)
    const answerRows: Record<string, unknown>[] = []
    for (const q of questions) {
      const a = answers.find((x) => x.questionId === q.id)
      if (!a) continue
      let fileDocId: string | null = null
      if (q.answer_type === "FILE") {
        const f = formData.get(`qfile_${q.id}`) as File | null
        if (f && f.size > 0) fileDocId = (await uploadDoc(f, "ANSWER_FILE")) ?? null
      }
      answerRows.push({
        application_id: applicationId,
        question_id: q.id,
        answer_text: a.text ?? null,
        answer_json: a.options?.length ? { options: a.options } : null,
        file_document_id: fileDocId,
      })
    }
    if (answerRows.length > 0) {
      await supabase.from("career_application_answers").insert(answerRows)
    }

    // Screening score + initial history
    const screening = scoreScreeningAnswers(questions, answers, v.pass_score)
    if (screening.passed !== null) {
      await supabase
        .from("career_applications")
        .update({
          screening_score: screening.score,
          screening_passed: screening.passed,
          status: screening.passed ? "SCREENING_PASSED" : "SCREENING_FAILED",
        })
        .eq("id", applicationId)
    }

    await supabase.from("career_application_status_history").insert({
      application_id: applicationId,
      previous_status: null,
      new_status: screening.passed === true ? "SCREENING_PASSED" : screening.passed === false ? "SCREENING_FAILED" : "NEW",
      changed_by: null,
      changed_by_name: "System",
      reason: "Application submitted",
    })

    // Talent pool opt-in → create/update reusable candidate profile
    if (fields.consentTalentPool === true) {
      const { data: existing } = await supabase
        .from("career_candidate_profiles")
        .select("id")
        .ilike("email", email)
        .is("deleted_at", null)
        .maybeSingle()

      const profileFields = {
        full_name: str("fullName"),
        email,
        phone: str("phone") || null,
        whatsapp: str("whatsapp") || null,
        state: str("state") || null,
        lga: str("lga") || null,
        city: str("city") || null,
        residential_area: str("residentialArea") || null,
        qualified_roles: v.category_name ? [v.category_name] : [],
        earliest_available_date: str("earliestAvailableDate") || null,
        other_work_cities: str("otherCities") || null,
        highest_qualification: str("highestQualification") || null,
        field_of_study: str("fieldOfStudy") || null,
        years_experience: str("yearsExperience") ? Number(str("yearsExperience")) : null,
        equipment: {
          owns_android: bool("ownsAndroid"),
          smartphone_model: str("smartphoneModel") || null,
          has_mobile_data: bool("hasMobileData"),
          owns_laptop: bool("ownsLaptop"),
          owns_power_bank: bool("ownsPowerBank"),
          transportation: str("transportation") || null,
        },
        consent_talent_pool: true,
        consent_notifications: fields.consentNotifications === true,
        privacy_version: PRIVACY_VERSION,
        consent_at: new Date().toISOString(),
        source: "application_opt_in",
        updated_at: new Date().toISOString(),
      }

      let candidateId: string | null = null
      if (existing) {
        candidateId = existing.id
        await supabase.from("career_candidate_profiles").update(profileFields).eq("id", existing.id)
      } else {
        const { data: created } = await supabase
          .from("career_candidate_profiles")
          .insert({ ...profileFields, reference_number: generateCandidateReference() })
          .select("id")
          .single()
        candidateId = created?.id ?? null
      }
      if (candidateId) {
        await supabase.from("career_applications").update({ candidate_profile_id: candidateId }).eq("id", applicationId)
        const skills = str("skills")
          ? str("skills").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 30)
          : []
        if (skills.length > 0) {
          await supabase.from("career_candidate_skills").upsert(
            skills.map((s) => ({ candidate_id: candidateId, skill: s })),
            { onConflict: "candidate_id,skill" }
          )
        }
      }
    }

    // Notifications (status stored in career_notification_log by the sender)
    const statusUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "https://martpoint.com.ng"}/careers/application-status`

    // Confirmation message: per-vacancy override → careers default → built-in template.
    const { data: locRows } = await supabase
      .from("career_vacancy_locations")
      .select("public_description, city, state, is_primary")
      .eq("vacancy_id", v.id)
      .order("sort_order")
    const primaryLoc =
      (locRows || []).find((l) => l.is_primary) || (locRows || [])[0] || null
    const vacancyLocation = primaryLoc
      ? primaryLoc.public_description || [primaryLoc.city, primaryLoc.state].filter(Boolean).join(", ")
      : ""
    const messageTemplate = v.confirmation_message?.trim() || (await getDefaultConfirmationMessage())
    const confirmationMessage = renderConfirmationMessage(messageTemplate, {
      applicant_name: str("fullName"),
      vacancy_title: v.title,
      application_reference: reference,
      vacancy_location: vacancyLocation,
      status_url: statusUrl,
    })
    const confirmationMessageHtml = confirmationMessage
      ? confirmationMessage
          .split(/\n{2,}/)
          .map(
            (p) =>
              `<p style="font-size:15px; line-height:1.6; margin:0 0 12px; color:#374151;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`
          )
          .join("")
      : ""

    void sendCareerNotification({
      template: "career_application_received",
      to: email,
      applicationId,
      vars: {
        fullName: str("fullName"),
        reference,
        vacancyTitle: v.title,
        statusUrl,
        confirmationMessage,
        confirmationMessageHtml,
      },
    })
    void sendCareerNotification({
      template: "career_application_admin",
      to: "",
      route: "career_application",
      applicationId,
      vars: { fullName: str("fullName"), reference, email, vacancyTitle: v.title },
    })

    await recordAudit(auditContextFromSession(null, request), {
      action: AUDIT_ACTIONS.CAREER_APPLICATION_SUBMITTED,
      entityType: "career_application",
      entityId: applicationId,
      metadata: { reference, vacancyId: v.id, vacancy: v.title },
    })

    return NextResponse.json({ success: true, reference, confirmationMessage })
  } catch (err) {
    console.error("[careers] application error:", err)
    return NextResponse.json({ error: "Failed to process application" }, { status: 500 })
  }
}
