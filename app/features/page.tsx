export const revalidate = 86400
import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { ExitIntentPopup } from "@/components/exit-intent-popup"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/shared/section-header"
import { FAQPageSchema, BreadcrumbSchema } from "@/components/structured-data"
import type { LucideIcon } from "lucide-react"
import {
  ArrowRight,
  ArrowRightLeft,
  BadgeDollarSign,
  BarChart3,
  BellRing,
  Bot,
  Building2,
  CalendarClock,
  ChartLine,
  Check,
  ChevronDown,
  ClipboardList,
  CreditCard,
  Crown,
  FileDown,
  FileSpreadsheet,
  FileText,
  Gift,
  Globe,
  HandCoins,
  Heart,
  Info,
  KeyRound,
  Layers,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  MessagesSquare,
  MonitorSmartphone,
  Package,
  PackageCheck,
  PiggyBank,
  Pill,
  Scale,
  ScanBarcode,
  ScanFace,
  ScanLine,
  Search,
  ShieldCheck,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Split,
  Store,
  Tag,
  Tags,
  TicketPercent,
  Truck,
  Undo2,
  UserPlus,
  Users,
  UtensilsCrossed,
  Wallet,
  WifiOff,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Retail POS Features — Inventory, Online Store, Payments & More",
  description:
    "Explore MartPoint Retail features: touch-friendly POS with barcode scanning, real-time stock control, purchasing, customer credit and PayPlan installments, reports, loyalty, an included online store and multi-branch management — built for African retailers.",
  keywords: [
    "retail POS features Nigeria", "POS software features",
    "inventory management features", "barcode POS system",
    "stock control software", "customer credit tracking",
    "loyalty program software", "online store for retailers",
    "multi-branch POS", "retail reporting software",
    "MartPoint features", "retail software capabilities",
  ],
  alternates: {
    canonical: "/features",
  },
  openGraph: {
    title: "MartPoint Retail Features — Everything You Need to Run Your Shop",
    description:
      "POS, inventory, purchasing, customer payments, reports, loyalty, online store and multi-branch tools — in one retail platform.",
    url: "https://martpoint.com.ng/features",
  },
}

/* ─── Section data ─── */

interface FeatureHighlight {
  icon: LucideIcon
  title: string
  desc: string
}

interface FeatureSection {
  id: string
  label: string
  headline: string
  intro: string
  highlights: FeatureHighlight[]
  more: string[]
  note?: string
  screenshot?: { src: string; alt: string; width: number; height: number; portrait?: boolean }
}

