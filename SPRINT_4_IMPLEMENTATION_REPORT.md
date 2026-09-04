# MARTPOINT SPRINT 4 IMPLEMENTATION REPORT

## 1. Summary

Sprint 4 turns the MartPoint Control Centre into the financial/commercial source of truth for customer billing, subscriptions, renewals, partner commissions and commercial entitlement management. This implementation preserves the existing `finance_transactions` internal bookkeeping system and builds a new, separate **Commercial Finance** module on top of it.

What is now in place:

- Complete database schema for products, plans, add-ons, quotes, invoices, payments, receipts, subscriptions, licences, renewals and partner commissions.
- Core service layer in `lib/finance-commercial.ts` handling money arithmetic in integer kobo, server-side recalculation, payment allocation, subscription activation/entitlement sync, commission evaluation and payout creation.
- Granular finance permission map in `lib/finance-permissions.ts`.
- Commercial finance overview API and admin page.
- Audit-log, notification and webhook-event types extended for finance.
- Existing public pricing migrated into `commercial_products`, `plans` and `addons` without changing advertised prices.

The following items are intentionally **scaffolded as data + service layers** but have not yet had every CRUD UI/API route completed due to the size of the sprint; see [Known limitations](#30-known-limitations) for the explicit, remaining work.

## 2. Existing Finance Audit

- **Existing tables**: `finance_transactions` and `finance_settings` were found in `supabase/migrations/003_complete.sql` and in active use by `lib/finance.ts` and `app/api/admin/finance/route.ts`.
- **Existing admin pages**: `/admin/finance` (investor metrics), `/admin/finance/transactions` (bookkeeping) and `/admin/finance/reports`.
- **Existing onboarding invoice**: `app/api/admin/onboarding/invoice/route.ts` writes a single `income` record to `finance_transactions` and sends an email. It is a point-of-sale record, not a formal invoice/payment/subscription system.
- **Pricing source**: public website pricing is in `data/settings.json` under the `pricing` key.

## 3. Database Migrations

**File**: `supabase/migrations/012_sprint4_finance.sql`

New tables and functions created:

- `commercial_products`, `plans`, `addons`
- `business_commercial_profiles`
- `quotes`, `quote_items`
- `invoices`, `invoice_items`, `invoice_number_counters` + `next_invoice_number()`
- `payments`, `payment_allocations`, `payment_reference_counters` + `next_payment_reference()`
- `receipts`, `receipt_number_counters` + `next_receipt_number()`
- `subscriptions`, `subscription_addons`
- `business_licenses`
- `subscription_renewals`
- `commission_plans`, `partner_commissions`
- `commission_payouts`, `commission_payout_items`, `commission_payout_reference_counters` + `next_commission_payout_reference()`
- `entitlement_change_log`, `finance_audit_events`

Existing `finance_transactions` was extended with `business_id`, `invoice_id`, `payment_id` and `commercial_reference` so that commercial events can be linked to internal accounting without replacing `finance_transactions`.

## 4. Commercial Product Model

`commercial_products` stores canonical products:

- `MARTPOINT_RETAIL`
- `MARTPOINT_ERP`
- `ONLINE_STORE`
- `IMPLEMENTATION`
- `TRAINING`
- `MARKETING`
- `OTHER`

Existing advertised pricing was migrated into this model, not silently changed.

## 5. Plans & Add-ons

`plans` now holds the public plans:

- `RETAIL_CLOUD` — ₦99,999 / year, 1 branch, 5 users, online store
- `RETAIL_OFFLINE` — ₦250,000 one-time, 1 branch, 5 users
- `ERP_GROWTH` — ₦85,000 / month, 1 branch, 5 users
- `ERP_SCALE` — ₦180,000 / month, 1 branch, 10 users
- `ERP_CORPORATE` — Custom (admin-quoted)

`addons` catalog created with default prices where known (additional branches) and custom/placeholder pricing for implementation, training, etc. All are admin-controlled.

## 6. Business Commercial Profile

`business_commercial_profiles` links a canonical `business_id` to billing contacts, tax ID, currency, payment terms and account status. A seed query creates a default profile for every existing business.

## 7. Quotes

`quotes` and `quote_items` schemas are in place with status workflow `DRAFT → SENT → ACCEPTED/DECLINED/EXPIRED → CONVERTED`. Numbering is handled by `next_quote_number()`. The service function `recalculateQuote()` validates server-side totals in kobo and prevents negative totals.

## 8. Invoices

`invoices` and `invoice_items` are created with `next_invoice_number()` producing e.g. `MPI-2026-00001`. `recalculateInvoice()` recomputes subtotal, discount, tax, total, amount paid, balance due and derives the correct status (`ISSUED`, `PARTIALLY_PAID`, `PAID`, `OVERDUE`, `VOID`, `CANCELLED`).

## 9. Payments

`payments` supports methods `BANK_TRANSFER`, `PAYSTACK`, `FLUTTERWAVE`, `CASH`, `POS`, `OTHER` and statuses including `PENDING`, `CONFIRMED`, `REVERSED`, `REFUNDED`. Only MartPoint Admin/system can confirm a payment (`confirmPayment()`). Partner cannot confirm.

## 10. Payment Allocation

`payment_allocations` enforces:

- total allocations ≤ confirmed payment amount
- allocation ≤ invoice outstanding balance
- no allocation to `VOID`/`CANCELLED` invoices
- one allocation row per `(payment_id, invoice_id)` via `UNIQUE`

`recalculateInvoice()` runs after every allocation.

## 11. Receipts

`receipts` are generated from confirmed payments with `next_receipt_number()`. `createReceipt()` issues a receipt and writes a `RECEIPT_ISSUED` audit event. No internal notes are exposed in the receipt record.

## 12. Subscriptions

`subscriptions` stores `price_at_activation` snapshot, status, interval, current period, renewal date and `auto_renew`. `activateSubscription()` flips a subscription to `ACTIVE`, creates/updates `business_licenses` and triggers entitlement sync. Price is captured at activation and is not altered by later plan changes.

## 13. Add-ons

`subscription_addons` links active add-ons to a subscription with `price_at_activation`, `quantity` and status. `syncEntitlementsFromSubscription()` aggregates branches, users and online-store flags from the base plan plus active add-ons and updates `business_entitlements`.

## 14. Business Licences

`business_licenses` stores the commercial licence record (`CLOUD`/`ERP`/`OFFLINE`/`CUSTOM`). It is operational tracking only — no infrastructure secrets or licence keys are stored. The `business_licenses_business_id_unique` constraint supports upsert from subscription activation.

## 15. Entitlement Sync

`entitlement_change_log` records:

- `business_id`
- `source_type`, `source_id`
- `previous_values` and `new_values` JSONB
- `reason` and `changed_by`

`syncEntitlementsFromSubscription()` updates `business_entitlements.max_users`, `max_branches`, `online_store_enabled` and `subscription_status`. Admin retains override authority by writing directly to `business_entitlements`.

## 16. Renewals

`subscription_renewals` is keyed `UNIQUE(subscription_id)` and supports status `UPCOMING`, `DUE`, `OVERDUE`, `RENEWED`, `NOT_RENEWING`. `refreshRenewalStatus()` derives the correct bucket from the subscription `renewal_date`. The `getFinanceOverview()` returns counts for 30-day and 7-day renewals.

## 17. Business Finance 360

The data layer for the business 360 finance tab is complete. Routes and UI are scaffolded in the service functions; the full per-business page was not built in this session. Available functions:

- `recalculateQuote`, `recalculateInvoice`, `recordPayment`, `confirmPayment`, `allocatePayment`, `createReceipt`, `activateSubscription`, `syncEntitlementsFromSubscription`, `evaluateCommissionsForPayment`, `getFinanceOverview`.

## 18. Admin Finance Changes

- `app/admin/(protected)/finance/page.tsx` now links to the new **Commercial Finance** page.
- New page: `app/admin/(protected)/finance/commercial/page.tsx` shows commercial KPIs and module navigation.
- New API: `app/api/admin/finance/commercial/route.ts` exposes `GET /api/admin/finance/commercial?action=overview` and `?action=products`.

## 19. Commission Plans

`commission_plans` supports percentage/fixed, applies-to filters, product/plan/addon targeting, effective dates, clawback, and commission trigger (`PAYMENT_CONFIRMED`, `SUBSCRIPTION_ACTIVATED`, `CUSTOMER_GO_LIVE`). A default `Retail Referral 10%` plan is seeded.

## 20. Partner Commissions

`partner_commissions` ties a commission to `partner_id`, `business_id`, `invoice_id`, `payment_id`, `subscription_id`, `commission_plan_id` and `attribution_type` (`ORIGINATING`, `SALES`, `IMPLEMENTATION`). `evaluateCommissionsForPayment()` creates an `ELIGIBLE` commission only after a payment is `CONFIRMED`, using the business's `originating_partner_id`. Partners cannot change amount or status.

## 21. Commission Payouts

`commission_payouts` and `commission_payout_items` prevent double payment via `UNIQUE(commission_id)`. `createCommissionPayout()` sums `APPROVED`/`SCHEDULED` commissions, creates a draft payout, schedules the commissions, and writes an audit event.

## 22. Partner Commission Portal

Data and permission model are in place. The `/partner/commissions` portal route was not built in this session (pending UI).

## 23. Payment Gateway Architecture

The `payments` table stores `payment_method`, `gateway_reference` and `status`. `confirmPayment()` is the only path to `CONFIRMED`. Manual bank transfer is fully supported. Paystack/Flutterwave adapters are a data-model placeholder; webhook signature verification and idempotency will be added when gateway credentials are provided.

## 24. Permissions

- `lib/finance-permissions.ts` defines granular actions: `finance:view`, `finance:quotes:create/approve`, `finance:invoices:create/issue/void`, `finance:payments:view/record/confirm/reverse`, `finance:subscriptions:view/manage`, `finance:renewals:manage`, `finance:commissions:view/approve/payout`, `finance:reports:view`.
- `Admin` has all. `Finance` has all except `finance:commissions:payout` (payout separation of duties). `Sales` has `finance:view` and `finance:quotes:create`.
- Existing `lib/admin-types.ts` page-level checks still protect routes; new granular map is available for fine-grained API gates.

## 25. Audit Logging

`finance_audit_events` table captures all finance audit events requested in Part AA (`QUOTE_CREATED`, `INVOICE_ISSUED`, `PAYMENT_CONFIRMED`, `SUBSCRIPTION_ACTIVATED`, `COMMISSION_PAID`, etc.). The generic `audit_logs` table remains for non-finance actions. `logFinanceAudit()` helper is in `lib/finance-commercial.ts`.

## 26. Notifications

`lib/notifications.ts` event union was extended with:

`QUOTE_SENT`, `INVOICE_ISSUED`, `PAYMENT_RECEIVED`, `RECEIPT_ISSUED`, `RENEWAL_REMINDER`, `COMMISSION_ELIGIBLE`, `COMMISSION_APPROVED`, `COMMISSION_PAID`, `OVERDUE_INVOICE`, `RENEWAL_APPROACHING`, `PAYMENT_AWAITING_CONFIRMATION`, `COMMISSION_APPROVAL_PENDING`.

Sending logic reuses the existing `sendEmail` wrapper.

## 27. Reports

The `getFinanceOverview()` service returns operational commercial metrics. The full dedicated report pages are not built, but the data is queryable through the new tables and the overview API.

## 28. Security Tests

Security model implemented at schema + service layer:

1. `finance` admin pages and `/api/admin/finance/*` require admin session.
2. Partner API does not have create/confirm payment or invoice routes.
3. `confirmPayment()` requires an admin/system actor.
4. Plan, entitlement and commission plan changes are admin-only.
5. `partner_commissions` cannot be modified by the partner; status flow is server-controlled.
6. `payment_allocations` prevents over-allocation.
7. Invoice totals are recomputed server-side in `recalculateInvoice()`.
8. Webhook idempotency is prepared via `gateway_reference` uniqueness and `PAYMENT_PENDING` guard.
9. `business_licenses` does not store infrastructure secrets.

Automated tests for the 25 security assertions in Part AF were not written in this session.

## 29. Regression Tests

- `npx tsc --noEmit` passes with no errors.
- Existing `finance_transactions`, `finance_settings` and `/api/admin/finance` were not deleted or modified functionally; they were extended.
- Existing Sprint 1–3 migrations (`001`–`011`) were not altered.

Full automated regression suite was not run.

## 30. Known Limitations

This is a foundation-first implementation. The following remain to be completed in follow-up work:

- Full CRUD API routes for quotes, invoices, payments, subscriptions, renewals, products, plans, add-ons and commission plans.
- Full CRUD admin UI pages for the above modules.
- `/partner/commissions` and partner customer finance visibility pages.
- `/admin/businesses/[businessId]` Finance tab.
- Printable receipt view.
- Paystack/Flutterwave webhook adapter with signature verification and idempotency.
- Automated security and regression tests covering the 25 assertions in Part AF.
- Commission attribution rules beyond originating partner (sales/implementation attribution).
- Payment gateway integration runtime wiring (no production API keys were created).
- Business rules for auto-cancellation and explicit overpayment handling.

## 31. Environment Variables

No new environment variables are required for the foundation. Existing variables continue:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `NEXT_PUBLIC_BASE_URL`

When Paystack/Flutterwave is integrated, the following will be added:

- `PAYSTACK_SECRET_KEY`
- `PAYSTACK_WEBHOOK_SECRET`
- `FLUTTERWAVE_SECRET_KEY`
- `FLUTTERWAVE_WEBHOOK_HASH`

## 32. Production Migration Instructions

1. Apply `supabase/migrations/012_sprint4_finance.sql` against the production Supabase project (or run through Supabase Dashboard SQL Editor). It is idempotent and additive.
2. Seed data will create default commercial products, plans, add-ons and a referral commission plan. Verify the prices in `plans` and `addons` match current public pricing before going live.
3. Existing `finance_transactions` continue to work; commercial transactions will reference them via the new nullable columns.
4. Re-deploy the Next.js application after the migration.

## 33. Route Evidence / Screenshots

New/updated routes and files:

- `supabase/migrations/012_sprint4_finance.sql`
- `lib/finance-commercial.ts`
- `lib/finance-permissions.ts`
- `lib/supabase.ts` (exposes `.rpc`)
- `lib/notifications.ts`
- `app/api/admin/finance/commercial/route.ts`
- `app/admin/(protected)/finance/commercial/page.tsx`
- `app/admin/(protected)/finance/page.tsx` (Commercial Finance link)
- `SPRINT_4_IMPLEMENTATION_REPORT.md`

TypeScript check:

```
npx tsc --noEmit
# Exited with code 0 and no output
```

---

**End of Sprint 4 report.**
