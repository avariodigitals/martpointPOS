import type { QuestionnaireField } from "./lead-questionnaire"

export interface LeadAdditionalQuestionTemplate {
  industry: string
  label: string
  fields: QuestionnaireField[]
}

const printingQuestions: QuestionnaireField[] = [
  { name: "printing_services", label: "Services: Which printing categories and finishing services do you offer? Which stages are outsourced?", type: "textarea", required: true },
  { name: "printing_orders", label: "Orders: Can one order contain several printing categories? Do you allow partial completion or collection?", type: "textarea", required: true },
  { name: "printing_pricing", label: "Pricing: How do you price each category—per piece, sheet, square metre/foot, set or complete job? Do prices vary by quantity, material or customer?", type: "textarea", required: true },
  { name: "printing_design", label: "Design: Do you charge separately for new designs and artwork modifications? Who can discount or waive the fee, and how many revisions are included?", type: "textarea", required: true },
  { name: "printing_payments", label: "Payments: What deposit is required for each type of job? When is the balance due, and which customers receive approved credit?", type: "textarea", required: true },
  { name: "printing_approvals", label: "Approvals: Who checks artwork technically, verifies payments, authorizes production and approves exceptions? Who acts as backup?", type: "textarea", required: true },
  { name: "printing_customer_artwork_approval", label: "Customer artwork approval: Do customers approve through WhatsApp, email or signed proof? How do you handle unchanged repeat jobs?", type: "textarea", required: true },
  { name: "printing_materials", label: "Materials: Which materials do you track, and in what purchasing and usage units? Do customers supply garments or materials, and how do you record unused returns?", type: "textarea", required: true },
  { name: "printing_production_equipment", label: "Production equipment: Which machines do you use? Do you record meter readings, ink replenishment, toner replacements or material usage today?", type: "textarea", required: true },
  { name: "printing_changes_rework", label: "Changes and rework: How do you handle changes after approval, cancellations and faulty output? Who decides whether extra costs are charged to the customer?", type: "textarea", required: true },
  { name: "printing_fulfilment", label: "Fulfilment: Do you provide delivery or installation? Who confirms collection or delivery, and can goods leave with an outstanding balance?", type: "textarea", required: true },
  { name: "printing_referrals", label: "Referrals: Who qualifies for a job referral bonus? Is it fixed or percentage-based, when is it payable, and do repeat orders qualify?", type: "textarea", required: true },
  { name: "printing_access_connectivity", label: "Access and connectivity: How often is internet access unavailable?", type: "textarea", required: true },
  { name: "printing_migration_samples", label: "Migration (a) — Samples: Can you share anonymized sample Excel records, a quotation or job card, and the monthly report management currently uses?", type: "textarea", required: true, helpText: "We only need anonymized samples — never live customer data." },
  { name: "printing_migration_scope", label: "Migration (b) — Records to migrate: Which historical records must move into MartPoint (for example customers, jobs, stock or outstanding balances), and how far back?", type: "textarea", required: true },
  { name: "printing_migration_uploads", label: "Migration (c) — Uploads: How would you like to send us the sample files? Paste a secure file-sharing link (Google Drive, Dropbox, WeTransfer) or tell us you will email them after submitting.", type: "text", required: true, helpText: "Add a secure file-sharing link here, or email the files to us after submitting." },
  { name: "printing_online_store", label: "Online store: Do you have a website? Which services should customers request online? Should any have fixed prices and checkout, or should all require quotation review?", type: "textarea", required: true },
]

