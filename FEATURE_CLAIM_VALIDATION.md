# Feature Claim Validation — `/features` page

Date: 30 September 2026 · Source list: *MartPoint Retail — Complete Feature List (v4.0.9)* (supplied) ·
Page: `app/features/page.tsx`

## Method and caveats

This repository contains the **public website + admin/partner portal**. The Retail POS product
runtime (martpointretailapp) is a separate codebase, so validation here combines:

- **Repo** — functional evidence in this repository (routes, APIs, schema, admin modules).
- **Product UI** — genuine v4.0.9 application screens shipped in `public/` (`retail-dash.webp`,
  `retail-dashboard.webp`, `loginUI.webp`) showing menus/indicators in the running product.
- **Approved copy** — the public pricing baseline (`lib/pricing-plans.ts`), plan comparison matrix,
  FAQ content and help-centre articles already published for the product.

Where a claim could not be confirmed by any of these, it was **omitted from the public page** and
flagged below for product-repo verification before it is advertised.

Statuses: **Published — verified** · **Published — flagged** (advertised; needs product-repo flow
check) · **Omitted — flagged** (kept off the public page pending confirmation).

## Sell faster at the counter

| Capability | Status | Restrictions / notes | Evidence |
|---|---|---|---|
| Touch-friendly POS | Published — verified | Works on desktop, tablet and phone browsers | Plan inclusion "POS Sales & Checkout" + "Mobile & Desktop Access" (`lib/pricing-plans.ts`); POS button in `loginUI.webp`, `retail-dash.webp` |
| Barcode scanning | Published — verified | Works with standard USB scanners | `/industries/mini-marts` + `/industries/supermarkets` FAQs; `app/onboarding/[id]` hardware list; "Quick scan" action in `loginUI.webp` |
| Product search | Published — verified | — | `/industries/supermarkets` FAQ ("search instantly at checkout"); cosmetics "quick search by brand, product and shade" (`lib/industries.ts`) |
| Split payments | Published — verified | — | Help-centre topic "Split payments and partial payments" (`app/help-centre/page.tsx`); restaurant/beauty industry pages |
| Held sales | **Omitted — flagged** | No evidence of a hold/park-sale flow in repo or screenshots | No match in code or published copy; needs product-repo confirmation |
| Receipts (print & digital) | Published — verified | — | Help-centre "Printing and sending receipts"; industry workflow copy ("receipt prints instantly"). NOTE: `app/receipts/[receiptNumber]` is MartPoint's own invoice-receipt view, not the POS receipt |
| Returns & refunds | Published — verified | — | Help-centre "Handling returns and refunds" (`app/help-centre/page.tsx`) |
| Cashier shifts | Published — verified | — | "Clock In" + "Attendance" in product screenshots; Product Updates April 2026 "shift tracking linked to sales performance"; supermarket cashier-reconciliation copy |
| Offline selling & sync | Published — flagged | Online-dependent features (storefront orders, online payments, WhatsApp) pause until reconnected | Approved copy across FAQs/industries/`why-martpoint`; "Online" status + "Sync" button visible in `retail-dash.webp`. **Flag:** full offline→sync user flow needs product-repo confirmation |
| Discounts auto-applied | Published — verified | Where promotions are configured | `/industries/fashion-stores` FAQ ("discounts… applied automatically at checkout") |

## Know what is in stock

| Capability | Status | Restrictions / notes | Evidence |
|---|---|---|---|
| Live stock levels | Published — verified | — | "Inventory"/"Stock" menus in both product screenshots; plan inclusion |
| Low-stock alerts | Published — verified | — | "Low Stock Items" + "Low Stock Alert" cards in `retail-dashboard.webp`; help-centre "Setting low-stock alerts" |
| Stock transfers (inter-branch) | Published — verified | Requires multi-branch capacity | Product Updates April 2026 "Multi-Branch Stock Transfer"; help-centre article; `lib/industries.ts` multi-branch entry |
| Batch & expiry tracking | Published — verified | — | "Expiry Alerts" card in `retail-dashboard.webp`; help-centre "Tracking batch numbers and expiry dates"; pharmacy industry page |
| Serial numbers & warranties | Published — verified | — | `/industries/electronics-stores` (IMEI/serial registration, warranty lookup) |
| Variants (size/colour etc.) | Published — verified | Variation limits per plan; 10,000-variation add-on ₦25,000/yr | `/industries/fashion-stores`; plan limits `lib/pricing-plans.ts`; variants meter in `loginUI.webp` |
| Stock counts & adjustments | Published — verified | — | Help-centre "Physical stock count procedures" |
| Stock by location | Published — verified | — | `/industries/electronics-stores` showroom-vs-warehouse copy |
| Barcode label printing | **Omitted — flagged** | Scanning verified; label *printing* not evidenced | No label-generation evidence in repo or screenshots |
| Sales-to-stock reconciliation | Published — verified | — | `lib/industries.ts` supermarkets capabilities |

