import type { Metadata } from "next"
import fs from "fs"
import path from "path"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { ExitIntentPopup } from "@/components/exit-intent-popup"
import { BlogPreview } from "@/components/sections/blog-preview"
import { PayPlanSection, PayPlanBenefits, PayPlanTrustCallout } from "@/components/sections/payplan-section"
import { LoyaltySection, LoyaltyBenefits, LoyaltyTrustCallout } from "@/components/sections/loyalty-section"
import { TrustLayer } from "@/components/sections/trust-layer"
import { SoftwareApplicationSchema, FAQPageSchema } from "@/components/structured-data"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/shared/section-header"
import {
  ArrowRight,
  Check,
  ShoppingCart,
  Package,
  Receipt,
  CreditCard,
  Store,
  BarChart3,
  Users,
  AlertTriangle,
  Clock,
  Eye,
  TrendingUp,
  Wifi,
  WifiOff,
  Wallet,
  GraduationCap,
  Headphones,
  MapPin,
  Laptop,
  Monitor,
  ScanLine,
  LayoutGrid,
  Building2,
  Quote,
  Star,
  MessageCircle,
  Globe,
  FileText,
  CheckCircle2,
  Camera,
  QrCode,
  Bot,
  Heart,
  Pill,
  UtensilsCrossed,
  Smartphone,
  Shirt,
} from "lucide-react"

function readSettings() {
  try {
    const settingsPath = path.join(process.cwd(), "data", "settings.json")
    if (!fs.existsSync(settingsPath)) return null
    const data = fs.readFileSync(settingsPath, "utf-8")
    return JSON.parse(data)
  } catch {
    return null
  }
}

export const metadata: Metadata = {
  title: "MartPoint Retail — Retail Commerce Platform for African Businesses",
  description:
    "Complete retail commerce platform. Sell in-store, online and on WhatsApp. POS, inventory, loyalty rewards, installment payments, online store and multi-branch management.",
}

const trustBullets = [
  "POS Sales",
  "Inventory Control",
  "Online Store",
  "WhatsApp Ordering",
  "Flexible Payment Plans",
  "Loyalty Rewards",
]

const whoUses = [
  {
    photo: "/whouses/supermart.webp",
    title: "Supermarket / Mini Mart",
    description: "Manage thousands of products, multiple cashiers and daily sales operations.",
  },
  {
    photo: "/whouses/pharmacies.webp",
    title: "Pharmacies",
    description: "Track stock levels, monitor inventory movement and improve operational visibility.",
  },
  {
    photo: "/whouses/restaurants.webp",
    title: "Restaurants",
    description: "Process orders quickly, track sales and manage daily transactions efficiently.",
  },
  {
    photo: "/whouses/electronic-store.webp",
    title: "Electronics Stores",
    description: "Monitor high-value inventory and maintain accurate stock records.",
  },
  {
    photo: "/whouses/fashion.webp",
    title: "Fashion Stores",
    description: "Manage product variants, stock movement and sales performance.",
  },
  {
    photo: "/whouses/multi-branch.webp",
    title: "Multi-Branch Retailers",
    description: "View and manage all locations from one dashboard.",
  },
]

const challenges = [
  { icon: AlertTriangle, title: "Stock discrepancies" },
  { icon: Users, title: "Cashier accountability issues" },
  { icon: Clock, title: "Slow reporting" },
  { icon: TrendingUp, title: "Inventory losses" },
  { icon: Eye, title: "Manual processes" },
  { icon: MapPin, title: "Poor branch visibility" },
]

const workflowSteps = [
  { step: "01", title: "Customer walks in", detail: "Staff checks stock availability instantly on any device" },
  { step: "02", title: "Item scanned or selected", detail: "Barcode scan or quick-select from the catalog" },
  { step: "03", title: "Payment processed", detail: "Cash, card, or transfer — recorded automatically" },
  { step: "04", title: "Receipt printed or sent", detail: "Branded receipt via SMS, email, or thermal printer" },
  { step: "05", title: "Stock updates in real time", detail: "Inventory count adjusts across all branches instantly" },
  { step: "06", title: "Sales report ready", detail: "See the transaction in your daily summary immediately" },
]

