# MartPoint Creator Challenge — Pilot 001 Launch Configuration

**Status:** Draft for review — NOT activated. Challenge may sit as SCHEDULED ("Coming soon") during recruitment.
**Activation gate:** Do not activate until ~20–30 approved Creator Ready creators exist.

Engine notes: implements via migration 070 tables + `lib/creator-challenges.ts`.
Policy knobs live in `creator_challenges.scoring_config` (see §Policy).

---

## 1. Identity

| Field | Value |
|---|---|
| name | `MartPoint Creator Challenge — Pilot` |
| slug | `creator-challenge-pilot-001` |
| theme | `Run Your Business Smarter with MartPoint` |
| description | Show Nigerian small businesses how MartPoint helps them run smarter — demonstrate, explain, dramatize or document a real business problem and how MartPoint addresses it. |
| objective | Drive qualified demo bookings from Nigerian small-business owners via creator content. |

Content does **not** require the creator to personally own a MartPoint-powered business — demonstration, explanation, dramatization and documentation formats are all acceptable.

## 2. Timeline (offsets from activation day T)

| Field | Offset | Notes |
|---|---|---|
| join_opens_at | T+0 | Announcement broadcast to eligible creators |
| join_closes_at | T+7 | 1-week join window — bounded cohort |
| start_date | T+0 | Content can be created on joining |
| submission_deadline | T+21 | 3-week submission window |
| performance_cutoff | T+28 | Last-submitted content still gets its window |
| announcement_date | T+31 | Judging + verification between cutoff and announcement |

## 3. Eligibility

| Field | Value |
|---|---|
| creator_ready_required | `true` |
| eligible_levels | `[]` (all levels) |
| eligible_states | `[]` (all Nigeria) |
| eligible_platforms | `["TIKTOK","INSTAGRAM","YOUTUBE"]` |
| min_submissions | `1` |
| max_submissions | `3` |

## 4. CTA & attribution

- `required_cta`: `Book a free MartPoint demo — link in bio`
- `required_hashtags`: `#MartPointChallenge`, `#SmallBusinessNG`
- `required_mentions`: `@martpoint`
- **Tracking link policy:** creators are NOT required to paste raw `?s=` URLs into captions. The MartPoint-issued tracking URL must be the clickable destination through an approved placement: bio / link-in-bio / story link / pinned comment where the platform permits.
- Conversion event = demo booking through the tracking link (DEMO referral event).
- Only **MartPoint-verified qualified** demo enquiries count toward Conversion Champion — raw form submissions are tracked but do not determine the winner.

## 5. Awards — ₦400,000 pool

| # (precedence) | Title | Type | Winners | Cash | Basis |
|---|---|---|---|---|---|
| 1 | Overall Creator | OVERALL | 1 | ₦150,000 | Judges 60% + verified performance 40% |
| 2 | Conversion Champion | CONVERSION | 1 | ₦100,000 | Most **qualified** demo enquiries via tracking link |
| 3 | Reach Champion | REACH | 1 | ₦75,000 | Verified views in the 7-day window |
| 4 | Creative Champion | CREATIVE | 1 | ₦50,000 | Judge scores only — no performance floor |
| 5 | Rising Creator | RISING | 1 | ₦25,000 | Performance vs creator's own baseline (see §7) |

`sort_order` = precedence for award stacking (§8).

## 6. Policy (`creator_challenges.scoring_config`)

```json
{
  "metricWindowDays": 7,
  "maxCashAwardsPerCreator": 1
}
```

- **Comparable measurement window:** performance awards rank each submission on the metric snapshot nearest to `published_at + 7 days`, bounded by `performance_cutoff` — never simple lifetime views at a common cutoff.
- **Award stacking:** max 1 cash award per creator. If a creator tops multiple cash-award rankings, the higher-precedence award stands and the next-ranked eligible candidate takes the other. Rankings are preserved in the computed candidate list for audit; the block message names the held award.

## 7. Rising Creator baseline