const featureSections: FeatureSection[] = [
  {
    id: "sell-faster",
    label: "Point of Sale",
    headline: "Sell faster at the counter",
    intro:
      "Keep checkout moving and give your team an easier way to record sales.",
    highlights: [
      { icon: MonitorSmartphone, title: "Touch-friendly POS", desc: "A clean sales screen your staff can learn quickly, on desktop, tablet or phone." },
      { icon: ScanBarcode, title: "Barcode scanning", desc: "Scan items with standard barcode scanners for fast, accurate checkout." },
      { icon: Search, title: "Instant product search", desc: "Find any product by name, category or code in seconds." },
      { icon: Split, title: "Split & partial payments", desc: "Let one customer pay across cash, card and transfer in a single sale." },
      { icon: Undo2, title: "Returns & refunds", desc: "Process returns against the original sale with the full record at hand." },
      { icon: ScanFace, title: "Cashier shifts & clock-in", desc: "Clock staff in and out and keep every sale tied to a shift." },
    ],
    more: [
      "Print thermal receipts or send digital receipts after every sale",
      "Record cash, card, bank transfer and mobile-money payments in one flow",
      "Apply configured discounts and promotions automatically at checkout",
      "Reconcile each cashier's takings at the end of a shift",
      "Keep recording sales when the internet drops — everything syncs when you reconnect",
    ],
  },
  {
    id: "stock",
    label: "Inventory",
    headline: "Know what is in stock",
    intro:
      "See what is available, what needs restocking and where your products are located.",
    highlights: [
      { icon: Package, title: "Live stock levels", desc: "Every sale updates your counts instantly across all branches." },
      { icon: BellRing, title: "Low-stock alerts", desc: "Get warned before fast-moving items run out." },
      { icon: ArrowRightLeft, title: "Stock transfers", desc: "Move products between branches with tracking at both ends." },
      { icon: CalendarClock, title: "Batch & expiry tracking", desc: "Expiry alerts help you sell older stock first and cut waste." },
      { icon: ScanLine, title: "Serial numbers & warranties", desc: "Register IMEI and serial numbers, with warranty lookup at the counter." },
      { icon: Tags, title: "Variants", desc: "Sizes, colours and styles tracked as their own sellable items." },
    ],
    more: [
      "Record physical stock counts and adjustments when numbers don't match",
      "See stock by location — sales floor, warehouse or another branch",
      "Spot sales-to-stock discrepancies before they grow",
      "Import and update stock in bulk from spreadsheets",
    ],
    note: "Product, variation and media limits depend on your plan. Capacity add-ons are available on every plan.",
    screenshot: {
      src: "/retail-dashboard.webp",
      alt: "MartPoint Retail dashboard showing low-stock alerts, expiry alerts and outstanding payments",
      width: 1908,
      height: 956,
    },
  },
  {
    id: "products-purchasing",
    label: "Catalogue & Purchasing",
    headline: "Manage products and purchasing",
    intro:
      "Keep your catalogue organised and follow purchases from order to receipt.",
    highlights: [
      { icon: Layers, title: "Products & services", desc: "Sell physical goods and services side by side from one catalogue." },
      { icon: ListChecks, title: "Categories & brands", desc: "Organise items so staff can find them quickly at the counter." },
      { icon: Scale, title: "Flexible selling units", desc: "Sell by piece, carton, pack or weight — stock stays accurate." },
      { icon: FileSpreadsheet, title: "Bulk import & editing", desc: "Upload spreadsheets to build or update your catalogue in one pass." },
      { icon: Truck, title: "Purchase orders", desc: "Create orders and track supplier deliveries against them." },
      { icon: Tag, title: "Central price control", desc: "Update prices and promotions once — every branch applies them." },
    ],
    more: [
      "Compare supplier pricing when it is time to reorder",
      "Record supplier payments alongside your other expenses",
      "Keep purchase history per product and per supplier",
    ],
    note: "Catalogue and service limits depend on your plan. Product uploads can be prepared or handled through approved MartPoint partners — see the FAQ below.",
  },
  {
    id: "customer-payments",
    label: "Customers & Credit",
    headline: "Stay on top of customer payments",
    intro:
      "Keep customer records, purchase history and outstanding balances easy to follow.",
    highlights: [
      { icon: Users, title: "Customer profiles", desc: "Contact details, purchase history and balances in one record." },
      { icon: HandCoins, title: "Deposits & installments", desc: "PayPlan™ tracks deposits, balances and payment schedules automatically." },
      { icon: PiggyBank, title: "Debt tracking", desc: "See who owes what — and when each balance is due." },
      { icon: BellRing, title: "Payment reminders", desc: "Automatic reminders help customers settle balances on time." },
      { icon: FileText, title: "Quotations", desc: "Send quotes and convert them into sales when the customer agrees." },
      { icon: ShieldCheck, title: "Customer verification", desc: "Verify identity before offering credit or installment plans." },
    ],
    more: [
      "Full payment history for every customer",
      "Send balance reminders over SMS or WhatsApp",
      "Collect outstanding balances remotely with payment links (Standard plan and above)",
      "Set credit limits and record deposits on custom orders",
    ],
    note: "Identity verification lookups and SMS/WhatsApp messaging are billed separately unless bundled in your offer.",
  },
  {
    id: "reports",
    label: "Reports & Insights",
    headline: "Understand your sales and profit",
    intro:
      "Get a clearer picture of sales, costs, expenses and business performance.",
    highlights: [
      { icon: LayoutDashboard, title: "Owner dashboard", desc: "Sales, profit, debts and stock alerts on one screen." },
      { icon: ClipboardList, title: "Daily summary", desc: "Today's takings, expenses and profit ready at close of business." },
      { icon: BarChart3, title: "Sales & profit reports", desc: "Margins by product, category, staff member or branch." },
      { icon: Wallet, title: "Expense tracking", desc: "Record rent, transport and supplier costs beside your sales." },
      { icon: HandCoins, title: "Receivables", desc: "Outstanding customer balances in one clear view." },
      { icon: FileDown, title: "Report exports", desc: "Download reports to Excel or PDF for your accountant." },
    ],
    more: [
      "Compare performance across branches and time periods",
      "Stock and inventory reports for buying decisions",
      "Staff performance and attendance reports",
      "MartPoint Intelligence surfaces daily insights automatically — see below",
    ],
    screenshot: {
      src: "/loginUI.webp",
      alt: "MartPoint Retail mobile dashboard showing sales, expenses, debts, plan usage and the daily intelligence report",
      width: 1288,
      height: 1974,
      portrait: true,
    },
  },
  {
    id: "retention",
    label: "Loyalty & Marketing",
    headline: "Bring customers back",
    intro:
      "Give customers reasons to return and keep them connected to your business.",
    highlights: [
      { icon: Heart, title: "Loyalty points", desc: "Customers earn points on purchases and redeem them at checkout." },
      { icon: Crown, title: "Membership tiers", desc: "Reward your best customers with Bronze, Silver and Gold-style tiers." },
      { icon: TicketPercent, title: "Coupons & promotions", desc: "Run discounts and offers that apply automatically at checkout." },
      { icon: Gift, title: "Gift cards", desc: "Sell gift cards that bring new shoppers through your door." },
      { icon: Wallet, title: "Store credit", desc: "Issue credit for returns or goodwill that customers can spend later." },
      { icon: Megaphone, title: "Campaigns & win-backs", desc: "Reach customer groups by SMS, WhatsApp or email to bring them back." },
    ],
    more: [
      "Group customers by purchase behaviour for targeted offers",
      "Automatic birthday rewards and referral incentives",
      "Spot customers who have not visited recently and re-engage them",
    ],
    note: "SMS, WhatsApp and paid email messaging are billed separately unless bundled in your offer.",
  },
  {
    id: "online-store",
    label: "Online Store",
    headline: "Take your shop online",
    intro:
      "Give customers a place to browse your products and place orders beyond your counter.",
    highlights: [
      { icon: Store, title: "Your own online store", desc: "A Standard Online Store is included with every Retail Cloud plan." },
      { icon: PackageCheck, title: "Publish from your catalogue", desc: "Products you mark for online go live with photos and prices." },
      { icon: ShoppingBag, title: "Cart, checkout & orders", desc: "Customers order online; you manage fulfilment inside MartPoint." },
      { icon: CreditCard, title: "Online payments", desc: "Accept cards, transfers and more via Paystack, Flutterwave or Moniepoint." },
      { icon: Globe, title: "Your own domain", desc: "Connect a custom domain as an add-on." },
      { icon: ChartLine, title: "Store analytics", desc: "See orders, visits and which products sell online." },
    ],
    more: [
      "Stock syncs between your counter and your storefront",
      "WhatsApp ordering & invoicing included on every plan",
      "QR menu ordering for restaurants and cafés",
      "Payment links for remote customers (Standard plan and above)",
    ],
    note: "Online payments require your own payment-gateway account — gateway fees apply. Domain connection is included in your plan; buying or renewing the domain is billed separately.",
  },
  {
    id: "team-branches",
    label: "Team & Branches",
    headline: "Manage your team and branches",
    intro:
      "Give staff the access they need and keep an overview as your business grows.",
    highlights: [
      { icon: UserPlus, title: "Staff accounts", desc: "Give each team member their own login." },
      { icon: KeyRound, title: "Role-based permissions", desc: "Cashiers, managers and owners each see what they need — nothing more." },
      { icon: ScanFace, title: "Attendance & shifts", desc: "Face-capture clock-in with shift records linked to sales." },
      { icon: BadgeDollarSign, title: "Commissions", desc: "Calculate staff commissions automatically on sales or services." },
      { icon: Building2, title: "Branch reporting", desc: "Compare sales, stock and staff across every location." },
      { icon: ArrowRightLeft, title: "Inter-branch transfers", desc: "Move stock between branches with a full trail." },
    ],
    more: [
      "See who made each sale or change with activity history",
      "Compare staff and branch performance side by side",
      "Add branches and users as add-ons as your business grows",
    ],
    note: "Your plan sets how many branches and named users are included; extra capacity is available as annual add-ons.",
  },
]