const supermarketQuestions: QuestionnaireField[] = [
  { name: "retail_services", label: "Products: Which product categories do you sell? Do you stock fresh, frozen, or perishable goods that need batch and expiry tracking?", type: "textarea", required: true },
  { name: "retail_locations", label: "Locations: How many branches, tills or checkout lanes do you operate today? Do you plan to add more?", type: "textarea", required: true },
  { name: "retail_orders", label: "Sales flow: Do you offer delivery, online ordering or pickup? Do you allow credit sales, transfers or partial payments?", type: "textarea", required: true },
  { name: "retail_pricing", label: "Pricing: Do prices vary by branch, customer type or promotion? How do you apply discounts and price changes across the catalogue?", type: "textarea", required: true },
  { name: "retail_stock", label: "Stock: Which units of measure do you use (packs, cartons, pieces, weight)? How do you handle bulk-to-unit conversions, transfers and stock counts?", type: "textarea", required: true },
  { name: "retail_suppliers", label: "Suppliers and purchasing: How do you record purchases, supplier payments and returns? Which suppliers offer credit terms?", type: "textarea", required: true },
  { name: "retail_expiry", label: "Expiry and batch control: Do you currently track expiry dates and batches? What discount or removal process applies to near-expiry goods?", type: "textarea", required: true },
  { name: "retail_payments", label: "Payments: Which payment methods do you accept (cash, transfer, card, POS, wallet)? Is reconciliation done per till, shift or cashier?", type: "textarea", required: true },
  { name: "retail_approvals", label: "Approvals: Who authorises discounts, refunds, voids and stock adjustments? Who acts as backup?", type: "textarea", required: true },
  { name: "retail_staff", label: "Staff and shifts: How do you track attendance, shifts and cashier sales performance? Do you pay commissions?", type: "textarea", required: true },
  { name: "retail_reports", label: "Reports: Which daily, weekly and monthly reports does management use today? What do you need to see on a dashboard?", type: "textarea", required: true },
  { name: "retail_access_connectivity", label: "Access and connectivity: How often is internet access unavailable? Do you need offline selling and automatic sync?", type: "textarea", required: true },
  { name: "retail_migration_samples", label: "Migration (a) — Samples: Can you share anonymized sample product lists, sales records and the reports management currently uses?", type: "textarea", required: true, helpText: "We only need anonymized samples — never live customer data." },
  { name: "retail_migration_scope", label: "Migration (b) — Records to migrate: Which historical records must move into MartPoint (for example products, customers, stock or outstanding balances), and how far back?", type: "textarea", required: true },
  { name: "retail_migration_uploads", label: "Migration (c) — Uploads: How would you like to send us the sample files? Paste a secure file-sharing link (Google Drive, Dropbox, WeTransfer) or tell us you will email them after submitting.", type: "text", required: true, helpText: "Add a secure file-sharing link here, or email the files to us after submitting." },
  { name: "retail_online_store", label: "Online store: Do you have a website? Which products should customers buy online, and should any have fixed prices with checkout?", type: "textarea", required: true },
]

const restaurantQuestions: QuestionnaireField[] = [
  { name: "food_services", label: "Menu: Which food and drink categories do you sell? Do you offer dine-in, takeaway, delivery or catering? Which stages are outsourced?", type: "textarea", required: true },
  { name: "food_orders", label: "Orders: Can one order contain multiple items with special requests? Do you allow split bills, table transfers or pre-orders?", type: "textarea", required: true },
  { name: "food_pricing", label: "Pricing: How do you price menu items? Do prices vary by portion, channel (dine-in vs delivery) or time of day? How are promos applied?", type: "textarea", required: true },
  { name: "food_recipes", label: "Recipes and portions: Do you track ingredients per portion? How do you cost a recipe and monitor wastage?", type: "textarea", required: true },
  { name: "food_kitchen", label: "Kitchen flow: How do orders reach the kitchen (tickets, screens, verbal)? Who confirms readiness and dispatch?", type: "textarea", required: true },
  { name: "food_inventory", label: "Inventory: Which raw materials do you track, in what purchasing and usage units? How do you record spoilage and unused returns?", type: "textarea", required: true },
  { name: "food_payments", label: "Payments: Do you require deposits for large or catering orders? Which customers receive credit, and when is the balance due?", type: "textarea", required: true },
  { name: "food_approvals", label: "Approvals: Who authorises discounts, voids, comps and refunds? Who acts as backup?", type: "textarea", required: true },
  { name: "food_staff", label: "Staff and shifts: How do you track attendance, tips, shift handover and cashier or waiter performance?", type: "textarea", required: true },
  { name: "food_delivery", label: "Delivery and fulfilment: Do you deliver in-house or through apps (e.g. Glovo, Bolt Food)? Who confirms delivery and collects payment?", type: "textarea", required: true },
  { name: "food_reports", label: "Reports: Which daily and monthly reports does management use (sales, food cost, wastage, best sellers)?", type: "textarea", required: true },
  { name: "food_access_connectivity", label: "Access and connectivity: How often is internet access unavailable? Do you need offline ordering and automatic sync?", type: "textarea", required: true },
  { name: "food_migration_samples", label: "Migration (a) — Samples: Can you share anonymized sample menu, recipe and sales records, and the reports management currently uses?", type: "textarea", required: true, helpText: "We only need anonymized samples — never live customer data." },
  { name: "food_migration_scope", label: "Migration (b) — Records to migrate: Which historical records must move into MartPoint (for example menu, recipes, customers or outstanding balances), and how far back?", type: "textarea", required: true },
  { name: "food_migration_uploads", label: "Migration (c) — Uploads: How would you like to send us the sample files? Paste a secure file-sharing link (Google Drive, Dropbox, WeTransfer) or tell us you will email them after submitting.", type: "text", required: true, helpText: "Add a secure file-sharing link here, or email the files to us after submitting." },
  { name: "food_online_store", label: "Online store: Do you have a website or ordering page? Which items should customers order online with fixed prices and checkout?", type: "textarea", required: true },
]

