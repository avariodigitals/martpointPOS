import type { Metadata } from "next"
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
  WifiOff,
  Wallet,
  Headphones,
  MapPin,
  Building2,
  Quote,
  Star,
  MessageCircle,
  Pill,
  UtensilsCrossed,
  Smartphone,
  Shirt,
  HandCoins,
} from "lucide-react"

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
    description: "Process sales quickly, manage thousands of products, prevent stock shortages and monitor every cashier from one dashboard.",
  },
  {
    photo: "/whouses/pharmacies.webp",
    title: "Pharmacies",
    description: "Track medicine inventory, monitor expiry dates, manage prescriptions and never run out of essential products.",
  },
  {
    photo: "/whouses/restaurants.webp",
    title: "Restaurants",
    description: "Take orders faster, manage tables, print kitchen tickets and monitor daily sales in real time.",
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

export default async function MartPointRetailPage() {
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
                  <div className="grid grid-cols-3 lg:grid-cols-4 gap-4">
                    {[
                      { label: "Supermarkets", icon: Store },
                      { label: "Mini Marts", icon: ShoppingCart },
                      { label: "Pharmacies", icon: Pill },
                      { label: "Restaurants", icon: UtensilsCrossed },
                      { label: "Electronics Stores", icon: Smartphone },
                      { label: "Fashion Retailers", icon: Shirt },
                      { label: "Bakeries", icon: Store, desktopOnly: true },
                      { label: "Laundry", icon: Shirt, desktopOnly: true },
                    ].map(({ label, icon: Icon, desktopOnly }) => (
                      <div key={label} className={`flex flex-col items-center gap-2 ${desktopOnly ? 'hidden lg:flex' : 'flex'}`}>
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

        {/* SECTION 4A — BUILT FOR AFRICA */}
        <section className="w-full bg-muted py-10 md:py-16 lg:py-20">
          <div className="container-martpoint">
            <SectionHeader
              label="Designed For Africa"
              headline="Built For The Way Africa Does Business"
              description="MartPoint wasn&apos;t adapted for Africa. It was designed for Africa."
            />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                { icon: CreditCard, title: "Accept Transfer Payments", description: "Record cash, card, transfer and mobile money in one place. No missed transactions." },
                { icon: Wallet, title: "Sell on Credit", description: "Track customer debts, set credit limits and know exactly who owes what at any time." },
                { icon: MessageCircle, title: "WhatsApp Orders", description: "Receive orders, send invoices and collect payments directly through WhatsApp." },
                { icon: Building2, title: "Multiple Branches", description: "Manage unlimited locations from one dashboard. Compare sales and transfer stock in real time." },
                { icon: HandCoins, title: "Installment Payments", description: "Let customers pay in deposits and track balances automatically. No more forgotten debts." },
                { icon: WifiOff, title: "Works Even During Poor Connectivity", description: "Sell and manage stock offline. Everything syncs automatically when connection returns." },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-border bg-background p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mb-4">
                    <item.icon className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
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
                Every day, retailers lose money through stock errors, forgotten debts, delayed reports and poor visibility. MartPoint brings your sales, inventory, customers, staff and payments together so you always know what&apos;s happening in your business.
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

        {/* SECTION 4H — WHY WE BUILT MARTPOINT */}
        <section className="w-full bg-background py-10 md:py-16 lg:py-20">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
                Our Story
              </span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Why We Built MartPoint
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                African retail is different. Customers pay by transfer. Some buy on credit. Internet isn&apos;t always reliable. Businesses sell products and services together. Most retail software wasn&apos;t designed for these realities. MartPoint was.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-4xl mx-auto">
              {[
                { icon: CreditCard, text: "Transfer payments built-in" },
                { icon: Wallet, text: "Credit sales tracked automatically" },
                { icon: WifiOff, text: "Works offline when internet fails" },
                { icon: Store, text: "Products and services together" },
                { icon: MapPin, text: "Designed for African businesses" },
                { icon: Headphones, text: "Local support that understands you" },
              ].map((item) => (
                <div
                  key={item.text}
                  className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-retail" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">{item.text}</span>
                </div>
              ))}
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

        {/* SECTION 4I — MARTPOINT INTELLIGENCE */}
        <section className="w-full bg-muted py-10 md:py-16 lg:py-20">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
                AI-Powered Insights
              </span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Meet MartPoint Intelligence
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                MartPoint doesn&apos;t just show reports. It tells you what needs your attention next.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {[
                { icon: TrendingUp, title: "Sales dropped because beverages sold 23% less.", color: "bg-amber-50 border-amber-200 text-amber-800" },
                { icon: Package, title: "Bread will finish tomorrow.", color: "bg-blue-50 border-blue-200 text-blue-800" },
                { icon: Wallet, title: "Three customers are due for payment today.", color: "bg-green-50 border-green-200 text-green-800" },
                { icon: Users, title: "Cashier Sarah achieved the highest sales this week.", color: "bg-purple-50 border-purple-200 text-purple-800" },
                { icon: AlertTriangle, title: "₦420,000 worth of products haven&apos;t sold in 120 days.", color: "bg-red-50 border-red-200 text-red-800" },
                { icon: BarChart3, title: "Your best-selling product this month is running low.", color: "bg-retail-soft border-retail-muted text-retail" },
              ].map((item) => (
                <div
                  key={item.title}
                  className={`rounded-xl border p-6 transition-all duration-200 hover:shadow-sm ${item.color}`}
                >
                  <div className="flex items-start gap-3">
                    <item.icon className="w-5 h-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium leading-relaxed">{item.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

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