const businessTypes = [
  {
    icon: Shirt,
    name: "Fashion & clothing",
    href: "/industries/fashion-stores",
    desc: "Sizes, colours and style variants tracked individually, with seasonal sales insight.",
  },
  {
    icon: Smartphone,
    name: "Electronics & phone stores",
    href: "/industries/electronics-stores",
    desc: "Serial numbers, IMEI registration and warranty records for every unit sold.",
  },
  {
    icon: Store,
    name: "Supermarkets & mini marts",
    href: "/industries/supermarkets",
    desc: "Fast barcode checkout, expiry alerts, supplier ordering and multi-branch stock.",
  },
  {
    icon: Sparkles,
    name: "Beauty & cosmetics",
    href: "/industries/cosmetics-stores",
    desc: "Shade variants, batch and expiry tracking, loyalty and customer profiles.",
  },
  {
    icon: UtensilsCrossed,
    name: "Restaurants & food service",
    href: "/industries/restaurants",
    desc: "QR table ordering, kitchen tickets and ingredient-level stock control.",
  },
  {
    icon: Pill,
    name: "Pharmacies & specialist retail",
    href: "/industries",
    desc: "Batch tracking, service workflows and more — see all supported business types.",
  },
]

const faqs = [
  {
    q: "Does MartPoint include an online store?",
    a: "Yes. A Standard Online Store is included with every Retail Cloud plan at no extra charge. You can publish products from your existing catalogue, receive orders and take online payments. The number of online products depends on your plan.",
  },
  {
    q: "Can I use MartPoint on my phone?",
    a: "Yes. MartPoint works in the browser on phones, tablets and computers — no special hardware is required. It also connects to standard barcode scanners, receipt printers and other shop equipment you may already have.",
  },
  {
    q: "Can I manage more than one branch?",
    a: "Yes. MartPoint supports multi-branch businesses from a single dashboard — transfer stock, compare sales and manage staff across locations. Your plan sets how many branches and users are included, and you can add more with annual add-ons.",
  },
  {
    q: "What works when my internet connection drops?",
    a: "Your counter keeps working. Staff can record sales, update stock and print receipts while offline, and everything syncs automatically when your connection returns. Features that depend on the internet — like online store orders and online payments — pick back up when you are reconnected.",
  },
  {
    q: "Can you help upload my products?",
    a: "You are responsible for your product catalogue, but you do not have to do it alone. Catalogue preparation and uploading can be arranged through approved MartPoint partners, with scope and fees agreed separately before work begins.",
  },
  {
    q: "Which features are included in my plan?",
    a: "Every Retail Cloud plan includes the core toolkit — POS, inventory, an online store, WhatsApp ordering, PayPlan installments, loyalty, customer verification, attendance, daily reports and MartPoint Assist. Capacity limits and a few capabilities differ between plans; the comparison table on our pricing page shows the detail. Some integrations also require a third-party account or carry additional charges.",
  },
]