const pharmacyQuestions: QuestionnaireField[] = [
  { name: "pharmacy_services", label: "Services: Do you dispense, sell over-the-counter, offer consultations or run a clinic? Which services are outsourced?", type: "textarea", required: true },
  { name: "pharmacy_orders", label: "Orders: Can one order combine prescription and OTC items? Do you allow partial dispensing, refills or holds?", type: "textarea", required: true },
  { name: "pharmacy_pricing", label: "Pricing: How do you price drugs and services? Do prices vary by brand, pack size, HMO or customer type?", type: "textarea", required: true },
  { name: "pharmacy_batches", label: "Batches and expiry: Which medicines do you track by batch and expiry? What is your process for near-expiry, recalled and expired stock?", type: "textarea", required: true },
  { name: "pharmacy_prescriptions", label: "Prescriptions: Do you record prescriptions and dispensed quantities against a patient? How are repeat prescriptions handled?", type: "textarea", required: true },
  { name: "pharmacy_inventory", label: "Inventory: Which purchasing and usage units do you track? How do you handle bulk packs, loose dispensing and returns to suppliers?", type: "textarea", required: true },
  { name: "pharmacy_payments", label: "Payments: Do you bill HMOs or insurers? What deposit or credit terms apply, and when is the balance due?", type: "textarea", required: true },
  { name: "pharmacy_approvals", label: "Approvals: Who verifies prescriptions, authorises discounts, refunds and stock adjustments? Who acts as backup?", type: "textarea", required: true },
  { name: "pharmacy_staff", label: "Staff and licensing: Who are your pharmacists and locums? How do you track attendance, shifts and dispensing responsibility?", type: "textarea", required: true },
  { name: "pharmacy_reports", label: "Reports: Which reports does management use (sales, stock valuation, expiry, HMO claims, controlled drugs)?", type: "textarea", required: true },
  { name: "pharmacy_access_connectivity", label: "Access and connectivity: How often is internet access unavailable? Do you need offline dispensing and automatic sync?", type: "textarea", required: true },
  { name: "pharmacy_migration_samples", label: "Migration (a) — Samples: Can you share anonymized sample drug lists, sales records and the reports management currently uses?", type: "textarea", required: true, helpText: "We only need anonymized samples — never live customer data." },
  { name: "pharmacy_migration_scope", label: "Migration (b) — Records to migrate: Which historical records must move into MartPoint (for example products, batches, customers or outstanding balances), and how far back?", type: "textarea", required: true },
  { name: "pharmacy_migration_uploads", label: "Migration (c) — Uploads: How would you like to send us the sample files? Paste a secure file-sharing link (Google Drive, Dropbox, WeTransfer) or tell us you will email them after submitting.", type: "text", required: true, helpText: "Add a secure file-sharing link here, or email the files to us after submitting." },
  { name: "pharmacy_online_store", label: "Online store: Do you have a website? Which items may be ordered online, and should any require prescription review before checkout?", type: "textarea", required: true },
]

