# Pricing Reconciliation

Audit of every surface that displays, stores or computes commercial values, reconciled against the
supplied baseline: *MartPoint Master Pricing & Commercial Policy / Pricing & Quotation Playbook v2.1,
effective 8 September 2026* (as embedded in the Retail Pricing brief).

**Approval status of the baseline:** the supplied policy copy has blank signature fields. The values
below were implemented as the reconciliation baseline because they were supplied as the approved
matrix in the brief; formal sign-off remains **unverified** and is listed as an unresolved item.

## Legend

- **Observed** — what the surface showed/stored before this change.
- **Now** — what it shows after this change.
- **Source** — where the value lives.

## Surfaces

| # | Surface | Observed | Now | Correction | Unresolved |
|---|---------|----------|-----|------------|------------|
| 1 | `lib/pricing-plans.ts` (new canonical module) | Did not exist | Four annual Retail Cloud tiers (Basic ₦99,999 / Standard ₦249,999 / Premium ₦499,999 / Enterprise Retail ₦999,999) with full capacity limits, add-on catalogue, Offline terms | Created as the single retail baseline; `resolveCloudPlans()` merges admin display overrides | Baseline sign-off unverified; Enterprise Retail online-products (20,000) exceeds main-products (10,000) in supplied policy — preserved verbatim, counting semantics flagged for owner verification |
| 2 | `data/settings.json` (seed) | `cloud.branchAddonPrice` ₦49,999/yr; offline `period` empty + "annual maintenance and license renewal applicable"; `supportRenewal` ₦50,000/yr; offline `branchAddonPrice` ₦100,000 (period unstated); SEO positioned Retail+ERP equally | `branchAddonPrice` ₦50,000/yr; offline `period` "one-time", description corrected to one-time licence + first-12-months updates/support; `supportRenewal` ₦150,000/yr (Annual Care); `branchAddonPrice` "₦100,000 one-time"; new `cloudPlans` array (4 tiers); retail-first SEO defaults | Seed defaults corrected to baseline | **Seed ≠ live**: Supabase `settings` row 1 is authoritative; the live row must be updated through the admin Settings save path (or re-seed) before production reflects it |
| 3 | `app/api/admin/settings/route.ts` (GET defaults) | Same stale defaults as seed | Same corrections as seed | Aligned fallback defaults | Same live-DB caveat |
| 4 | `app/pricing/page.tsx` | One Cloud card (₦99,999), one Offline card, three ERP cards (₦85,000/mo, ₦180,000/mo, Custom) loaded from `settings.erp` | Four annual Cloud cards + capacity comparison table + add-on table + Offline card with corrected licence/care terms + activation-vs-implementation copy + FAQs. No ERP content | Rewritten to the baseline matrix; ERP pricing removed from the page entirely | Live settings override display fields only; capacity limits are code-fixed baseline |
| 5 | `lib/estimate-calculator.ts` + `components/estimate/estimate-calculator.tsx` | Returned two recommendation legs (Retail + ERP) and asked an ERP-modules question | Retail-only result; lowest-valid-plan + add-on pricing per policy (`quotePlan`/`lowestCostPlan`); ERP question removed (`erpModules` retained as optional legacy field for stored leads) | Estimator aligned to baseline pricing and the "lowest valid plan/add-on" rule | Mid-term proration math (price difference × remaining months ÷ 12) is described in FAQs but not yet computed in the estimator — quotes still done by sales |
| 6 | `app/api/estimate/route.ts` | Sent Retail+ERP legs to CRM/email | Sends retail leg only (`retail_plan`, `retail_tier` custom fields) | Aligned | — |
| 7 | `lib/email-templates.ts` (`estimate_submission`) | Template listed both Retail and ERP recommendations | Retail recommendation only | Aligned | Admin-editable template copy in live DB may still contain old placeholders until saved |
| 8 | `components/admin/lead-detail-modal.tsx` | Rendered `estimate.erp` leg for all estimates | Renders `estimate.erp` only when present on the stored lead (historical data preserved) | New estimates are retail-only; old leads unchanged | — |
| 9 | `components/exit-intent-popup.tsx` | "Fee Covers" list included "Training" | "Training" replaced with "Activation" | Training is a separately scoped charge; activation is included | Live `popup` settings in DB can override title/price text — admin must keep them consistent |
| 10 | `data/faqs.json` | Cost answer quoted single ₦99,999 plan + "licence and setup" + recurring renewal wording for Offline; industries answer promoted ERP | Four-plan annual answer; Offline described as one-time licence + optional Annual Care; ERP sentence removed | Aligned to baseline | — |
| 11 | `app/martpoint-retail/page.tsx` | Same stale fallbacks (₦49,999 branch add-on, recurring-maintenance wording, "Training & Onboarding") | Fallbacks corrected; support-renewal line now shows optional Annual Care ₦150,000/yr | Aligned | Live `settings.pricing` row still overrides until admin save |
| 12 | `app/admin/(protected)/settings/page.tsx` | Editable: cloud, offline, 3 ERP plans | Added per-tier `cloudPlans` editor (name/badge/price/description/CTA); ERP section relabelled "internal — not shown on the public pricing page"; capacity limits not admin-editable | Admin can still maintain ERP plan config for internal use without affecting the public page | — |
| 13 | Internal quote/invoice catalogue — `supabase/migrations/022_commercial_catalog.sql` (`plans` table) | Seeds Retail Starter ₦15,000/**month**, Retail Growth ₦35,000/**month**, Retail Enterprise ₦300,000/yr, ERP Starter ₦45,000/mo, ERP Professional ₦85,000/mo, ERP Enterprise ₦750,000/yr, Online Store ₦12,000/₦28,000/mo, Implementation ₦75,000, Training ₦35,000, Support ₦10,000–₦25,000/mo | **Unchanged** | None — deliberately untouched: catalogue rows feed quotes/invoices; rewriting them would alter contract snapshots | **Major discrepancy requiring owner decision**: catalogue plan codes, billing intervals (monthly vs annual) and prices do not match the v2.1 baseline. The admin quote engine can still issue quotes at old rates until the catalogue is migrated via the authorised release path |
| 14 | Entitlement service — `app/api/admin/businesses/[businessId]/entitlements/route.ts` | Per-business entitlement records (independent of public plan display) | Unchanged | None — existing entitlements preserved | Mapping of the four public plan IDs to entitlement records is **unverified** — needs owner confirmation that entitlements follow the baseline capacity limits |
| 15 | `/api/settings` public endpoint | Exposes `popup` and public fields | Unchanged | None | Verify the live `popup.priceText`/`priceSubtext` values in DB after settings release |

## Corrections applied (summary)

- Cloud branch add-on: ₦49,999 → **₦50,000/year** (seed, admin defaults, retail page fallback).
- Offline licence: ₦250,000 now presented as **one-time**; "annual maintenance and license renewal"
  wording replaced with **first-12-months updates + standard remote support included**.
- Offline extra branch: **₦100,000 one-time** (was presented as recurring).
- Offline renewal: mandatory-sounding ₦50,000/yr → **optional Annual Care ₦150,000/year from year two**.
- ERP pricing cards (₦85,000/mo, ₦180,000/mo, Custom) **removed from the public pricing page**; ERP
  plan records retained in settings/admin for internal use.
- Public pricing page now shows all four annual Retail Cloud tiers + capacity comparison + add-ons.

## Items deliberately NOT changed

- `plans`/`commercial_products` rows in migration 022 and any live catalogue records.
- Existing leads, contracts, invoices, entitlements, subscriptions — untouched.
- ERP settings block (`pricing.erp`) — retained for internal/back-office use.
- ERP landing pages and ERP industry pages — retained and indexable (see `ERP_VISIBILITY_AUDIT.md`).

## Unresolved / awaiting approval

1. **Policy sign-off** — supplied copy has blank signature fields; confirm a signed v2.1 (or newer) exists.
2. **Live settings row** — the Supabase `settings` row must be saved via Admin → Settings for production
   to pick up `cloudPlans`, corrected offline terms and SEO text. Code fallbacks are already correct.
3. **Commercial catalogue mismatch** — migration 022 catalogue uses monthly/legacy pricing that conflicts
   with the annual baseline; needs an owner-approved catalogue migration, not a silent edit.
4. **Enterprise Retail online-products limit (20,000) > main-products limit (10,000)** — internal
   inconsistency in the supplied matrix; displayed verbatim pending counting-semantics verification.
5. **Entitlement mapping** — four public plan IDs need verified mapping to the entitlement service.
6. **Tax treatment** — brief requires displaying actual applicable tax treatment; no tax configuration
   was found in public settings — not asserted anywhere on the site.