## Manage products and purchasing

| Capability | Status | Restrictions / notes | Evidence |
|---|---|---|---|
| Products & services together | Published — verified | Service limits per plan (100–1,000) | Plan limits (`services` in `lib/pricing-plans.ts`); martpoint-retail "products and services together" |
| Categories & brands | Published — verified | — | Help-centre "Adding products and categories"; electronics page profit-by-brand copy |
| Selling units (piece/carton/weight) | Published — verified | — | `lib/industries.ts` frozen-foods "carton-to-unit breakdown"; grocery weighing-scale FAQ |
| Bulk import & editing | Published — verified | Catalogue accuracy is the customer's responsibility | Comparison matrix "Customer import/export & bulk editing"; supermarket FAQ "import SKUs in bulk" |
| Purchase orders | Published — verified | — | "Purchases"/"Purchase" menu + "Purchase Stock" action in product screenshots; supermarket FAQ |
| Supplier delivery tracking | Published — verified | — | Supermarket FAQ "track supplier deliveries"; `lib/industries.ts` grocery "Supplier Reorder" |
| Partial receiving | **Omitted — flagged** | Delivery tracking evidenced; partial-quantity receiving not confirmed | Only ERP/distributors GRN copy; retail flow unverified |
| Supplier balances | **Omitted — flagged** | "Record supplier payments" (expense-side) evidenced; running supplier balances unverified | Mini-marts FAQ records supplier payments as expenses; no supplier-ledger evidence |
| Purchase returns | **Omitted — flagged** | Not evidenced | No match in repo or screenshots |
| Central price editing | Published — verified | — | `/industries/fashion-stores` "unified pricing & promotions"; multi-branch copy |

## Stay on top of customer payments

| Capability | Status | Restrictions / notes | Evidence |
|---|---|---|---|
| Customer profiles & history | Published — verified | — | "Customers"/"Contacts" menus in screenshots; beauty/cosmetics client-profile copy |
| Customer notes | Published — flagged | Folded into "profiles" wording only | Order notes/modifiers evidenced; dedicated customer-note field unverified |
| Deposits & installments (PayPlan) | Published — verified | — | `components/sections/payplan-section.tsx`; plan inclusion; PayPlan dashboard in Product Updates |
| Debt tracking / receivables | Published — verified | — | "Outstanding Debts — 2 Customers Owing ₦197,815.26" card in `retail-dash.webp`; plan inclusion "Collections Tracking" |
| Payment reminders | Published — flagged | SMS/WhatsApp messaging billed separately unless bundled | Help-centre "PayPlan reminders and collections"; laundry/cake-shops automatic-reminder copy. **Flag:** confirm reminder automation covers general debt, not only PayPlan/industry flows |
| Quotations | Published — verified | — | "Quotation" menu in `retail-dashboard.webp` product sidebar |
| Customer account statements | **Omitted — flagged** | Not evidenced for retail customers | `lib/finance-ledger.ts` statements are internal GL — not a customer feature |
| Credit limits | Published — verified | — | `app/martpoint-retail/page.tsx` "set credit limits" copy |
| Identity verification (NIN/BVN/custom) | Published — flagged | **Verification lookups billed separately** unless bundled | Plan inclusion "Customer Verification"; `data/faqs.json` NIN/BVN answer. **Flag:** confirm lookup providers live in product before scaling this claim |
| Payment links | Published — verified | **Not included on Basic plan** (Standard and above) | Comparison matrix row "Payment links" (`lib/pricing-plans.ts`) |

## Understand your sales and profit

