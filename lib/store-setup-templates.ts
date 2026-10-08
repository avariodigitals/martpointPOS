/* ─────────────────────  Store Setup templates (per business type)  ─────────────────────
 * ONE flow: business onboarding.
 *
 * When an admin initiates onboarding for a converted business, we pick a Store Setup
 * template by business type and use it to build the client's onboarding form. The
 * client fills it in at /onboarding/<id>; their answers become the deployment brief.
 *
 * Why a template registry (instead of the old hardcoded DEPLOYMENT_FIELDS):
 *   • the base block was already good — it is preserved verbatim as the "common"
 *     core so EXISTING submissions stay aligned with what we now render,
 *   • business-type layers add the industry-specific asks (e.g. skincare needs
 *     variants by shade/size and expiry dates),
 *   • `generateSetupQuestions()` (the email/WhatsApp prose) is derived from the
 *     same template so the email and the form can never drift apart again.
 *
 * Field `key`s are stable identifiers — they are the JSON keys inside
 * onboarding.client_responses, so NEVER rename a key that already has answers.
 */

export type StoreSetupFieldType =
  | "text"
  | "email"
  | "tel"
  | "number"
  | "date"
  | "select"
  | "multiselect"
  | "textarea"
  | "section"
  | "userlist"
  | "branchlist"
  | "file"

export interface StoreSetupField {
  key: string
  label: string
  type: StoreSetupFieldType
  options?: string[]
  required?: boolean
  helpText?: string
  placeholder?: string
}

export interface StoreSetupTemplate {
  /** Canonical business-type key this template belongs to. */
  key: string
  /** Human label shown in admin ("Skincare & Cosmetics"). */
  label: string
  description: string
  /** Extra industry questions appended to the common core. */
  industry?: StoreSetupField[]
}

/* ───────────────────────────  Common core  ───────────────────────────
 * Preserved from the previous hardcoded onboarding form so existing
 * submissions keep matching the keys we render today. */

