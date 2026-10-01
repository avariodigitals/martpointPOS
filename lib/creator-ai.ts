/* ───────────────────────────  AI-assisted creator review  ───────────────────────────
 * Produces a structured assessment of a creator application using OpenAI.
 *
 * Hard rules (from the Creator Network spec):
 *  - AI NEVER makes the final approve/reject decision — it produces a
 *    recommendation + reasoning for an authorised admin.
 *  - Never fabricate platform statistics. Public profile data is fetched
 *    best-effort; when a platform doesn't return data we say so and score
 *    only on what was actually provided.
 *  - Assessments are stored separately (creator_ai_reviews) from the
 *    application and are never exposed to applicants.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { readSettings } from "./settings"
import type { CreatorApplication, CreatorSocialProfile } from "./creators"

export interface CreatorAiReviewResult {
  scores: {
    profileCompleteness: number // /10
    contentQuality: number      // /20
    audienceFit: number         // /20
    engagementQuality: number   // /15
    communication: number       // /15
    geographicValue: number     // /10
    brandSafety: number         // /10
  }
  totalScore: number            // /100
  recommendation: "STRONG_CANDIDATE" | "REVIEW" | "FURTHER_VERIFICATION"
  strengths: string[]
  concerns: string[]
  suggestedQuestions: string[]
  contentCategories: string[]
  audienceFitSummary: string
  suggestedTier: string
  dataNotes: string
}

interface FetchedProfile {
  url: string
  platform: string
  fetched: boolean
  title?: string
  description?: string
  note?: string
}

/* ───────────────────────────  Best-effort public fetch  ───────────────────────────
 * Pulls <title> and meta description/og: fields from public profile pages.
 * Most social platforms serve limited HTML to non-JS clients — anything we
 * can't retrieve is recorded honestly in fetched_profiles/data_notes.
 */

const FETCH_TIMEOUT_MS = 6000
const MAX_HTML_BYTES = 300_000

function extractMeta(html: string, names: string[]): string | undefined {
  for (const name of names) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']+)["']`,
      "i"
    )
    const m = html.match(re)
    if (m?.[1]) return m[1].slice(0, 500)
    // content-first attribute order variant
    const re2 = new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${name}["']`,
      "i"
    )
    const m2 = html.match(re2)
    if (m2?.[1]) return m2[1].slice(0, 500)
  }
  return undefined
}

async function fetchPublicProfile(url: string, platform: string): Promise<FetchedProfile> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; MartPointBot/1.0; +https://martpoint.com.ng)",
        Accept: "text/html",
      },
    })
    clearTimeout(timer)
    if (!res.ok) {
      return { url, platform, fetched: false, note: `HTTP ${res.status}` }
    }
    const html = (await res.text()).slice(0, MAX_HTML_BYTES)
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim().slice(0, 300)
    const description =
      extractMeta(html, ["og:description", "twitter:description", "description"])?.trim()
    return {
      url,
      platform,
      fetched: true,
      title: title || undefined,
      description: description || undefined,
    }
  } catch (err) {
    const msg = err instanceof Error && err.name === "AbortError" ? "timeout" : "unreachable"
    return { url, platform, fetched: false, note: msg }
  }
}

/* ───────────────────────────  OpenAI call  ─────────────────────────── */

async function getOpenAiKey(): Promise<string | undefined> {
  try {
    const settings = await readSettings()
    const openai = settings?.openai as Record<string, string> | undefined
    if (openai?.apiKey) return openai.apiKey
  } catch {
    // ignore
  }
  return process.env.OPENAI_API_KEY
}

const RUBRIC = `
Score the applicant on exactly these dimensions (weights are fixed):

- profileCompleteness (max 10): application completeness and quality of supplied information.
- contentQuality (max 20): clarity, presentation, originality and consistency evident from the bio, portfolio links and any fetched profile content.
- audienceFit (max 20): likelihood that the creator's content/audience overlaps with Nigerian SMEs, merchants, entrepreneurs or MartPoint-supported business types.
- engagementQuality (max 15): available indicators of genuine audience interaction. If followers/views were supplied by the applicant treat them as self-reported, not verified.
- communication (max 15): ability to communicate concepts clearly, based on the written answers.
- geographicValue (max 10): useful regional coverage for a Nigeria-wide creator network. NEVER penalise a creator for being outside Lagos — strong non-Lagos coverage can be a positive.
- brandSafety (max 10): lower score for potential brand-safety concerns, spam behaviour, impersonation signals or obvious risk; higher when nothing concerning is found.

Output rules:
- recommendation must be exactly one of: STRONG_CANDIDATE, REVIEW, FURTHER_VERIFICATION
- NEVER invent statistics. If platform data was unavailable, base scores only on supplied information and mention the gap in dataNotes.
- suggestedQuestions: 3-6 interview questions tailored to this applicant.
- suggestedTier must be one of: Starter, Verified, Pro, Ambassador.
- Be concise: each strength/concern is a single sentence.
`.trim()

