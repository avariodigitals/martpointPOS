/* ───────────────────────────  AI-assisted career application review  ───────────────────────────
 * Produces a structured assessment of a job application against its vacancy
 * using the shared aiChat provider (OpenAI with configured fallback).
 *
 * Hard rules (mirrors lib/partner-ai.ts):
 *  - AI NEVER changes the application status or score fields — it produces a
 *    recommendation + assessment note for a human reviewer.
 *  - Base scores only on what the applicant actually supplied. Never invent
 *    experience, employers, qualifications or statistics.
 *  - Reviews are stored separately (career_application_ai_reviews), are
 *    immutable history, and are never exposed to applicants.
 *
 * Mode: career_settings key "ai_assessment" = {"mode": "AUTO"|"MANUAL"}.
 * AUTO runs an assessment automatically after each submission; MANUAL leaves
 * it to the "Run AI Assessment" button on the application review page.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { aiChat } from "./ai-chat"

export type CareerAiMode = "AUTO" | "MANUAL"

export const CAREER_AI_MODE_KEY = "ai_assessment"

export async function getCareerAiAssessmentMode(): Promise<CareerAiMode> {
  if (!isSupabaseConfigured()) return "MANUAL"
  const { data } = await supabase
    .from("career_settings")
    .select("value")
    .eq("key", CAREER_AI_MODE_KEY)
    .maybeSingle()
  const mode = (data?.value as { mode?: string } | null)?.mode
  return mode === "AUTO" ? "AUTO" : "MANUAL"
}

export interface CareerAiReviewResult {
  scores: {
    roleFit: number        // /30
    experience: number     // /25
    skills: number         // /20
    logistics: number      // /15
    communication: number  // /10
  }
  totalScore: number       // /100
  recommendation: "SHORTLIST" | "REVIEW" | "DO_NOT_PROGRESS"
  summary: string
  strengths: string[]
  concerns: string[]
  suggestedQuestions: string[]
  dataNotes: string
}

const RUBRIC = `
Score the applicant on exactly these dimensions (weights are fixed):

- roleFit (max 30): how well the applicant's qualifications, field of study and stated career direction match this vacancy's responsibilities and requirements.
- experience (max 25): relevance and depth of their work history and years of experience for this specific role. An applicant with little formal experience but clearly relevant hands-on work can still score well.
- skills (max 20): the listed skills and screening answers (e.g. Excel proficiency, inventory software, smartphone/laptop ownership) versus what the role actually needs.
- logistics (max 15): availability, location/transport, travel ability, accommodation needs and equipment versus the work arrangement and schedule. NEVER penalise an applicant for living in a different state — only flag a genuine mismatch with the role's location or schedule requirements.
- communication (max 10): clarity and professionalism of the written answers and work history.

Output rules:
- recommendation must be exactly one of: SHORTLIST, REVIEW, DO_NOT_PROGRESS
- summary: a concise 3-5 sentence assessment note a hiring manager can act on. Reference specific evidence from the application.
- NEVER invent experience, employers, qualifications or statistics. If information is missing, score lower on that dimension and mention the gap in dataNotes.
- strengths: 2-5 single-sentence points. concerns: 1-5 single-sentence points (empty list if none).
- suggestedQuestions: 3-5 interview questions tailored to this applicant's gaps or claims.
`.trim()

function buildPrompt(app: Record<string, unknown>, vac: Record<string, unknown>, answersLines: string): string {
  const s = (v: unknown) => (v == null || v === "" ? "(none)" : String(v))
  const yn = (v: unknown) => (v === true ? "Yes" : v === false ? "No" : "(not stated)")
  const arr = (v: unknown) => (Array.isArray(v) && v.length ? v.map(String).join(", ") : "(none)")

  return `Assess this MartPoint job application against the vacancy it was submitted for.

VACANCY
Title: ${s(vac.title)}
Employment type: ${s(vac.employment_type)}
Work arrangement: ${s(vac.work_arrangement)}
Working days/hours: ${[s(vac.working_days), vac.work_start_time && vac.work_end_time ? `${vac.work_start_time}–${vac.work_end_time}` : null].filter((x) => x && x !== "(none)").join(", ") || "(none)"}
Duration: ${s(vac.duration_description)}
Description: ${s(vac.short_summary || vac.description)}
Responsibilities: ${arr(vac.responsibilities)}
Requirements: ${arr(vac.requirements)}
Provided: lunch ${yn(vac.lunch_provided)}, accommodation ${yn(vac.accommodation_provided)}

APPLICANT
Name: ${s(app.full_name)}
Location: ${[s(app.city), s(app.state)].filter((x) => x !== "(none)").join(", ")}
Residential area: ${s(app.residential_area)}
Employment status: ${s(app.employment_status)}
Earliest available date: ${s(app.earliest_available_date)}
Available for the role's working hours: ${yn(app.available_working_hours)}
Available for the full duration: ${yn(app.available_full_duration)}
Can travel to the work location: ${yn(app.can_travel_to_location)}
Requires accommodation: ${yn(app.requires_accommodation)}
Other work cities: ${s(app.other_work_cities)}

QUALIFICATIONS
Highest qualification: ${s(app.highest_qualification)}
Field of study: ${s(app.field_of_study)}
Current occupation: ${s(app.current_occupation)}
Years of experience: ${s(app.years_experience)}
Skills: ${arr(app.skills)}
Excel proficiency: ${s(app.excel_proficiency)}
Inventory software experience: ${s(app.inventory_software_experience)}

WORK HISTORY
${s(app.work_history)}

EQUIPMENT & ACCESS
Owns Android phone: ${yn(app.owns_android)}${app.smartphone_model ? ` (model: ${app.smartphone_model})` : ""}
Has mobile data: ${yn(app.has_mobile_data)}
Owns laptop: ${yn(app.owns_laptop)}
Owns power bank: ${yn(app.owns_power_bank)}
Transportation: ${s(app.transportation)}

LINKS
LinkedIn: ${s(app.linkedin_url)}
Portfolio: ${s(app.portfolio_url)}

SCREENING ANSWERS
${answersLines || "(none)"}

Knockout screening result recorded by the system: ${app.screening_score != null ? `${app.screening_score}% (${app.screening_passed ? "passed" : "failed"})` : "no auto-scored questions"}.
Treat the screening result as factual system data — note agreement or tension with it, do not recompute it.

${RUBRIC}

Respond with a single JSON object:
{
  "scores": {
    "roleFit": <0-30>, "experience": <0-25>, "skills": <0-20>,
    "logistics": <0-15>, "communication": <0-10>
  },
  "recommendation": "SHORTLIST|REVIEW|DO_NOT_PROGRESS",
  "summary": "...",
  "strengths": ["..."],
  "concerns": ["..."],
  "suggestedQuestions": ["..."],
  "dataNotes": "what information was missing or could not be assessed"
}`
}

function parseReview(raw: string): CareerAiReviewResult | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const s = (parsed.scores || {}) as Record<string, unknown>
    const num = (v: unknown, max: number) => Math.max(0, Math.min(max, typeof v === "number" ? v : 0))
    const scores = {
      roleFit: num(s.roleFit, 30),
      experience: num(s.experience, 25),
      skills: num(s.skills, 20),
      logistics: num(s.logistics, 15),
      communication: num(s.communication, 10),
    }
    const totalScore = scores.roleFit + scores.experience + scores.skills + scores.logistics + scores.communication
    const validRecs = ["SHORTLIST", "REVIEW", "DO_NOT_PROGRESS"]
    return {
      scores,
      totalScore,
      recommendation: validRecs.includes(parsed.recommendation as string)
        ? (parsed.recommendation as CareerAiReviewResult["recommendation"])
        : "REVIEW",
      summary: String(parsed.summary || ""),
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String).slice(0, 8) : [],
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns.map(String).slice(0, 8) : [],
      suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions.map(String).slice(0, 8) : [],
      dataNotes: String(parsed.dataNotes || ""),
    }
  } catch {
    return null
  }
}

/* ───────────────────────────  Public entry point  ───────────────────────────
 * Runs the assessment and stores it in career_application_ai_reviews. Safe to
 * call more than once — each run is a new row (immutable history). The
 * application status and scores are deliberately left untouched.
 */