export const STORE_SETUP_COMMON: StoreSetupField[] = [
  // ─── Branding ───
  { key: "sectionBranding", label: "Branding", type: "section" },
  { key: "brandName", label: "Brand / store display name", type: "text", required: true, placeholder: "e.g. Ada's Supermart" },
  { key: "preferredSubdomain", label: "Preferred account / subdomain name", type: "text", placeholder: "e.g. adassupermart" },
  {
    key: "receiptFooter",
    label: "Receipt footer message (your sales terms)",
    type: "text",
    placeholder: "e.g. Any item purchased is not returnable. Thank you for shopping with us!",
    helpText: "Printed on every receipt and invoice. Include your returns/exchange policy here.",
  },
  { key: "aboutUs", label: "Footer About Us — short paragraph for your store", type: "textarea" },
  { key: "announcementBar", label: "Announcement bar text", type: "text", placeholder: "e.g. Free delivery on orders above ₦50,000", helpText: "Shown at the top of your store. Leave blank to skip." },
  { key: "socialHandles", label: "Social media handles (Instagram, Facebook, TikTok, X)", type: "textarea", helpText: 'Paste the full links where possible. Type "skip" if you have none.' },

  // ─── Business & Contact ───
  { key: "sectionBusiness", label: "Business & Contact", type: "section" },
  { key: "legalName", label: "Registered business / legal name", type: "text", placeholder: "As registered with CAC" },
  { key: "rcNumber", label: "Business registration number (RC / CAC)", type: "text" },
  { key: "storePhone", label: "Store phone number", type: "tel", required: true },
  { key: "whatsappNumber", label: "WhatsApp number (include country code)", type: "tel", helpText: "Where customers reach you for orders and receipts." },
  { key: "storeEmail", label: "Store email address", type: "email" },
  { key: "orderEmail", label: "Order / sales email address", type: "email", helpText: "Where new orders are sent. Use the store email if they are the same." },
  { key: "address", label: "Store address", type: "textarea", required: true, placeholder: "Street, area, nearest landmark" },
  { key: "city", label: "City", type: "text", required: true },
  { key: "state", label: "State / Region", type: "text", required: true },
  { key: "country", label: "Country", type: "text", required: true },
  { key: "postcode", label: "Postcode", type: "text" },

  // ─── Users & Access ───
  { key: "sectionUsers", label: "Users & Access", type: "section", helpText: "Who should get a login? The primary admin is usually the owner or manager." },
  { key: "adminName", label: "Primary admin — full name", type: "text", required: true },
  { key: "adminEmail", label: "Primary admin — email", type: "email", required: true },
  { key: "adminPhone", label: "Primary admin — phone", type: "tel", required: true },
  { key: "additionalUsers", label: "Additional users and roles", type: "userlist", helpText: 'Add each person who needs a login, e.g. "Wale — Cashier", "Timi — Supervisor".' },

  // ─── Branches ───
  { key: "sectionBranches", label: "Branches", type: "section", helpText: "Your head office is assumed to be the store address above unless listed here." },
  { key: "branchList", label: "Branch locations", type: "branchlist" },

  // ─── Banking & Tax ───
  { key: "sectionBanking", label: "Banking & Tax", type: "section" },
  { key: "bankName", label: "Bank name", type: "text" },
  { key: "accountName", label: "Account name", type: "text" },
  { key: "accountNumber", label: "Business account number", type: "text" },
  { key: "bankDetails", label: "Extra accounts for invoices (if any)", type: "textarea", helpText: "One per line: bank, account name, account number." },
  { key: "vatRegistered", label: "Are you registered for VAT / tax?", type: "select", options: ["Yes", "No"] },
  { key: "taxRate", label: "Tax rate to apply on sales (%)", type: "number", placeholder: "e.g. 7.5" },
  { key: "tin", label: "Tax Identification Number (TIN)", type: "text" },

  // ─── Online Payments ───
  { key: "sectionPayments", label: "Online Payments", type: "section" },
  {
    key: "onlineCheckout",
    label: "Do you want paid online checkout?",
    type: "select",
    options: ["Yes", "No"],
    required: true,
    helpText: "Online payment requires Paystack and a registered business (BN or LTD). If you are not registered yet, we will set up pay-on-delivery or WhatsApp ordering for now.",
  },
  { key: "payOnDelivery", label: "Do you want to offer pay on delivery?", type: "select", options: ["Yes", "No"], required: true },
  { key: "paymentVendor", label: "Which online payment vendor should we connect?", type: "select", options: ["Paystack", "Flutterwave", "Monnify", "Bank transfer only", "None — advise me"], required: true },
  { key: "paymentAccountExists", label: "Do you already have an account with that vendor?", type: "select", options: ["Yes", "No", "Not yet — need help setting up"] },
  { key: "paymentPublicKey", label: "Vendor public key (optional)", type: "text", placeholder: "e.g. pk_live_...", helpText: "Paste your PUBLIC key only. Never share secret keys here — we will collect those securely during setup." },

  // ─── Shipping & Fulfilment ───
  { key: "sectionShipping", label: "Shipping & Fulfilment", type: "section" },
  { key: "shippingArrangement", label: "How do you handle deliveries?", type: "select", options: ["We deliver ourselves", "Third-party courier", "Customer pickup only", "Combination"], required: true },
  { key: "deliveryZones", label: "Delivery areas / zones covered", type: "textarea", placeholder: "e.g. Lekki, VI, Ikoyi — mainland on request" },
  { key: "deliveryFee", label: "Pickup fee and delivery fees by city / region", type: "textarea", placeholder: "e.g. Lagos Island — ₦2,500 (one per line)", helpText: "List each city or area on its own line with the fee." },

  // ─── Data, Hardware & Go-live ───
  { key: "sectionData", label: "Data, Hardware & Go-live", type: "section" },
  { key: "productData", label: "Do you have product data to import?", type: "select", options: ["Yes — CSV/Excel ready", "Yes — needs cleanup", "No — starting fresh"] },
  { key: "productExcel", label: "Product Excel upload", type: "file", helpText: "Upload your product list spreadsheet — we will import it directly. Skip if you have no list yet." },
  { key: "productImages", label: "Product images", type: "file", helpText: "Upload your product photos (zip or individual files), or paste a Drive/Dropbox link in the notes below." },
  { key: "productCategories", label: "Products — list every product category with its pricing", type: "textarea", required: true, helpText: "For each category give the products and prices, including variants that change the price." },
  { key: "productionSheet", label: "Production sheet (for manufactured products)", type: "file", helpText: "Upload the ingredients / recipe sheet. Skip if you do not manufacture." },
  { key: "hardware", label: "What hardware do you have? (select all that apply)", type: "multiselect", options: ["Barcode scanner", "Receipt printer", "Cash drawer", "Customer display", "Tablet / iPad", "Computer", "Weighing scale", "Card terminal", "None yet"] },
  { key: "suppliers", label: "Key suppliers (names and contacts)", type: "textarea" },
  { key: "goLiveDate", label: "Preferred go-live date", type: "date", required: true },
  { key: "specialRequests", label: "Any special deployment or integration requests", type: "textarea" },
]

/* ───────────────────────────  Industry layers  ─────────────────────────── */

