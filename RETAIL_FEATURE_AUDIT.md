# Retail Feature Audit

Scope: this repository is the **public website + admin/partner portal** codebase, not the POS product
runtime. Features are classified by what this repository evidences (marketing claims, admin modules,
API routes, settings) — "Live verified" requires functional evidence *here*; where the claim exists on
the site but the product implementation lives elsewhere, the feature is marked **implemented but
unverified** pending product-repo confirmation.

## Status definitions

- **Live verified** — functional evidence in this repo (route, admin module, API, schema).
- **Separate charge** — supported, but billed/charged separately per the pricing baseline.
- **Implemented, unverified** — claimed on the site; implementation not confirmable from this repo.
- **Planned** — announced as coming; not evidenced.
- **Absent** — no evidence found.

## Feature classification

| Feature | Status | Evidence in this repo | Entitlement / notes |
|---------|--------|------------------------|---------------------|
| POS (sales & checkout) | Implemented, unverified | Listed in plan inclusions (`lib/pricing-plans.ts`, settings features); receipt pages `app/receipts/[receiptNumber]` | Core licence inclusion |
| Inventory / stock control | Implemented, unverified | Plan inclusions; industry pages | Core licence inclusion; main-product/variation limits per plan |
| Expenses | Implemented, unverified | Mentioned on ERP page; finance modules exist in admin (`app/admin/(protected)/finance/*` are internal) | Verify it is a customer-facing Retail feature, not only ERP |
| Receipts | Implemented, unverified | `app/receipts/[receiptNumber]/page.tsx` public receipt view | Included; no plan-level cap per policy |
| Reports / daily report | Implemented, unverified | Plan inclusions ("Daily Reports"), admin reports | Included |
| Online Store | Implemented, unverified | Plan inclusions; `commercial_products` includes `mp-online-store` product rows | **Standard Online Store included** in every active Retail Cloud subscription — do not charge again; hosted store NOT included in Offline licence |
| WhatsApp ordering & invoices | Implemented, unverified | Plan inclusions; WhatsApp CTA infra (`lib/whatsapp*` env usage in `app/api/estimate/route.ts`) | Included; Meta/messaging provider costs are usage-based (metered, separately charged unless bundled) |
| QR menu ordering | Implemented, unverified | Plan inclusions | Included |
| Payment links | Implemented, unverified | Plan inclusions; Paystack/Flutterwave referenced in `data/faqs.json` | Included; gateway fees separate |
| PayPlan (installments) | Implemented, unverified | Plan inclusions; `components/sections/payplan-section.tsx` | Included |
| Loyalty & rewards | Implemented, unverified | Plan inclusions; `components/sections/loyalty-section.tsx` | Included |
| Gift cards / store credit | Implemented, unverified | `components/sections/loyalty-section.tsx`, `lib/industries.ts` copy | Verify availability per plan |
| Attendance (face capture) | Implemented, unverified | Plan inclusions; admin careers/performance pages | Included |
| AI assistant (MartPoint Assist / Intelligence) | Implemented, unverified | Plan inclusions; `/martpoint-intelligence` page; `app/api/admin/generate/route.ts` for admin content gen | Included as capability; AI usage is a metered/separate cost per policy |
| Serial / warranty records | Implemented, unverified | `app/industries/electronics-stores/page.tsx`, pricing page copy | Included |
| Variants (size/colour etc.) | Implemented, unverified | Industry pages; variations add-on in `ADDONS` | Included; product-variation limits per plan + ₦25,000/yr per 10,000 add-on |
| Kitchen tickets | Implemented, unverified | `app/industries/restaurants/page.tsx`, `fast-food` copy | Included for restaurant workflows |
| Laundry workflow | Implemented, unverified | `app/industries/laundry/page.tsx` | Included |
| Customer import/export | Implemented, unverified | "full exports" claim in why-martpoint FAQ | Included; verify export tooling in product |
| Bulk editing | Implemented, unverified | Industry/product copy | Verify |
| Payment reconciliation | Implemented, unverified | Industry pages (distributors, mini-marts) | Included; gateway fees separate |
| Advertising pixels / analytics | Implemented, unverified | `components/tracking-script.tsx` (site tracking); marketing modules in admin | For customer storefronts — verify |
| Abandoned-cart recovery | Planned / unverified | No evidence found in repo | Do not claim until verified |
| Shipping / pickup / tracking | Implemented, unverified | Quote page + contact copy | Verify scope |
| Customer segmentation / campaigns | Implemented (internal), unverified (customer-facing) | `app/admin/(protected)/marketing/*` (audiences, suppressions, builder) exist for MartPoint's own marketing | Whether customers get campaign tools needs product verification — do not claim |
| Reviews | Unverified | Only generic copy | Do not claim until verified |
| Bundles / add-ons (product) | Unverified | "bundle" appears in industry copy only | Verify |
| Order quantity controls | Unverified | No direct evidence | Verify |
| Coupon limits | Unverified | `lib/industries.ts` mentions coupons | Verify |

## Cost drivers noted for the commercial position

- Metered/third-party costs (payment gateway fees, SMS/WhatsApp messaging, paid email, verification
  lookups, AI usage, domain registration/renewal, custom design, integrations, hardware, onsite work,
  travel) are **separately charged unless expressly bundled** — stated on the pricing page.
- Add-on catalogue (annual, co-terminating): branch ₦50,000 · 5 users ₦25,000 · 500 products ₦15,000 ·
  10,000 variations ₦25,000 · 100 services ₦10,000 · Basic storage 2→5 GB ₦10,000 · extra 5 GB media
  ₦10,000 — all rendered on `/pricing` and used by the estimator.
- Implementation is separately scoped (Essential Remote ₦50,000 / Standard ₦150,000 / Premium
  ₦300,000 / Enterprise from ₦500,000; remote training ₦40,000/session; onsite ₦100,000/day) — these
  are internal scope-bound rates and are **not** published as a universal setup fee.

## Recommendation for owners

The website lists inclusions drawn from the approved plan matrix. Feature-level verification against
the product codebase is still required before marketing copy can be treated as fully verified —
particularly: abandoned-cart recovery, customer-facing campaigns, reviews, bundles, order quantity
controls, and coupon limits.
