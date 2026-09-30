# ERP Visibility Audit

Goal: ERP removed from the active website and Retail sales journey, while existing ERP landing pages
remain public, indexable and reachable by search/direct URL. No ERP functionality, customer accounts,
contracts or backend products were deleted.

## Retained, public, indexable URLs

Verified against a local production build (`next start`, Next.js 16.2.9):

| URL | HTTP | Indexability | Source |
|---|---|---|---|
| `/martpoint-erp` | 200 | `index, follow` meta; listed in `/sitemap.xml` | `app/martpoint-erp/page.tsx` |
| `/industries/distributors` | 200 | indexable; in sitemap | `app/industries/distributors/page.tsx` |
| `/industries/wholesalers` | 200 | indexable; in sitemap | `app/industries/wholesalers/page.tsx` (IndustryTemplate, `product: "erp"`) |
| `/industries/manufacturers` | 200 | indexable; in sitemap | `app/industries/manufacturers/page.tsx` |
| `/industries/hospitals` | 200 | indexable; in sitemap | `app/industries/hospitals/page.tsx` |

- `robots.txt`: `Allow: /` (only `/admin` and `/api` disallowed) — ERP pages crawlable.
- `sitemap.xml`: `/martpoint-erp` listed explicitly; all four ERP industry pages included via
  auto-discovery from `lib/industries.ts`.
- ERP CTAs preserved on ERP pages: `/martpoint-erp` and `/industries/distributors` link to
  `/request-quote?product=erp` and `/book-demo?product=erp` — these explicit routes render the ERP
  product option (verified: the option is absent on the plain routes, present on `?product=erp`).

## Removed promotional locations (active Retail journey)

| Location | Before | After |
|---|---|---|
| Header nav (`lib/navigation.ts`) | "MartPoint Enterprise" child under Solutions; ERP-targeted industries in nav | Removed; Solutions shows Retail, Intelligence, Compare Plans, Estimate Cost |
| Footer (`lib/navigation.ts`) | ERP link under Solutions | Removed |
| Homepage product split (`components/sections/product-split.tsx`) | Retail + ERP two-card split | Retail Cloud + Retail Offline cards |
| Homepage metadata (`app/page.tsx`, `app/layout.tsx`) | "#1 POS & ERP…", ERP keywords/OG copy | Retail-first title/description/keywords |
| Structured data (`components/structured-data.tsx`) | ERP in site-nav schema + org descriptions | Retail-first; no ERP nav entries |
| `/pricing` | Three ERP cards (₦85,000/mo, ₦180,000/mo, Custom) | Removed entirely; four Retail Cloud tiers + Offline |
| `/estimate` | ERP questionnaire question + ERP recommendation leg | Retail-only questionnaire and recommendation |
| `/request-quote`, `/book-demo` | ERP shown as a general product option | ERP option only when arriving via `?product=erp` |
| `/industries` index | Listed Enterprise-category industries | Filters to `product !== "erp"`; ERP pages still reachable directly |
| `/why-martpoint` | "Retail + Enterprise" differentiator, growth-path card linking `/martpoint-erp`, ERP FAQs | Rewritten to Retail growth path (plan tiers, capacity) |
| Metadata | `about`, `faqs`, `contact`, `help-centre`, `customer-stories`, `product-updates` mentioned ERP/Enterprise | Retail-first wording |
| `data/faqs.json` | Industry answer promoted ERP | Removed; cost answer updated to four-plan baseline |
| Exit-intent popup | Listed "Training" under fee coverage | "Training" → "Activation" (training is separately scoped) |

## Intentionally retained ERP references (not promotional)

- **ERP landing/industry pages** themselves (required by brief).
- **About page timeline** — factual company-history entry ("MartPoint ERP brought accounting…").
- **Terms of Service** — describes the service scope including ERP (legal accuracy).
- **Product Updates changelog** — historical "MartPoint Enterprise Launch" entry.
- **Partners page** — "ERP Consultants" partner-recruitment category (not a Retail customer journey).
- **Admin/partner/back-office** — leads, settings, quotes, onboarding, finance retain ERP records and
  options; `pricing.erp` settings block kept for internal use.
- **Lead detail modal** — still renders a stored `estimate.erp` leg on historical leads.
- **`/f/[token]` feedback page** — conditionally labels ERP for ERP customers.
- **ERP option in form handlers** — `product_interest: "erp"` still accepted by `/api/leads` for the
  explicit ERP flows.

## Verified checks

- [x] All five ERP URLs return HTTP 200 on production build.
- [x] `/martpoint-erp` serves `index, follow` robots meta.
- [x] All five URLs present in `sitemap.xml`; `robots.txt` allows crawling.
- [x] Homepage HTML contains zero `martpoint-erp`/`MartPoint ERP`/`MartPoint Enterprise` references.
- [x] `/request-quote` and `/book-demo` render no ERP product option by default; `?product=erp` adds it.
- [x] `/pricing` renders all four Retail tiers and no ERP prices.
- [x] `/industries` index no longer links to ERP industry pages.

## Pending

- Live production HTTP checks (this audit used a local `next start` build — same output expected,
  but confirm post-deploy).
- Optional: monitor Search Console for ERP page impressions after launch.
