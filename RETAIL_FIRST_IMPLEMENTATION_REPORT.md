# Retail-First Implementation — Final Report

Date: 30 September 2026 · Scope: MartPoint public website + connected commercial flows (this repo) ·
Baseline: Pricing & Quotation Playbook v2.1 (supplied; sign-off unverified).

## What changed

### Retail-first positioning
- **Navigation & footer** (`lib/navigation.ts`): ERP removed from Solutions menu and footer links.
- **Homepage** (`app/page.tsx`, `app/layout.tsx`, `components/sections/product-split.tsx`,
  `components/structured-data.tsx`): Retail-first metadata; product split is now Retail Cloud +
  a four-plan pricing teaser card linking to `/pricing` (the Offline card was removed per owner
  direction; headline rephrased from "Two ways to run it" to a Retail-first message); structured
  data no longer exposes ERP entries.
- **Industries index** (`app/industries/page.tsx`): ERP-targeted industries excluded from the
  nav-linked listing (pages remain live, indexable, direct-URL accessible).
- **Copy sweeps**: `why-martpoint` (growth path rewritten to Retail plan tiers), `about`, `faqs`,
  `contact`, `help-centre`, `customer-stories`, `product-updates` metadata, `data/faqs.json`,
  exit-intent popup ("Training" → "Activation").

### Pricing
- **`lib/pricing-plans.ts` (new)**: canonical Retail Cloud matrix (Basic ₦99,999 / Standard ₦249,999 /
  Premium ₦499,999 / Enterprise Retail ₦999,999), capacity limits, add-on catalogue, Offline terms,
  `resolveCloudPlans()` settings-merge helper.
- **`app/pricing/page.tsx`**: rewritten — four annual Cloud cards, grouped feature-matrix
  comparison (Capacity / Sell everywhere / Payment methods / Grow your store / Integrations,
  with Merchant API + international currencies marked "Coming soon"), icon-led "Every plan
  includes" grid, add-on table, quote-only Offline card (no public price — owner direction),
  activation-vs-implementation copy, pricing FAQs, industry workflow links. **No ERP cards.**
- **`data/settings.json` + admin defaults** (`app/api/admin/settings/route.ts`): corrected seed
  values (`cloudPlans` array, ₦50,000 branch add-on, Offline one-time terms, ₦150,000 Annual Care,
  retail-first SEO defaults).
- **Admin settings** (`app/admin/(protected)/settings/page.tsx`): per-tier Cloud plan editor;
  capacity limits fixed to baseline; ERP editor retained and labelled internal-only.

### Estimator & forms
- **`lib/estimate-calculator.ts`**: Retail recommendation uses lowest-valid plan/add-on cost
  (`quotePlan`, `lowestCostPlan`). An "ERP interest" question adds a quote-only MartPoint ERP
  leg ("Custom quote" — no figure ever shown); offline operation returns a quote-only Retail
  Offline result (owner direction: no public Offline price). Legacy `erpModules` field retained.
- **`components/estimate/estimate-calculator.tsx`**, **`app/api/estimate/route.ts`**,
  **`lib/email-templates.ts`**, **`components/admin/lead-detail-modal.tsx`**: retail-only
  recommendation end-to-end; historical `estimate.erp` data still rendered when present.
- **`/request-quote`, `/book-demo`**: ERP product option gated behind `?product=erp`; ERP landing
  pages link with that param so direct ERP enquiries keep working.

## Systems actually inspected

- Next.js 16.2.9 app (App Router, Turbopack build).
- Settings pipeline: `data/settings.json` (seed) → `scripts/seed-*.ts` → Supabase `settings` row 1 →
  `lib/settings.ts` (`unstable_cache`, tag `settings`) → admin save via `app/api/admin/settings`.
- Estimator stack (UI + engine + API + email + lead storage + CRM forwarding).
- Lead/demo forms (`lead-form.tsx`, `demo-booking.tsx`) and `/api/leads`.
- Internal commercial catalogue (`supabase/migrations/022_commercial_catalog.sql`), entitlement
  route, finance/admin modules — inspected, **not modified**.
- `sitemap.ts`, `robots.ts`, structured-data components.

## Checks passed

| Check | Result |
|---|---|
| `npx tsc --noEmit` | Clean |
| `next build` (Turbopack) | Pass — all routes compile; ERP pages static & indexable |
| `npm run test:finance` (Vitest) | 12 files, 134 tests — all pass |
| `eslint` on changed files | Clean (repo-wide lint has ~1,040 pre-existing errors unrelated to this change) |
| ERP routes HTTP | `/martpoint-erp`, 4 ERP industry pages → 200 on `next start` |
| Indexability | `index, follow` on `/martpoint-erp`; sitemap includes all ERP URLs; robots allows |
| Form gating | ERP option absent on `/request-quote`, `/book-demo`; present with `?product=erp` |
| Homepage | Zero ERP links/mentions in rendered HTML |
| Pricing page | Four tier prices + feature matrix + add-ons render; Offline quote-only; no ERP prices |

## Approval-dependent / unresolved items

1. **Policy signature** — the supplied v2.1 copy has blank signature fields; confirm a signed version.
2. **Live settings release** — production Supabase `settings` row must be saved via Admin → Settings
   (or re-seeded); code fallbacks are correct but live data overrides display fields.
3. **Commercial catalogue** — migration 022 legacy monthly plans conflict with the annual baseline;
   needs an owner-approved catalogue migration (not done — snapshots preserved).
4. **Enterprise Retail limit inconsistency** — 20,000 online vs 10,000 main products, preserved verbatim.
5. **Entitlement mapping** — verify plan IDs map to entitlement records.
6. **Production smoke test** — re-run the ERP visibility HTTP checks post-deploy.

## Release status

Ready for review. Not yet merged/deployed. Live settings update and catalogue migration are
deliberately pending the authorised release path and owner decisions above.