| Capability | Status | Restrictions / notes | Evidence |
|---|---|---|---|
| Owner dashboard | Published — verified | — | Both product screenshots |
| Daily summary | Published — verified | — | "Today's Summary" action in `retail-dash.webp`; plan inclusion "Daily Reports" |
| Sales & profit reports | Published — verified | — | "Reports" menu in screenshots; help-centre "Profit and margin analysis" |
| Expense tracking | Published — verified | — | "Expenses" menu + "Add Expense" action in screenshots |
| Receivables view | Published — verified | — | "Outstanding Debts"/"Outstanding Payments" cards in screenshots |
| Stock reports | Published — verified | — | Reports menus + industry copy (stock summaries, reorder data) |
| Report exports (Excel/PDF) | Published — verified | — | Help-centre "Exporting reports to Excel or PDF"; why-martpoint "full exports"; Product Updates "Export Flexibility" |

## Bring customers back

| Capability | Status | Restrictions / notes | Evidence |
|---|---|---|---|
| Loyalty points | Published — verified | — | `components/sections/loyalty-section.tsx`; plan inclusion "Loyalty & Rewards" |
| Membership tiers | Published — verified | — | Loyalty section "Membership Levels"; help-centre "Creating customer tiers" |
| Coupons & promotions | Published — verified | — | "Coupons" and "Promotions" menus in product screenshots; matrix "coupon limits" |
| Gift cards | Published — verified | — | `loyalty-section.tsx` "Gift Cards" card |
| Store credit | Published — verified | — | `loyalty-section.tsx` "Store Credit" card |
| Email/SMS campaigns & win-backs | Published — flagged | **Messaging billed separately** unless bundled; RETAIL_FEATURE_AUDIT lists customer-facing campaigns for product verification | "Marketing" + "Messaging" menus in product screenshots; matrix "Segmentation, campaigns & back-in-stock alerts" on all plans. **Flag:** confirm campaign send flow end-to-end in product |

## Take your shop online

| Capability | Status | Restrictions / notes | Evidence |
|---|---|---|---|
| Online store included | Published — verified | Standard Online Store on every Retail Cloud plan; online-product limits 500–20,000 | `lib/pricing-plans.ts`; "Online Store" menu in both screenshots; plan meter in `loginUI.webp` |
| Product publishing | Published — verified | — | Online-product limits + storefront copy; `data/faqs.json` online-store answer |
| Cart, checkout & order management | Published — verified | — | FAQ "browse your products, place orders, and pay online"; Product Updates "Online Store Integration" |
| Online payments | Published — flagged | **Requires the merchant's own gateway account; gateway fees apply** | Matrix rows: Paystack, Moniepoint, Flutterwave on all plans; `lib/payment-gateways.ts` + `app/api/payments/webhooks/*` prove Paystack/Flutterwave integration exists in this codebase. **Flag:** Moniepoint evidenced only in the approved matrix |
| Custom domain | Published — verified | 1 per plan; domain purchase/renewal billed separately | Plan limits + comparison matrix; pricing-page footnote |
| Store analytics | Published — verified | — | Matrix "Advertising pixels & analytics" |
| Store banners | **Omitted — flagged** | No evidence found | No match in repo or screenshots |
| Store themes | **Omitted — flagged** | No evidence found | No match in repo or screenshots |
| WhatsApp ordering & invoices | Published — verified | Meta/messaging costs are usage-based | Plan inclusion; Product Updates June 2026; `data/faqs.json` |
| QR menu ordering | Published — verified | Restaurant/hospitality business types | Plan inclusion; `/industries/restaurants`; Product Updates May 2026 |

## Manage your team and branches

| Capability | Status | Restrictions / notes | Evidence |
|---|---|---|---|
| Staff accounts | Published — verified | Named-user limits per plan (5–50); 5-user add-on ₦25,000/yr | "Users" menu in `retail-dashboard.webp`; help-centre "Staff accounts and permissions" |
| Role-based permissions | Published — verified | — | why-martpoint "Role-Based Permissions"; help-centre topic |
| Attendance & shifts | Published — verified | — | "Clock In" + "Attendance" in screenshots; plan inclusion "Attendance (Face Capture)"; Product Updates April 2026 |
| Staff commissions | Published — verified | — | `/industries/beauty-and-salons` automatic-commission copy |
| Branch reporting | Published — verified | Branch limits per plan (1–10); ₦50,000/yr per extra branch | "Branch" menu in `retail-dashboard.webp`; multi-branch industry entry |
| Activity history | Published — verified | Customer language for audit logging | why-martpoint "Full Audit Logs — know who did what, when and why"; electronics "every transaction logged with timestamp, staff and payment method" |
| Manager approvals | **Omitted — flagged** | Evidenced only for ERP/distribution workflows, not retail POS | `/industries/distributors` (ERP product line). Needs retail product confirmation before publishing |

