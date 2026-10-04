/* Seed: MartPoint Creator Challenge — Pilot 001 (SCHEDULED / Coming Soon).
 *
 * Uses the Supabase service-role REST endpoint to create the challenge with
 * all approved Pilot 001 configuration directly in the database, then sets
 * status to SCHEDULED so it shows as "Coming soon" in the creator portal.
 *
 * Does NOT activate — rules are NOT frozen and no notifications are sent.
 * Activation gate: ~20–30 Creator Ready creators.
 *
 * The four public-facing creator copies (Challenge Brief, Terms & Conditions,
 * Recruitment Announcement, Challenge Announcement) are NOT published here.
 * They remain in CREATOR_CHALLENGE_PILOT_001.md for review before publishing.
 *
 * Usage:
 *   npx tsx scripts/seed-creator-challenge-pilot-001.ts
 */
import { config } from "dotenv"
config({ path: ".env.local" })

const SUPA = process.env.SUPABASE_URL || ""
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""

async function db(method: string, path: string, body?: unknown, returnRep = false) {
  const headers: Record<string, string> = {
    apikey: KEY,
    Authorization: `Bearer ${KEY}`,
    "Content-Type": "application/json",
  }
  if (returnRep) headers.Prefer = "return=representation"
  const res = await fetch(`${SUPA}/rest/v1/${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let data: unknown = null
  try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data }
}

function assert(ok: boolean, msg: string) {
  if (!ok) {
    console.error(`  FAIL  ${msg}`)
    process.exit(1)
  }
  console.log(`  PASS  ${msg}`)
}

// Hypothetical activation date (T). Set far enough ahead for recruitment.
// When ready, an admin will update these dates and activate.
const T = new Date("2026-11-16T00:00:00+01:00").getTime()
const iso = (offsetMs: number) => new Date(T + offsetMs).toISOString()
const ADMIN_ID = "3f0b41f8-6b0c-4ee1-91c3-ce0aee80d1c3"

async function main() {
  console.log("\n=== Seeding MartPoint Creator Challenge — Pilot 001 (SCHEDULED) ===\n")

  // Check for existing challenge with same slug
  const { data: existing } = await db("GET", `creator_challenges?slug=eq.creator-challenge-pilot-001&select=id,status`)
  if (existing && Array.isArray(existing) && existing.length > 0) {
    console.log(`⚠  Pilot 001 already exists (ID: ${(existing[0] as Record<string, unknown>).id}, status: ${(existing[0] as Record<string, unknown>).status})`)
    console.log("   Skipping creation.\n")
    return
  }

  // 1. Create the challenge as DRAFT
  console.log("1. Creating Pilot 001 as DRAFT…")
  const now = new Date().toISOString()
  const r1 = await db("POST", "creator_challenges", {
    name: "MartPoint Creator Challenge — Pilot",
    slug: "creator-challenge-pilot-001",
    theme: "Run Your Business Smarter with MartPoint",
    description:
      "Show Nigerian small businesses how MartPoint helps them run smarter — " +
      "demonstrate, explain, dramatize or document a real business problem " +
      "and how MartPoint addresses it.",
    objective:
      "Drive qualified demo bookings from Nigerian small-business owners via creator content.",
    // Future timeline — dates are placeholders until activation
    start_date: iso(0),
    submission_deadline: iso(21 * 86400_000),
    performance_cutoff: iso(28 * 86400_000),
    announcement_date: iso(31 * 86400_000),
    join_opens_at: iso(0),
    join_closes_at: iso(7 * 86400_000),
    eligible_levels: [],
    eligible_states: [],
    eligible_platforms: ["TIKTOK", "INSTAGRAM", "YOUTUBE"],
    required_hashtags: ["#MartPointChallenge", "#SmallBusinessNG"],
    required_mentions: ["@martpoint"],
    required_cta: "Book a free MartPoint demo — link in bio",
    content_requirements: [
      "Hook in the first 3 seconds with a real business pain",
      "Show or describe the MartPoint fix — real UI, screenshots, or a dramatized scenario",
      "End every post with the required CTA",
      "Your MartPoint-issued tracking link must be the clickable destination through an approved placement (bio / link-in-bio / story link / pinned comment)",
    ].join("\n"),
    prohibited_claims: [
      'Income or profit guarantees ("you\'ll double your money")',
      "Fake discounts, fake pricing, fake urgency",
      "Naming or mocking competitors",
      "Misleading claims about what MartPoint does",
    ].join("\n"),
    judging_criteria: "Originality 30%, Clarity 30%, MartPoint relevance/accuracy 20%, Execution 20%",
    // Placeholder terms — final T&Cs from §12 will be reviewed before activation
    terms:
      "This challenge is governed by the MartPoint Creator Challenge Terms & Conditions " +
      "which will be provided upon activation. Joining does not guarantee any payment, " +
      "prize or reward.",
    featured: true,
    leaderboard_visible: true,
    leaderboard_metrics: ["approved_content", "verified_reach", "clicks", "leads", "conversions"],
    min_submissions: 1,
    max_submissions: 3,
    creator_ready_required: true,
    scoring_config: { metricWindowDays: 7, maxCashAwardsPerCreator: 1 },
    status: "DRAFT",
    created_by: ADMIN_ID,
    updated_by: ADMIN_ID,
    created_at: now,
    updated_at: now,
  }, true) /* return=representation to get the ID */
  assert(r1.status === 201, `Challenge row created: ${r1.status}`)
  const challengeId = (Array.isArray(r1.data) ? (r1.data as Record<string, unknown>[])[0] : (r1.data as Record<string, unknown>))?.id as string
  assert(!!challengeId, `Challenge ID: ${challengeId}`)
  console.log(`  Challenge ID: ${challengeId}`)

  // 2. Create awards (₦400,000 pool) — insert individually since PostgREST
  //    batch POST requires identical keys for all rows.
  console.log("\n2. Creating awards…")
  const awards = [
    { award_type: "OVERALL", title: "Overall Creator", description: "Best overall entry — judged on originality, clarity, MartPoint relevance/accuracy, execution, and verified performance.", winners_count: 1, cash_amount_kobo: 150_000 * 100, judging_criteria: "Judges 60% + verified performance 40%", non_cash_reward: null, scoring_config: {}, sort_order: 1 },
    { award_type: "CONVERSION", title: "Conversion Champion", description: "Most qualified demo enquiries via the tracking link.", winners_count: 1, cash_amount_kobo: 100_000 * 100, judging_criteria: "Qualified demo bookings via tracking link", non_cash_reward: null, scoring_config: { minQualifiedLeads: 1 }, sort_order: 2 },
    { award_type: "REACH", title: "Reach Champion", description: "Highest verified views in the comparable 7-day measurement window.", winners_count: 1, cash_amount_kobo: 75_000 * 100, judging_criteria: "Verified views within the measurement window", non_cash_reward: null, scoring_config: { minViews: 1000 }, sort_order: 3 },
    { award_type: "CREATIVE", title: "Creative Champion", description: "Highest judge scores for creativity — originality, clarity, relevance and execution — with no performance floor.", winners_count: 1, cash_amount_kobo: 50_000 * 100, judging_criteria: "Judge scores only (Originality 30%, Clarity 30%, Relevance 20%, Execution 20%)", non_cash_reward: null, scoring_config: {}, sort_order: 4 },
    { award_type: "RISING", title: "Rising Creator", description: "Best performance relative to the creator's own baseline — gives smaller creators a genuine path to win.", winners_count: 1, cash_amount_kobo: 25_000 * 100, judging_criteria: "Performance vs creator's self-reported baseline", non_cash_reward: null, scoring_config: { minViews: 500, minEngagement: 0, engagementRateWeight: 100, reachVsFollowingWeight: 10, conversionsWeight: 2, judgingWeight: 0.5 }, sort_order: 5 },
  ]
  const awardRows = awards.map((a) => ({ ...a, challenge_id: challengeId }))
  const r2 = await db("POST", "creator_challenge_awards", awardRows)
  assert(r2.status === 201, `Awards created: ${r2.status} ${JSON.stringify(r2.data).slice(0, 200)}`)

  // 3. Create brief (key info only — NOT the four public-facing copies)
  console.log("\n3. Creating brief…")
  const r3 = await db("POST", "creator_challenge_briefs", {
    challenge_id: challengeId,
    version: 1,
    sections: {
      overview:
        "The first MartPoint Creator Challenge. Create content that shows a real Nigerian " +
        "business problem — messy stock counts, lost sales, no idea which branch made money " +
        "today — and how MartPoint fixes it. You don't need to own a MartPoint-powered " +
        "business; you can demonstrate, explain, dramatize or document the problem and the fix.",
      audience:
        "Shop owners, supermarket and pharmacy operators, boutique owners, mini-mart managers, " +
        "market traders going digital — people running real businesses on paper, WhatsApp and memory.",
      keyMessage:
        "MartPoint helps you run your business smarter — sales, stock, staff and reports in one place.",
      directions: [
        'Hook in the first 3 seconds with a real pain ("Oga counted stock till 11pm again")',
        "Show or describe the MartPoint fix — real UI, screenshots from the brief pack, or a dramatized scenario",
        "End every post with the CTA",
      ],
      requiredElements: [
        "#MartPointChallenge and #SmallBusinessNG hashtags",
        "Mention @martpoint",
        "Tracking link as the clickable destination (bio / link-in-bio / story link / pinned comment)",
        "30–90 seconds recommended duration",
      ],
      exampleIdeas: [
        "Skit/dramatization of a shop owner's chaos before MartPoint",
        "Screen recording walkthrough of the MartPoint dashboard",
        '"Day in the life" of a shop owner using MartPoint',
        "Before/after comparison of manual vs MartPoint operations",
        "Explainer carousel or short video",
      ],
      submissionInstructions:
        "Post publicly on TikTok, Instagram or YouTube → copy the post's public URL → " +
        "submit it under this challenge in your Creator Portal. You can submit up to 3 posts " +
        "(minimum 1 to be eligible for awards).",
      judgingExplainer:
        "Human judges score originality, clarity, accuracy and execution; verified performance " +
        "(measured 7 days after your post goes live) decides reach and conversion awards. " +
        "Joining never guarantees a reward.",
    },
    created_by: ADMIN_ID,
  })
  assert(r3.status === 201, `Brief created: ${r3.status}`)

  // 4. Schedule — set status SCHEDULED ("Coming soon")
  //    Does NOT freeze rules; does NOT notify anyone.
  console.log("\n4. Setting status to SCHEDULED…")
  const r4 = await db("PATCH", `creator_challenges?id=eq.${challengeId}`, {
    status: "SCHEDULED",
    updated_by: ADMIN_ID,
    updated_at: new Date().toISOString(),
  })
  assert(r4.status === 200 || r4.status === 204, `Status updated: ${r4.status}`)

  console.log(`\n✅ Pilot 001 is now SCHEDULED ("Coming soon")`)
  console.log(`   Challenge ID: ${challengeId}`)
  console.log(`   Slug: creator-challenge-pilot-001`)
  console.log(`   Admin view: https://martpoint.com.ng/admin/creators/challenges/${challengeId}`)
  console.log("")
  console.log("   Next steps:")
  console.log("   • Recruitment: build to ~20–30 Creator Ready creators")
  console.log("   • Review four public-facing copies in CREATOR_CHALLENGE_PILOT_001.md")
  console.log("   • Update dates, publish copies, then activate when recruitment gate met")
}

main().catch((err) => {
  console.error("Fatal:", err)
  process.exit(1)
})