const capabilities = [
  {
    icon: ShoppingCart,
    title: "Prevent Stock Shortages",
    description: "Track inventory in real time and receive alerts before critical products run out. Never disappoint a customer again.",
  },
  {
    icon: Package,
    title: "Know What Sells",
    description: "See your best-selling products, slow movers and profit margins at a glance. Make buying decisions with confidence.",
  },
  {
    icon: Receipt,
    title: "Speed Up Checkout",
    description: "Process sales in seconds with barcode scanning, quick keys and split payments. Your queue moves faster.",
  },
  {
    icon: CreditCard,
    title: "Accept Every Payment",
    description: "Cash, card, transfer, POS terminal and mobile money — all recorded in one place. No more missed transactions.",
  },
  {
    icon: Store,
    title: "See Every Branch",
    description: "Compare sales across locations, transfer stock between stores and manage centrally. One view of your entire operation.",
  },
  {
    icon: BarChart3,
    title: "Close With Confidence",
    description: "Daily sales summaries, cashier performance and profit reports ready in one click. Know your numbers every night.",
  },
]

const dashboardCallouts = [
  "Total Revenue",
  "Total Orders",
  "Daily Report",
  "Daily Summary",
  "Inventory Alerts",
]

const hardwareOptions = [
  {
    icon: Laptop,
    title: "Laptop + Receipt Printer",
    description: "Standard setup for counter-based sales",
  },
  {
    icon: Monitor,
    title: "Touchscreen POS Setup",
    description: "All-in-one terminal for fast checkout",
  },
  {
    icon: ScanLine,
    title: "Barcode Scanner Setup",
    description: "Speed up item entry and inventory counts",
  },
  {
    icon: LayoutGrid,
    title: "Multi-Counter Setup",
    description: "Multiple checkout points in one location",
  },
  {
    icon: Building2,
    title: "Multi-Branch Setup",
    description: "Centralised management across all stores",
  },
]

const whyChoose = [
  { icon: Wifi, text: "Available on offline or Cloud" },
  { icon: Wallet, text: "Supports multiple payment methods" },
  { icon: GraduationCap, text: "Easy cashier onboarding" },
  { icon: Building2, text: "Multi-branch visibility" },
  { icon: Headphones, text: "Local support" },
  { icon: MapPin, text: "Built for African businesses" },
]

const powerFeatures = [
  {
    icon: MessageCircle,
    title: "WhatsApp Invoice",
    description: "Send branded invoices directly to customers via WhatsApp. No printing needed — just share and get paid faster.",
  },
  {
    icon: Globe,
    title: "Online Payment",
    description: "Accept card and transfer payments securely online. Integrated with Paystack and Flutterwave for instant settlement.",
  },
  {
    icon: Wallet,
    title: "PayPlan™ Installments",
    description: "Let customers buy now and pay over time with structured installment plans. Automatically track deposits, balances and collections.",
  },
  {
    icon: QrCode,
    title: "QR Menu & Ordering",
    description: "Customers scan a QR code to view your product catalogue or menu on their phones. No app download required.",
  },
  {
    icon: Store,
    title: "Online Store",
    description: "Launch your own branded e-commerce storefront. Customers browse, order and pay online while inventory syncs automatically.",
  },
  {
    icon: CheckCircle2,
    title: "Customer Verification",
    description: "Verify customers with NIN, BVN or custom approval rules before offering credit or installment plans.",
  },
  {
    icon: Building2,
    title: "Multi Branch",
    description: "Manage unlimited locations from one dashboard. Transfer stock, compare sales and oversee every branch in real time.",
  },
  {
    icon: FileText,
    title: "Daily Summary Report",
    description: "Get an automated daily breakdown of sales, expenses, stock movement and cashier performance every night.",
  },
  {
    icon: Camera,
    title: "Attendance (Face Capture)",
    description: "Staff clock in and out with facial recognition. No buddy punching — accurate attendance records for payroll and compliance.",
  },
  {
    icon: Bot,
    title: "MartPoint Assist Chat Bot",
    description: "AI-powered assistant answers customer questions, guides staff and helps resolve common issues instantly — 24/7.",
  },
  {
    icon: Heart,
    title: "Loyalty & Rewards",
    description: "Keep customers coming back with loyalty points, membership tiers, gift cards, store credit, birthday rewards and referral incentives — all tracked automatically.",
  },
  {
    icon: Receipt,
    title: "Expense & Profit Tracking",
    description: "Record every business expense from rent to supplies. See true profit margins after all costs, not just top-line sales. Know where your money really goes.",
  },
]

