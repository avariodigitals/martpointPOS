/* ───────────────────────────  AI books review — narrative layer  ───────────────────────────
 * Runs the deterministic checks (lib/books-checks.ts), then asks OpenAI to
 * write an investor-grade narrative over the COMPUTED numbers only.
 *
 * Hard rules (inherited from the creator-ai spec):
 *  - The AI never does arithmetic and never invents figures — it may only
 *    reference numbers present in the supplied JSON.
 *  - Health score and verdict are computed in code, not by the AI.
 *  - The report is internal analysis, not tax or legal advice; the prompt
 *    forces the model to say so where compliance is discussed.
 *  - Every run is a new row (immutable history) and is admin-only.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { aiChat } from "./ai-chat"
import { runBooksChecks, type BooksMetrics, type Finding } from "./books-checks"

export type BooksNarrative = {
  executive_summary: string
  sustainability: string
  compliance_posture: string[]
  red_flags: string[]
  cash_and_runway: string
  revenue_quality: string
  recommended_actions: string[]
  investor_readiness: string
}

const OUTPUT_SPEC = `
Respond with JSON only, exactly these keys:
{
  "executive_summary": "4-6 sentences: what state the books are in and the single most important thing to fix first",
  "sustainability": "Is this business building sustainably? Cover margin direction, cost discipline and revenue durability. 4-6 sentences.",
  "compliance_posture": ["3-6 short statements about VAT/tax and record-keeping posture, each grounded in the supplied findings/metrics. Always phrase tax items as risk flags to verify with a tax adviser, never as clearance or legal advice."],
  "red_flags": ["0-8 short statements, ordered most to least serious, taken ONLY from the supplied findings and metrics"],
  "cash_and_runway": "2-4 sentences on cash, receivables and runway using the supplied figures",
  "revenue_quality": "2-4 sentences on concentration, overdue debt and collection quality using the supplied figures",
  "recommended_actions": ["3-8 concrete actions, each addressable by a named owner this month"],
  "investor_readiness": "3-5 sentences: would these books survive investor due diligence today, and what would an investor notice first"
}
Rules:
- Every number you write MUST appear verbatim in the supplied JSON (metrics or findings). Do NOT compute, extrapolate, or estimate new numbers. If a figure is missing, describe the gap instead.
- Money figures are in NGN; you may reformat with thousands separators but not change values.
- Be direct and specific. No generic business advice.
`.trim()

function buildPrompt(months: number, metrics: BooksMetrics, findings: Finding[]): string {
  return [
    `Review period: last ${months} months.`,
    "",
    "COMPUTED METRICS (authoritative — produced by the ledger, not by you):",
    JSON.stringify(metrics, null, 2),
    "",
    "DETERMINISTIC FINDINGS (integrity checks already run by code):",
    findings.length > 0 ? JSON.stringify(findings, null, 2) : "None — all automated integrity checks passed.",
    "",
    "Write the internal books-review narrative for MartPoint's founders ahead of investor due diligence.",
  ].join("\n")
}

export async function runBooksReview(
  months: number,
  triggeredBy?: string | null,
): Promise<{ ok: boolean; reviewId?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data: row, error: insertError } = await supabase
    .from("books_reviews")
    .insert({ status: "RUNNING", months: months, triggered_by: triggeredBy ?? null })
    .select("id")
    .single()
  if (insertError || !row) return { ok: false, error: insertError?.message || "Could not start review" }
  const reviewId = row.id as string

  try {
    const { metrics, findings } = await runBooksChecks(months)

    let model = ""
    let narrative: BooksNarrative
    try {
      const completion = await aiChat({
        json: true,
        temperature: 0.2,
        maxTokens: 2200,
        messages: [
          {
            role: "system",
            content:
              "You are a careful financial-review analyst for MartPoint, a Nigerian retail/business operating system. You narrate an internal books review for the founders ahead of investor due diligence. You never invent data, never perform arithmetic beyond the figures you are given, and you do not give tax or legal advice — you flag items for a qualified adviser. You respond with JSON only.",
          },
          { role: "user", content: buildPrompt(months, metrics, findings) },
        ],
      })
      const raw = completion.content || "{}"
      model = completion.model
      const parsed = JSON.parse(raw) as Partial<BooksNarrative>
      narrative = {
        executive_summary: String(parsed.executive_summary || ""),
        sustainability: String(parsed.sustainability || ""),
        compliance_posture: Array.isArray(parsed.compliance_posture) ? parsed.compliance_posture.map(String).slice(0, 8) : [],
        red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags.map(String).slice(0, 10) : [],
        cash_and_runway: String(parsed.cash_and_runway || ""),
        revenue_quality: String(parsed.revenue_quality || ""),
        recommended_actions: Array.isArray(parsed.recommended_actions) ? parsed.recommended_actions.map(String).slice(0, 10) : [],
        investor_readiness: String(parsed.investor_readiness || ""),
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "AI request failed"
      await supabase
        .from("books_reviews")
        .update({
          status: "FAILED",
          error_message: message,
          metrics,
          findings,
          health_score: metrics.health_score,
          verdict: metrics.verdict,
          completed_at: new Date().toISOString(),
        })
        .eq("id", reviewId)
      return { ok: false, reviewId, error: message }
    }

    await supabase
      .from("books_reviews")
      .update({
        status: "COMPLETED",
        model,
        metrics,
        findings,
        narrative,
        health_score: metrics.health_score,
        verdict: metrics.verdict,
        completed_at: new Date().toISOString(),
      })
      .eq("id", reviewId)

    return { ok: true, reviewId }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Books review failed"
    await supabase
      .from("books_reviews")
      .update({ status: "FAILED", error_message: message, completed_at: new Date().toISOString() })
      .eq("id", reviewId)
    return { ok: false, reviewId, error: message }
  }
}
