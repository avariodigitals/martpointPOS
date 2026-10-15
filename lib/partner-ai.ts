/* ───────────────────────────  AI-assisted partner application review  ───────────────────────────
 * Produces a structured assessment of a MartPoint partner application using OpenAI.
 *
 * Hard rules (mirrors lib/creator-ai.ts):
 *  - AI NEVER makes the final approve/reject decision — it produces a
 *    recommendation + reasoning for an authorised admin.
 *  - Never fabricate business statistics. Public site data is fetched
 *    best-effort; when a site doesn't return data we say so and score only
 *    on what was actually provided.
 *  - Assessments are stored separately (partner_ai_reviews) and are never
 *    exposed to applicants. The application status is not changed.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { aiChat } from "./ai-chat"
import { fetchPublicProfile, type FetchedProfile } from "./creator-ai"
import { listApplicationQuestionRounds } from "./partner-application-questions"

export interface PartnerAiReviewResult {
  scores: {
    completeness: number       // /10
    capability: number         // /20
    partnerTypeFit: number     // /20
    marketReach: number        // /15
    communication: number      // /15
    trustRisk: number          // /20 (higher = fewer red flags)
  }
  totalScore: number           // /100
  recommendation: "STRONG_CANDIDATE" | "REVIEW" | "FURTHER_VERIFICATION"
  strengths: string[]
  concerns: string[]
  suggestedQuestions: string[]
  suggestedPartnerType: string
  industryFitSummary: string
  dataNotes: string
}

const PARTNER_TYPE_LABELS: Record<string, string> = {
  REFERRAL: "Referral Partner",
  CHANNEL: "Channel Partner",
  IMPLEMENTATION: "Implementation Partner",
  CHANNEL_IMPLEMENTATION: "Channel + Implementation Partner",
  TECHNOLOGY: "Technology Partner",
  PAYMENT: "Payment Partner",
}

const RUBRIC = `
Score the applicant on exactly these dimensions (weights are fixed):

- completeness (max 10): how fully and specifically the application was completed (registration details, coverage, experience, answers).
- capability (max 20): evidence they can actually deliver for MartPoint — team size, existing customer base, products/services, relevant experience.
- partnerTypeFit (max 20): how well the requested partner type matches their real business; suggest the better-fit type in suggestedPartnerType when it differs.
- marketReach (max 15): industries served and geographic coverage value for a Nigeria-wide partner network. NEVER penalise a partner for being outside Lagos — strong regional coverage can be a positive.
- communication (max 15): clarity and professionalism of the written answers.
- trustRisk (max 20): higher when nothing concerning is found; lower for inconsistencies, unverifiable claims, missing registration details, or anything that looks like fraud.

Output rules:
- recommendation must be exactly one of: STRONG_CANDIDATE, REVIEW, FURTHER_VERIFICATION
- NEVER invent statistics or company facts. If a public site was unavailable, base scores only on supplied information and mention the gap in dataNotes.
- suggestedQuestions: 3-6 discovery-call questions tailored to this applicant.
- suggestedPartnerType must be one of: REFERRAL, CHANNEL, IMPLEMENTATION, CHANNEL_IMPLEMENTATION, TECHNOLOGY, PAYMENT
- Be concise: each strength/concern is a single sentence.
`.trim()

function buildPrompt(app: Record<string, unknown>, fetched: FetchedProfile[], answersLines: string): string {
  const str = (k: string) => String(app[k] || "")
  const arr = (k: string) => {
    const v = app[k]
    return Array.isArray(v) ? v.map(String).join(", ") : ""
  }

  const fetchedLines = fetched
    .map((f) =>
      f.fetched
        ? `- ${f.platform} ${f.url}: title="${f.title || ""}" description="${f.description || ""}"`
        : `- ${f.platform} ${f.url}: UNAVAILABLE (${f.note || "no public data"})`
    )
    .join("\n")

  return `Assess this MartPoint partner application.

APPLICANT
Type: ${str("applicant_type") === "COMPANY" ? "Company" : "Individual"}
Name: ${str("full_name")}
Business name: ${str("business_name") || "(none)"}
Location: ${[str("city"), str("state"), str("country")].filter(Boolean).join(", ")}
Address: ${str("business_address") || "(none)"}
Registration number: ${str("registration_number") || "(none supplied)"}
Year established: ${str("year_established") || "(none)"}
Team size: ${str("team_size") || "(none)"}
Estimated customer base: ${str("estimated_customer_base") || "(none)"}
Website: ${str("website") || "(none)"}
LinkedIn: ${str("linkedin") || "(none)"}
Social profile: ${str("social_profile") || "(none)"}

REQUESTED PARTNERSHIP
Requested type: ${PARTNER_TYPE_LABELS[str("requested_partner_type")] || str("requested_partner_type")}
Industries served: ${arr("industries_served") || "(none)"}
Geographic coverage: ${arr("geographic_coverage") || "(none)"}
Expected monthly opportunities: ${str("expected_monthly_opportunities") || "(none)"}

CURRENT PRODUCTS / SERVICES
${str("current_products_services") || "(none)"}

WHY THEY WANT TO PARTNER
${str("reason_for_applying") || "(none)"}

RELEVANT EXPERIENCE
${str("relevant_experience") || "(none)"}

EXTRA ANSWERS FROM THE APPLICATION FORM
${answersLines || "(none)"}

PUBLIC SITE DATA RETRIEVED BY SYSTEM
${fetchedLines || "(no sites fetched)"}

${RUBRIC}

Respond with a single JSON object:
{
  "scores": {
    "completeness": <0-10>, "capability": <0-20>, "partnerTypeFit": <0-20>,
    "marketReach": <0-15>, "communication": <0-15>, "trustRisk": <0-20>
  },
  "recommendation": "STRONG_CANDIDATE|REVIEW|FURTHER_VERIFICATION",
  "strengths": ["..."],
  "concerns": ["..."],
  "suggestedQuestions": ["..."],
  "suggestedPartnerType": "REFERRAL|CHANNEL|IMPLEMENTATION|CHANNEL_IMPLEMENTATION|TECHNOLOGY|PAYMENT",
  "industryFitSummary": "...",
  "dataNotes": "what could and could not be verified/retrieved"
}`
}

function parseReview(raw: string): PartnerAiReviewResult | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const s = (parsed.scores || {}) as Record<string, unknown>
    const num = (v: unknown, max: number) =>
      Math.max(0, Math.min(max, typeof v === "number" ? v : 0))
    const scores = {
      completeness: num(s.completeness, 10),
      capability: num(s.capability, 20),
      partnerTypeFit: num(s.partnerTypeFit, 20),
      marketReach: num(s.marketReach, 15),
      communication: num(s.communication, 15),
      trustRisk: num(s.trustRisk, 20),
    }
    const totalScore =
      scores.completeness + scores.capability + scores.partnerTypeFit +
      scores.marketReach + scores.communication + scores.trustRisk
    const validRecs = ["STRONG_CANDIDATE", "REVIEW", "FURTHER_VERIFICATION"]
    const validTypes = Object.keys(PARTNER_TYPE_LABELS)
    return {
      scores,
      totalScore,
      recommendation: validRecs.includes(parsed.recommendation as string)
        ? (parsed.recommendation as PartnerAiReviewResult["recommendation"])
        : "REVIEW",
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String).slice(0, 10) : [],
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns.map(String).slice(0, 10) : [],
      suggestedQuestions: Array.isArray(parsed.suggestedQuestions)
        ? parsed.suggestedQuestions.map(String).slice(0, 8)
        : [],
      suggestedPartnerType: validTypes.includes(parsed.suggestedPartnerType as string)
        ? String(parsed.suggestedPartnerType)
        : "REFERRAL",
      industryFitSummary: String(parsed.industryFitSummary || ""),
      dataNotes: String(parsed.dataNotes || ""),
    }
  } catch {
    return null
  }
}

/* ───────────────────────────  Public entry point  ───────────────────────────
 * Runs the assessment and stores it in partner_ai_reviews. Safe to call more
 * than once — each run is a new review row (immutable history). The
 * application status is deliberately left untouched: AI never overrides the
 * human workflow.
 */