const fashionQuestions: QuestionnaireField[] = [
  { name: "fashion_services", label: "Products and services: Which apparel, footwear, cosmetics or beauty lines do you offer? Do you offer tailoring, styling or spa services?", type: "textarea", required: true },
  { name: "fashion_variants", label: "Variants: Which sizes, colours and styles do you track? How do you manage size curves and variant-level stock?", type: "textarea", required: true },
  { name: "fashion_orders", label: "Orders: Can one order mix sizes and variants? Do you allow layaway, pre-orders, alterations or partial collection?", type: "textarea", required: true },
  { name: "fashion_pricing", label: "Pricing: How do you price each line? Do prices vary by season, collection, customer or promotion? How are markdowns applied?", type: "textarea", required: true },
  { name: "fashion_inventory", label: "Inventory: Which purchasing and usage units do you track? How do you record damaged goods, fabric usage and unused returns?", type: "textarea", required: true },
  { name: "fashion_payments", label: "Payments: What deposit is required for restocking or custom orders? When is the balance due, and which customers receive credit?", type: "textarea", required: true },
  { name: "fashion_approvals", label: "Approvals: Who authorises discounts, exchanges, refunds and stock adjustments? Who acts as backup?", type: "textarea", required: true },
  { name: "fashion_customers", label: "Customers: Do you keep measurements, style preferences or loyalty points? How do you handle repeat or VIP customers?", type: "textarea", required: true },
  { name: "fashion_staff", label: "Staff and shifts: How do you track sales by stylist, attendant or branch? Do you pay commissions?", type: "textarea", required: true },
  { name: "fashion_reports", label: "Reports: Which reports does management use (best sellers, slow movers, stock by variant, branch performance)?", type: "textarea", required: true },
  { name: "fashion_access_connectivity", label: "Access and connectivity: How often is internet access unavailable? Do you need offline selling and automatic sync?", type: "textarea", required: true },
  { name: "fashion_migration_samples", label: "Migration (a) — Samples: Can you share anonymized sample product lists, sales records and the reports management currently uses?", type: "textarea", required: true, helpText: "We only need anonymized samples — never live customer data." },
  { name: "fashion_migration_scope", label: "Migration (b) — Records to migrate: Which historical records must move into MartPoint (for example products, variants, customers or outstanding balances), and how far back?", type: "textarea", required: true },
  { name: "fashion_migration_uploads", label: "Migration (c) — Uploads: How would you like to send us the sample files? Paste a secure file-sharing link (Google Drive, Dropbox, WeTransfer) or tell us you will email them after submitting.", type: "text", required: true, helpText: "Add a secure file-sharing link here, or email the files to us after submitting." },
  { name: "fashion_online_store", label: "Online store: Do you have a website or social catalogue? Which items should customers buy online, and should any have fixed prices with checkout?", type: "textarea", required: true },
]

const electronicsQuestions: QuestionnaireField[] = [
  { name: "electronics_services", label: "Products and services: Which electronics, gadgets or hardware lines do you sell? Do you offer repairs, installation or warranty service?", type: "textarea", required: true },
  { name: "electronics_serials", label: "Serial tracking: Do you track IMEI, serial numbers or warranty per unit? How do you record repairs and replacements?", type: "textarea", required: true },
  { name: "electronics_orders", label: "Orders: Can one order contain accessories and devices with different warranty terms? Do you allow special orders or backorders?", type: "textarea", required: true },
  { name: "electronics_pricing", label: "Pricing: How do you price each category? Do prices vary by quantity, supplier cost, customer type or promotion? How are price changes handled?", type: "textarea", required: true },
  { name: "electronics_inventory", label: "Inventory: Which purchasing and usage units do you track? How do you handle accessories, kits, demo units and defective returns?", type: "textarea", required: true },
  { name: "electronics_payments", label: "Payments: Do you offer instalments or layaway? What deposit is required, and which customers receive approved credit?", type: "textarea", required: true },
  { name: "electronics_approvals", label: "Approvals: Who authorises discounts, refunds, warranty claims and stock adjustments? Who acts as backup?", type: "textarea", required: true },
  { name: "electronics_warranty", label: "Warranty and after-sales: How do you track warranty periods, repair tickets and customer devices in for service?", type: "textarea", required: true },
  { name: "electronics_suppliers", label: "Suppliers and purchasing: How do you record purchases, supplier payments and warranty returns? Which suppliers offer credit terms?", type: "textarea", required: true },
  { name: "electronics_reports", label: "Reports: Which reports does management use (sales, stock by serial, warranty exposure, profitability)?", type: "textarea", required: true },
  { name: "electronics_access_connectivity", label: "Access and connectivity: How often is internet access unavailable? Do you need offline selling and automatic sync?", type: "textarea", required: true },
  { name: "electronics_migration_samples", label: "Migration (a) — Samples: Can you share anonymized sample product lists, sales records and the reports management currently uses?", type: "textarea", required: true, helpText: "We only need anonymized samples — never live customer data." },
  { name: "electronics_migration_scope", label: "Migration (b) — Records to migrate: Which historical records must move into MartPoint (for example products, serials, customers or outstanding balances), and how far back?", type: "textarea", required: true },
  { name: "electronics_migration_uploads", label: "Migration (c) — Uploads: How would you like to send us the sample files? Paste a secure file-sharing link (Google Drive, Dropbox, WeTransfer) or tell us you will email them after submitting.", type: "text", required: true, helpText: "Add a secure file-sharing link here, or email the files to us after submitting." },
  { name: "electronics_online_store", label: "Online store: Do you have a website? Which products should customers buy online, and should any have fixed prices with checkout?", type: "textarea", required: true },
]