function buildPrompt(app: CreatorApplication, profiles: CreatorSocialProfile[], fetched: FetchedProfile[]): string {
  const socialLines = profiles
    .map(
      (p) =>
        `- ${p.platform}: ${p.profileUrl}${p.username ? ` (@${p.username})` : ""}` +
        ` | self-reported followers: ${p.followers ?? "n/a"}` +
        ` | self-reported typical views: ${p.typicalViews ?? "n/a"}` +
        ` | engagement: ${p.typicalEngagement ?? "n/a"}`
    )
    .join("\n")

  const fetchedLines = fetched
    .map((f) =>
      f.fetched
        ? `- ${f.platform} ${f.url}: title="${f.title || ""}" description="${f.description || ""}"`
        : `- ${f.platform} ${f.url}: UNAVAILABLE (${f.note || "no public data"})`
    )
    .join("\n")

  const portfolioLines = app.portfolioLinks
    .map((p) => `- ${p.url}${p.note ? ` (${p.note})` : ""}`)
    .join("\n")

  return `Assess this MartPoint Creator Network application.

APPLICANT
Name: ${app.fullName}
Location: ${[app.city, app.state, app.country].filter(Boolean).join(", ")}
Primary category: ${app.primaryCategory}
Secondary category: ${app.secondaryCategory || "none"}
Languages: ${app.languages.join(", ") || "not specified"}
Experience: ${app.experienceYears || "not specified"} years
Bio: ${app.bio || "(none)"}

AUDIENCE (self-reported)
Primary audience: ${app.primaryAudience || "not specified"}
Locations: ${app.audienceLocations.join(", ") || "not specified"}
Age range: ${app.audienceAgeRange || "not specified"}
Includes business owners/entrepreneurs: ${app.audienceHasBusinessOwners === null ? "unknown" : app.audienceHasBusinessOwners ? "yes" : "no"}
Audience industries: ${app.audienceIndustries.join(", ") || "not specified"}

SOCIAL PROFILES (self-reported numbers)
${socialLines || "(none)"}

PUBLIC PROFILE DATA RETRIEVED BY SYSTEM
${fetchedLines || "(no profiles fetched)"}

PORTFOLIO LINKS
${portfolioLines || "(none supplied)"}

WHY THEY WANT TO JOIN
${app.whyCreator || "(none)"}

HOW THEY WOULD INTRODUCE MARTPOINT
${app.introduceMartpoint || "(none)"}

${RUBRIC}

Respond with a single JSON object:
{
  "scores": {
    "profileCompleteness": <0-10>, "contentQuality": <0-20>, "audienceFit": <0-20>,
    "engagementQuality": <0-15>, "communication": <0-15>, "geographicValue": <0-10>,
    "brandSafety": <0-10>
  },
  "recommendation": "STRONG_CANDIDATE|REVIEW|FURTHER_VERIFICATION",
  "strengths": ["..."],
  "concerns": ["..."],
  "suggestedQuestions": ["..."],
  "contentCategories": ["..."],
  "audienceFitSummary": "...",
  "suggestedTier": "Starter|Verified|Pro|Ambassador",
  "dataNotes": "what could and could not be verified/retrieved"
}`
}

function parseReview(raw: string): CreatorAiReviewResult | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
    const s = (parsed.scores || {}) as Record<string, unknown>
    const num = (v: unknown, max: number) =>
      Math.max(0, Math.min(max, typeof v === "number" ? v : 0))
    const scores = {
      profileCompleteness: num(s.profileCompleteness, 10),
      contentQuality: num(s.contentQuality, 20),
      audienceFit: num(s.audienceFit, 20),
      engagementQuality: num(s.engagementQuality, 15),
      communication: num(s.communication, 15),
      geographicValue: num(s.geographicValue, 10),
      brandSafety: num(s.brandSafety, 10),
    }
    const totalScore =
      scores.profileCompleteness + scores.contentQuality + scores.audienceFit +
      scores.engagementQuality + scores.communication + scores.geographicValue +
      scores.brandSafety
    const validRecs = ["STRONG_CANDIDATE", "REVIEW", "FURTHER_VERIFICATION"]
    return {
      scores,
      totalScore,
      recommendation: validRecs.includes(parsed.recommendation as string)
        ? (parsed.recommendation as CreatorAiReviewResult["recommendation"])
        : "REVIEW",
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String).slice(0, 10) : [],
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns.map(String).slice(0, 10) : [],
      suggestedQuestions: Array.isArray(parsed.suggestedQuestions)
        ? parsed.suggestedQuestions.map(String).slice(0, 8)
        : [],
      contentCategories: Array.isArray(parsed.contentCategories)
        ? parsed.contentCategories.map(String).slice(0, 8)
        : [],
      audienceFitSummary: String(parsed.audienceFitSummary || ""),
      suggestedTier: String(parsed.suggestedTier || "Starter"),
      dataNotes: String(parsed.dataNotes || ""),
    }
  } catch {
    return null
  }
}

