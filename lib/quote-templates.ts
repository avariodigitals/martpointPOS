/* ───────────────────────────  Industry quote templates  ─────────────────────
 * Redefined Public Notes and Payment Terms templates, keyed by industry.
 *
 * A quote needs two free-text blocks:
 *   • Public Notes  — shown to the client on the public quote page and PDF.
 *   • Payment Terms — when and how the client pays.
 *
 * Rather than writing 55 near-identical blobs, templates resolve in three layers:
 *   1. DEFAULT_QUOTE_TEMPLATE            (fallback for every quote)
 *   2. QUOTE_TEMPLATES_BY_CATEGORY       (per industry category)
 *   3. QUOTE_TEMPLATES_BY_SLUG           (specific-industry overrides)
 *
 * `resolveQuoteTemplate()` accepts either a canonical industry name ("Supermarkets"),
 * a business-type form label ("Supermarket") or a slug ("supermarkets") and returns
 * the merged { publicNotes, paymentTerms }.
 */

import { allIndustries, categoryOrder, getIndustryByName, resolveIndustryName } from "./industries"

export interface QuoteTemplateContent {
  publicNotes: string
  paymentTerms: string
}

export const DEFAULT_QUOTE_TEMPLATE: QuoteTemplateContent = {
  publicNotes:
    "This quotation covers the MartPoint Retail Cloud licence and the capacity add-ons listed above.\n" +
    "• Implementation, onsite training and custom workflows are scoped separately and quoted before any work begins.\n" +
    "• Hardware (POS terminals, scanners, printers) and third-party fees are not included unless stated.\n" +
    "• You supply your product catalogue; during onboarding please provide a maximum of 20 sample products for testing.\n" +
    "• Setup timelines are confirmed after a short discovery call, once we have reviewed your requirements.",
  paymentTerms:
    "50% deposit on acceptance of this quotation; balance due before go-live.\n" +
    "The annual licence renews automatically and is payable 30 days before the renewal date. " +
    "Capacity add-ons co-terminate with your subscription term. Hardware and third-party fees are billed separately.",
}

