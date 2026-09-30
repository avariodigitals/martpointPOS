# Commercial Position — 30 September 2026

Baseline: *MartPoint Master Pricing & Commercial Policy / Pricing & Quotation Playbook v2.1,
effective 8 September 2026* (supplied in the Retail Pricing brief; signature fields blank —
**formal approval unverified**, flagged for owner confirmation).

## Retail Cloud — annual licences

| Plan | Annual licence | Branches | Users | Main products | Product variations | Online products | Services | Media | Storefronts | Custom domains |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Basic | ₦99,999 | 1 | 5 | 500 | 10,000 | 500 | 100 | 2 GB | 1 | 1 |
| Standard | ₦249,999 | 3 | 10 | 2,000 | 50,000 | 2,000 | 300 | 5 GB | 1 | 1 |
| Premium | ₦499,999 | 5 | 25 | 5,000 | 150,000 | 5,000 | 500 | 10 GB | 1 | 1 |
| Enterprise Retail | ₦999,999 | 10 | 50 | 10,000 | 500,000 | 20,000 | 1,000 | 20 GB | 1 | 1 |

> **Owner-directed correction:** storefront and custom-domain allowances are **1 on every plan**.
> Earlier drafts showing 2/3 on upper tiers were corrected in `lib/pricing-plans.ts`,
> `lib/estimate-calculator.ts` and the comparison matrix — no public surface may show more than 1.

- **Enterprise Retail is a Retail Cloud capacity tier — not MartPoint ERP.** Labelled as such on the
  pricing page and in the admin editor.
- Main products = active top-level catalogue items; variations = active sellable inventory records
  (incl. simple items). Domain allowance = connection capacity, not domain purchase/renewal.
- **Policy inconsistency (recorded, not corrected):** Enterprise Retail online products (20,000) exceed
  main products (10,000). Values preserved verbatim; counting semantics await owner verification.
- No plan-level caps for customers, suppliers, sales, orders, receipts or invoices — none published.

## Included in every active Retail Cloud subscription

Activation, store URL, initial administrator invitation, and Standard Online Store capability —
no separate charge. Core features per the plan inclusions (POS, inventory, WhatsApp ordering &
invoices, QR ordering, payment links, PayPlan, loyalty, customer verification, collections,
attendance, daily reports, AI assistant, mobile/desktop access).

## Annual add-ons (co-terminate with subscription)

| Add-on | Price |
|---|---:|
| Extra Cloud branch | ₦50,000/yr |
| Five named users | ₦25,000/yr |
| 500 main products | ₦15,000/yr |
| 10,000 product variations | ₦25,000/yr |
| 100 services | ₦10,000/yr |
| Basic storage upgrade (2 GB → 5 GB total) | ₦10,000/yr |
| Additional 5 GB media | ₦10,000/yr |

Quoting rule implemented in the estimator: lowest valid plan/add-on combination; if it reaches or
exceeds the next suitable plan's price, the higher plan is recommended. Mid-term upgrades charge the
price difference × remaining billing months ÷ 12 (stated in FAQ; sales-executed, not yet automated).

## MartPoint Retail Offline — separate one-time licence

> **Owner-directed change:** Offline is **removed from the public website entirely** — no card,
> no price, no product listing on `/pricing`, `/martpoint-retail`, FAQs, homepage, estimator or
> structured data. The figures below are the internal baseline, retained for quoting; they must
> not be published.

| Item | Internal terms (not published) |
|---|---|
| Licence | ₦250,000 **one-time** — 1 branch, 5 users, local installation |
| Included | First 12 months of eligible updates + standard remote support; works without internet |
| Extra branch | ₦100,000 **one-time** |
| Annual Care (from year two, **optional**) | ₦150,000/yr — continued updates + standard remote support |
| Without Annual Care | Licensed installation keeps working; updates/standard support not included |
| Hosted Online Store | Not included — requires Retail Cloud or separately quoted hosted arrangement |
| Hardware/network/onsite/travel | Assessed separately |

## Implementation (internal scope-bound rates — not a universal public fee)

Essential Remote ₦50,000 (Basic, ≤5 users, ≤20 sample products, 1×90-min session) ·
Standard Multi-branch ₦150,000 (≤3 branches/10 users, 2×2-hr sessions) ·
Premium Rollout ₦300,000 (≤5 branches/25 users, workshop + 3 sessions) ·
Enterprise Rollout from ₦500,000 (assessed) ·
Additional remote training ₦40,000/session · Onsite ₦100,000/day + travel.

These are quoted per scope and are **not** published on the site; the site states only that activation
is included and implementation is separately scoped/quoted.

## Separately charged (unless expressly bundled)

Payment gateway fees · SMS/WhatsApp messaging · paid email · verification lookups · AI usage ·
domain purchase/renewal · custom design · integrations · hardware · onsite work · travel.
Metered services have no included allowance unless an accepted offer specifies one.

## Billing position

- Retail Cloud: **annual** billing; downgrades at renewal, no mid-term credit.
- Retail Offline: **one-time** licence + optional Annual Care — **not listed on the public website
  at all** (owner decision); sold only through direct conversation.
- ERP: retained for existing customers/direct enquiries; **no public ERP pricing anywhere**, including
  the estimator — visitors who flag ERP interest get a "Custom quote" leg and a consultation.
  Retail remains the sole priced sales journey.
- Tax treatment: not asserted on the site — no approved tax configuration was found; display only what
  approved configuration confirms.

## Awaiting owner approval / verification

1. Signed policy version (v2.1 signature fields were blank).
2. Enterprise Retail online-vs-main product counting semantics.
3. Migration of the internal commercial catalogue (migration 022 legacy monthly plans) to baseline.
4. Entitlement mapping for the four public plan IDs.
5. Confirmation that live Supabase `settings` row has been saved with the corrected values.
6. Roadmap items shown as "Coming soon" on the comparison matrix (Merchant API, international
   currencies) — confirm public roadmap wording is acceptable.