const SKINCARE_FIELDS: StoreSetupField[] = [
  { key: "sectionIndustry", label: "Skincare & Cosmetics", type: "section", helpText: "A few specifics for beauty products so we can set up your catalogue correctly." },
  { key: "skinCategories", label: "Product categories (e.g. cleansers, serums, moisturisers, SPF, makeup)", type: "textarea", required: true },
  { key: "skinVariants", label: "Variants you sell — size, shade, skin type or scent", type: "textarea", helpText: "e.g. 30ml / 50ml, shades NC15–NC45, oily/dry/combination." },
  { key: "skinBatchExpiry", label: "Do your products carry batch numbers and expiry dates?", type: "select", options: ["Yes — both batch and expiry", "Expiry only", "No"], required: true },
  { key: "skinNafdac", label: "NAFDAC registration numbers for your products", type: "textarea", helpText: "Required for regulated cosmetics. Skip if not applicable." },
  { key: "skinShelfLife", label: "Typical shelf life / PAO (period after opening)", type: "text", placeholder: "e.g. 24 months unopened, 6 months after opening" },
  { key: "skinConsultation", label: "Do you offer skin consultations or treatments?", type: "select", options: ["Yes", "No"] },
  { key: "skinSamples", label: "Do you give out samples, testers or gift sets?", type: "select", options: ["Yes", "No"] },
  { key: "skinLoyalty", label: "Do you track repeat customers, refills or loyalty points?", type: "select", options: ["Yes", "No"] },
  { key: "skinRegulated", label: "Any products requiring age verification or usage warnings?", type: "textarea", helpText: "e.g. retinol, acids, hydroquinone. Skip if none." },
]

const FASHION_FIELDS: StoreSetupField[] = [
  { key: "sectionIndustry", label: "Fashion & Lifestyle", type: "section" },
  { key: "fashionCategories", label: "Product categories (apparel, footwear, accessories)", type: "textarea", required: true },
  { key: "fashionVariants", label: "Sizes, colours and styles you track", type: "textarea", required: true, helpText: "Tell us your size curve — e.g. S–XXL, UK 3–12, one-size." },
  { key: "fashionSeasonal", label: "Do you run seasonal collections or markdowns?", type: "select", options: ["Yes", "No"] },
  { key: "fashionAlterations", label: "Do you offer tailoring, alterations or styling?", type: "select", options: ["Yes", "No"] },
  { key: "fashionMeasurements", label: "Do you keep customer measurements or style preferences?", type: "select", options: ["Yes", "No"] },
  { key: "fashionLayaway", label: "Do you allow layaway or pre-orders?", type: "select", options: ["Yes", "No"] },
]

const SUPERMARKET_FIELDS: StoreSetupField[] = [
  { key: "sectionIndustry", label: "Grocery & Retail", type: "section" },
  { key: "groceryCategories", label: "Product categories you stock", type: "textarea", required: true },
  { key: "groceryPerishable", label: "Do you stock fresh, frozen or perishable goods?", type: "select", options: ["Yes", "No"] },
  { key: "groceryExpiry", label: "Do you track expiry dates and batches?", type: "select", options: ["Yes — both batch and expiry", "Expiry only", "No"], required: true },
  { key: "groceryUnits", label: "Units of measure (packs, cartons, pieces, weight)", type: "text", placeholder: "e.g. carton of 24, sold per piece" },
  { key: "groceryBulk", label: "Do you sell in bulk with unit conversions?", type: "select", options: ["Yes", "No"] },
  { key: "groceryTills", label: "How many tills or checkout lanes do you run?", type: "number" },
]

const FOOD_FIELDS: StoreSetupField[] = [
  { key: "sectionIndustry", label: "Food & Beverage", type: "section" },
  { key: "foodMenu", label: "Menu categories you sell", type: "textarea", required: true },
  { key: "foodChannels", label: "Which channels do you serve? (select all)", type: "multiselect", options: ["Dine-in", "Takeaway", "Delivery", "Catering"] },
  { key: "foodRecipes", label: "Do you track ingredients per portion / recipe costing?", type: "select", options: ["Yes", "No"] },
  { key: "foodApps", label: "Delivery apps you use (Glovo, Bolt Food, etc.)", type: "text", helpText: "Leave blank if you deliver in-house only." },
  { key: "foodTables", label: "Number of tables / seats", type: "number" },
]