export const QUOTE_TEMPLATES_BY_CATEGORY: Record<string, QuoteTemplateContent> = {
  "Food & Grocery": {
    publicNotes:
      "Covers your MartPoint Retail Cloud licence, barcode checkout, live inventory and multi-branch stock control.\n" +
      "• Expiry/batch tracking and low-stock alerts are included in the licence.\n" +
      "• Catalogue import, till setup and staff training are part of onboarding.\n" +
      "• Weighing scales, barcode scanners, receipt printers and cash drawers are quoted separately.\n" +
      "• You supply the product catalogue; during onboarding provide a maximum of 20 sample products for testing.",
    paymentTerms:
      "60% deposit on acceptance; 40% before go-live.\n" +
      "The annual licence renews 12 months from go-live and is payable 30 days before renewal. " +
      "Extra branches, users and product packs co-terminate with the subscription. Hardware is billed separately.",
  },
  "Restaurants & Food": {
    publicNotes:
      "Covers your MartPoint Retail Cloud licence, kitchen tickets, QR table ordering and ingredient-level stock.\n" +
      "• Menu setup, recipe/portion configuration and staff training are part of onboarding.\n" +
      "• Kitchen printers, tablets and receipt hardware are quoted separately.\n" +
      "• QR codes are generated per table; no app download is required for your customers.\n" +
      "• You supply the menu; during onboarding provide a maximum of 20 sample items for testing.",
    paymentTerms:
      "50% deposit on acceptance; 50% before go-live.\n" +
      "Annual licence renews 12 months from go-live, payable 30 days before renewal. " +
      "Additional branches and users co-terminate with the subscription. Kitchen and POS hardware is billed separately.",
  },
  Health: {
    publicNotes:
      "Covers your MartPoint Retail Cloud licence, batch/expiry tracking, prescription sales records and low-stock alerts.\n" +
      "• Regulatory audit trails (batch numbers, expiry dates, prescription references) are stored securely.\n" +
      "• Catalogue import and counter-staff training are part of onboarding.\n" +
      "• Cold-chain monitoring, specialised dispensing and regulatory licensing fees are quoted separately.\n" +
      "• You supply the product catalogue; during onboarding provide a maximum of 20 sample products for testing.",
    paymentTerms:
      "70% on acceptance; 30% before deployment.\n" +
      "The annual licence renews 12 months from go-live and is payable 30 days before renewal. " +
      "Additional branches/users co-terminate with the subscription. Regulatory, hardware and third-party fees are billed separately.",
  },
  "Fashion & Beauty": {
    publicNotes:
      "Covers your MartPoint Retail Cloud licence, variant/size tracking, appointment or queue flow and the online store.\n" +
      "• Variations (size, colour, style) are tracked as sellable inventory.\n" +
      "• Online store setup and WhatsApp ordering are included in the licence.\n" +
      "• Professional product photography, custom design and paid media are quoted separately.\n" +
      "• You supply the catalogue; during onboarding provide a maximum of 20 sample products for testing.",
    paymentTerms:
      "60% deposit on acceptance; 40% before go-live.\n" +
      "The annual licence renews 12 months from go-live and is payable 30 days before renewal. " +
      "Additional branches, users and product packs co-terminate with the subscription. Design and media work is billed separately.",
  },
  Electronics: {
    publicNotes:
      "Covers your MartPoint Retail Cloud licence, serial/IMEI tracking, warranty management and showroom/warehouse stock.\n" +
      "• Warranty periods are calculated automatically from the sale date.\n" +
      "• Barcode scanners and thermal printers you already own connect out of the box.\n" +
      "• Third-party warranty schemes and installation services are quoted separately.\n" +
      "• You supply the catalogue; during onboarding provide a maximum of 20 sample products for testing.",
    paymentTerms:
      "50% deposit on acceptance; balance on delivery/go-live.\n" +
      "The annual licence renews 12 months from go-live and is payable 30 days before renewal. " +
      "Capacity add-ons co-terminate with the subscription. Hardware and third-party fees are billed separately.",
  },
  "Building Materials": {
    publicNotes:
      "Covers your MartPoint Retail Cloud licence, bulk/unit sales, delivery tracking and supplier records.\n" +
      "• Sales by unit, bundle or weight are supported with delivery notes.\n" +
      "• Supplier and purchase records are included for cost tracking.\n" +
      "• Delivery logistics, haulage and installation are quoted separately.\n" +
      "• You supply the catalogue; during onboarding provide a maximum of 20 sample products for testing.",
    paymentTerms:
      "50% deposit on acceptance; balance on delivery.\n" +
      "The annual licence renews 12 months from go-live, payable 30 days before renewal. " +
      "Additional branches/users co-terminate with the subscription. Haulage and third-party logistics are billed separately.",
  },
  Agriculture: {
    publicNotes:
      "Covers your MartPoint Retail Cloud licence, bulk order recording, weigh-scale sales and delivery scheduling.\n" +
      "• Farmer and cooperative orders are logged with weight, price and payment terms.\n" +
      "• Seasonal and credit sales are tracked alongside cash sales.\n" +
      "• Scales, moisture meters and field hardware are quoted separately.\n" +
      "• You supply the catalogue; during onboarding provide a maximum of 20 sample products for testing.",
    paymentTerms:
      "40% deposit on acceptance; balance at harvest/delivery as agreed.\n" +
      "The annual licence renews 12 months from go-live, payable 30 days before renewal. " +
      "Capacity add-ons co-terminate with the subscription. Field hardware is billed separately.",
  },
  Automotive: {
    publicNotes:
      "Covers your MartPoint Retail Cloud licence, part lookups, service/job records and workshop stock control.\n" +
      "• Parts are tracked by fitment/serial where required.\n" +
      "• Job cards, labour and parts are recorded together for accurate billing.\n" +
      "• Diagnostic tools and workshop equipment are quoted separately.\n" +
      "• You supply the parts catalogue; during onboarding provide a maximum of 20 sample items for testing.",
    paymentTerms:
      "50% deposit on acceptance; balance on completion/go-live.\n" +
      "The annual licence renews 12 months from go-live, payable 30 days before renewal. " +
      "Additional branches/users co-terminate with the subscription. Tools and equipment are billed separately.",
  },
  "General & Specialty Retail": {
    publicNotes:
      "Covers your MartPoint Retail Cloud licence, POS checkout, inventory control and the standard online store.\n" +
      "• Barcode or quick-key checkout, payments and receipts are included.\n" +
      "• Catalogue import and staff training are part of onboarding.\n" +
      "• Hardware, custom design and third-party integrations are quoted separately.\n" +
      "• You supply the catalogue; during onboarding provide a maximum of 20 sample products for testing.",
    paymentTerms:
      "50% deposit on acceptance; balance before go-live.\n" +
      "The annual licence renews 12 months from go-live, payable 30 days before renewal. " +
      "Capacity add-ons co-terminate with the subscription. Hardware and integrations are billed separately.",
  },
  Services: {
    publicNotes:
      "Covers your MartPoint Retail Cloud licence, service catalogue, job/booking records and invoice tracking.\n" +
      "• Services, packages and deposits are managed alongside any products you sell.\n" +
      "• Customer records, collection tracking and reminders are included.\n" +
      "• Print, design and third-party integrations are quoted separately.\n" +
      "• Setup and staff training are part of onboarding.",
    paymentTerms:
      "50% deposit on acceptance; balance before go-live.\n" +
      "The annual licence renews 12 months from go-live, payable 30 days before renewal. " +
      "Additional branches/users co-terminate with the subscription. Design and third-party work is billed separately.",
  },
  "Digital & Creative": {
    publicNotes:
      "Covers your MartPoint Retail Cloud licence, digital catalogue, order fulfilment and customer management.\n" +
      "• Digital products and services are sold through the standard online store.\n" +
      "• Payment links, WhatsApp ordering and abandoned-cart recovery are included.\n" +
      "• Paid advertising, content creation and custom design are quoted separately.\n" +
      "• Setup and account configuration are part of onboarding.",
    paymentTerms:
      "Full payment on acceptance, or 50% deposit with balance before go-live.\n" +
      "The annual licence renews 12 months from go-live, payable 30 days before renewal. " +
      "Capacity add-ons co-terminate with the subscription. Advertising and third-party fees are billed separately.",
  },
  Enterprise: {
    publicNotes:
      "Covers your MartPoint Retail Cloud Enterprise licence, multi-branch roll-out and capacity add-ons.\n" +
      "• ERP functions (finance, HR, manufacturing) are scoped separately and quoted after discovery.\n" +
      "• Implementation is delivered in phases against an agreed roll-out plan.\n" +
      "• Custom integrations, data migration and workshop travel are quoted separately.\n" +
      "• You supply catalogues and migration data; a sample set is used for validation.",
    paymentTerms:
      "40% deposit on acceptance; 40% at configuration sign-off; 20% at go-live.\n" +
      "Annual licence renews 12 months from go-live, payable 30 days before renewal. " +
      "Capacity add-ons co-terminate with the subscription. ERP scope, integrations and travel are billed separately.",
  },
}

