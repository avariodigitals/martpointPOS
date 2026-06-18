# MartPoint Website — Design System

## Personality
- **Structured** — Clear grids, consistent spacing, purposeful alignment
- **Confident** — Bold headlines, strong CTAs, decisive language
- **Professional** — Clean lines, restrained color, business-appropriate
- **Reliable** — Stable layouts, predictable patterns, trustworthy visuals
- **Business Focused** — Content hierarchy favors decision-making information
- **Clean** — Generous whitespace, minimal decoration
- **Premium** — Refined details, quality typography, subtle depth
- **Fast** — Lightweight feel, no heavy visuals, quick comprehension
- **Human** — Warm accent colors, approachable language
- **Commercial** — Conversion-oriented, clear value propositions

## NOT
- Playful, Startup-ish, Generic, Overly futuristic, Crypto-like, Overly animated

---

## Typography

**Font Family**: Inter (Google Fonts)
- Weights: 400 (Regular), 500 (Medium), 600 (Semibold), 700 (Bold), 800 (Extrabold)

**Scale**:

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|-------|------|--------|-------------|----------------|-----|
| display | 56px | 800 | 1.05 | -0.02em | Homepage hero headline |
| h1 | 48px | 700 | 1.1 | -0.02em | Page headlines |
| h2 | 36px | 700 | 1.15 | -0.01em | Section headlines |
| h3 | 24px | 600 | 1.3 | -0.01em | Card titles, sub-sections |
| h4 | 20px | 600 | 1.35 | 0 | Feature titles |
| body-lg | 18px | 400 | 1.6 | 0 | Lead paragraphs |
| body | 16px | 400 | 1.6 | 0 | Standard text |
| body-sm | 14px | 400 | 1.5 | 0 | Captions, metadata |
| label | 12px | 600 | 1.4 | 0.05em | Labels, tags (uppercase) |

**Mobile Scale**:
- display → 36px
- h1 → 32px
- h2 → 28px
- h3 → 22px

---

## Color Palette

### Brand Colors

| Token | Hex | Use |
|-------|-----|-----|
| `--color-foreground` | `#0f172a` | Primary text, headings |
| `--color-background` | `#ffffff` | Page background |
| `--color-muted` | `#f8fafc` | Section backgrounds, subtle fills |
| `--color-muted-foreground` | `#64748b` | Secondary text, descriptions |
| `--color-border` | `#e2e8f0` | Dividers, card borders |
| `--color-card` | `#ffffff` | Card backgrounds |

### Retail Identity

| Token | Hex | Use |
|-------|-----|-----|
| `--color-retail` | `#d97706` | Retail CTAs, accents, badges |
| `--color-retail-soft` | `#fffbeb` | Retail section backgrounds |
| `--color-retail-muted` | `#fef3c7` | Retail hover states, highlights |

### ERP Identity

| Token | Hex | Use |
|-------|-----|-----|
| `--color-erp` | `#1e40af` | ERP CTAs, accents, badges |
| `--color-erp-soft` | `#eff6ff` | ERP section backgrounds |
| `--color-erp-muted` | `#dbeafe` | ERP hover states, highlights |

### Accent

| Token | Hex | Use |
|-------|-----|-----|
| `--color-accent` | `#f59e0b` | Primary CTA buttons, focus rings |
| `--color-accent-foreground` | `#0f172a` | Text on accent backgrounds |

### Semantic

| Token | Hex | Use |
|-------|-----|-----|
| `--color-destructive` | `#ef4444` | Errors, validation failures |
| `--color-success` | `#10b981` | Success states, confirmations |

---

## Spacing System

**Base unit**: 4px

| Token | Value | Use |
|-------|-------|-----|
| xs | 4px | Tight gaps, icon padding |
| sm | 8px | Button padding-y, small gaps |
| md | 16px | Card padding, component gaps |
| lg | 24px | Section internal spacing |
| xl | 32px | Between components |
| 2xl | 48px | Between sub-sections |
| 3xl | 64px | Section padding-y (mobile) |
| 4xl | 96px | Section padding-y (desktop) |
| 5xl | 128px | Major section breaks |

