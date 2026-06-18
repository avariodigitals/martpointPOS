# MartPoint Website — Information Architecture

## Objective
Structure the website so a Nigerian business owner understands what MartPoint does in under 10 seconds, clearly distinguishes Retail from ERP, and is guided toward lead generation actions.

## Hierarchy

### L1: Brand Layer
- **Homepage** (`/`)
  - Communicates: "MartPoint is business management software for Nigerian businesses"
  - Hero: Transformation message (not dashboard screenshots)
  - Trust: Metrics-driven credibility
  - Product Split: Retail vs ERP (the most important section)
  - Pain Points → Solution Framework → Industry Coverage
  - Feature Highlights → Business Impact
  - Demo CTA

### L2: Product Pages
- **MartPoint Retail** (`/retail`)
  - Tone: Fast, Operational, Store-Focused, Practical
  - Focus: Sales, Inventory, Cashiers, Receipts, Payments, Branches, Reports
  - Structure: Workflow-driven (how a transaction flows), not feature dumps
  - CTAs: Book Demo (Retail Pipeline), Request Quote (Retail Pipeline)

- **MartPoint ERP** (`/erp`)
  - Tone: Executive, Structured, Business Control, Management Visibility
  - Focus: Accounting, Procurement, HR, CRM, Approvals, Reporting, Operations
  - Structure: Process diagrams showing department connections
  - CTAs: Book Demo (ERP Pipeline), Request Quote (ERP Pipeline)

### L3: Conversion Pages
- **Book a Demo** (`/demo`)
  - Form fields: Full Name, Business Name, Email, Phone, Business Type, Product Interest, Branches, Staff Size, Current Challenge, Message
  - Lead routing: Retail → Retail Pipeline, ERP → ERP Pipeline, Not Sure → General Pipeline
  - Form destination: RelaviCX CRM

- **Request a Quote** (`/quote`)
  - Same form structure as Demo, different intent signaling
  - Lead routing identical to Demo

### L4: Support / Trust Pages
- **Industries** (`/industries`) — optional consolidated view
- **Contact / Talk to Sales** (`/contact`)
  - Short form for quick sales inquiries

## Content Flow
1. **Awareness**: Homepage Hero + Trust metrics
2. **Clarification**: Product Split section — user self-selects Retail or ERP
3. **Education**: Product pages show workflows and process diagrams
4. **Validation**: Industries, Business Impact, Feature Highlights
5. **Conversion**: Demo / Quote / Talk to Sales CTAs on every page
6. **Action**: Form submission creates lead in RelaviCX

## User Journeys

### Primary: Retail Store Owner
`/` → sees Product Split → clicks Retail card → `/retail` → sees transaction workflows → clicks "Book Demo" → `/demo` → submits form → Retail Pipeline

### Primary: Distributor / Wholesaler
`/` → sees Product Split → clicks ERP card → `/erp` → sees department process diagrams → clicks "Request Quote" → `/quote` → submits form → ERP Pipeline

### Secondary: Operations Manager
`/` → scrolls to Industries → sees relevant industry → clicks "Learn More" → product page → CTA

### Unsure User
`/` → scrolls to Solution Framework → understands difference → clicks "Talk to Sales" → `/contact` → General Pipeline