## MartPoint Assist (conditional section — INCLUDED)

| Capability | Status | Restrictions / notes | Evidence |
|---|---|---|---|
| In-app assistant ("Ask MartPoint") | Published — flagged | Included as a platform capability; **AI usage billed separately** unless bundled in the offer | "Ask MartPoint" button visible in `retail-dash.webp`, `retail-dashboard.webp` and `loginUI.webp`; plan inclusion "AI Assistant"; `data/faqs.json` answer |
| Staff Q&A / task guidance | Published — verified | Copy scoped to answering questions and guiding tasks — no "runs the business" claims made | `data/faqs.json` "MartPoint Assist" entry; pricing common-inclusions card |
| Daily intelligence summaries | Published — verified | — | "Intelligence Report" block in `loginUI.webp`; `/martpoint-intelligence` page; Product Updates June–July 2026 GA entry |

## Business-type section

| Business type | Status | Restrictions / notes | Evidence |
|---|---|---|---|
| Fashion (variants) | Published — verified | Links to live industry page | `app/industries/fashion-stores` + `lib/industries.ts` |
| Electronics & phone stores (IMEI/warranty) | Published — verified | Links to live industry page | `app/industries/electronics-stores` |
| Supermarkets & mini marts (barcode, purchasing, stock) | Published — verified | Links to live industry page | `app/industries/supermarkets`, `app/industries/mini-marts` |
| Beauty & cosmetics (variants, loyalty, batch) | Published — verified | Links to `/industries/cosmetics-stores` | `lib/industries.ts` cosmeticsStores (shade variants, batch/expiry, profiles) |
| Specialist (pharmacies, restaurants, more) | Published — verified | Linked to `/industries` index, not published as dedicated claims on this page | 50+ live industry pages; index filtered to retail product lines |

## Cross-page availability & pricing claims

| Claim | Status | Source of truth |
|---|---|---|
| "Availability depends on plan, business type and setup; integrations may need third-party accounts/charges" | Published — verified | Approved note; pricing FAQ (`app/pricing/page.tsx`) |
| Payment links — Standard plan and above | Published — verified | `lib/pricing-plans.ts` matrix row |
| Branch/user/catalogue limits vary by plan | Published — verified | `CLOUD_PLANS` limits (₦-values never shown on `/features`) |
| Messaging, verification lookups, AI usage, gateways, domains billed separately unless bundled | Published — verified | Pricing FAQ "What costs are not included" |
| Product-upload help via partners, separately quoted | Published — verified | Approved catalogue-responsibility copy (`data/faqs.json`, pricing page) |

## Items deliberately kept off the public page

- Internal/admin surfaces (fleet controls, manifest/release tooling, seed tools, licensing).
- ERP modules and ERP industry workflows (distributors, wholesalers, manufacturers, hospitals).
- Retail Offline licence terms (owner decision — not listed publicly anywhere).
- Roadmap items marked "Coming soon" (Merchant API, international currencies, public API,
  accounting integrations, supplier portal, advanced AI forecasting).
- Omitted pending product verification: held sales, barcode label printing, partial receiving,
  supplier balances, purchase returns, customer statements, store banners, store themes,
  manager approvals.

## Pending owner/product verification before unflagging

1. End-to-end offline→sync walkthrough in the product repo.
2. Customer-facing campaign send flow (SMS/WhatsApp/email) beyond menu presence.
3. NIN/BVN verification provider flow and per-lookup billing.
4. Moniepoint gateway integration (matrix-approved; no code evidence in this repo).
5. Reminder automation scope (general receivables vs PayPlan/industry flows).
6. MartPoint Assist action surface (kept to Q&A/guidance/insights on the page).