- Pilot 001 uses application-provided `followers` / `typical_views` (`creator_social_profiles`) as the baseline — internally flagged `baselineSource: APPLICATION_UNVERIFIED` in candidate data.
- Declared social profiles are review-locked: creator add/edit/removal requests queue in `creator_social_change_requests` and apply only after `creator.manage` approval (Admin / Digital Marketer), so baselines cannot silently change post-approval.
- Challenge performance is always measured/verified separately.
- Future challenges should switch the baseline to MartPoint historical creator performance once a track record exists.
- Suggested `scoring_config` on the RISING award: `{"minViews": 500, "minEngagement": 0, "engagementRateWeight": 100, "reachVsFollowingWeight": 10, "conversionsWeight": 2, "judgingWeight": 0.5}` — minimums prevent tiny-denominator wins.

## 8. Judging

- `judging_criteria`: Originality 30%, Clarity 30%, MartPoint relevance/accuracy 20%, Execution 20%
- Creative Champion scored by named admin judges via `creator_award_scores` (per-criterion, multi-judge preserved)
- OVERALL combines judge average + verified metrics per the award's `scoring_config`
- Final decisions: authorised admin (`creator.reward.manage`) — no automated winner selection

## 9. Fraud & integrity (defaults active)

- Duplicate URL rejected system-wide (normalised unique index)
- Not-joined, ineligible platform, malformed URL, outside window → rejected at submission
- Referral/click anomalies, self-referral spikes, evidence mismatch → flagged for review
- HIGH/CRITICAL open flags quarantine a submission from winner finalisation
- Content-availability check available per submission (admin action, HEAD request — no aggressive scraping)

## 10. Communications plan

| Trigger | Audience | Template |
|---|---|---|
| Challenge goes live (SCHEDULED→visible) | ELIGIBLE | Challenge Announcement (§13) |
| Activation | JOINED | "You're in" + brief link |
| T+10, T+18 | NO_SUBMISSION | Deadline reminder |
| Submission received | per-creator | Submission received |
| Review decision | per-creator | Submission decision |
| submission_deadline | JOINED | Submissions closed |
| start_judging | JOINED | Judging started |
| Winners finalised | WINNERS + JOINED | Winners announced |
| Recruitment period | public + applicants | Recruitment Announcement (§12) |

---

## 11. Challenge Brief (creator-facing copy — for review)

### Run Your Business Smarter with MartPoint

**What this is.** The first MartPoint Creator Challenge. Create content that shows a real Nigerian business problem — messy stock counts, lost sales, no idea which branch made money today — and how MartPoint fixes it. You don't need to own a MartPoint-powered business; you can demonstrate, explain, dramatize or document the problem and the fix.

**Who you're talking to.** Shop owners, supermarket and pharmacy operators, boutique owners, mini-mart managers, market traders going digital — people running real businesses on paper, WhatsApp and memory.

**The one message.** MartPoint helps you run your business smarter — sales, stock, staff and reports in one place.

**Content directions**
- Hook in the first 3 seconds with a real pain ("Oga counted stock till 11pm again")
- Show or describe the MartPoint fix — real UI, screenshots from the brief pack, or a dramatized scenario
- End every post with the CTA: **"Book a free MartPoint demo — link in bio"**

**Required in every post**
- `#MartPointChallenge` and `#SmallBusinessNG`
- Mention `@martpoint`
- Your tracking link as the clickable destination — bio, link-in-bio, story link, or pinned comment (platform permitting). You do not need to paste the raw link into the caption.

**Formats that work.** Skit/dramatization, screen recording walkthrough, "day in the life" of a shop owner, before/after, explainer carousel or short video. 30–90 seconds is plenty.

**Not allowed**
- Income or profit guarantees ("you'll double your money")
- Fake discounts, fake pricing, fake urgency
- Naming or mocking competitors
- Misleading claims about what MartPoint does

