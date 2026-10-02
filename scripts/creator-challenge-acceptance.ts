/* Creator Challenge Engine acceptance suite — Phase 3.
 * Runs one full seeded lifecycle + the security/edge matrix against the app
 * and DB. Uses signed session cookies (SESSION_SECRET) for real API calls and
 * the service-role REST endpoint for DB-level assertions.
 *
 * Creates clearly-labelled QA rows and cleans them up at the end.
 *
 *   npx tsx scripts/creator-challenge-acceptance.ts
 *   BASE_URL=http://localhost:3000 npx tsx scripts/creator-challenge-acceptance.ts
 */
import { config } from "dotenv"
config({ path: ".env.local" })
import crypto from "crypto"

const BASE = process.env.BASE_URL || "http://localhost:3000"
const SUPA = process.env.SUPABASE_URL || ""
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ""
const SECRET = process.env.SESSION_SECRET || ""

// Real Creator-Ready creator (Lagos, STARTER, MP-00001, TIKTOK/IG/YT profiles)
const CREATOR_A = { id: "5a8e0af2-46b3-49f2-9164-09bb4bfdb357", email: "adaeze.okafor.demo@example.com", name: "Adaeze Okafor" }
const ADMIN = { userId: "3f0b41f8-6b0c-4ee1-91c3-ce0aee80d1c3", username: "admin", role: "Admin", name: "Administrator" }
const QA_TAG = "QA-CHALLENGE-ACCEPTANCE"

function sign(payload: object): string {
  const data = JSON.stringify(payload)
  const sig = crypto.createHmac("sha256", SECRET).update(data).digest("hex")
  return Buffer.from(`${data}.${sig}`).toString("base64")
}
const creatorCookie = `creator-session=${sign({ creatorId: CREATOR_A.id, email: CREATOR_A.email, name: CREATOR_A.name, sessionVersion: 1 })}`
let creatorBCookie = ""
const adminCookie = `admin-session=${sign(ADMIN)}`

async function api(path: string, cookie: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { cookie, "Content-Type": "application/json", ...(init?.headers || {}) }, redirect: "manual" })
  let body: any = null
  try { body = await res.json() } catch { /* non-JSON */ }
  return { status: res.status, body, headers: res.headers }
}

async function db(path: string, init?: RequestInit) {
  const res = await fetch(`${SUPA}/rest/v1/${path}`, { ...init, headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Prefer: "return=representation", ...(init?.headers || {}) } })
  const text = await res.text()
  let body: any = null
  try { body = JSON.parse(text) } catch { body = text }
  return { status: res.status, body }
}