const servicesQuestions: QuestionnaireField[] = [
  { name: "services_offer", label: "Services: Which services do you offer? Which stages are outsourced?", type: "textarea", required: true },
  { name: "services_orders", label: "Jobs and bookings: How do you book appointments or jobs? Can one order contain several services, and do you allow partial completion?", type: "textarea", required: true },
  { name: "services_pricing", label: "Pricing: How do you price each service—fixed, hourly, per session, per set or complete job? Do prices vary by customer or package?", type: "textarea", required: true },
  { name: "services_payments", label: "Payments: What deposit is required? When is the balance due, and which customers receive approved credit or subscriptions?", type: "textarea", required: true },
  { name: "services_approvals", label: "Approvals: Who checks the work, verifies payments, authorises delivery and approves exceptions? Who acts as backup?", type: "textarea", required: true },
  { name: "services_materials", label: "Materials and parts: Which materials or spare parts do you track, and in what purchasing and usage units? How do you record unused returns?", type: "textarea", required: true },
  { name: "services_scheduling", label: "Scheduling: How do you assign staff, resources or equipment to jobs? How do you handle rescheduling and no-shows?", type: "textarea", required: true },
  { name: "services_rework", label: "Changes and rework: How do you handle changes after approval, cancellations and faulty work? Who decides whether extra costs are charged?", type: "textarea", required: true },
  { name: "services_customers", label: "Customers: Do you keep service history, warranties or loyalty records per customer? How do repeat jobs differ?", type: "textarea", required: true },
  { name: "services_reports", label: "Reports: Which daily, weekly and monthly reports does management use?", type: "textarea", required: true },
  { name: "services_access_connectivity", label: "Access and connectivity: How often is internet access unavailable?", type: "textarea", required: true },
  { name: "services_migration_samples", label: "Migration (a) — Samples: Can you share anonymized sample records, a job card and the reports management currently uses?", type: "textarea", required: true, helpText: "We only need anonymized samples — never live customer data." },
  { name: "services_migration_scope", label: "Migration (b) — Records to migrate: Which historical records must move into MartPoint (for example customers, jobs, service history or outstanding balances), and how far back?", type: "textarea", required: true },
  { name: "services_migration_uploads", label: "Migration (c) — Uploads: How would you like to send us the sample files? Paste a secure file-sharing link (Google Drive, Dropbox, WeTransfer) or tell us you will email them after submitting.", type: "text", required: true, helpText: "Add a secure file-sharing link here, or email the files to us after submitting." },
  { name: "services_online_store", label: "Online store: Do you have a website? Which services should customers request online, and should any have fixed prices with checkout?", type: "textarea", required: true },
]

