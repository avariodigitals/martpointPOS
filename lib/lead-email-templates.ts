/* ───────────────  Lead email templates (industry-specific)  ────────────────
 * Ready-to-send emails for the lead Email tab — one per stage of the
 * relationship:
 *   introduction  first touch: introduce MartPoint for the lead's industry
 *   follow_up     second touch after no reply, pain-point focused
 *   nurture       value-first tips that keep the lead warm
 *   thank_you     after conversion: thanks, onboarding steps, support
 *
 * Copy is industry-specific in three layers:
 *   1. generic stage copy (fallback for unknown industries)
 *   2. category angles — the sales story differs between a pharmacy, a
 *      restaurant and an auto workshop
 *   3. per-industry detail pulled from lib/industries.ts (solutions,
 *      painPoints, capabilities, whyMartPoint), so every industry speaks its
 *      own language without 260 hand-written blobs
 *
 * `buildLeadEmailTemplate()` returns the subject, a plain-text twin (shown in
 * the composer) and an HTML body fragment; the send route wraps the fragment
 * in the branded MartPoint shell (`brandedEmailHtml`). Both renderings are
 * produced from one block list so the text and HTML can never drift apart.
 * Client-safe: only lib/industries and lib/email-html are imported.
 */

import { getIndustryByName, resolveIndustryName } from "./industries"
import { escapeHtml } from "./email-html"