/** Per-industry overrides, keyed by industry slug, layered over the category template. */
export const QUOTE_TEMPLATES_BY_SLUG: Record<string, Partial<QuoteTemplateContent>> = {
  supermarkets: {
    publicNotes:
      "Covers your MartPoint Retail Cloud licence, fast barcode checkout, live inventory and multi-branch stock control.\n" +
      "• Thousands of SKUs supported with bulk import, categories and instant search.\n" +
      "• Expiry/batch tracking and low-stock reorder alerts are included.\n" +
      "• Weighing scales, barcode scanners, receipt printers and cash drawers are quoted separately.\n" +
      "• You supply the catalogue; during onboarding provide a maximum of 20 sample products for testing.",
    paymentTerms:
      "60% deposit on acceptance; 40% before go-live.\n" +
      "Annual licence renews 12 months from go-live, payable 30 days before renewal. " +
      "Extra branches, users and product packs co-terminate with the subscription. Hardware is billed separately.",
  },
  pharmacies: {
    publicNotes:
      "Covers your MartPoint Retail Cloud licence, batch/expiry tracking, prescription sales records and low-stock alerts.\n" +
      "• Full audit trail (batch number, expiry, prescription reference) for regulatory inspection.\n" +
      "• FIFO expiry prompts protect patient safety and reduce waste.\n" +
      "• Cold-chain and specialised dispensing equipment is quoted separately.\n" +
      "• You supply the product catalogue; during onboarding provide a maximum of 20 sample products for testing.",
    paymentTerms:
      "70% on acceptance; 30% before deployment.\n" +
      "Annual licence renews 12 months from go-live, payable 30 days before renewal. " +
      "Additional branches/users co-terminate with the subscription. Regulatory and hardware costs are billed separately.",
  },
  restaurants: {
    publicNotes:
      "Covers your MartPoint Retail Cloud licence, QR table ordering, kitchen tickets and recipe-level stock.\n" +
      "• Orders route to the kitchen with table numbers and modifiers.\n" +
      "• Split bills, cash/card/transfer and PayPlan™ installments are supported.\n" +
      "• Kitchen printers, tablets and receipt hardware are quoted separately.\n" +
      "• You supply the menu; during onboarding provide a maximum of 20 sample items for testing.",
    paymentTerms:
      "50% deposit on acceptance; 50% before go-live.\n" +
      "Annual licence renews 12 months from go-live, payable 30 days before renewal. " +
      "Additional branches/users co-terminate with the subscription. Kitchen and POS hardware is billed separately.",
  },
  "electronics-stores": {
    publicNotes:
      "Covers your MartPoint Retail Cloud licence, serial/IMEI tracking, warranty management and showroom/warehouse sync.\n" +
      "• Every unit is logged from purchase to sale, with warranty expiry calculated automatically.\n" +
      "• Existing barcode scanners and thermal printers connect out of the box.\n" +
      "• Third-party warranty schemes and installation are quoted separately.\n" +
      "• You supply the catalogue; during onboarding provide a maximum of 20 sample products for testing.",
    paymentTerms:
      "50% deposit on acceptance; balance on delivery/go-live.\n" +
      "Annual licence renews 12 months from go-live, payable 30 days before renewal. " +
      "Capacity add-ons co-terminate with the subscription. Hardware is billed separately.",
  },
  "multi-branch-retail": {
    publicNotes:
      "Covers your MartPoint Retail Cloud Enterprise licence, multi-branch roll-out and capacity add-ons.\n" +
      "• Central stock visibility, inter-branch transfers and consolidated reporting.\n" +
      "• Phased roll-out against an agreed deployment plan.\n" +
      "• Custom integrations, data migration and onsite travel are quoted separately.\n" +
      "• You supply catalogues and migration data; a sample set is used for validation.",
    paymentTerms:
      "40% deposit on acceptance; 40% at configuration sign-off; 20% at go-live.\n" +
      "Annual licence renews 12 months from go-live, payable 30 days before renewal. " +
      "Capacity add-ons co-terminate with the subscription. Integrations and travel are billed separately.",
  },
}