**Max Widths**:
- Content: 1200px
- Reading: 680px
- Full: 100%

---

## Layout

**Grid**: 12-column
- Gap: 24px (desktop), 16px (mobile)
- Max container: 1200px, centered
- Side padding: 16px (mobile), 24px (tablet), 32px (desktop)

**Breakpoints**:
- sm: 640px
- md: 768px
- lg: 1024px
- xl: 1280px

**Section Pattern**:
- Every section: `py-16 md:py-24 lg:py-32`
- Alternating backgrounds: white → muted (#f8fafc) → white
- Clear section separation with spacing, not heavy dividers

---

## Components

### Buttons

**Primary (Accent)**
- Background: `--color-accent`
- Text: `--color-accent-foreground`
- Padding: 14px 28px
- Border-radius: 8px
- Font: 16px, weight 600
- Hover: darken 5%, subtle shadow
- Focus: ring 2px `--color-accent` at 50% opacity

**Retail CTA**
- Background: `--color-retail`
- Text: white
- Same sizing as Primary
- Hover: darken 5%

**ERP CTA**
- Background: `--color-erp`
- Text: white
- Same sizing as Primary
- Hover: darken 5%

**Outline**
- Border: 1px `--color-border`
- Background: transparent
- Text: `--color-foreground`
- Hover: `--color-muted` background

**Ghost**
- No border, no background
- Text: `--color-muted-foreground`
- Hover: `--color-muted` background

### Cards

**Default**
- Background: white
- Border: 1px `--color-border`
- Border-radius: 12px
- Padding: 24px
- Shadow: none (flat design)
- Hover: subtle shadow, border darkens

**Retail Card**
- Background: `--color-retail-soft`
- Border: 1px `--color-retail-muted`
- Left border accent: 4px `--color-retail`

**ERP Card**
- Background: `--color-erp-soft`
- Border: 1px `--color-erp-muted`
- Left border accent: 4px `--color-erp`

**Elevated**
- Background: white
- Shadow: `0 4px 24px rgba(0,0,0,0.06)`
- Border-radius: 16px
- Padding: 32px

### Form Inputs

**Text Input**
- Border: 1px `--color-border`
- Border-radius: 8px
- Padding: 14px 16px
- Font: 16px (prevents iOS zoom)
- Focus: border `--color-accent`, ring 2px `--color-accent` at 30%
- Error: border `--color-destructive`

**Select**
- Same styling as text input
- Custom dropdown arrow
- Clear option grouping

**Label**
- Font: 14px, weight 500
- Color: `--color-foreground`
- Margin-bottom: 6px

---

## Animation Rules

**Allowed**:
- Fade in on scroll (subtle, 0.4s ease-out)
- Slide up on scroll (subtle, 16px translate, 0.5s ease-out)
- Hover: background/color transitions (0.2s)
- Button: scale 1.02 on hover, 0.98 on active
- Mobile nav: slide from right (0.3s)

**Rejected**:
- Parallax
- Heavy motion / complex sequences
- Floating card chaos
- Excessive effects
- Auto-playing carousels
- Bounce / elastic animations

---

## Mobile Experience

**Header**:
- Logo + hamburger only
- Nav links in sheet drawer

**Buttons**:
- Min touch target: 44px × 44px
- Full-width on mobile for primary CTAs

**Forms**:
- Single column
- Large input fields (16px font)
- Sticky CTA bar at viewport bottom
- Shortened stepper if multi-step

**Typography**:
- Scale down proportionally
- Maintain hierarchy

**Sections**:
- Stack vertically
- Maintain generous padding
- No horizontal scroll

---

## SEO Architecture

- Semantic HTML: `<header>`, `<main>`, `<section>`, `<article>`, `<footer>`
- Heading hierarchy: single H1 per page, logical H2/H3 nesting
- Alt text on all images
- Internal linking between product pages and homepage
- Canonical URLs on all pages
- Structured data: Organization, SoftwareApplication (for Retail and ERP)
- Fast loading: compressed assets, minimal JS on initial load