const SITE = (process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng").replace(/\/$/, "")
const DEMO_URL = `${SITE}/book-demo`

export type LeadEmailStageKey = "introduction" | "follow_up" | "nurture" | "thank_you"

export interface LeadEmailStageMeta {
  key: LeadEmailStageKey
  label: string
  description: string
}

export const LEAD_EMAIL_STAGES: LeadEmailStageMeta[] = [
  {
    key: "introduction",
    label: "Introduce MartPoint",
    description: "First touch — introduces MartPoint to the lead in their industry's language.",
  },
  {
    key: "follow_up",
    label: "Follow up",
    description: "Second touch after no reply — leads with the problem MartPoint solves for them.",
  },
  {
    key: "nurture",
    label: "Nurture",
    description: "Value-first ideas for leads who aren't ready yet — no hard sell.",
  },
  {
    key: "thank_you",
    label: "Thank you",
    description: "After conversion — thanks, onboarding next steps and support.",
  },
]

export const LEAD_EMAIL_STAGE_KEYS = LEAD_EMAIL_STAGES.map((s) => s.key) as [
  LeadEmailStageKey,
  ...LeadEmailStageKey[],
]

export interface LeadEmailTemplateVars {
  firstName?: string | null
  fullName?: string | null
  businessName?: string | null
}

export interface BuiltLeadEmailTemplate {
  subject: string
  text: string
  eyebrow: string
  title: string
  preheader: string
  /** Branded-shell body fragment, HTML-escaped content only. */
  bodyHtml: string
  /** Canonical industry the copy was tailored to; "" when generic. */
  industry: string
}

/* ─── Copy sources ─── */

interface CopyPoint {
  title: string
  desc: string
}

const DEFAULT_SOLUTIONS: CopyPoint[] = [
  { title: "Real-Time Inventory", desc: "Every sale updates your stock instantly, with low-stock alerts before you run out." },
  { title: "Fast Checkout", desc: "Barcode, quick-key and split payments keep queues moving at peak hours." },
  { title: "Daily Reports & Insights", desc: "Sales, profit and best-sellers ready at close of business — no spreadsheets." },
]

const DEFAULT_PAINS: CopyPoint[] = [
  { title: "Stock Losses You Only Notice at Month End", desc: "Without sales-to-stock matching, shrinkage and errors pile up unseen until the money is gone." },
  { title: "Running the Business from Paper and Spreadsheets", desc: "Counting stock and tallying sales by hand eats hours and still gets the numbers wrong." },
]

const DEFAULT_CAPABILITIES: CopyPoint[] = [
  { title: "Run Every Location From One Screen", desc: "Compare sales, stock and staff across all your locations in real time." },
  { title: "Sell Across Channels", desc: "In-store, online and WhatsApp orders land in one catalogue and one stock pool." },
  { title: "Keep Your Team Accountable", desc: "Role-based access, staff performance and sales-to-stock reconciliation." },
]

const DEFAULT_WHY = [
  "Built for African business: transfer payments, credit sales and offline mode included.",
  "Local support that understands your business, not a ticket system abroad.",
]

interface CategoryAngle {
  /** Opening value-proposition line for the introduction email. */
  introAngle: string
  /** What the client hands over during onboarding. */
  catalogueNoun: string
  /** Extra onboarding guidance for the thank-you email. */
  onboardingNote?: string
}

const CATEGORY_ANGLES: Record<string, CategoryAngle> = {
  "Food & Grocery": {
    introAngle:
      "From fast barcode checkout and expiry tracking to live stock across every branch, MartPoint keeps your shelves full and your margins intact.",
    catalogueNoun: "product catalogue",
    onboardingNote: "Include expiry dates for a few perishable sample items so we can set up expiry alerts before you go live.",
  },
  "Restaurants & Food": {
    introAngle:
      "From QR table ordering and kitchen tickets to recipe-level stock, MartPoint keeps service fast and your food cost under control.",
    catalogueNoun: "menu",
    onboardingNote: "Include portion sizes and prices for a few sample menu items so we can configure recipes and food-cost reports.",
  },
  Health: {
    introAngle:
      "From batch and expiry tracking to prescription records and full audit trails, MartPoint keeps your dispensary compliant and your stock accurate.",
    catalogueNoun: "product catalogue",
    onboardingNote: "Include batch numbers and expiry dates for a few sample products so expiry alerts work from day one.",
  },
  "Fashion & Beauty": {
    introAngle:
      "From size and colour variants to appointments and your online store, MartPoint keeps your stock, your bookings and your customers in one place.",
    catalogueNoun: "product catalogue",
    onboardingNote: "Include size and colour variants for a few sample products so your variants are configured correctly.",
  },
  Electronics: {
    introAngle:
      "From serial and IMEI tracking to warranty management, MartPoint gives you unit-level control from purchase to sale.",
    catalogueNoun: "product catalogue",
    onboardingNote: "Include serial or IMEI details for a few sample units so warranty tracking is configured correctly.",
  },
  "Building Materials": {
    introAngle:
      "From bulk and unit sales to delivery tracking and supplier records, MartPoint keeps every sale, transfer and delivery accounted for.",
    catalogueNoun: "product catalogue",
    onboardingNote: "Include how you sell each sample item (by unit, bundle or weight) so pricing and checkout match your counter.",
  },
  Agriculture: {
    introAngle:
      "From weigh-scale sales and farmer orders to seasonal and credit sales, MartPoint keeps your stock and your settlements accurate through the season.",
    catalogueNoun: "product catalogue",
    onboardingNote: "Include the units you trade in (kg, bag, litre) for a few sample items so scale and weight pricing work from day one.",
  },
  Automotive: {
    introAngle:
      "From part lookups and job cards to workshop stock, MartPoint ties every job, part and payment together.",
    catalogueNoun: "parts catalogue",
    onboardingNote: "Include vehicle fitment details for a few sample parts so part lookups return the right items.",
  },
  "General & Specialty Retail": {
    introAngle:
      "From fast checkout and inventory control to your online store, MartPoint runs the whole shop from one screen.",
    catalogueNoun: "product catalogue",
  },
  Services: {
    introAngle:
      "From service bookings and job records to invoices and customer follow-up, MartPoint keeps your work, your team and your revenue organised.",
    catalogueNoun: "service catalogue",
    onboardingNote: "Include the services you offer most and how you price them (fixed, hourly or per job) so we can set up your service catalogue.",
  },
  "Digital & Creative": {
    introAngle:
      "From your digital catalogue and payment links to WhatsApp ordering and abandoned-cart recovery, MartPoint turns your audience into paying customers.",
    catalogueNoun: "catalogue",
  },
  Enterprise: {
    introAngle:
      "From multi-branch roll-out to finance, HR and manufacturing, MartPoint Enterprise runs your operation on one connected platform.",
    catalogueNoun: "catalogue and migration data",
    onboardingNote: "A small sample data set from each department lets us validate migration before the full roll-out.",
  },
}

const DEFAULT_ANGLE: CategoryAngle = {
  introAngle:
    "From fast checkout and live inventory to multi-branch control and daily reports, MartPoint runs your business from one screen.",
  catalogueNoun: "product catalogue",
}

function industryUrl(slug: string): string {
  return slug ? `${SITE}/industries/${slug}` : `${SITE}/industries`
}

/* ─── Block model — rendered to plain text and HTML from one source ─── */

type Block =
  | { type: "p"; text: string }
  | { type: "head"; text: string }
  | { type: "card"; items: CopyPoint[] }
  | { type: "steps"; items: CopyPoint[] }
  | { type: "bullets"; items: string[] }
  | { type: "callout"; title: string; text: string }
  | { type: "cta"; primary?: { label: string; href: string }; secondary?: { label: string; href: string } }
  | { type: "note"; text: string }

function renderBlocksText(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "p":
        case "note":
          return block.text
        case "head":
          return `\n${block.text}`
        case "card":
          return block.items.map((i) => `• ${i.title} — ${i.desc}`).join("\n")
        case "steps":
          return block.items.map((i, n) => `${n + 1}. ${i.title} — ${i.desc}`).join("\n")
        case "bullets":
          return block.items.map((i) => `• ${i}`).join("\n")
        case "callout":
          return `${block.title}\n${block.text}`
        case "cta":
          return [block.primary, block.secondary]
            .filter((c): c is { label: string; href: string } => Boolean(c))
            .map((c) => `• ${c.label}: ${c.href}`)
            .join("\n")
      }
    })
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