const testimonials = [
  {
    quote:
      "MartPoint Retail transformed how we run our supermarket. We now track stock in real time across two branches and our checkout speed has doubled.",
    author: "Adeola B.",
    role: "Owner, FreshMart Supermarket",
    rating: 5,
    logo: "/trust/freshmart.webp",
  },
  {
    quote:
      "Offline mode keeps us selling even when the network is down. Our pharmacy never stopped operations, and the daily reports help us reorder before we run out.",
    author: "Dr. Emeka N.",
    role: "Manager, GreenLife Pharmacy",
    rating: 5,
    logo: "/trust/greenlife.webp",
  },
  {
    quote:
      "Orders flow straight from the counter to the kitchen. Our wait times dropped and we can finally see which dishes sell best every day.",
    author: "Chioma O.",
    role: "Manager, Spice Kitchen Restaurant",
    rating: 5,
    logo: "/trust/spicekitchen.webp",
  },
  {
    quote:
      "Our laundry runs on MartPoint. We track pickups, deliveries and payments from one place. No more lost receipts or missed orders.",
    author: "Tunde A.",
    role: "Founder, Clean Bubbles Laundry",
    rating: 5,
    logo: "/trust/cleanbubbles.webp",
  },
  {
    quote:
      "Managing high-value gadgets used to be stressful. Now every phone and laptop is tracked from purchase to sale with full warranty records.",
    author: "Ibrahim K.",
    role: "Director, TechWorld Electronics",
    rating: 5,
    logo: "/trust/techworld.webp",
  },
  {
    quote:
      "We run three grocery stores and MartPoint connects them all. I can check stock, sales and staff from anywhere without calling each branch.",
    author: "Ngozi E.",
    role: "CEO, DailyNeeds Grocery",
    rating: 5,
    logo: "/trust/dailyneeds.webp",
  },
]

const trustedBy = [
  { name: "GreenLife", logo: "/trust/greenlife.webp" },
  { name: "Spice Kitchen", logo: "/trust/spicekitchen.webp" },
  { name: "TechWorld", logo: "/trust/techworld.webp" },
  { name: "Luxe", logo: "/trust/luxe.webp" },
  { name: "DailyNeeds", logo: "/trust/dailyneeds.webp" },
  { name: "256 Bar", logo: "/trust/256bar.webp" },
  { name: "Clean Bubbles", logo: "/trust/cleanbubbles.webp" },
  { name: "Gana", logo: "/trust/gana.webp" },
  { name: "Luxuria", logo: "/trust/luxuria.webp" },
  { name: "Zion Bookshop", logo: "/trust/zionbookshop.webp" },
]