let pass = 0, fail = 0
function check(name: string, cond: boolean, detail = "") {
  if (cond) { pass++; console.log(`  PASS  ${name}`) }
  else { fail++; console.log(`  FAIL  ${name}  ${String(detail).slice(0, 160)}`) }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main() {
  console.log(`\n=== Creator Challenge acceptance — ${BASE} ===\n`)
  const t0 = Date.now()

  /* ═══ 0. Fixtures: QA creator B (ACTIVE but not Creator-Ready) ═══ */
  console.log("0. Fixtures")
  let creatorBId = ""
  {
    const { body: app } = await db("creator_applications", {
      method: "POST",
      body: JSON.stringify({
        reference_number: `MCA-QA-${t0}`,
        full_name: `${QA_TAG} Creator B`, email: `${QA_TAG.toLowerCase()}-b@test.invalid`,
        phone: "08000000000", state: "Abuja FCT", age_confirmed: true,
        primary_category: "Technology", status: "APPROVED",
      }),
    })
    const appId = Array.isArray(app) ? app[0]?.id : app?.id
    check("QA application created", !!appId, JSON.stringify(app)?.slice(0, 120))
    const { body: cb } = await db("creators", {
      method: "POST",
      body: JSON.stringify({
        creator_id: `MPC-QA-${String(t0).slice(-6)}`, referral_code: `MP-9${String(t0).slice(-4)}`,
        application_id: appId, full_name: `${QA_TAG} Creator B`,
        email: `${QA_TAG.toLowerCase()}-b@test.invalid`, phone: "08000000000", state: "Abuja FCT",
      }),
    })
    creatorBId = Array.isArray(cb) ? cb[0]?.id : cb?.id
    check("QA creator B created (not ready)", !!creatorBId, JSON.stringify(cb)?.slice(0, 120))
    creatorBCookie = `creator-session=${sign({ creatorId: creatorBId, email: `${QA_TAG.toLowerCase()}-b@test.invalid`, name: `${QA_TAG} Creator B`, sessionVersion: 1 })}`
  }

  let challengeId = ""
  let submissionId = ""
  let trackingToken = ""
  let awardOverallId = ""
  let awardRisingId = ""
  let qaLeadId: string | undefined

  try {
    /* ═══ 1. Admin creates incomplete challenge → activation must fail ═══ */
    console.log("1. Create + activation validation")
    let r = await api("/api/admin/creators/challenges", adminCookie, {
      method: "POST",
      body: JSON.stringify({
        name: `${QA_TAG} — Harmattan Launch`, slug: `qa-challenge-${t0}`,
        theme: "QA",
      }),
    })
    check("challenge created (DRAFT)", r.status === 200 && !!r.body?.id, JSON.stringify(r.body)?.slice(0, 160))
    challengeId = r.body?.id

    r = await api(`/api/admin/creators/challenges/${challengeId}`, adminCookie, { method: "POST", body: JSON.stringify({ action: "activate" }) })
    check("incomplete challenge cannot activate", r.status === 400 && Array.isArray(r.body?.missing) && r.body.missing.length > 0, JSON.stringify(r.body)?.slice(0, 200))

    /* ═══ 2. Complete the challenge, then activate ═══ */
    const now = Date.now()
    const iso = (ms: number) => new Date(now + ms).toISOString()
    r = await api(`/api/admin/creators/challenges/${challengeId}`, adminCookie, {
      method: "PATCH",
      body: JSON.stringify({
        patch: {
          name: `${QA_TAG} — Harmattan Launch`,
          description: "QA acceptance challenge — show how MartPoint helps small businesses sell more.",
          objective: "Drive demo bookings from Lagos retailers.",
          startDate: iso(-86400_000),
          submissionDeadline: iso(7 * 86400_000),
          performanceCutoff: iso(14 * 86400_000),
          announcementDate: iso(15 * 86400_000),
          eligiblePlatforms: ["TIKTOK", "INSTAGRAM"],
          requiredHashtags: ["#MartPointChallenge"],
          requiredMentions: ["@martpoint"],
          requiredCta: "Book a free demo at martpoint.com.ng",
          contentRequirements: "Show a real MartPoint screen; mention the demo link.",
          prohibitedClaims: "No income guarantees, no fake discounts.",
          judgingCriteria: "Originality 30%, clarity 30%, verified performance 40%.",
          terms: `${QA_TAG} terms: joining does not guarantee a reward. MartPoint decides winners.`,
          leaderboardVisible: true,
          minSubmissions: 1, maxSubmissions: 3,
        },
      }),
    })
    check("challenge fields patched", r.status === 200, JSON.stringify(r.body)?.slice(0, 160))

    r = await api(`/api/admin/creators/challenges/${challengeId}`, adminCookie, {
      method: "POST",
      body: JSON.stringify({
        action: "save_brief",
        brief: {
          overview: `${QA_TAG} brief overview — make a short video showing MartPoint POS.`,
          keyMessage: "MartPoint helps small businesses sell more and track everything.",
          directions: ["Hook in first 3 seconds", "Show the dashboard", "End with the CTA"],
          submissionInstructions: "Post publicly on TikTok or Instagram, then paste the URL here.",
          judgingExplainer: "Judged on originality, clarity and verified performance.",
        },
      }),
    })
    check("brief saved", r.status === 200, JSON.stringify(r.body)?.slice(0, 120))

    r = await api(`/api/admin/creators/challenges/${challengeId}`, adminCookie, {
      method: "POST",
      body: JSON.stringify({
        action: "replace_awards", awards: [
          { awardType: "OVERALL", title: "QA Overall Creator", winnersCount: 1, cashAmountNaira: 1, nonCashReward: "QA badge", judgingCriteria: "Combined score" },
          { awardType: "RISING", title: "QA Rising Creator", winnersCount: 1, nonCashReward: "QA shout-out" },
        ],
      }),
    })
    check("awards configured", r.status === 200, JSON.stringify(r.body)?.slice(0, 120))

    // Link one Creator Kit resource
    const { body: res1 } = await db("creator_resources?select=id&active=eq.true&limit=1")
    const resId = res1?.[0]?.id
    if (resId) {
      r = await api(`/api/admin/creators/challenges/${challengeId}`, adminCookie, {
        method: "POST",
        body: JSON.stringify({ action: "link_resources", resourceIds: [{ resourceId: resId, required: true }] }),
      })
      check("resource linked", r.status === 200, JSON.stringify(r.body)?.slice(0, 120))
    }

    r = await api(`/api/admin/creators/challenges/${challengeId}`, adminCookie, { method: "POST", body: JSON.stringify({ action: "activate" }) })
    check("challenge activates when complete", r.status === 200 && r.body?.status === "ACTIVE", JSON.stringify(r.body)?.slice(0, 160))

    const { body: chRows } = await db(`creator_challenges?id=eq.${challengeId}&select=status,rules_version,rules_frozen_at`)
    check("rules frozen at activation", !!chRows?.[0]?.rules_frozen_at && chRows[0].rules_version === 1)
    const { body: rv } = await db(`creator_challenge_rule_versions?challenge_id=eq.${challengeId}&select=version`)
    check("rules v1 snapshot exists", rv?.some((v: any) => v.version === 1), JSON.stringify(rv))

    /* ═══ 3. Discovery + eligibility ═══ */
    console.log("2. Discovery + join")
    r = await api("/api/creator/challenges", creatorCookie)
    const card = (r.body?.challenges ?? []).find((c: any) => c.id === challengeId)
    check("creator sees challenge", r.status === 200 && !!card, JSON.stringify(r.body)?.slice(0, 200))
    check("creator A eligible", card?.eligible === true, JSON.stringify(card?.reasons))

    r = await api(`/api/creator/challenges/${challengeId}/join`, creatorBCookie, { method: "POST", body: JSON.stringify({ acceptTerms: true }) })
    check("not-ready creator cannot join", r.status === 400 && /onboarding/i.test(JSON.stringify(r.body)), JSON.stringify(r.body)?.slice(0, 160))

    r = await api(`/api/creator/challenges/${challengeId}/join`, creatorCookie, { method: "POST", body: JSON.stringify({ acceptTerms: false }) })
    check("join without terms acceptance rejected", r.status === 400)

    r = await api(`/api/creator/challenges/${challengeId}/join`, creatorCookie, { method: "POST", body: JSON.stringify({ acceptTerms: true }) })
    check("creator A joins", r.status === 200, JSON.stringify(r.body)?.slice(0, 160))
    const { body: part } = await db(`creator_challenge_participants?challenge_id=eq.${challengeId}&creator_id=eq.${CREATOR_A.id}&select=status,rules_version_accepted,terms_accepted_at`)
    check("participant recorded w/ rules v1 + terms ts", part?.[0]?.status === "JOINED" && part?.[0]?.rules_version_accepted === 1 && !!part?.[0]?.terms_accepted_at)

    r = await api(`/api/creator/challenges/${challengeId}/join`, creatorCookie, { method: "POST", body: JSON.stringify({ acceptTerms: true }) })
    check("duplicate join is idempotent", r.status === 200)

    // Manipulated challenge id (draft challenge / random uuid)
    r = await api(`/api/creator/challenges/00000000-0000-0000-0000-000000000000/join`, creatorCookie, { method: "POST", body: JSON.stringify({ acceptTerms: true }) })
    check("joining a nonexistent challenge fails", r.status === 404 || r.status === 400)

    /* ═══ 4. Brief + resources visible to participant ═══ */
    console.log("3. Brief/detail")
    r = await api(`/api/creator/challenges/${challengeId}`, creatorCookie)
    check("detail shows brief", r.status === 200 && !!r.body?.brief?.overview, JSON.stringify(r.body)?.slice(0, 160))
    check("detail shows awards", (r.body?.awards?.length ?? 0) === 2)
    check("detail shows linked resource", (r.body?.resources?.length ?? 0) >= 1)
    check("no internal fields leak to creator", !JSON.stringify(r.body).includes("decisionReason") && !JSON.stringify(r.body).includes("decision_reason"))

    /* ═══ 5. Submissions ═══ */
    console.log("4. Submissions")
    r = await api("/api/creator/submissions", creatorBCookie, {
      method: "POST",
      body: JSON.stringify({ challengeId, platform: "TIKTOK", contentUrl: "https://tiktok.com/@qa-b/video/1" }),
    })
    check("non-participant cannot submit", r.status === 400, JSON.stringify(r.body)?.slice(0, 160))

    r = await api("/api/creator/submissions", creatorCookie, {
      method: "POST",
      body: JSON.stringify({ challengeId, platform: "YOUTUBE", contentUrl: `https://youtube.com/watch?v=qa-${t0}` }),
    })
    check("ineligible platform rejected", r.status === 400, JSON.stringify(r.body)?.slice(0, 160))

    const qaUrl = `https://tiktok.com/@adaezebiz/video/qa${t0}`
    r = await api("/api/creator/submissions", creatorCookie, {
      method: "POST",
      body: JSON.stringify({ challengeId, platform: "TIKTOK", contentUrl: qaUrl, caption: "QA submission", publishedAt: new Date().toISOString(), notes: "QA" }),
    })
    check("valid submission accepted", r.status === 200 && !!r.body?.submission?.id, JSON.stringify(r.body)?.slice(0, 200))
    submissionId = r.body?.submission?.id
    trackingToken = r.body?.submission?.tracking_token
    check("tracking token generated", typeof trackingToken === "string" && trackingToken.startsWith("sub_"), trackingToken)

    r = await api("/api/creator/submissions", creatorCookie, {
      method: "POST",
      body: JSON.stringify({ challengeId, platform: "INSTAGRAM", contentUrl: `${qaUrl}?utm_source=decorated` }),
    })
    check("decorated duplicate URL rejected", r.status === 400, JSON.stringify(r.body)?.slice(0, 200))

    r = await api("/api/creator/submissions", creatorCookie, {
      method: "POST",
      body: JSON.stringify({ challengeId, platform: "TIKTOK", contentUrl: "not-a-url" }),
    })
    check("malformed URL rejected", r.status === 400)

    /* ═══ 6. Admin review ═══ */
    console.log("5. Review")
    r = await api("/api/admin/creators/submissions?status=SUBMITTED", adminCookie)
    check("admin queue lists submission", r.status === 200 && (r.body?.submissions ?? []).some((s: any) => s.id === submissionId), JSON.stringify(r.body)?.slice(0, 200))

    r = await api(`/api/admin/creators/submissions/${submissionId}`, adminCookie, {
      method: "PATCH", body: JSON.stringify({ action: "reject" }),
    })
    check("reject without internal reason blocked", r.status === 400)

    r = await api(`/api/admin/creators/submissions/${submissionId}`, adminCookie, {
      method: "PATCH", body: JSON.stringify({ action: "approve", reviewFeedback: "QA approved" }),
    })
    check("admin approves submission", r.status === 200 && r.body?.status === "APPROVED", JSON.stringify(r.body)?.slice(0, 160))

    /* ═══ 7. Attribution: click → dedupe → lead ═══ */
    console.log("6. Attribution")
    const qaIp = `10.${(t0 % 200) + 1}.0.9`
    r = await api("/api/creator/track", "", {
      method: "POST",
      headers: { "x-forwarded-for": qaIp },
      body: JSON.stringify({ ref: "MP-00001", s: trackingToken, utmSource: "tiktok", utmCampaign: "qa", pagePath: "/" }),
    })
    check("submission-token click accepted", r.status === 200 && r.body?.ok === true, JSON.stringify(r.body)?.slice(0, 120))
    await sleep(400)
    const { body: refs1 } = await db(`creator_referrals?submission_id=eq.${submissionId}&event_type=eq.CLICK&select=id`)
    check("click attributed to submission+challenge", (refs1?.length ?? 0) === 1, JSON.stringify(refs1))
    const { body: refRow } = await db(`creator_referrals?submission_id=eq.${submissionId}&event_type=eq.CLICK&select=challenge_id,creator_id`)
    check("click carries challenge_id + creator_id", refRow?.[0]?.challenge_id === challengeId && refRow?.[0]?.creator_id === CREATOR_A.id)

    r = await api("/api/creator/track", "", {
      method: "POST",
      headers: { "x-forwarded-for": qaIp },
      body: JSON.stringify({ ref: "MP-00001", s: trackingToken, pagePath: "/" }),
    })
    await sleep(400)
    const { body: refs2 } = await db(`creator_referrals?submission_id=eq.${submissionId}&event_type=eq.CLICK&select=id`)
    check("repeat click same IP/hour deduped", (refs2?.length ?? 0) === 1, `count=${refs2?.length}`)

    // Backward compat: creator-only ref link still works
    r = await api("/api/creator/track", "", {
      method: "POST",
      headers: { "x-forwarded-for": `10.${(t0 % 200) + 1}.0.77` },
      body: JSON.stringify({ ref: "MP-00001", pagePath: "/pricing" }),
    })
    check("creator-only ?ref link still works", r.status === 200 && r.body?.ok === true)

    // Lead via processLead lib (HTTP path is captcha-gated on the live site).
    // Node 20 lacks native WebSocket — supabase realtime init needs the
    // constructor to exist; this path never subscribes so a stub suffices.
    if (typeof (globalThis as { WebSocket?: unknown }).WebSocket === "undefined") {
      ;(globalThis as { WebSocket?: unknown }).WebSocket = class {
        constructor() { throw new Error("WebSocket unavailable in QA script") }
      }
    }
    const { processLead } = await import("../lib/process-lead")
    const leadRes: any = await processLead({
      fullName: `${QA_TAG} Lead`, businessName: `${QA_TAG} Shop`,
      email: `${QA_TAG.toLowerCase()}-lead@test.invalid`, phone: "08000000001",
      businessType: "retail", productInterest: "POS", branches: "1", staffSize: "1-5",
      source: "qa-acceptance", creatorCode: "MP-00001", creatorSubmissionToken: trackingToken,
    } as any)
    check("lead created via attributed path", leadRes.success === true, JSON.stringify(leadRes)?.slice(0, 160))
    if (leadRes.leadId) {
      const { body: leadRow } = await db(`leads?id=eq.${leadRes.leadId}&select=creator_id,creator_challenge_id,creator_submission_id`)
      check("lead carries creator+challenge+submission", leadRow?.[0]?.creator_challenge_id === challengeId && leadRow?.[0]?.creator_submission_id === submissionId, JSON.stringify(leadRow))
      await sleep(600)
      const { body: leadRef } = await db(`creator_referrals?lead_id=eq.${leadRes.leadId}&event_type=eq.LEAD&select=challenge_id,submission_id`)
      check("LEAD referral attributed to submission", leadRef?.[0]?.submission_id === submissionId && leadRef?.[0]?.challenge_id === challengeId, JSON.stringify(leadRef))
      qaLeadId = leadRes.leadId
    }

    /* ═══ 8. Metrics snapshot ═══ */
    console.log("7. Metrics")
    r = await api(`/api/admin/creators/submissions/${submissionId}`, adminCookie, {
      method: "POST",
      body: JSON.stringify({ type: "metric", verified: true, label: "QA verified snapshot", views: 12500, likes: 900, comments: 120, shares: 80, clicks: 1, leads: 1 }),
    })
    check("admin metric snapshot recorded", r.status === 200, JSON.stringify(r.body)?.slice(0, 120))
    const { body: snaps } = await db(`creator_submission_metrics?submission_id=eq.${submissionId}&select=source,verified,views`)
    check("snapshot is verified+ADMIN source", snaps?.[0]?.source === "ADMIN" && snaps?.[0]?.verified === true, JSON.stringify(snaps))
    // Creators have no metric-write route — verify submissions POST ignores metric fields
    r = await api("/api/creator/submissions", creatorCookie, {
      method: "POST",
      body: JSON.stringify({ challengeId, platform: "TIKTOK", contentUrl: `https://tiktok.com/@adaezebiz/video/qa${t0}b`, views: 999999, verified: true }),
    })
    const { body: snapAfter } = await db(`creator_submission_metrics?submission_id=eq.${r.body?.submission?.id ?? "none"}&select=id`)
    check("creator cannot inject metrics via submission", (snapAfter?.length ?? 0) === 0)

    /* ═══ 9. Rules amendment (frozen) ═══ */
    console.log("8. Rules freeze/amendment")
    r = await api(`/api/admin/creators/challenges/${challengeId}`, adminCookie, {
      method: "PATCH", body: JSON.stringify({ patch: { submissionDeadline: iso(20 * 86400_000) } }),
    })
    check("material change without reason blocked", r.status === 409, `status=${r.status}`)
    r = await api(`/api/admin/creators/challenges/${challengeId}`, adminCookie, {
      method: "PATCH",
      body: JSON.stringify({ patch: { submissionDeadline: iso(20 * 86400_000) }, reason: "QA: extending deadline", confirmMaterialAmendment: true, notifyParticipants: false }),
    })
    check("amendment creates rules v2", r.status === 200 && r.body?.rulesVersion === 2, JSON.stringify(r.body)?.slice(0, 160))
    const { body: rv2 } = await db(`creator_challenge_rule_versions?challenge_id=eq.${challengeId}&version=eq.2&select=is_material,reason`)
    check("v2 snapshot flagged material", rv2?.[0]?.is_material === true, JSON.stringify(rv2))
    r = await api(`/api/creator/challenges/${challengeId}`, creatorCookie)
    check("creator sees needsAcknowledgement", r.body?.needsAcknowledgement === true, JSON.stringify(r.body?.participant))
    r = await api(`/api/creator/challenges/${challengeId}/join`, creatorCookie, { method: "PATCH" })
    check("creator acknowledges v2", r.status === 200 && r.body?.acknowledgedVersion === 2)
    const { body: part2 } = await db(`creator_challenge_participants?challenge_id=eq.${challengeId}&creator_id=eq.${CREATOR_A.id}&select=rules_version_accepted,acknowledged_rules_version`)
    check("original v1 acceptance preserved", part2?.[0]?.rules_version_accepted === 1 && part2?.[0]?.acknowledged_rules_version === 2)

    /* ═══ 10. Lifecycle to judging ═══ */
    console.log("9. Lifecycle → judging")
    r = await api(`/api/admin/creators/challenges/${challengeId}`, adminCookie, { method: "POST", body: JSON.stringify({ action: "close_submissions" }) })
    check("submissions closed", r.status === 200 && r.body?.status === "SUBMISSION_CLOSED", JSON.stringify(r.body)?.slice(0, 120))
    r = await api("/api/creator/submissions", creatorCookie, {
      method: "POST",
      body: JSON.stringify({ challengeId, platform: "TIKTOK", contentUrl: `https://tiktok.com/@adaezebiz/video/qalate${t0}` }),
    })
    check("late submission rejected after close", r.status === 400, JSON.stringify(r.body)?.slice(0, 160))
    r = await api(`/api/admin/creators/challenges/${challengeId}`, adminCookie, { method: "POST", body: JSON.stringify({ action: "start_judging" }) })
    check("judging started", r.status === 200 && r.body?.status === "JUDGING")

    /* ═══ 11. Judging scores ═══ */
    console.log("10. Judging")
    const { body: awardRows } = await db(`creator_challenge_awards?challenge_id=eq.${challengeId}&select=id,award_type,winners_count`)
    awardOverallId = awardRows?.find((a: any) => a.award_type === "OVERALL")?.id
    awardRisingId = awardRows?.find((a: any) => a.award_type === "RISING")?.id
    r = await api(`/api/admin/creators/challenges/${challengeId}/scores`, adminCookie, {
      method: "POST",
      body: JSON.stringify({ awardId: awardOverallId, submissionId, creatorId: CREATOR_A.id, criterion: "Originality", score: 88, notes: "QA", finalize: true }),
    })
    check("judge score saved", r.status === 200, JSON.stringify(r.body)?.slice(0, 120))
    r = await api(`/api/admin/creators/challenges/${challengeId}/scores`, creatorCookie, {
      method: "POST",
      body: JSON.stringify({ awardId: awardOverallId, submissionId, creatorId: CREATOR_A.id, criterion: "Hack", score: 999 }),
    })
    check("creator cannot post judging scores", r.status === 401 || r.status === 403, `status=${r.status}`)

    /* ═══ 12. Fraud quarantine blocks finalisation ═══ */
    console.log("11. Fraud/quarantine")
    r = await api(`/api/admin/creators/submissions/${submissionId}`, adminCookie, {
      method: "POST",
      body: JSON.stringify({ type: "flag", flagType: "SUSPICIOUS_ENGAGEMENT", severity: "HIGH", description: "QA flag" }),
    })
    check("HIGH flag raised", r.status === 200, JSON.stringify(r.body)?.slice(0, 120))
    const { body: flagRows } = await db(`creator_flags?submission_id=eq.${submissionId}&status=eq.OPEN&select=id,type,severity`)
    const flagId = flagRows?.[0]?.id
    check("flag persisted", !!flagId, JSON.stringify(flagRows))

    r = await api(`/api/admin/creators/challenges/${challengeId}/winners`, adminCookie, {
      method: "POST",
      body: JSON.stringify({ awardId: awardOverallId, winners: [{ creatorId: CREATOR_A.id, submissionId, position: 1 }], confirm: true }),
    })
    check("open HIGH flag blocks finalisation", r.status === 400, `status=${r.status} ${JSON.stringify(r.body)?.slice(0, 120)}`)

    r = await api(`/api/admin/creators/submissions/${submissionId}`, adminCookie, {
      method: "POST", body: JSON.stringify({ type: "resolve_flag", flagId, resolution: "DISMISSED", note: "QA false positive" }),
    })
    check("flag resolved", r.status === 200)

    /* ═══ 13. Winner-count enforcement + finalisation ═══ */
    console.log("12. Winners")
    r = await api(`/api/admin/creators/challenges/${challengeId}/winners`, adminCookie, {
      method: "POST",
      body: JSON.stringify({ awardId: awardOverallId, winners: [
        { creatorId: CREATOR_A.id, submissionId, position: 1 },
        { creatorId: creatorBId, position: 2 },
      ], confirm: true }),
    })
    check("exceeding winners_count rejected", r.status === 400, `status=${r.status} ${JSON.stringify(r.body)?.slice(0, 120)}`)

    r = await api(`/api/admin/creators/challenges/${challengeId}/winners`, adminCookie, {
      method: "POST",
      body: JSON.stringify({ awardId: awardOverallId, winners: [{ creatorId: CREATOR_A.id, submissionId, position: 1, notes: "QA winner" }], confirm: true }),
    })
    check("winner finalised + reward created", r.status === 200 && (r.body?.rewardIds?.length ?? 0) === 1, JSON.stringify(r.body)?.slice(0, 160))
    const { body: winRow } = await db(`creator_challenge_winners?challenge_id=eq.${challengeId}&select=creator_id,position,reward_id`)
    check("winner row persisted", winRow?.[0]?.creator_id === CREATOR_A.id && winRow?.[0]?.position === 1)
    const { body: reward } = await db(`creator_rewards?id=eq.${winRow?.[0]?.reward_id}&select=source,status,award_id,creator_id`)
    check("reward is PENDING CHALLENGE_AWARD", reward?.[0]?.source === "CHALLENGE_AWARD" && reward?.[0]?.status === "PENDING", JSON.stringify(reward))

    // RISING award — multiple winners allowed test via winners_count? it's 1; finalize it too
    r = await api(`/api/admin/creators/challenges/${challengeId}/winners`, adminCookie, {
      method: "POST",
      body: JSON.stringify({ awardId: awardRisingId, winners: [{ creatorId: CREATOR_A.id, position: 1 }], confirm: true }),
    })
    check("second award finalised", r.status === 200, JSON.stringify(r.body)?.slice(0, 120))

    /* ═══ 14. Communications ═══ */
    console.log("13. Communications")
    r = await api(`/api/admin/creators/challenges/${challengeId}/notify`, adminCookie, {
      method: "POST",
      body: JSON.stringify({ audience: "WINNERS", title: `${QA_TAG} winners announced`, body: "QA notification", sendEmail: false }),
    })
    check("challenge notification sent to winners", r.status === 200 && (r.body?.sent ?? 0) >= 1, JSON.stringify(r.body)?.slice(0, 160))

    /* ═══ 15. Completion + archive ═══ */
    console.log("14. Closeout")
    r = await api(`/api/admin/creators/challenges/${challengeId}`, adminCookie, { method: "POST", body: JSON.stringify({ action: "complete" }) })
    check("challenge completed", r.status === 200 && r.body?.status === "COMPLETED")
    r = await api(`/api/admin/creators/challenges/${challengeId}`, adminCookie, { method: "POST", body: JSON.stringify({ action: "archive" }) })
    check("challenge archived", r.status === 200 && r.body?.status === "ARCHIVED")

    /* ═══ 16. Security matrix ═══ */
    console.log("15. Security")
    r = await api("/api/creator/submissions", creatorBCookie)
    check("creator B sees none of A's submissions", r.status === 200 && (r.body?.submissions ?? []).every((s: any) => s.id !== submissionId))
    r = await api(`/api/creator/challenges/${challengeId}/join`, creatorBCookie, { method: "POST", body: JSON.stringify({ acceptTerms: true }) })
    check("archived challenge rejects joins", r.status === 404 || r.status === 400)
    r = await api(`/api/admin/creators/submissions/${submissionId}`, creatorBCookie)
    check("creator cannot use admin submission API", r.status === 401 || r.status === 403 || r.status === 302, `status=${r.status}`)
    r = await api(`/api/admin/creators/challenges/${challengeId}/winners`, creatorCookie, {
      method: "POST",
      body: JSON.stringify({ awardId: awardOverallId, winners: [{ creatorId: CREATOR_A.id, position: 1 }], confirm: true }),
    })
    check("creator cannot finalise winners", r.status === 401 || r.status === 403 || r.status === 302, `status=${r.status}`)

  } finally {
    /* ═══ Cleanup — QA rows only ═══ */
    console.log("\nCleanup")
    if (challengeId) {
      const { body: subs } = await db(`creator_submissions?challenge_id=eq.${challengeId}&select=id`)
      const subIds = (subs ?? []).map((s: any) => s.id)
      for (const sid of subIds) {
        await db(`creator_submission_metrics?submission_id=eq.${sid}`, { method: "DELETE" })
        await db(`creator_referrals?submission_id=eq.${sid}`, { method: "DELETE" })
        await db(`creator_flags?submission_id=eq.${sid}`, { method: "DELETE" })
      }
      await db(`creator_challenge_winners?challenge_id=eq.${challengeId}`, { method: "DELETE" })
      await db(`creator_award_scores?challenge_id=eq.${challengeId}`, { method: "DELETE" })
      await db(`creator_rewards?challenge_id=eq.${challengeId}`, { method: "DELETE" })
      await db(`creator_challenge_resources?challenge_id=eq.${challengeId}`, { method: "DELETE" })
      await db(`creator_challenge_briefs?challenge_id=eq.${challengeId}`, { method: "DELETE" })
      await db(`creator_challenge_rule_versions?challenge_id=eq.${challengeId}`, { method: "DELETE" })
      await db(`creator_submissions?challenge_id=eq.${challengeId}`, { method: "DELETE" })
      await db(`creator_challenge_participants?challenge_id=eq.${challengeId}`, { method: "DELETE" })
      await db(`creator_challenge_awards?challenge_id=eq.${challengeId}`, { method: "DELETE" })
      await db(`creator_flags?challenge_id=eq.${challengeId}`, { method: "DELETE" })
      await db(`creator_challenges?id=eq.${challengeId}`, { method: "DELETE" })
      console.log("  challenge + children removed")
    }
    if (creatorBId) {
      await db(`creators?id=eq.${creatorBId}`, { method: "DELETE" })
      await db(`creator_applications?email=eq.${QA_TAG.toLowerCase()}-b@test.invalid`, { method: "DELETE" })
      console.log("  QA creator B removed")
    }
    // QA lead + stray referrals
    await db(`creator_referrals?referral_code=eq.MP-00001&page_path=eq./&utm_campaign=eq.qa`, { method: "DELETE" })
    if (typeof qaLeadId !== "undefined") {
      await db(`creator_referrals?lead_id=eq.${qaLeadId}`, { method: "DELETE" })
      await db(`leads?id=eq.${qaLeadId}`, { method: "DELETE" })
      console.log("  QA lead removed")
    }
    await db(`creator_referrals?ip=like.10.${(t0 % 200) + 1}.*`, { method: "DELETE" })
  }

  console.log(`\n=== Result: ${pass} passed, ${fail} failed ===\n`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error("Suite crashed:", e); process.exit(1) })