/* ─── Page ─── */

export default function FeaturesPage() {
  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: "Home", href: "/" },
          { name: "Features", href: "/features" },
        ]}
      />
      <FAQPageSchema faqs={faqs.map((f) => ({ question: f.q, answer: f.a }))} />
      <Header />
      <main className="flex-1">
        {/* SECTION 1 — HERO */}
        <section className="w-full bg-background border-b border-border overflow-hidden relative">
          <div className="absolute inset-0 bg-[radial-gradient(#0057FF_0.5px,transparent_0.5px)] [background-size:20px_20px] opacity-[0.06] pointer-events-none" />
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-retail/5 rounded-full blur-[100px] pointer-events-none" />
          <div className="container-martpoint py-10 md:py-16 lg:py-20 relative">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div className="max-w-xl">
                <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-4">
                  MartPoint Retail Features
                </span>
                <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.05] text-foreground">
                  Everything you need to run your retail business.
                </h1>
                <p className="mt-4 text-base md:text-lg text-muted-foreground leading-relaxed max-w-lg">
                  Sell in-store and online, manage stock, follow up on customer payments and understand how your business is performing — all with MartPoint.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                  <Button asChild size="lg" variant="retail">
                    <Link href="/book-demo">
                      Book a Demo
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="/pricing">View Pricing</Link>
                  </Button>
                </div>
                <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
                  {[
                    "POS & inventory",
                    "Online store included",
                    "Works on any device",
                    "Multi-branch ready",
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-retail shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Real product screenshot — MartPoint Retail v4.0.9 dashboard */}
              <div className="relative mx-auto w-full max-w-2xl">
                <div className="rounded-xl border border-border bg-slate-100 p-2 md:p-3 shadow-xl">
                  <div className="relative rounded-lg overflow-hidden bg-white">
                    <Image
                      src="/retail-dash.webp"
                      alt="MartPoint Retail dashboard showing today's sales, profit, expenses, outstanding debts and low-stock items"
                      width={2396}
                      height={1496}
                      className="w-full h-auto"
                      priority
                    />
                  </div>
                </div>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  The real MartPoint Retail dashboard — sales, profit, debts and stock alerts in one view.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2 — AVAILABILITY NOTE + FEATURE SECTIONS */}
        <section className="w-full bg-muted py-10 md:py-16 lg:py-20">
          <div className="container-martpoint">
            <SectionHeader
              label="Capabilities"
              headline="One platform for the whole shop"
              description="From the counter to the stockroom to your online store, MartPoint keeps the moving parts of retail in one place."
            />
            <div className="mt-8 max-w-3xl mx-auto flex items-start gap-3 rounded-xl border border-retail-muted bg-retail-soft/60 px-5 py-4">
              <Info className="w-5 h-5 text-retail shrink-0 mt-0.5" />
              <p className="text-sm text-foreground/80 leading-relaxed">
                Feature availability depends on your plan, business type and setup. Some integrations require a third-party account and may carry additional charges.
              </p>
            </div>

            <div className="mt-14 space-y-8">
              {featureSections.map((section) => (
                <article
                  key={section.id}
                  id={section.id}
                  className="rounded-2xl border border-border bg-card p-6 md:p-10 shadow-sm"
                >
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                    {/* Left: heading, intro, optional screenshot, expander */}
                    <div>
                      <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail">
                        {section.label}
                      </span>
                      <h2 className="mt-2 text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                        {section.headline}
                      </h2>
                      <p className="mt-3 text-muted-foreground leading-relaxed">
                        {section.intro}
                      </p>

                      {section.screenshot && (
                        <div
                          className={`mt-6 rounded-xl border border-border bg-slate-100 p-2 shadow-md ${
                            section.screenshot.portrait ? "max-w-[300px] mx-auto lg:mx-0" : ""
                          }`}
                        >
                          <div className="relative rounded-lg overflow-hidden bg-white">
                            <Image
                              src={section.screenshot.src}
                              alt={section.screenshot.alt}
                              width={section.screenshot.width}
                              height={section.screenshot.height}
                              className="w-full h-auto"
                              loading="lazy"
                            />
                          </div>
                        </div>
                      )}

                      <details className="group mt-6 rounded-xl border border-border bg-background overflow-hidden open:ring-1 open:ring-retail/20">
                        <summary className="flex items-center justify-between cursor-pointer p-4 md:p-5 text-left select-none list-none">
                          <span className="text-sm font-semibold text-foreground">
                            Explore more features
                          </span>
                          <ChevronDown className="w-5 h-5 text-muted-foreground shrink-0 ml-4 transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="px-4 md:px-5 pb-5 pt-0">
                          <ul className="space-y-2.5">
                            {section.more.map((item) => (
                              <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                                <Check className="w-4 h-4 text-retail shrink-0 mt-0.5" />
                                <span>{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </details>
                      {section.note && (
                        <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
                          {section.note}
                        </p>
                      )}
                    </div>

                    {/* Right: highlight cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
                      {section.highlights.map((h) => (
                        <div
                          key={h.title}
                          className="rounded-xl border border-border bg-background p-5 transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                        >
                          <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mb-3">
                            <h.icon className="w-5 h-5 text-retail" />
                          </div>
                          <h3 className="text-base font-semibold text-foreground mb-1">
                            {h.title}
                          </h3>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {h.desc}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3 — BUSINESS TYPES */}
        <section className="w-full bg-background py-10 md:py-16 lg:py-20">
          <div className="container-martpoint">
            <SectionHeader
              label="Business Types"
              headline="Features that fit the way your business works"
              description="MartPoint adapts selected tools and workflows to your business type, helping your team work with relevant screens and familiar terms."
            />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
              {businessTypes.map((type) => (
                <Link
                  key={type.name}
                  href={type.href}
                  className="group rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mb-4">
                    <type.icon className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2 flex items-center gap-1.5">
                    {type.name}
                    <ArrowRight className="w-4 h-4 text-retail opacity-0 -translate-x-1 transition-all group-hover:opacity-100 group-hover:translate-x-0" />
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {type.desc}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 4 — MARTPOINT ASSIST */}
        <section className="w-full bg-muted py-10 md:py-16 lg:py-20">
          <div className="container-martpoint">
            <div className="max-w-4xl mx-auto rounded-2xl border border-border bg-card p-6 md:p-10 shadow-sm">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div>
                  <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
                    MartPoint Assist
                  </span>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                    A helping hand inside MartPoint.
                  </h2>
                  <p className="mt-4 text-muted-foreground leading-relaxed">
                    Ask MartPoint is built into the platform, so your team can get answers without leaving the app — on the desktop dashboard and on mobile.
                  </p>
                  <div className="mt-6 rounded-lg bg-retail-soft/60 border border-retail-muted px-4 py-3">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      MartPoint Assist is included with Retail Cloud plans. AI usage is billed according to your offer where it is not bundled — your agreement will state what is included.
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  {[
                    { icon: Bot, title: "Ask questions anytime", desc: "Staff can ask how to complete a task and get step-by-step guidance inside the app." },
                    { icon: Sparkles, title: "Daily intelligence", desc: "Plain-language summaries flag low stock, due balances and notable changes in sales." },
                    { icon: MessagesSquare, title: "Always on hand", desc: "Available from your MartPoint workspace on desktop and mobile, whenever your team needs it." },
                  ].map((item) => (
                    <div key={item.title} className="flex items-start gap-4 rounded-xl border border-border bg-background p-4">
                      <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center shrink-0">
                        <item.icon className="w-5 h-5 text-retail" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-foreground">{item.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                  <Link
                    href="/martpoint-intelligence"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-retail hover:underline"
                  >
                    Learn more about MartPoint Intelligence
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 5 — OFFLINE NOTE STRIP */}
        <section className="w-full bg-background py-10 md:py-14">
          <div className="container-martpoint">
            <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center gap-5 rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
              <div className="w-12 h-12 rounded-xl bg-retail-soft flex items-center justify-center shrink-0">
                <WifiOff className="w-6 h-6 text-retail" />
              </div>
              <div className="text-center sm:text-left">
                <h2 className="text-lg font-semibold text-foreground">Keeps working when the internet doesn&apos;t.</h2>
                <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                  Staff can keep recording sales, updating stock and printing receipts while offline. Records sync automatically when your connection returns.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 6 — FAQs */}
        <section className="w-full bg-muted py-10 md:py-16 lg:py-20">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader
              label="FAQ"
              headline="Questions retailers ask"
            />
            <div className="mt-10 space-y-4">
              {faqs.map((faq) => (
                <details
                  key={faq.q}
                  className="group rounded-xl border border-border bg-card p-5 cursor-pointer"
                >
                  <summary className="flex items-center justify-between list-none">
                    <span className="text-sm font-semibold text-foreground pr-4">{faq.q}</span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                </details>
              ))}
            </div>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Want the full picture? <Link href="/pricing" className="text-retail font-medium hover:underline">Compare plans on the pricing page</Link>.
            </p>
          </div>
        </section>

        {/* SECTION 7 — CLOSING CTA */}
        <section className="w-full bg-[#023047] py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                See how MartPoint fits your shop.
              </h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
                Book a demo to explore the tools that match your products, team and daily operations.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="/book-demo">
                    Book a Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10">
                  <Link href="/pricing">View Pricing</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <ExitIntentPopup />
    </>
  )
}