export default function MartPointRetailPage() {
  const settings = readSettings()
  const pricing = settings?.pricing || {}
  const cloud = pricing.cloud || {}
  const offline = pricing.offline || {}

  return (
    <>
      <SoftwareApplicationSchema
        name="MartPoint Retail"
        description="Complete retail commerce platform for African businesses. Sell in-store, online and on WhatsApp with POS, inventory, loyalty rewards, installment payments, online store and multi-branch management."
        image="https://martpoint.ng/og-image.jpg"
        url="https://martpoint.ng/martpoint-retail"
        category="BusinessApplication"
        price="99999"
      />
      <FAQPageSchema
        faqs={[
          {
            question: "What is MartPoint Retail?",
            answer: "MartPoint Retail is a complete retail commerce platform for African businesses. It includes POS, inventory management, online store, WhatsApp ordering, loyalty rewards, installment payments and multi-branch operations in one system.",
          },
          {
            question: "Does MartPoint Retail work offline?",
            answer: "Yes. MartPoint Retail works offline and syncs data when the internet connection is restored. Your business never stops.",
          },
          {
            question: "How much does MartPoint Retail cost?",
            answer: "MartPoint Retail Cloud costs ₦99,999 per year. The offline version costs ₦250,000 as a one-time purchase.",
          },
          {
            question: "Can I manage multiple branches with MartPoint Retail?",
            answer: "Yes. MartPoint Retail supports multi-branch operations allowing you to track sales, inventory, and staff across all locations from a single dashboard.",
          },
          {
            question: "Is MartPoint Retail suitable for pharmacies?",
            answer: "Yes. MartPoint Retail is used by pharmacies across Africa for stock management, sales tracking, and compliance reporting.",
          },
        ]}
      />
      <Header />
      <main className="flex-1">
        {/* SECTION 1 — HERO */}
        <section className="w-full bg-background border-b border-border overflow-hidden relative">
          {/* Subtle dot grid pattern */}
          <div className="absolute inset-0 bg-[radial-gradient(#0057FF_0.5px,transparent_0.5px)] [background-size:20px_20px] opacity-[0.06] pointer-events-none" />
          {/* Soft top glow */}
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-retail/5 rounded-full blur-[100px] pointer-events-none" />
          <div className="container-martpoint py-10 md:py-16 lg:py-20 relative">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left: Copy */}
              <div className="max-w-xl">
                <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.05] text-foreground">
                  See Every Sale. Track Every Stock Item. <span className="text-retail italic">Manage Every Branch.</span>
                </h1>
                <p className="mt-4 text-base text-black leading-relaxed max-w-lg">
                  Sell in-store, online and on WhatsApp. Manage inventory, staff, payments and customer relationships from one easy-to-use platform built for African retailers.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-4">
                  <Button asChild size="lg" variant="retail">
                    <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20learning%20more%20about%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
                      See MartPoint in Action
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="lg">
                    <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20learning%20more%20about%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">View Pricing</Link>
                  </Button>
                </div>
                <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
                  {trustBullets.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-retail shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                {/* Built For */}
                <div className="mt-10">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
                    Built For Businesses Like
                  </p>
                  <div className="flex flex-wrap items-center justify-center sm:items-start sm:justify-start gap-x-8 gap-y-4">
                    {[
                      { label: "Supermarkets", icon: Store },
                      { label: "Mini Marts", icon: ShoppingCart },
                      { label: "Pharmacies", icon: Pill },
                      { label: "Restaurants", icon: UtensilsCrossed },
                      { label: "Electronics Stores", icon: Smartphone },
                      { label: "Fashion Retailers", icon: Shirt },
                    ].map(({ label, icon: Icon }) => (
                      <div key={label} className="flex flex-col items-center gap-2 min-w-[6rem]">
                        <div className="w-12 h-12 rounded-xl bg-retail-soft flex items-center justify-center">
                          <Icon className="w-6 h-6 text-retail" />
                        </div>
                        <span className="text-xs font-medium text-foreground text-center leading-tight">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right: Hero Image */}
              <div className="relative mx-auto w-full max-w-md">
                <div className="relative rounded-xl overflow-hidden shadow-2xl">
                  <Image
                    src="/loginUI.webp"
                    alt="MartPoint Retail Login Interface"
                    width={800}
                    height={500}
                    className="w-full h-auto"
                    priority
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST & IMPACT */}
        <TrustLayer />

        {/* SECTION 2 — WHO USES MARTPOINT RETAIL */}
        <section className="w-full bg-muted py-10 md:py-16 lg:py-20">
          <div className="container-martpoint">
            <SectionHeader
              headline="Built For The Way Retail Businesses Operate"
              description="Whether you run a single store or multiple branches, MartPoint Retail helps you stay in control."
            />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {whoUses.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-border bg-background p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                >
                  <div className="relative w-full h-36 rounded-lg bg-retail-soft mb-4 overflow-hidden">
                    <Image
                      src={item.photo}
                      alt={item.title}
                      fill
                      className="object-cover"
                      loading="lazy"
                    />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 3 — RETAIL BUSINESS CHALLENGES */}
        <section className="w-full bg-[#023047] py-10 md:py-16 lg:py-20">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                Still Managing Your Store With Guesswork?
              </h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
                A complete retail commerce platform. Sell in-store, online and on WhatsApp. Accept every payment, offer installment plans and manage inventory, collections and staff — all from one simple dashboard.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-5 max-w-4xl mx-auto">
              {challenges.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl bg-white/5 border border-white/10 p-5 sm:p-8 text-center transition-all duration-200 hover:bg-white/10 hover:border-white/20"
                >
                  <div className="w-14 h-14 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-7 h-7 text-white" />
                  </div>
                  <p className="text-base font-semibold text-white/95">{item.title}</p>
                </div>
              ))}
            </div>
            <p className="mt-10 text-center text-white/70 text-lg max-w-2xl mx-auto leading-relaxed">
              MartPoint Retail gives you the visibility and control needed to run retail operations confidently.
            </p>
            <div className="mt-8 flex justify-center">
              <Button asChild size="lg" variant="retail">
                <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20learning%20more%20about%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
                  Book a Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* SECTION 4 — HOW A SALE FLOWS */}
        <section className="w-full bg-background py-10 md:py-16 lg:py-20">
          <div className="container-martpoint">
            <SectionHeader
              label="How It Works"
              headline="How a sale flows through MartPoint Retail"
              description="From customer entry to daily summary — every step is tracked, every number is real."
            />
            <div className="mt-14 relative">
              {/* Timeline connector (desktop only) */}
              <div className="hidden lg:block absolute top-[2.25rem] left-[8%] right-[8%] h-0.5 bg-border" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {workflowSteps.map((item, i) => (
                  <div key={item.step} className="relative">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 rounded-full bg-retail text-white font-bold text-base flex items-center justify-center shrink-0 shadow-sm z-10 relative">
                        {item.step}
                      </div>
                      {i < workflowSteps.length - 1 && (
                        <div className="hidden md:block lg:hidden flex-1 h-0.5 bg-border" />
                      )}
                    </div>
                    <div className="rounded-xl border border-border bg-card p-6 hover:border-retail/30 transition-colors">
                      <h3 className="text-lg font-semibold text-foreground mb-2">
                        {item.title}
                      </h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {item.detail}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 4B — PAYPLAN */}
        <PayPlanSection />

        {/* SECTION 4C — PAYPLAN BENEFITS */}
        <PayPlanBenefits />

        {/* SECTION 4D — PAYPLAN TRUST CALLOUT */}
        <PayPlanTrustCallout />

        {/* SECTION 4E — LOYALTY */}
        <LoyaltySection />

        {/* SECTION 4F — LOYALTY BENEFITS */}
        <LoyaltyBenefits />

        {/* SECTION 4G — LOYALTY TRUST CALLOUT */}
        <LoyaltyTrustCallout />

        {/* SECTION 5 — CAPABILITIES */}
        <section className="w-full bg-muted py-10 md:py-16 lg:py-20">
          <div className="container-martpoint">
            <SectionHeader
              label="What You Get"
              headline="Capabilities That Drive Real Business Results"
            />
            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {capabilities.map((cap) => (
                <div
                  key={cap.title}
                  className="rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mb-4">
                    <cap.icon className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {cap.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {cap.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 6 — OWNER DASHBOARD SHOWCASE */}
        <section className="w-full bg-background py-10 md:py-16 lg:py-20">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
                Dashboard
              </span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                See What Business Owners See Every Day
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Monitor your entire retail operation from one dashboard.
              </p>
            </div>

            <div className="relative mx-auto max-w-5xl">
              <div className="rounded-xl border border-border bg-slate-100 p-2 md:p-4 shadow-xl">
                <div className="relative rounded-lg overflow-hidden bg-white">
                  <Image
                    src="/retail-dash.webp"
                    alt="MartPoint Retail Dashboard with sales metrics, stock alerts and transaction history"
                    width={1200}
                    height={800}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>
              </div>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {dashboardCallouts.map((callout) => (
                  <div
                    key={callout}
                    className="inline-flex items-center gap-2 rounded-lg border border-retail-muted bg-retail-soft px-4 py-2"
                  >
                    <div className="w-2 h-2 rounded-full bg-retail shrink-0" />
                    <span className="text-sm font-medium text-retail">{callout}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-10 flex justify-center">
              <Button asChild size="lg" variant="retail">
                <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20learning%20more%20about%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
                  See It Live — Book a Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* SECTION 6A — OFFLINE & ONLINE MODE */}
        <section className="w-full bg-[#023047] py-10 md:py-16 lg:py-20">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-12">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-white mb-3">
                No Internet? No Problem.
              </span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                Works Offline. Works Online. Your Business Never Stops.
              </h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
                Whether you have strong internet, patchy connection, or none at all — MartPoint Retail keeps your business running. Sales, inventory and receipts work seamlessly in any environment.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="rounded-xl bg-white/5 border border-white/10 p-6 md:p-8">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mb-4">
                  <WifiOff className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Fully Offline Mode</h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  Sell, manage stock and print receipts with zero internet. All data is stored locally on your device. Perfect for locations with unreliable connectivity.
                </p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 p-6 md:p-8">
                <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center mb-4">
                  <Wifi className="w-5 h-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Auto-Sync When Online</h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  The moment you are back online, everything syncs to the cloud — sales, stock levels, attendance and reports. No manual upload needed.
                </p>
              </div>
            </div>
            <div className="mt-10 flex justify-center">
              <Button asChild size="lg" variant="retail">
                <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20learning%20more%20about%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
                  See How It Works — Book a Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* SECTION 6B — PRICING */}
        <section className="w-full bg-slate-50 py-10 md:py-16 lg:py-20">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Simple Pricing. No Confusing Plans.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Whether you operate one store or multiple branches, MartPoint Retail grows with your business.
              </p>
            </div>

              {/* Pricing Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto mb-16">
              {/* Cloud Plan */}
              <div className="relative rounded-2xl border-2 border-retail bg-card p-8 shadow-sm">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-block rounded-full bg-retail px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
                    {cloud.badge || "Most Popular"}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-foreground mt-2">{cloud.name || "MartPoint Retail Cloud"}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-extrabold text-retail">{cloud.price || "₦99,999"}</span>
                  <span className="text-muted-foreground">{cloud.period || "/ Year"}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  {cloud.description || "Everything you need to run a modern retail business."}
                </p>
                <ul className="mt-6 space-y-3">
                  {(cloud.features || [
                    "POS Sales & Checkout",
                    "Inventory & Stock Control",
                    "Online Store",
                    "WhatsApp Ordering & Invoice",
                    "QR Menu Ordering",
                    "Payment Links",
                    "PayPlan™ Installment Plans",
                    "Loyalty & Rewards",
                    "Customer Verification",
                    "Collections Tracking",
                    "Attendance (Face Capture)",
                    "Daily Report",
                    "AI Chatbot",
                    "Training & Onboarding",
                    "Mobile & Desktop Access",
                  ]).map((item: string) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="w-4 h-4 text-retail shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 rounded-lg bg-retail-soft p-4 text-center">
                  <p className="text-sm font-semibold text-foreground">Includes {cloud.branchesIncluded ?? 1} Branch · {cloud.usersIncluded ?? 5} Users</p>
                  <p className="text-base font-bold text-retail mt-1">Additional Branch: {cloud.branchAddonPrice || "₦49,999 / Year"}</p>
                </div>
                <div className="mt-6">
                  <Button asChild size="lg" variant="retail" className="w-full">
                    <a href={cloud.ctaLink || "https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20the%20MartPoint%20Retail%20Cloud%20plan.%20Can%20we%20talk%3F"} target="_blank" rel="noopener noreferrer">
                      {cloud.ctaText || "Get Started"}
                    </a>
                  </Button>
                </div>
              </div>

              {/* Offline Plan */}
              <div className="relative rounded-2xl border border-border bg-card p-8 shadow-sm">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-block rounded-full bg-foreground px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
                    {offline.badge || "One-Time"}
                  </span>
                </div>
                <h3 className="text-xl font-bold text-foreground mt-2">{offline.name || "MartPoint Retail Offline"}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-extrabold text-foreground">{offline.price || "₦250,000"}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{offline.period || "One-Time Payment"}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {offline.description || "Full software installed locally. No recurring subscription. Works without internet."}
                </p>
                <ul className="mt-6 space-y-3">
                  {(offline.features || [
                    "POS Sales & Checkout",
                    "Inventory & Stock Control",
                    "Receipt Printing",
                    "Barcode & SKU Management",
                    "Customer & Supplier Records",
                    "Staff Attendance (Face Capture)",
                    "Daily Sales Report",
                    "Multi-Branch (LAN Connected)",
                    "Offline-First Sync",
                    "Local Installation",
                    "Staff Setup & Training",
                    "No Recurring Fees",
                  ]).map((item: string) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="w-4 h-4 text-retail shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 rounded-lg bg-muted p-4 text-center">
                  <p className="text-sm font-semibold text-foreground">Additional Branch: {offline.branchAddonPrice || "₦100,000 One-Time"}</p>
                  {offline.supportRenewal && (
                    <p className="text-xs text-muted-foreground mt-1">Optional Support Renewal: {offline.supportRenewal}</p>
                  )}
                </div>
                <div className="mt-6">
                  <Button asChild size="lg" variant="outline" className="w-full">
                    <a href={offline.ctaLink || "https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20the%20MartPoint%20Retail%20Offline%20setup.%20Can%20we%20talk%3F"} target="_blank" rel="noopener noreferrer">
                      {offline.ctaText || "Request Offline Setup"}
                    </a>
                  </Button>
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* SECTION 6C — POWER FEATURES */}
        <section className="w-full bg-muted py-10 md:py-16 lg:py-20">
          <div className="container-martpoint">
            <SectionHeader
              label="What&apos;s New"
              headline="Everything You Need To Run A Modern Retail Business"
              description="MartPoint Retail goes beyond traditional POS with modern tools designed for how retail works today."
            />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {powerFeatures.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-xl border border-border bg-background p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mb-4">
                    <feature.icon className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* SECTION 7 — HARDWARE & SETUP OPTIONS */}
        <section className="w-full bg-background py-10 md:py-16 lg:py-20">
          <div className="container-martpoint">
            <SectionHeader
              headline="Flexible Setup For Every Retail Environment"
            />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {hardwareOptions.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-border bg-background p-6 text-center transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-1">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-12 rounded-xl border border-retail-muted bg-retail-soft p-8 text-center">
              <h3 className="text-lg font-semibold text-foreground mb-2">
                Need hardware too?
              </h3>
              <p className="text-muted-foreground max-w-xl mx-auto mb-6">
                MartPoint can provide a complete retail deployment including software setup, hardware recommendations, onboarding and training.
              </p>
              <Button asChild size="lg" variant="retail">
                <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20learning%20more%20about%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
                  Request Complete Setup
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* SECTION 8 — WHY NIGERIAN BUSINESSES CHOOSE MARTPOINT */}
        <section className="w-full bg-[#023047] py-10 md:py-16 lg:py-20">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                Why African Businesses Choose MartPoint
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
              {whyChoose.map((item) => (
                <div
                  key={item.text}
                  className="flex items-center gap-4 rounded-xl bg-white/5 border border-white/10 p-6 transition-all duration-200 hover:bg-white/10 hover:border-white/20"
                >
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <span className="text-base font-semibold text-white/95">{item.text}</span>
                </div>
              ))}
            </div>
            <div className="mt-10 flex justify-center">
              <Button asChild size="lg" variant="retail">
                <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20learning%20more%20about%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
                  Book a Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* SECTION 8B — TESTIMONIALS & TRUSTED BY */}
        <section className="w-full bg-slate-50 py-10 md:py-16 lg:py-20">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
                Testimonials
              </span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Trusted by Retail Businesses Across Africa
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {testimonials.map((t) => (
                <div
                  key={t.author}
                  className="rounded-xl border border-border bg-background p-8 transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                >
                  <div className="flex gap-1 mb-4">
                    {Array.from({ length: t.rating }).map((_, i) => (
                      <Star
                        key={i}
                        className="w-4 h-4 text-[#fb8500] fill-[#fb8500]"
                      />
                    ))}
                  </div>
                  <Quote className="w-6 h-6 text-retail/30 mb-3" />
                  <blockquote className="text-foreground leading-relaxed mb-6">
                    &ldquo;{t.quote}&rdquo;
                  </blockquote>
                  <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-full bg-retail/10 overflow-hidden shrink-0">
                      <Image
                        src={t.logo}
                        alt={t.author}
                        fill
                        className="object-contain p-1"
                        loading="lazy"
                      />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground">
                        {t.author}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {t.role}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Trusted By Logos */}
            <div className="mt-16 text-center">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-8">
                Trusted By
              </p>
              <div className="flex flex-wrap justify-center items-center gap-x-6 sm:gap-x-10 lg:gap-x-12 gap-y-6 sm:gap-y-8 max-w-6xl mx-auto">
                {trustedBy.map((brand) => (
                  <div
                    key={brand.name}
                    className="relative h-14 sm:h-20 lg:h-28 w-auto shrink-0 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                    title={brand.name}
                  >
                    <Image
                      src={brand.logo}
                      alt={`${brand.name} logo`}
                      width={320}
                      height={112}
                      className="h-14 sm:h-20 lg:h-28 w-auto object-contain"
                      loading="lazy"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 9 — FINAL CTA */}
        <section className="w-full bg-background py-10 md:py-16 lg:py-20">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Ready To Take Control Of Your Retail Operations?
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Book a personalized demo and see how MartPoint Retail can fit your business.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20learning%20more%20about%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
                    Book a Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20learning%20more%20about%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">Request a Quote</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <BlogPreview />
      </main>
      <Footer />
      <ExitIntentPopup />
    </>
  )
}