/* ───────────────────────────  Public entry point  ───────────────────────────
 * Runs the assessment and stores it in creator_ai_reviews. Safe to call more
 * than once — each run is a new review row (immutable history).
 */

export async function runCreatorAiReview(
  applicationId: string,
  triggeredBy?: string | null
): Promise<{ ok: boolean; reviewId?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const [{ data: appRow }, { data: profileRows }] = await Promise.all([
    supabase.from("creator_applications").select("*").eq("id", applicationId).maybeSingle(),
    supabase.from("creator_social_profiles").select("*").eq("application_id", applicationId),
  ])
  if (!appRow) return { ok: false, error: "Application not found" }

  const { mapCreatorApplication, mapSocialProfile } = await import("./creators")
  const app = mapCreatorApplication(appRow)
  const profiles = (profileRows || []).map(mapSocialProfile)

  // Best-effort public fetch of each submitted profile.
  const fetched: FetchedProfile[] = []
  for (const p of profiles.slice(0, 6)) {
    fetched.push(await fetchPublicProfile(p.profileUrl, p.platform))
  }

  const apiKey = await getOpenAiKey()
  if (!apiKey) {
    const { data: failed } = await supabase
      .from("creator_ai_reviews")
      .insert({
        application_id: applicationId,
        status: "FAILED",
        error_message: "OpenAI API key not configured",
        triggered_by: triggeredBy ?? null,
      })
      .select("id")
      .single()
    return { ok: false, reviewId: failed?.id, error: "OpenAI API key not configured" }
  }

  const OpenAI = (await import("openai")).default
  const openai = new OpenAI({ apiKey })

  let raw = ""
  let model = "gpt-4o-mini"
  try {
    const completion = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a careful talent-review analyst for MartPoint, a Nigerian retail/business operating system. You assess creator-network applications objectively and never invent data. You respond with JSON only.",
        },
        { role: "user", content: buildPrompt(app, profiles, fetched) },
      ],
      temperature: 0.3,
      max_tokens: 1600,
      response_format: { type: "json_object" },
    })
    raw = completion.choices[0]?.message?.content?.trim() || ""
    model = completion.model || model
  } catch (err) {
    const message = err instanceof Error ? err.message : "OpenAI request failed"
    await supabase.from("creator_ai_reviews").insert({
      application_id: applicationId,
      status: "FAILED",
      error_message: message,
      fetched_profiles: fetched,
      triggered_by: triggeredBy ?? null,
    })
    return { ok: false, error: message }
  }

  const review = parseReview(raw)
  if (!review) {
    await supabase.from("creator_ai_reviews").insert({
      application_id: applicationId,
      status: "FAILED",
      error_message: "Unparseable model response",
      raw_response: { raw: raw.slice(0, 8000) },
      fetched_profiles: fetched,
      triggered_by: triggeredBy ?? null,
    })
    return { ok: false, error: "Unparseable model response" }
  }

  const { data: inserted, error } = await supabase
    .from("creator_ai_reviews")
    .insert({
      application_id: applicationId,
      model,
      status: "COMPLETED",
      score_profile_completeness: review.scores.profileCompleteness,
      score_content_quality: review.scores.contentQuality,
      score_audience_fit: review.scores.audienceFit,
      score_engagement_quality: review.scores.engagementQuality,
      score_communication: review.scores.communication,
      score_geographic_value: review.scores.geographicValue,
      score_brand_safety: review.scores.brandSafety,
      total_score: review.totalScore,
      recommendation: review.recommendation,
      strengths: review.strengths,
      concerns: review.concerns,
      suggested_questions: review.suggestedQuestions,
      content_categories: review.contentCategories,
      audience_fit_summary: review.audienceFitSummary,
      suggested_tier: review.suggestedTier,
      data_notes: review.dataNotes,
      fetched_profiles: fetched,
      triggered_by: triggeredBy ?? null,
    })
    .select("id")
    .single()

  if (error) {
    console.error("[creator-ai] insert failed:", error.message)
    return { ok: false, error: "Failed to store review" }
  }

  // Advance the application to AI_REVIEWED only from SUBMITTED — a completed
  // AI review never overrides a later human decision.
  await supabase
    .from("creator_applications")
    .update({ status: "AI_REVIEWED", updated_at: new Date().toISOString() })
    .eq("id", applicationId)
    .eq("status", "SUBMITTED")

  return { ok: true, reviewId: inserted?.id }
}