const STYLE = {
  p: "font-size:15px; line-height:1.65; margin:0 0 18px; color:#374151;",
  head: "font-size:17px; font-weight:700; color:#111827; margin:32px 0 12px;",
  note: "font-size:14px; line-height:1.6; margin:0 0 18px; color:#6b7280;",
  cardItem: "font-size:14px; line-height:1.6; margin:0 0 12px; color:#374151;",
}

function renderBlocksHtml(blocks: Block[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "p":
          return `<p style="${STYLE.p}">${escapeHtml(block.text)}</p>`
        case "note":
          return `<p style="${STYLE.note}">${escapeHtml(block.text)}</p>`
        case "head":
          return `<h2 style="${STYLE.head}">${escapeHtml(block.text)}</h2>`
        case "card":
          return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f9fafb; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:18px 20px;">
                    ${block.items
                      .map(
                        (i) =>
                          `<p style="${STYLE.cardItem}"><strong style="color:#111827;">${escapeHtml(i.title)}</strong> &mdash; ${escapeHtml(i.desc)}</p>`,
                      )
                      .join("\n                    ")}
                  </td>
                </tr>
              </table>`
        case "steps":
          return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 24px;">
                ${block.items
                  .map(
                    (i, n) => `<tr>
                  <td width="34" valign="top" style="width:34px; padding:0 0 14px;">
                    <div style="width:26px; height:26px; border-radius:50%; background-color:#0057FF; color:#ffffff; font-size:13px; font-weight:700; line-height:26px; text-align:center;">${n + 1}</div>
                  </td>
                  <td style="padding:0 0 14px;">
                    <p style="font-size:15px; font-weight:600; color:#111827; margin:0 0 2px;">${escapeHtml(i.title)}</p>
                    <p style="font-size:14px; line-height:1.6; margin:0; color:#374151;">${escapeHtml(i.desc)}</p>
                  </td>
                </tr>`,
                  )
                  .join("\n                ")}
              </table>`
        case "bullets":
          return block.items
            .map((i) => `<p style="${STYLE.note} margin:0 0 8px;">&bull; ${escapeHtml(i)}</p>`)
            .join("\n              ")
        case "callout":
          return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#eef4ff; border-left:4px solid #0057FF; border-radius:8px; margin:0 0 24px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="font-size:13px; font-weight:700; color:#0057FF; margin:0 0 6px; text-transform:uppercase; letter-spacing:0.5px;">${escapeHtml(block.title)}</p>
                    <p style="font-size:15px; line-height:1.65; margin:0; color:#374151;">${escapeHtml(block.text)}</p>
                  </td>
                </tr>
              </table>`
        case "cta": {
          const rows = [block.primary, block.secondary]
            .filter((c): c is { label: string; href: string } => Boolean(c))
            .map(
              (c, idx) => `<tr>
                  <td style="padding:0 0 ${idx === 0 ? 12 : 0}px;" align="center">
                    <a href="${escapeHtml(c.href)}" target="_blank" style="display:inline-block; padding:14px 36px; font-size:15px; font-weight:600; color:${idx === 0 ? "#ffffff" : "#111827"}; background-color:${idx === 0 ? "#0057FF" : "#ffffff"}; border:1px solid ${idx === 0 ? "#0057FF" : "#d1d5db"}; text-decoration:none; border-radius:8px;">${escapeHtml(c.label)}</a>
                  </td>
                </tr>`,
            )
            .join("\n                ")
          return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto 28px;">
                ${rows}
              </table>`
        }
      }
    })
    .join("\n              ")
}