const distributionQuestions: QuestionnaireField[] = [
  { name: "dist_services", label: "Products: Which product lines do you distribute or manufacture? Which stages are outsourced?", type: "textarea", required: true },
  { name: "dist_orders", label: "Orders: Can one order contain several product lines? Do you allow partial dispatch, backorders or standing orders?", type: "textarea", required: true },
  { name: "dist_pricing", label: "Pricing: How do you price each line—per piece, carton, pallet or complete order? Do prices vary by quantity, route or customer tier?", type: "textarea", required: true },
  { name: "dist_customers", label: "Customers and channels: Who are your customers (retailers, wholesalers, institutions)? How do you manage territories, routes and sales reps?", type: "textarea", required: true },
  { name: "dist_payments", label: "Payments: What deposit or credit terms apply? When is the balance due, and how do you monitor overdue accounts?", type: "textarea", required: true },
  { name: "dist_approvals", label: "Approvals: Who authorises credit limits, discounts, dispatch and exceptions? Who acts as backup?", type: "textarea", required: true },
  { name: "dist_inventory", label: "Inventory: Which materials do you track, and in what purchasing, production and usage units? How do you record returns and damages?", type: "textarea", required: true },
  { name: "dist_logistics", label: "Logistics: How do you plan deliveries, load vehicles and confirm proof of delivery? Can goods leave with an outstanding balance?", type: "textarea", required: true },
  { name: "dist_production", label: "Production (if manufacturing): Which machines do you use? Do you record input, output, wastage or downtime today?", type: "textarea", required: true },
  { name: "dist_reports", label: "Reports: Which reports does management use (sales by rep, route, stock, receivables, production)?", type: "textarea", required: true },
  { name: "dist_access_connectivity", label: "Access and connectivity: How often is internet access unavailable across branches or field teams?", type: "textarea", required: true },
  { name: "dist_migration_samples", label: "Migration (a) — Samples: Can you share anonymized sample records, an invoice and the reports management currently uses?", type: "textarea", required: true, helpText: "We only need anonymized samples — never live customer data." },
  { name: "dist_migration_scope", label: "Migration (b) — Records to migrate: Which historical records must move into MartPoint (for example products, customers, stock or outstanding balances), and how far back?", type: "textarea", required: true },
  { name: "dist_migration_uploads", label: "Migration (c) — Uploads: How would you like to send us the sample files? Paste a secure file-sharing link (Google Drive, Dropbox, WeTransfer) or tell us you will email them after submitting.", type: "text", required: true, helpText: "Add a secure file-sharing link here, or email the files to us after submitting." },
  { name: "dist_online_store", label: "Online store: Do you have a website or B2B portal? Which products should customers order online, and should any have fixed prices with checkout?", type: "textarea", required: true },
]

/**
 * Shared "Store Setup" block.
 *
 * This is the information we cannot invent for a client and cannot collect from
 * the industry questionnaire (which is about *workflow*). It is appended to the
 * END of every industry template — it is industry-agnostic, so a SkinCare store
 * and a supermarket answer exactly the same questions. Business name is NOT
 * asked here: the client is already a business by this point.
 *
 * Names are prefixed `store_setup_` and the block opens with a `section` field so
 * the public form renders a titled divider (see components/shared/questionnaire-fields.tsx).
 */
