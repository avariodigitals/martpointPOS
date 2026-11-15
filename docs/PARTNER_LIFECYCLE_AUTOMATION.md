# Partner lifecycle automation

This implementation extends the existing Next.js partner portal, Supabase schema, partner authentication, lead pipeline, admin permissions, email sender and scheduled job system. It does not create a second application or change commission rows.

## Rollout defaults

Migration `193_partner_lifecycle_automation.sql` creates versioned policy/lifecycle records, verified activity, evaluation history, notice outbox, review cases, overrides, and rollout settings. Existing partner accounts and commissions are left in place. Existing active public listings are backfilled as published; their transition clock remains unset until policy acceptance or a later valid effective date. New partner registrations receive a hidden listing and no lifecycle clock.

The settings row starts with `feature_enabled=false`, `dry_run=true`, `auto_suspension_enabled=false`, and `auto_reinstate_enabled=false`. Keep these defaults during Phase 1. Dry-run records explainable `partner_evaluations` but makes no lifecycle/status changes and sends no notices.

## Evaluation behavior

- Probation is 90 calendar days, starting no earlier than both accepted/effective policy date and admin onboarding approval. Onboarding approval checks active partner standing, clear compliance, required verified documents, and an executed agreement for referral partners.
- The first verified qualifying activity is the initial threshold. `partner_policy_versions.config_json` stores the configurable threshold and lifecycle day values.
- Reminder stages are day 30, 60, and 75; day 90 below threshold creates a human review case. It does not close an account.
- Rolling inactivity uses verified activity records and the policy transition date. Logins do not count.
- At day 90 inactive, the notice must be delivered before the listing enters `pending_suspension`. The directory remains visible through the 10-business-day response window. A failed notice stays in the outbox and blocks that transition.
- An open case, appeal response, extension, or hold blocks directory suspension. When authorized auto-suspension is enabled, only `partner_lifecycle.listing_status` and `partners.public_profile_enabled` change. `partners.status`, partner access, and accrued commissions remain intact.
- Directory reads require active partner status, enabled lifecycle account, no confirmed violation, and lifecycle listing `published` or `pending_suspension` at both the public query and RLS policy. Opening a compliance review alone does not hide the profile; a documented admin listing restriction or confirmed violation does. A suspended listing is filtered server-side.
- Qualified-lead activities must reference the partner's own protected CRM pipeline record, meet a qualifying pipeline stage, and record a lawful-basis confirmation. Reused source keys, duplicate partner lead contacts, or an existing MartPoint CRM email/phone match are rejected. All submitted activities remain pending until an admin verifies them.
- Compliance review cases are neutral review requests. Only an authorized admin can confirm a violation; competing software representation is not classified as misconduct by automation.

## Deployment checklist

1. Review the immutable policy text and legal effective date with counsel. The seeded version is `2026-01`; create a new `partner_policy_versions` row for future changes instead of editing a version already accepted.
2. Back up the database and apply Supabase migration `193_partner_lifecycle_automation.sql` through the normal migration process. Do not apply against production without the required deployment approval.
3. Confirm the trigger creates a hidden lifecycle row for a newly registered partner and that pre-existing public listings retained their listing state with `transition_start_at IS NULL`.
4. Deploy application code and ensure `CRON_SECRET` is configured. Vercel runs `/api/cron/partner-lifecycle` at 23:00 UTC (00:00 Africa/Lagos). The cron endpoint requires a bearer secret in production.
5. Review `/admin/partners/lifecycle`; keep lifecycle disabled/dry-run, inspect sample evaluations and confirm notice delivery in a non-production environment.
6. Publish the partner policy acceptance workflow and allow affected partners to accept. Do not backdate transition clocks.
7. After legal/contract review and delivery testing, an authorized partner manager can enable evaluation and turn off dry-run to begin notices. Automatic directory suspension is a separate switch and remains off until explicitly approved. No production migration or deployment is performed by this change.
8. Populate `partner_business_holidays` with the configured Nigerian public holiday dates each year. Stored notice deadlines do not change if that calendar is later edited.

## Operations and recovery

- Failed notice deliveries retry on the daily sweep. After five failed attempts, the notice is marked `permanent_failure`; the admin lifecycle screen displays it and provides a reasoned retry action.
- Use the partner lifecycle admin screen to verify/reject activities, approve onboarding, extend probation, place a hold, open/resolve a review case, change directory listing status, inspect decisions/notices and export a CSV audit.
- If evaluation results are unexpected, turn off `feature_enabled` first. To stop enforcement without losing audit data, set `dry_run=true` and `auto_suspension_enabled=false`; existing notices/evaluations remain available.
- Code rollback can remove the cron route and UI while leaving the additive tables intact. Do not drop lifecycle tables after partners have accepted the policy or cases/decisions have been recorded. A schema rollback requires a reviewed, backed-up data export and is intentionally not an automatic destructive migration. The registration trigger can be disabled with `DROP TRIGGER trg_partner_lifecycle_registration ON partners`; restore the prior directory flag behavior only after confirming account/listing data.

## Verification

- `npx vitest run --config vitest.config.ts __tests__/partner-lifecycle-policy.test.ts __tests__/partner-lifecycle-schema.test.ts` — 15 focused policy and schema safeguard tests passed for acceptance/effective dates, prerequisites, probation milestones, configurable thresholds, extensions, rolling inactivity, notice windows, appeal/hold blocks, business days/holidays, reinstatement, registration defaults, data preservation, public access controls, and idempotency keys.
- `npx tsc --noEmit --pretty false` currently reports pre-existing errors in `admin-navigation.test.ts`, `africa-recording-consent.test.ts`, and `lead-email-sender.test.ts`; no lifecycle files were reported in that run.
- `npm run check:migrations` could not run because `tsx` is not installed locally and the offline environment could not fetch it from npm. No database migration was applied.
- Production deployment, database migration, and automatic suspension have not been run.
