# MartPoint Website — Component Library

## Philosophy
- Component-driven architecture
- Server Components by default
- `'use client'` only for interactivity (forms, mobile nav, animations)
- No generic SaaS template patterns
- Every component serves a specific business purpose

## Directory Structure

```
components/
├── ui/                         # shadcn/ui base components
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── label.tsx
│   ├── select.tsx
│   ├── dialog.tsx
│   ├── sheet.tsx
│   └── separator.tsx
├── layout/
│   ├── header.tsx              # Site header with nav + mobile menu
│   ├── footer.tsx              # Site footer
│   └── mobile-nav.tsx          # Mobile navigation sheet (client)
├── sections/
│   ├── hero.tsx                # Homepage hero
│   ├── trust-layer.tsx         # Trust / metrics section
│   ├── product-split.tsx       # Retail vs ERP cards
│   ├── pain-points.tsx         # Business pain points
│   ├── solution-framework.tsx  # How MartPoint solves problems
│   ├── industry-coverage.tsx   # Industry cards
│   ├── feature-highlights.tsx  # Key features grid
│   ├── business-impact.tsx     # Metrics / impact section
│   └── demo-cta.tsx            # Final CTA block
├── shared/
│   ├── section-header.tsx      # Reusable section title + subtitle
│   ├── lead-form.tsx           # Shared form component (client)
│   ├── sticky-cta.tsx          # Mobile sticky CTA bar (client)
│   └── icon-compositions.tsx   # Custom SVG business visuals
└── animations/
    └── fade-in.tsx             # Reusable fade/slide wrapper (client)
```

## Component Specifications

### UI Components (shadcn/ui style)

**Button**
- Variants: default, primary, retail, erp, outline, ghost, link
- Sizes: sm, default, lg, icon
- Uses: CTAs, nav links, form submission
- Mobile: touch-friendly min-height 44px

**Card**
- Variants: default, retail, erp, elevated
- Structure: header, content, footer slots
- Uses: Product cards, industry cards, feature cards

**Input**
- States: default, focus, error, disabled
- Uses: Form fields
- Mobile: large font-size to prevent zoom on iOS

**Select**
- Uses: Business Type, Product Interest, Number of Branches, Staff Size
- Styled dropdown with clear labels

**Dialog**
- Uses: Mobile menu, form confirmation, quick contact modal
- Accessible with focus trapping

**Sheet**
- Uses: Mobile navigation drawer
- Slide from right on mobile

### Layout Components

**Header**
- Server Component structure
- Client island: mobile hamburger toggle
- Scroll behavior: solid background on scroll
- Sticky positioning

**Footer**
- Server Component
- Columns: Products, Industries, Company, Contact
- Bottom bar: copyright, legal links

### Section Components (Homepage)

**Hero**
- Left: Strong business headline + subheadline + dual CTAs
- Right: Custom visual composition (not dashboard screenshot)
  - Abstract representation of retail + inventory + operations + growth
- No floating cards chaos

**Trust Layer**
- 4 metric-style blocks
- Content: Sales Visibility, Stock Accuracy, Operational Control, Business Insights
- Clean numbers + labels, no fake logos

**Product Split**
- Two large cards side by side (desktop), stacked (mobile)
- Card A (Retail): Warm amber tones, operational language
- Card B (ERP): Cool blue tones, executive language
- Each: Title, purpose statement, 4 key features, ideal business description, CTA

**Pain Points**
- 3-column grid
- Common business problems Nigerian retailers face
- Visual: simple, clear, not generic icons

**Solution Framework**
- 3-step visual: Disconnected → MartPoint → Connected
- Clean process diagram

**Industry Coverage**
- 8 industry cards in responsive grid
- Each: Industry name, small business scenario description
- Custom visual treatment per card (not generic icons)

**Feature Highlights**
- Alternating layout: image/visual + text
- 3-4 key capabilities
- Focus on outcomes, not feature lists

**Business Impact**
- Metrics with real business outcomes
- Numbers that matter to Nigerian business owners

**Demo CTA**
- Full-width section
- Strong headline + subheadline
- Primary CTA + secondary CTA

### Page-Specific Components

**Retail Page Sections**
- Retail Hero (different from homepage hero)
- Transaction Flow: Step-by-step workflow visualization
- Capabilities: Sales, Inventory, Cashiers, Receipts, Payments, Branches, Reports
- Use case scenarios

**ERP Page Sections**
- ERP Hero (executive tone)
- Department Connections: Process diagram showing how Accounting, Procurement, HR, CRM connect
- Capabilities: Accounting, Procurement, HR, CRM, Approvals, Reporting, Operations
- Workflow diagrams

## Client Component Boundaries

| Component | Why Client? |
|-----------|-------------|
| `mobile-nav.tsx` | useState for open/close |
| `lead-form.tsx` | useState, form validation, fetch submission |
| `sticky-cta.tsx` | useEffect for scroll detection, useState for visibility |
| `fade-in.tsx` | IntersectionObserver or framer-motion |

Everything else is a Server Component.
