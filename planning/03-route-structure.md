# MartPoint Website — Route Structure (Next.js 15 App Router)

## File Tree

```
app/
├── page.tsx                    # Homepage
├── layout.tsx                  # Root layout (html, body, fonts, metadata)
├── globals.css                 # Tailwind v4 + custom theme
├── not-found.tsx               # 404 page
├── sitemap.ts                  # Generated sitemap
├── robots.ts                   # robots.txt
├── opengraph-image.tsx         # Default OG image
├── (marketing)/
│   ├── page.tsx                # Homepage (alias for root, optional grouping)
│   └── layout.tsx              # Marketing layout wrapper
├── martpoint-retail/
│   ├── page.tsx                # MartPoint Retail page
│   └── opengraph-image.tsx     # Retail-specific OG image
├── martpoint-erp/
│   ├── page.tsx                # MartPoint ERP page
│   └── opengraph-image.tsx     # ERP-specific OG image
├── pricing/
│   └── page.tsx                # Pricing page
├── book-demo/
│   └── page.tsx                # Book Demo form
├── request-quote/
│   └── page.tsx                # Request Quote form
├── contact/
│   └── page.tsx                # Talk to Sales form
├── industries/
│   └── page.tsx                # Industries overview
├── api/
│   └── leads/
│       └── route.ts            # Lead submission endpoint (RelaviCX integration)
```

## Layout Nesting

```
Root Layout (app/layout.tsx)
├── html + body
├── fonts (Inter via next/font/google)
├── globals.css
├── metadata (default)
└── children
    ├── Homepage (app/page.tsx)
    ├── Retail (app/retail/page.tsx)
    ├── ERP (app/erp/page.tsx)
    ├── Demo (app/demo/page.tsx)
    ├── Quote (app/quote/page.tsx)
    ├── Contact (app/contact/page.tsx)
    └── Industries (app/industries/page.tsx)
```

## Navigation Structure

### Header (Server Component with Client island)
- **Logo** → `/`
- **Products** (dropdown)
  - MartPoint Retail → `/martpoint-retail`
  - MartPoint ERP → `/martpoint-erp`
- **Industries** → `/industries`
- **Pricing** → `/pricing`
- **Contact** → `/contact`
- **CTA**: Book Demo → `/book-demo`

### Mobile Navigation
- Hamburger menu
- Same links as desktop
- Sticky CTA bar at bottom of viewport on mobile

## Data Flow

### Lead Forms
1. User fills form on `/demo` or `/quote`
2. Client Component validates with Zod
3. Form submits to `POST /api/leads`
4. API Route (`app/api/leads/route.ts`):
   - Validates payload
   - Routes to correct pipeline (Retail / ERP / General)
   - Submits to RelaviCX via fetch
   - Returns success/error response
5. Client shows success toast / error message

### Metadata Strategy
- Each page exports `metadata` object with title, description, openGraph
- Root layout sets default metadata template
- Product pages have specific OG images and descriptions
- All pages have canonical URLs