export async function runPartnerAiReview(
  applicationId: string,
  triggeredBy?: string | null
): Promise<{ ok: boolean; reviewId?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data: appRow } = await supabase
    .from("partner_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle()
  if (!appRow) return { ok: false, error: "Application not found" }

  // Questionnaire rounds the applicant already answered add context.
  const rounds = await listApplicationQuestionRounds(applicationId)
  const answeredRounds = rounds.filter((r) => r.status === "Submitted" || r.status === "Reviewed")
  const answersLines = answeredRounds
    .map((r) => {
      const fieldsByName = new Map(r.fields.map((f) => [f.name, f.label] as const))
      const items = Object.entries(r.responses || {})
        .map(([k, v]) => {
          const label = fieldsByName.get(k) || k
          const value = Array.isArray(v) ? v.map(String).join(", ") : String(v ?? "")
          return `${label}: ${value}`
        })
        .join(" | ")
      return items ? `[${r.title}] ${items}` : ""
    })
    .filter(Boolean)
    .join("\n")

  // Best-effort public fetch of the supplied web presence.
  const siteEntries: { url: string; platform: string }[] = [
    { url: String(appRow.website || ""), platform: "website" },
    { url: String(appRow.linkedin || ""), platform: "linkedin" },
    { url: String(appRow.social_profile || ""), platform: "social" },
  ].filter((e) => /^https?:\/\//.test(e.url))
  const fetched: FetchedProfile[] = []
  for (const e of siteEntries.slice(0, 3)) {
    fetched.push(await fetchPublicProfile(e.url, e.platform))
  }

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
            "You are a careful partner-review analyst for MartPoint, a Nigerian retail/business operating system. You assess partner applications objectively and never invent data. You respond with JSON only.",
        },
        { role: "user", content: buildPrompt(appRow, fetched, answersLines) },
      ],
    })
    raw = completion.content
    model = completion.model
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI request failed"
    await supabase.from("partner_ai_reviews").insert({
      application_id: applicationId,
      status: "FAILED",
      error_message: message,
      fetched_sites: fetched,
      triggered_by: triggeredBy ?? null,
    })
    return { ok: false, error: message }
  }

  const review = parseReview(raw)
  if (!review) {
    await supabase.from("partner_ai_reviews").insert({
      application_id: applicationId,
      status: "FAILED",
      error_message: "Unparseable model response",
      raw_response: { raw: raw.slice(0, 8000) },
      fetched_sites: fetched,
      triggered_by: triggeredBy ?? null,
    })
    return { ok: false, error: "Unparseable model response" }
  }

  const { data: inserted, error } = await supabase
    .from("partner_ai_reviews")
    .insert({
      application_id: applicationId,
      model,
      status: "COMPLETED",
      score_completeness: review.scores.completeness,
      score_capability: review.scores.capability,
      score_partner_type_fit: review.scores.partnerTypeFit,
      score_market_reach: review.scores.marketReach,
      score_communication: review.scores.communication,
      score_trust_risk: review.scores.trustRisk,
      total_score: review.totalScore,
      recommendation: review.recommendation,
      strengths: review.strengths,
      concerns: review.concerns,
      suggested_questions: review.suggestedQuestions,
      suggested_partner_type: review.suggestedPartnerType,
      industry_fit_summary: review.industryFitSummary,
      data_notes: review.dataNotes,
      fetched_sites: fetched,
      triggered_by: triggeredBy ?? null,
    })
    .select("id")
    .single()

  if (error) {
    console.error("[partner-ai] insert failed:", error.message)
    return { ok: false, error: "Failed to store review" }
  }

  return { ok: true, reviewId: inserted?.id }
}

export async function listPartnerAiReviews(
  applicationId: string
): Promise<Record<string, unknown>[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("partner_ai_reviews")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
    .limit(20)
  return (data || []) as Record<string, unknown>[]
}
