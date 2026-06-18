# MartPoint Website — Sitemap

## Static Routes (App Router)

| URL | Purpose | SEO Priority |
|-----|---------|-------------|
| `/` | Homepage — brand positioning, product split, trust | High |
| `/martpoint-retail` | MartPoint Retail product page | High |
| `/martpoint-erp` | MartPoint ERP product page | High |
| `/pricing` | Pricing information | Medium |
| `/book-demo` | Book a Demo lead form | Medium |
| `/request-quote` | Request a Quote lead form | Medium |
| `/contact` | Talk to Sales / quick contact | Medium |
| `/industries` | Consolidated industries overview | Medium |

## Sitemap Generation
- Auto-generated via `app/sitemap.ts` using Next.js Metadata API
- Static routes with `priority` and `changefreq` attributes
- Lastmod set to build date

## robots.txt
- Generated via `app/robots.ts`
- Allow all, point to `/sitemap.xml`

## Open Graph / Twitter Cards
- Each page exports `metadata` with `openGraph` and `twitter` properties
- Dynamic OG images via `opengraph-image.tsx` for product pages
- Default OG image for all other routes

## Page Titles & Descriptions

| Page | Title | Meta Description |
|------|-------|-----------------|
| `/` | MartPoint — Retail & ERP Software for Nigerian Businesses | Business management software built for Nigerian retail stores and enterprises. POS, inventory, accounting, and operations in one ecosystem. |
| `/martpoint-retail` | MartPoint Retail — POS & Store Management Software | Retail management software for supermarkets, pharmacies, restaurants, and fashion stores. Sales, inventory, receipts, and branches. |
| `/martpoint-erp` | MartPoint ERP — Business Management Software | Enterprise software for accounting, procurement, HR, CRM, and operations. Built for Nigerian distributors, wholesalers, and multi-branch businesses. |
| `/pricing` | Pricing — MartPoint | Transparent pricing for MartPoint Retail and ERP. Plans for every business size. |
| `/book-demo` | Book a Demo — MartPoint | Schedule a personalized demo of MartPoint Retail or ERP. See how it works for your business. |
| `/request-quote` | Request a Quote — MartPoint | Get a custom quote for MartPoint Retail or ERP. Tailored pricing for your business size and needs. |
| `/contact` | Contact Sales — MartPoint | Talk to our sales team about MartPoint for your business. |
| `/industries` | Industries We Serve — MartPoint | MartPoint software for supermarkets, restaurants, pharmacies, electronics, fashion, distributors, and wholesalers. |