export async function runCareerApplicationAiReview(
  applicationId: string,
  triggeredBy?: string | null
): Promise<{ ok: boolean; reviewId?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data: appRow } = await supabase
    .from("career_applications")
    .select("*, career_vacancies(*)")
    .eq("id", applicationId)
    .maybeSingle()
  if (!appRow) return { ok: false, error: "Application not found" }

  const vac = (appRow.career_vacancies || {}) as Record<string, unknown>
  delete (appRow as Record<string, unknown>).career_vacancies

  const { data: answerRows } = await supabase
    .from("career_application_answers")
    .select("answer_text, answer_json, file_document_id, career_screening_questions(question_text, answer_type)")
    .eq("application_id", applicationId)
  const answersLines = (answerRows || [])
    .map((a) => {
      const q = a.career_screening_questions as { question_text?: string } | null
      const value = a.answer_json && Array.isArray((a.answer_json as { options?: string[] }).options)
        ? (a.answer_json as { options: string[] }).options.join(", ")
        : a.answer_text || (a.file_document_id ? "(file attached)" : "")
      return q?.question_text && value ? `${q.question_text}: ${value}` : ""
    })
    .filter(Boolean)
    .join("\n")

  let raw = ""
  let model = ""
  try {
    const completion = await aiChat({
      json: true,
      temperature: 0.3,
      maxTokens: 1600,
      messages: [
        {
          role: "system",
          content:
            "You are a careful recruitment analyst for MartPoint, a Nigerian retail/business operating system. You assess job applications objectively against the specific vacancy, never invent candidate facts, and never make the final hiring decision. You respond with JSON only.",
        },
        { role: "user", content: buildPrompt(appRow as unknown as Record<string, unknown>, vac, answersLines) },
      ],
    })
    raw = completion.content
    model = completion.model
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed"
    await supabase.from("career_application_ai_reviews").insert({
      application_id: applicationId,
      status: "FAILED",
      error_message: message,
      triggered_by: triggeredBy ?? null,
    })
    return { ok: false, error: message }
  }

  const review = parseReview(raw)
  if (!review) {
    await supabase.from("career_application_ai_reviews").insert({
      application_id: applicationId,
      status: "FAILED",
      error_message: "Unparseable model response",
      raw_response: { raw: raw.slice(0, 8000) },
      triggered_by: triggeredBy ?? null,
    })
    return { ok: false, error: "Unparseable model response" }
  }

  const { data: inserted, error } = await supabase
    .from("career_application_ai_reviews")
    .insert({
      application_id: applicationId,
      model,
      status: "COMPLETED",
      score_role_fit: review.scores.roleFit,
      score_experience: review.scores.experience,
      score_skills: review.scores.skills,
      score_logistics: review.scores.logistics,
      score_communication: review.scores.communication,
      total_score: review.totalScore,
      recommendation: review.recommendation,
      summary: review.summary,
      strengths: review.strengths,
      concerns: review.concerns,
      suggested_questions: review.suggestedQuestions,
      data_notes: review.dataNotes,
      triggered_by: triggeredBy ?? null,
    })
    .select("id")
    .single()

  if (error) {
    console.error("[careers-ai] insert failed:", error.message)
    return { ok: false, error: "Failed to store review" }
  }

  return { ok: true, reviewId: inserted?.id }
}

export async function listCareerApplicationAiReviews(applicationId: string): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("career_application_ai_reviews")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
    .limit(20)
  return (data || []) as Record<string, unknown>[]
}