export const STORE_SETUP_FIELDS: QuestionnaireField[] = [
  {
    name: "store_setup_intro",
    label: "Store Setup",
    type: "section",
    helpText:
      "Almost there — these are the details we need to build your live store. You can skip anything you do not have yet and send it later.",
  },
  {
    name: "store_setup_address",
    label: "Store address: street address, city, state, country and postcode",
    type: "textarea",
    required: true,
    helpText: "One address per branch. Tell us which is your head office.",
  },
  {
    name: "store_setup_phone_whatsapp",
    label: "Phone and WhatsApp numbers (include country code, e.g. +234 801 234 5678)",
    type: "textarea",
    required: true,
    helpText: "WhatsApp is what your customers will use to reach you for orders and receipts.",
  },
  {
    name: "store_setup_store_email",
    label: "Store email address",
    type: "email",
    required: true,
    helpText: "Shown to customers on your store and used for enquiries.",
  },
  {
    name: "store_setup_order_email",
    label: "Order / sales email address",
    type: "email",
    required: true,
    helpText: "Where new orders and notifications are sent. Use the store email if they are the same.",
  },
  {
    name: "store_setup_receipt_footer",
    label: "Receipt footer note — your sales terms printed on every invoice or receipt",
    type: "textarea",
    required: true,
    helpText: 'Example: "Any item purchased is not returnable. Please check your purchase before leaving the store." Also add your return, exchange and refund policy here.',
  },
  {
    name: "store_setup_about_us",
    label: "Footer About Us — a short paragraph describing your business",
    type: "textarea",
    helpText: "Two or three sentences customers will see in your store footer. We will not write this for you, so please supply the exact wording.",
  },
  {
    name: "store_setup_announcement_bar",
    label: "Announcement bar text — the promo message shown at the top of your store",
    type: "text",
    helpText: 'e.g. "Free delivery on orders above ₦50,000 — nationwide shipping." Leave blank to skip.',
  },
  {
    name: "store_setup_social_handles",
    label: 'Social media handles (Instagram, Facebook, TikTok, X). Type "skip" if you have none.',
    type: "textarea",
    helpText: "Paste the full links where possible so we can link them in your footer.",
  },
  {
    name: "store_setup_online_checkout",
    label: "Do you want to accept paid online checkout?",
    type: "select",
    options: ["Yes", "No"],
    required: true,
    helpText: "Online payment requires Paystack and a registered business (BN or LTD). If you are not registered yet, we will set up pay-on-delivery or WhatsApp ordering for now.",
  },
  {
    name: "store_setup_pay_on_delivery",
    label: "Do you want to offer pay on delivery?",
    type: "select",
    options: ["Yes", "No"],
    required: true,
    helpText: "Customers pay the rider or at pickup instead of paying online.",
  },
  {
    name: "store_setup_delivery_fees",
    label: "Pickup fee and delivery fees by city or region",
    type: "textarea",
    required: true,
    helpText: 'List each city or area on its own line with the fee, e.g. "Lagos Island — ₦2,500" or "Pickup (Ikeja) — ₦0". Tell us if you also charge by distance or order weight.',
  },
  {
    name: "store_setup_bank_details",
    label: "Bank name, account name and account number for your invoices",
    type: "textarea",
    required: true,
    helpText: "Exactly as it should print on an invoice. One line per account if you use several.",
  },
  {
    name: "store_setup_products",
    label: "Products — list every product category with its pricing",
    type: "textarea",
    required: true,
    helpText: "For each category give the products and prices (including variants such as size, colour or weight if they change the price).",
  },
  {
    name: "store_setup_product_images",
    label: "Product images — paste a Google Drive (or Dropbox) link with all product photos",
    type: "text",
    required: true,
    helpText: 'Create one folder, upload every product image, set it to "Anyone with the link can view", then paste the link here. Name each file after the product.',
  },
  {
    name: "store_setup_product_excel",
    label: "Product Excel upload — paste a link to your product list spreadsheet",
    type: "text",
    helpText: "If you already keep products in Excel, upload the file and paste the link — we will import it directly. Skip if you have no list yet.",
  },
  {
    name: "store_setup_production_sheet",
    label: "Production sheet — for manufactured products, list the ingredients and paste the file link",
    type: "textarea",
    helpText: "Describe how each product is made (ingredients or raw materials, quantities, batch size) and continue the sentence with the link to your production sheet file. Skip if you do not manufacture.",
  },
  {
    name: "store_setup_user_list",
    label: "Team and roles — list each person and what they should be able to do",
    type: "textarea",
    required: true,
    helpText: 'One per line in this format: "Wale — Cashier", "Timi — Supervisor", "Tunde — Business Owner". Include the email or phone each person will log in with if you have it.',
  },
]

export const LEAD_ADDITIONAL_QUESTION_TEMPLATES: LeadAdditionalQuestionTemplate[] = [
  { industry: "Printing", label: "Printing", fields: [...printingQuestions, ...STORE_SETUP_FIELDS] },
  { industry: "Supermarkets", label: "Supermarkets & Grocery Retail", fields: [...supermarketQuestions, ...STORE_SETUP_FIELDS] },
  { industry: "Restaurants", label: "Restaurants & Food Service", fields: [...restaurantQuestions, ...STORE_SETUP_FIELDS] },
  { industry: "Pharmacies", label: "Pharmacies & Health Retail", fields: [...pharmacyQuestions, ...STORE_SETUP_FIELDS] },
  { industry: "Fashion Stores", label: "Fashion, Beauty & Lifestyle Retail", fields: [...fashionQuestions, ...STORE_SETUP_FIELDS] },
  { industry: "Electronics Stores", label: "Electronics & Hardware Retail", fields: [...electronicsQuestions, ...STORE_SETUP_FIELDS] },
  { industry: "Service Businesses", label: "Service Businesses", fields: [...servicesQuestions, ...STORE_SETUP_FIELDS] },
  { industry: "Distributors", label: "Distribution, Wholesale & Manufacturing", fields: [...distributionQuestions, ...STORE_SETUP_FIELDS] },
]