/* ─── Builder ─── */

function pick<T>(items: T[], count: number, fallback: T[]): T[] {
  const source = items.length >= count ? items : fallback
  return source.slice(0, count)
}

export function buildLeadEmailTemplate(
  stage: LeadEmailStageKey,
  industryOrType?: string | null,
  vars: LeadEmailTemplateVars = {},
): BuiltLeadEmailTemplate {
  const name = resolveIndustryName(industryOrType)
  const industry = getIndustryByName(name)
  const angle = (industry && CATEGORY_ANGLES[industry.category]) || DEFAULT_ANGLE

  const segment = industry?.name || "Growing Businesses"
  const firstName = (vars.firstName || vars.fullName?.trim().split(/\s+/)[0] || "").trim() || "there"
  const businessName = (vars.businessName || "").trim() || "your business"

  const solutions = pick(industry?.solutions || [], 3, DEFAULT_SOLUTIONS)
  const pains = pick(industry?.painPoints || [], 2, DEFAULT_PAINS)
  const capabilities = pick(industry?.capabilities || [], 3, DEFAULT_CAPABILITIES)
  const why = industry?.whyMartPoint?.length ? industry.whyMartPoint.slice(0, 2) : DEFAULT_WHY

  const seePage = { label: `See MartPoint for ${segment}`, href: industryUrl(industry?.slug || "") }

  const built = buildBlocks(stage, {
    segment,
    firstName,
    businessName,
    angle,
    solutions,
    pains,
    capabilities,
    why,
    seePage,
  })

  return {
    subject: built.subject,
    text: renderBlocksText(built.blocks),
    eyebrow: built.eyebrow,
    title: built.title,
    preheader: built.preheader,
    bodyHtml: renderBlocksHtml(built.blocks),
    industry: industry?.name || "",
  }
}

interface BuildContext {
  segment: string
  firstName: string
  businessName: string
  angle: CategoryAngle
  solutions: CopyPoint[]
  pains: CopyPoint[]
  capabilities: CopyPoint[]
  why: string[]
  seePage: { label: string; href: string }
}