**How to submit.** Post publicly on TikTok, Instagram or YouTube → copy the post's public URL → submit it under this challenge in your Creator Portal. You can submit up to 3 posts (minimum 1 to be eligible for awards).

**How winners are decided.** Human judges score originality, clarity, accuracy and execution; verified performance (measured 7 days after your post goes live) decides reach and conversion awards. Joining never guarantees a reward.

**Timeline.** Join by [join close] · Submit by [submission deadline] · Winners announced [announcement date].

## 12. Terms & Conditions (creator-facing copy — for review)

1. The MartPoint Creator Challenge ("the Challenge") is open to approved MartPoint Creator Network members who have completed Creator Onboarding and are Creator Ready.
2. Joining the Challenge does not guarantee any payment, prize or reward. Publishing content does not guarantee a reward.
3. To participate, join before the join window closes and submit at least one (max three) original, publicly-posted content URL on an eligible platform before the submission deadline.
4. All content must comply with the brief, required hashtags/mentions/CTA, and prohibited-claims list. Submissions may be approved, sent back for correction, rejected or disqualified at MartPoint's review.
5. Your unique tracking link must be the clickable call-to-action destination (bio, link-in-bio, story link or permitted placement) on content you submit.
6. Performance is measured on the snapshot taken approximately 7 days after each post's publish date, bounded by the challenge performance cutoff. Metrics provided by the creator are unverified unless confirmed by MartPoint.
7. Awards are decided by MartPoint judges and verified data. A creator may win at most one cash award per challenge; where a creator tops multiple award rankings, the higher-precedence award applies.
8. Fraudulent activity — fake engagement, self-referrals, duplicate or deleted content, manipulated evidence — results in disqualification from the affected submission or challenge, at MartPoint's discretion.
9. Challenge rules are versioned. If material rules change after you join, you will be notified and the version you originally accepted remains recorded.
10. Rewards are processed after winner finalisation and shown under Earnings & Rewards in your portal. Payment timing follows the reward status shown there.
11. MartPoint may request proof that published content remains publicly available during the challenge period. Deleted or made-private posts may be disqualified.
12. By participating you grant MartPoint permission to reference, repost or reuse your submitted content in MartPoint marketing, with credit.

## 13. Recruitment Announcement (for review)

> **MartPoint is launching its first Creator Challenge — and we want you in the founding cohort.**
>
> We're picking 20–30 Nigerian creators to be the first to compete in a paid challenge: create content that shows how MartPoint helps small businesses run smarter, and win from a ₦400,000 prize pool.
>
> To qualify you need to be an approved MartPoint Creator and complete Creator Onboarding (our short Creator Academy). If you've applied already, finish onboarding now. Haven't applied? Apply today — applications are open.
>
> The challenge appears as "Coming soon" in your portal until the cohort is full. Don't wait — the first cohort sets the bar.

## 14. Challenge Announcement (sent to eligible creators at activation — for review)

> **The MartPoint Creator Challenge is live.**
>
> Theme: **Run Your Business Smarter with MartPoint.**
>
> Make content showing a real business problem — and how MartPoint fixes it. Demonstrate it, explain it, dramatize it, document it. Post on TikTok, Instagram or YouTube with your tracking link, and compete for ₦400,000 across five awards — including categories where smaller creators can genuinely win.
>
> Join the challenge in your portal to get the full brief, brand resources and your tracking link. Joining takes 30 seconds — and remember, everyone competes; the rules decide the winners.

---

## Admin runbook (do not activate until recruitment gate met)

1. `Admin → Creator Network → Challenges → New` — apply §1–§5 fields, §6 scoring_config
2. Save draft → upload/link brief-pack resources (logo pack, UI screenshots, brief PDF) → preview creator view
3. Set status SCHEDULED once recruitment begins (shows "Coming soon")
4. When ~20–30 Creator Ready creators exist → **Activate** (freezes rules v1, notifies eligible)
5. Run comms calendar per §10
6. At deadline: close submissions → start judging → enter scores → finalize winners (precedence order) → complete → archive