/** Aliases map alternate business types / industry names to a canonical template
 *  so the admin dropdown and a lead's stored `industry` both resolve correctly. */
const TEMPLATE_ALIASES: Record<string, string> = {
  supermarket: "Supermarkets",
  "mini marts": "Supermarkets",
  "mini mart": "Supermarkets",
  "grocery stores": "Supermarkets",
  "provision stores": "Supermarkets",
  "convenience stores": "Supermarkets",
  "frozen foods": "Supermarkets",
  restaurant: "Restaurants",
  "fast food": "Restaurants",
  bakeries: "Restaurants",
  "cake shops": "Restaurants",
  cafés: "Restaurants",
  cafes: "Restaurants",
  "pizza shops": "Restaurants",
  shawarma: "Restaurants",
  "juice bars": "Restaurants",
  "bars & lounges": "Restaurants",
  "canteens & food courts": "Restaurants",
  "bukka / mama put": "Restaurants",
  pharmacy: "Pharmacies",
  "medical stores": "Pharmacies",
  clinics: "Pharmacies",
  hospitals: "Pharmacies",
  "diagnostic centres": "Pharmacies",
  "physiotherapy & rehabilitation": "Pharmacies",
  "fashion store": "Fashion Stores",
  boutiques: "Fashion Stores",
  "shoe stores": "Fashion Stores",
  "cosmetics stores": "Fashion Stores",
  "perfume shops": "Fashion Stores",
  barbershops: "Fashion Stores",
  "jewellery stores": "Fashion Stores",
  "beauty spas": "Fashion Stores",
  "makeup artists": "Fashion Stores",
  "makeup studios": "Fashion Stores",
  "skincare & organic cosmetics": "Fashion Stores",
  "beauty & salons": "Fashion Stores",
  "electronics store": "Electronics Stores",
  "phone shops": "Electronics Stores",
  "computer stores": "Electronics Stores",
  "gadget stores": "Electronics Stores",
  "appliance stores": "Electronics Stores",
  "hardware stores": "Electronics Stores",
  "paint stores": "Electronics Stores",
  "plumbing stores": "Electronics Stores",
  "bookshops": "Electronics Stores",
  "furniture stores": "Electronics Stores",
  "agro dealers": "Electronics Stores",
  "feed stores": "Electronics Stores",
  "auto parts": "Electronics Stores",
  "tyre shops": "Electronics Stores",
  automobile: "Electronics Stores",
  "scientific & laboratory suppliers": "Electronics Stores",
  "service business": "Service Businesses",
  laundry: "Service Businesses",
  tailoring: "Service Businesses",
  "digital creator": "Service Businesses",
  "online stores": "Electronics Stores",
  distributor: "Distributors",
  wholesalers: "Distributors",
  "processing plant": "Distributors", "processing plants": "Distributors", "processing-plant": "Distributors",
  manufacturers: "Distributors",
  "nylon & polythene manufacturing": "Distributors",
}

export function getLeadAdditionalQuestionTemplate(industry: string): LeadAdditionalQuestionTemplate | undefined {
  const normalized = industry.trim().toLowerCase()
  if (!normalized) return undefined
  const direct = LEAD_ADDITIONAL_QUESTION_TEMPLATES.find((template) => template.industry.toLowerCase() === normalized)
  if (direct) return direct
  const alias = TEMPLATE_ALIASES[normalized]
  if (!alias) return undefined
  return LEAD_ADDITIONAL_QUESTION_TEMPLATES.find((template) => template.industry === alias)
}

export function cloneTemplateFields(template: LeadAdditionalQuestionTemplate): QuestionnaireField[] {
  return template.fields.map(cloneField)
}

/** Deep-copy a single field so edits never mutate the shared template object. */
export function cloneField(field: QuestionnaireField): QuestionnaireField {
  return {
    ...field,
    options: field.options ? [...field.options] : undefined,
    optionStatuses: field.optionStatuses ? { ...field.optionStatuses } : undefined,
  }
}