function buildBlocks(
  stage: LeadEmailStageKey,
  ctx: BuildContext,
): { subject: string; eyebrow: string; title: string; preheader: string; blocks: Block[] } {
  const { segment, firstName, businessName, angle, solutions, pains, capabilities, why, seePage } = ctx

  switch (stage) {
    case "introduction":
      return {
        subject: `Meet MartPoint — POS & inventory built for ${segment}`,
        eyebrow: "Introduction",
        title: `Meet MartPoint — built for ${segment}`,
        preheader: `Sell faster, cut stock losses and see every naira clearly with MartPoint.`,
        blocks: [
          { type: "p", text: `Hi ${firstName},` },
          {
            type: "p",
            text: `I'm reaching out from MartPoint. Businesses like ${businessName} use us to sell faster, cut stock losses and see every naira clearly — a POS and inventory platform built for ${segment}.`,
          },
          { type: "p", text: angle.introAngle },
          { type: "head", text: `What MartPoint does for ${segment}:` },
          { type: "card", items: solutions },
          { type: "head", text: "Why businesses choose MartPoint:" },
          { type: "bullets", items: why },
          {
            type: "cta",
            primary: { label: "Book a 15-minute demo", href: DEMO_URL },
            secondary: seePage,
          },
          { type: "note", text: "Or simply reply to this email and we'll take it from there." },
        ],
      }

    case "follow_up":
      return {
        subject: `Following up on MartPoint for ${businessName}`,
        eyebrow: "Following up",
        title: `Following up — MartPoint for ${businessName}`,
        preheader: `The short version of what MartPoint does for ${businessName}.`,
        blocks: [
          { type: "p", text: `Hi ${firstName},` },
          {
            type: "p",
            text: `I'm following up on my note about MartPoint for ${businessName}. I know things get busy, so here's the short version.`,
          },
          { type: "callout", title: "Where the money usually leaks", text: `${pains[0].title} — ${pains[0].desc}` },
          { type: "p", text: "That's exactly what MartPoint is built to fix:" },
          { type: "card", items: solutions.slice(0, 2) },
          {
            type: "p",
            text: `If the timing isn't right, just say the word and I'll leave you to it. If it is, pick whatever works:`,
          },
          {
            type: "cta",
            primary: { label: "Book a 15-minute demo", href: DEMO_URL },
            secondary: seePage,
          },
          { type: "note", text: "Or simply reply to this email — happy to answer questions first." },
        ],
      }

    case "nurture":
      return {
        subject: `Three quick ideas for ${businessName} from MartPoint`,
        eyebrow: "Ideas for you",
        title: `Three ideas for ${businessName}`,
        preheader: `Practical ${segment.toLowerCase()} ideas you can use this week — no pitch.`,
        blocks: [
          { type: "p", text: `Hi ${firstName},` },
          {
            type: "p",
            text: `No pitch today — just three practical ideas you can put to work in ${businessName} this week:`,
          },
          { type: "steps", items: capabilities },
          {
            type: "p",
            text: "All three are standard in MartPoint, but they work as good practice whatever system you use.",
          },
          { type: "cta", primary: { label: `See how they fit ${businessName}`, href: DEMO_URL }, secondary: seePage },
          {
            type: "note",
            text: "When you're ready to talk it through, just reply to this email and we'll walk you through it.",
          },
        ],
      }

    case "thank_you":
      return {
        subject: `Welcome to MartPoint, ${businessName}!`,
        eyebrow: "Welcome aboard",
        title: `Welcome to MartPoint, ${businessName}`,
        preheader: `Thank you for choosing MartPoint — here's what happens next.`,
        blocks: [
          { type: "p", text: `Hi ${firstName},` },
          {
            type: "p",
            text: `Thank you for choosing MartPoint — we're delighted to have ${businessName} on board.`,
          },
          { type: "head", text: "What happens next:" },
          {
            type: "steps",
            items: [
              {
                title: "Onboarding call",
                desc: "We confirm your setup, users and branches, then agree a go-live date.",
              },
              {
                title: "Catalogue setup",
                desc: `Send us your ${angle.catalogueNoun}; during onboarding please provide a maximum of 20 sample products for testing.`,
              },
              {
                title: "Training & go-live",
                desc: "We train your team, run a live check and switch you on.",
              },
            ],
          },
          ...(angle.onboardingNote ? [{ type: "note" as const, text: angle.onboardingNote }] : []),
          {
            type: "cta",
            primary: { label: "Book your onboarding call", href: DEMO_URL },
          },
          {
            type: "note",
            text: "Questions at any point? Simply reply to this email — our team is watching this thread.",
          },
          { type: "p", text: "Welcome aboard." },
        ],
      }
  }
}