/** Resolve the merged template for an industry name, business-type label or slug. */
export function resolveQuoteTemplate(industryOrType?: string | null): QuoteTemplateContent {
  const name = resolveIndustryName(industryOrType)
  const industry = getIndustryByName(name)
  const category = industry?.category ? QUOTE_TEMPLATES_BY_CATEGORY[industry.category] : undefined
  const slugOverride = industry ? QUOTE_TEMPLATES_BY_SLUG[industry.slug] : undefined

  return {
    publicNotes:
      slugOverride?.publicNotes ?? category?.publicNotes ?? DEFAULT_QUOTE_TEMPLATE.publicNotes,
    paymentTerms:
      slugOverride?.paymentTerms ?? category?.paymentTerms ?? DEFAULT_QUOTE_TEMPLATE.paymentTerms,
  }
}

/** Options for the "apply template" picker: a General default plus every industry
 *  grouped by category. Values are the canonical industry names (or "" for default). */
export interface QuoteTemplateOption {
  label: string
  value: string
  group: string
}

export function quoteTemplateOptions(): QuoteTemplateOption[] {
  const options: QuoteTemplateOption[] = [
    { label: "General (default)", value: "", group: "General" },
  ]
  for (const category of categoryOrder) {
    for (const industry of allIndustries.filter((i) => i.category === category)) {
      options.push({ label: industry.name, value: industry.name, group: category })
    }
  }
  // Any industry whose category is not in categoryOrder (defensive).
  for (const industry of allIndustries) {
    if (!categoryOrder.includes(industry.category)) {
      options.push({ label: industry.name, value: industry.name, group: "Other" })
    }
  }
  return options
}