const PHARMACY_FIELDS: StoreSetupField[] = [
  { key: "sectionIndustry", label: "Pharmacy & Health", type: "section" },
  { key: "pharmacyCategories", label: "Product categories (drugs, OTC, consumables)", type: "textarea", required: true },
  { key: "pharmacyRx", label: "Do you record prescriptions against patients?", type: "select", options: ["Yes", "No"], required: true },
  { key: "pharmacyBatchExpiry", label: "Do you track batches and expiry dates?", type: "select", options: ["Yes — both batch and expiry", "Expiry only", "No"], required: true },
  { key: "pharmacyHmo", label: "Do you bill HMOs or insurers?", type: "select", options: ["Yes", "No"] },
  { key: "pharmacyControlled", label: "Do you handle controlled substances requiring extra logging?", type: "select", options: ["Yes", "No"] },
  { key: "pharmacyLicence", label: "Premises licence / PCN registration number", type: "text" },
]

const PRINTING_FIELDS: StoreSetupField[] = [
  { key: "sectionIndustry", label: "Printing & Production", type: "section" },
  { key: "printingCategories", label: "Printing categories and finishing services", type: "textarea", required: true },
  { key: "printingPricingUnit", label: "How do you price work? (per piece, sheet, m²/ft, set, job)", type: "textarea", required: true },
  { key: "printingCustomersSupply", label: "Do customers supply their own materials or garments?", type: "select", options: ["Yes", "No"] },
  { key: "printingEquipment", label: "Production machines you use", type: "textarea" },
  { key: "printingArtworkApproval", label: "How do customers approve artwork? (WhatsApp, email, signed proof)", type: "text" },
]

const SERVICES_FIELDS: StoreSetupField[] = [
  { key: "sectionIndustry", label: "Service Business", type: "section" },
  { key: "servicesOffered", label: "Services you offer", type: "textarea", required: true },
  { key: "servicesPricingUnit", label: "How do you price work? (fixed, hourly, per session, per job)", type: "textarea", required: true },
  { key: "servicesBooking", label: "Do you take appointments or bookings?", type: "select", options: ["Yes", "No"] },
  { key: "servicesScheduling", label: "How do you assign staff or equipment to jobs?", type: "textarea" },
  { key: "servicesWarranty", label: "Do you offer warranties or service guarantees?", type: "select", options: ["Yes", "No"] },
]

const DISTRIBUTION_FIELDS: StoreSetupField[] = [
  { key: "sectionIndustry", label: "Distribution & Manufacturing", type: "section" },
  { key: "distLines", label: "Product lines you distribute or manufacture", type: "textarea", required: true },
  { key: "distCustomers", label: "Customer types (retailers, wholesalers, institutions)", type: "textarea", required: true },
  { key: "distTerritories", label: "Territories, routes or sales reps", type: "textarea" },
  { key: "distUnits", label: "Packaging units (piece, carton, pallet)", type: "text" },
  { key: "distProduction", label: "Do you manufacture? Describe your production process", type: "textarea" },
  { key: "distLogistics", label: "How do you plan deliveries and proof of delivery?", type: "textarea" },
]

/* ───────────────────────────  Registry  ─────────────────────────── */

export const STORE_SETUP_TEMPLATES: StoreSetupTemplate[] = [
  { key: "retail", label: "General Retail", description: "Default store setup for a general retail business.", },
  { key: "skincare", label: "Skincare & Cosmetics", description: "Beauty, skincare and cosmetics — variants, batches, expiry and NAFDAC.", industry: SKINCARE_FIELDS },
  { key: "fashion", label: "Fashion, Beauty & Lifestyle", description: "Apparel, footwear and accessories — size curves and seasonal collections.", industry: FASHION_FIELDS },
  { key: "supermarket", label: "Supermarket & Grocery", description: "Grocery retail — perishables, expiry, bulk units and tills.", industry: SUPERMARKET_FIELDS },
  { key: "restaurant", label: "Restaurants & Food Service", description: "Food service — menu, channels, recipes and delivery apps.", industry: FOOD_FIELDS },
  { key: "pharmacy", label: "Pharmacies & Health Retail", description: "Pharmacy — prescriptions, batches, HMO billing and controlled drugs.", industry: PHARMACY_FIELDS },
  { key: "printing", label: "Printing & Production", description: "Printing — categories, pricing units, materials and artwork approval.", industry: PRINTING_FIELDS },
  { key: "services", label: "Service Businesses", description: "Service businesses — offerings, booking, scheduling and warranties.", industry: SERVICES_FIELDS },
  { key: "distribution", label: "Distribution, Wholesale & Manufacturing", description: "Distribution — lines, territories, units and production.", industry: DISTRIBUTION_FIELDS },
  { key: "erp", label: "ERP / Multi-branch Operations", description: "Multi-branch or manufacturing operations on MartPoint ERP." },
]

/** Loose type / industry aliases → a canonical template key. */
const TEMPLATE_ALIASES: Record<string, string> = {
  // skincare & beauty
  skincare: "skincare", "skincare & organic cosmetics": "skincare", "skincare & cosmetics": "skincare",
  cosmetics: "skincare", "cosmetics stores": "skincare", "perfume shops": "skincare",
  "makeup artists": "skincare", "makeup studios": "skincare", "beauty spas": "skincare",
  "beauty & salons": "skincare", barbershops: "skincare", "beauty salon": "skincare",
  // fashion
  fashion: "fashion", "fashion store": "fashion", "fashion stores": "fashion", boutiques: "fashion",
  "shoe stores": "fashion", "jewellery stores": "fashion",
  // supermarket
  supermarket: "supermarket", supermarkets: "supermarket", "mini marts": "supermarket", "mini mart": "supermarket",
  "grocery stores": "supermarket", "provision stores": "supermarket", "convenience stores": "supermarket",
  "frozen foods": "supermarket",
  // food
  restaurant: "restaurant", restaurants: "restaurant", "fast food": "restaurant", bakeries: "restaurant",
  "cake shops": "restaurant", cafes: "restaurant", "cafés": "restaurant", "pizza shops": "restaurant",
  shawarma: "restaurant", "juice bars": "restaurant", "bars & lounges": "restaurant",
  "canteens & food courts": "restaurant", "bukka / mama put": "restaurant",
  // pharmacy
  pharmacy: "pharmacy", pharmacies: "pharmacy", "medical stores": "pharmacy", clinics: "pharmacy",
  hospitals: "pharmacy", "diagnostic centres": "pharmacy", "physiotherapy & rehabilitation": "pharmacy",
  // printing
  printing: "printing", "print shop": "printing", "print shops": "printing",
  // services
  services: "services", "service business": "services", "service businesses": "services",
  laundry: "services", tailoring: "services", "digital creator": "services",
  // distribution
  distribution: "distribution", distributors: "distribution", wholesalers: "distribution",
  manufacturers: "distribution", "nylon & polythene manufacturing": "distribution",
  // retail catch-alls
  "electronics stores": "retail", "electronics store": "retail", "phone shops": "retail",
  "computer stores": "retail", "gadget stores": "retail", "appliance stores": "retail",
  "hardware stores": "retail", "paint stores": "retail", "plumbing stores": "retail",
  bookshops: "retail", "furniture stores": "retail", "agro dealers": "retail", "feed stores": "retail",
  "auto parts": "retail", "tyre shops": "retail", automobile: "retail",
  "scientific & laboratory suppliers": "retail", "online stores": "retail", retail: "retail",
  // erp
  erp: "erp", "martpoint erp": "erp", manufacturing: "erp",
}

/** Resolve a business type / industry / product interest to a template key. */
export function resolveStoreSetupTemplateKey(input: string | null | undefined): string {
  const value = (input || "").trim().toLowerCase()
  if (!value) return "retail"
  const direct = STORE_SETUP_TEMPLATES.find((t) => t.key === value)
  if (direct) return direct.key
  return TEMPLATE_ALIASES[value] || "retail"
}

export function getStoreSetupTemplate(input: string | null | undefined): StoreSetupTemplate {
  const key = resolveStoreSetupTemplateKey(input)
  return STORE_SETUP_TEMPLATES.find((t) => t.key === key) ?? STORE_SETUP_TEMPLATES[0]
}

/** Full field list for a business type: common core + industry layer. */
export function getStoreSetupFields(input: string | null | undefined): StoreSetupField[] {
  const template = getStoreSetupTemplate(input)
  return [...STORE_SETUP_COMMON, ...(template.industry || [])]
}

/** Deep copy so callers can edit a rendered form without mutating the registry. */
export function cloneStoreSetupFields(fields: StoreSetupField[]): StoreSetupField[] {
  return fields.map((f) => ({ ...f, options: f.options ? [...f.options] : undefined }))
}

/**
 * Seed the Store Setup questionnaire into the legacy prose format used by the
 * onboarding email / WhatsApp message. Derived from the SAME template as the
 * form, so the two can never drift apart.
 */
export function generateSetupQuestions(businessType: string | null | undefined): string {
  const lines: string[] = []
  let n = 0
  for (const field of getStoreSetupFields(businessType)) {
    if (field.type === "section") {
      lines.push(`— ${field.label} —`)
      continue
    }
    n += 1
    lines.push(`${n}. ${field.label}${field.required ? "" : " (optional)"}`)
  }
  return lines.join("\n")
}
