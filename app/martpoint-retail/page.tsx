import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { ExitIntentPopup } from "@/components/exit-intent-popup"
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
} from "lucide-react"

export const metadata: Metadata = {
  title: "MartPoint Retail — POS & Store Management Software",
  description:
    "Retail management software for supermarkets, pharmacies, restaurants, and fashion stores. Sales, inventory, receipts, and branches.",
}

const trustBullets = [
  "POS Sales",
  "Inventory Control",
  "Receipt Printing",
  "Multi-Branch Management",
  "Real-Time Reports",
]

const whoUses = [
  {
    photo: "https://images.unsplash.com/photo-1701241284324-9afefe58e53b?w=400&h=200&fit=crop&q=80",
    title: "Supermart",
    description: "Manage thousands of products, multiple cashiers and daily sales operations.",
  },
  {
    photo: "https://images.unsplash.com/photo-1579684385127-1ef15d508118?w=400&h=200&fit=crop&q=80",
    title: "Pharmacies",
    description: "Track stock levels, monitor inventory movement and improve operational visibility.",
  },
  {
    photo: "https://images.pexels.com/photos/36756598/pexels-photo-36756598.jpeg?auto=compress&cs=tinysrgb&w=400&h=200",
    title: "Restaurants",
    description: "Process orders quickly, track sales and manage daily transactions efficiently.",
  },
  {
    photo: "https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=400&h=200&fit=crop&q=80",
    title: "Electronics Stores",
    description: "Monitor high-value inventory and maintain accurate stock records.",
  },
  {
    photo: "https://images.pexels.com/photos/32184048/pexels-photo-32184048.jpeg?auto=compress&cs=tinysrgb&w=400&h=200",
    title: "Fashion Stores",
    description: "Manage product variants, stock movement and sales performance.",
  },
  {
    photo: "https://images.pexels.com/photos/17290985/pexels-photo-17290985.jpeg?auto=compress&cs=tinysrgb&w=400&h=200",
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
  "Today&apos;s Sales",
  "Top Selling Products",
  "Stock Alerts",
  "Branch Performance",
  "Recent Transactions",
  "Purchase Summary",
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
  { icon: MapPin, text: "Built for Nigerian businesses" },
]

const testimonials = [
  {
    quote:
      "MartPoint Retail transformed how we run our supermarket. We now track stock in real time across two branches and our checkout speed has doubled.",
    author: "Adeola B.",
    role: "Owner, FreshMart Supermarket",
    rating: 5,
    logo: "/trust/freshmart.png",
  },
  {
    quote:
      "Offline mode keeps us selling even when the network is down. Our pharmacy never stopped operations, and the daily reports help us reorder before we run out.",
    author: "Dr. Emeka N.",
    role: "Manager, GreenLife Pharmacy",
    rating: 5,
    logo: "/trust/greenlife.png",
  },
  {
    quote:
      "Orders flow straight from the counter to the kitchen. Our wait times dropped and we can finally see which dishes sell best every day.",
    author: "Chioma O.",
    role: "Manager, Spice Kitchen Restaurant",
    rating: 5,
    logo: "/trust/spicekitchen.png",
  },
  {
    quote:
      "Our laundry runs on MartPoint. We track pickups, deliveries and payments from one place. No more lost receipts or missed orders.",
    author: "Tunde A.",
    role: "Founder, Clean Bubbles Laundry",
    rating: 5,
    logo: "/trust/cleanbubbles.png",
  },
  {
    quote:
      "Managing high-value gadgets used to be stressful. Now every phone and laptop is tracked from purchase to sale with full warranty records.",
    author: "Ibrahim K.",
    role: "Director, TechWorld Electronics",
    rating: 5,
    logo: "/trust/techworld.png",
  },
  {
    quote:
      "We run three grocery stores and MartPoint connects them all. I can check stock, sales and staff from anywhere without calling each branch.",
    author: "Ngozi E.",
    role: "CEO, DailyNeeds Grocery",
    rating: 5,
    logo: "/trust/dailyneeds.png",
  },
]

const trustedBy = [
  { name: "FreshMart", logo: "/trust/freshmart.png" },
  { name: "GreenLife", logo: "/trust/greenlife.png" },
  { name: "Spice Kitchen", logo: "/trust/spicekitchen.png" },
  { name: "TechWorld", logo: "/trust/techworld.png" },
  { name: "Luxe", logo: "/trust/luxe.png" },
  { name: "DailyNeeds", logo: "/trust/dailyneeds.png" },
  { name: "256 Bar", logo: "/trust/256bar.png" },
  { name: "Clean Bubbles", logo: "/trust/cleanbubbles.png" },
  { name: "Gana", logo: "/trust/gana.png" },
  { name: "Luxuria", logo: "/trust/luxuria.png" },
  { name: "Zion Bookshop", logo: "/trust/zionbookshop.png" },
]

export default function MartPointRetailPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* SECTION 1 — HERO */}
        <section className="w-full bg-background border-b border-border overflow-hidden">
          <div className="container-martpoint py-16 md:py-24 lg:py-28">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              {/* Left: Copy */}
              <div className="max-w-xl">
                <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-4">
                  MartPoint Retail
                </span>
                <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.05] text-foreground">
                  See Every Sale. Track Every Stock Item. <span className="text-accent italic">Manage Every Branch.</span>
                </h1>
                <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed">
                  MartPoint Retail gives supermarkets, pharmacies, restaurants and growing retail businesses complete control of sales, inventory, payments and staff performance — all from one simple dashboard.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row gap-4">
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
                <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
                  {trustBullets.map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-retail shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: Laptop Mockup */}
              <div className="relative mx-auto lg:mx-0 w-full max-w-xl">
                <div className="relative">
                  {/* Screen bezel */}
                  <div className="rounded-xl bg-slate-800 p-2 pb-0 shadow-2xl">
                    {/* Camera dot */}
                    <div className="flex justify-center pb-2">
                      <div className="w-2 h-2 rounded-full bg-slate-600" />
                    </div>
                    {/* Screen */}
                    <div className="relative rounded-lg overflow-hidden bg-white aspect-[16/10]">
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-slate-400 z-0">
                        <Monitor className="w-10 h-10 mb-2" />
                        <span className="text-xs font-medium">Dashboard Preview</span>
                        <span className="text-[10px] text-slate-300 mt-1">Save retail-dashboard.png to /public/</span>
                      </div>
                      <Image
                        src="/retail-dashboard.png"
                        alt="MartPoint Retail Dashboard showing sales, stock alerts and branch performance"
                        fill
                        className="object-cover object-top z-10"
                        priority
                      />
                    </div>
                  </div>
                  {/* Laptop base */}
                  <div className="h-3 bg-slate-700 rounded-b-lg mx-4 shadow-lg" />
                  <div className="h-1 bg-slate-600 rounded-b-sm mx-12" />
                  {/* Labels */}
                  <div className="mt-4 flex flex-wrap justify-center gap-2">
                    <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-retail-soft text-retail border border-retail-muted">
                      Today&apos;s Sales
                    </span>
                    <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-retail-soft text-retail border border-retail-muted">
                      Stock Alerts
                    </span>
                    <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-retail-soft text-retail border border-retail-muted">
                      Recent Transactions
                    </span>
                    <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-retail-soft text-retail border border-retail-muted">
                      Branch Performance
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2 — WHO USES MARTPOINT RETAIL */}
        <section className="w-full bg-muted py-16 md:py-24 lg:py-28">
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
        <section className="w-full bg-[#023047] py-16 md:py-24 lg:py-28">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                Still Managing Your Store With Guesswork?
              </h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5 max-w-4xl mx-auto">
              {challenges.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl bg-white/5 border border-white/10 p-8 text-center transition-all duration-200 hover:bg-white/10 hover:border-white/20"
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
        <section className="w-full bg-background py-16 md:py-24 lg:py-28">
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

        {/* SECTION 5 — CAPABILITIES */}
        <section className="w-full bg-muted py-16 md:py-24 lg:py-28">
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
        <section className="w-full bg-background py-16 md:py-24 lg:py-28">
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
                <div className="relative rounded-lg overflow-hidden aspect-[4/3] bg-white">
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50 text-slate-400 z-0">
                    <Monitor className="w-12 h-12 mb-2" />
                    <span className="text-sm font-medium">Dashboard Preview</span>
                    <span className="text-xs text-slate-300 mt-1">Save retail-dashboard.png to /public/</span>
                  </div>
                  <Image
                    src="/retail-dashboard.png"
                    alt="MartPoint Retail Dashboard with sales metrics, stock alerts and transaction history"
                    fill
                    className="object-cover object-top z-10"
                  />
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {dashboardCallouts.map((callout) => (
                  <div
                    key={callout}
                    className="flex items-center gap-2 rounded-lg border border-retail-muted bg-retail-soft px-3 py-2"
                  >
                    <div className="w-2 h-2 rounded-full bg-retail shrink-0" />
                    <span className="text-xs font-medium text-retail">{callout}</span>
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

        {/* SECTION 6B — PRICING */}
        <section className="w-full bg-background py-16 md:py-24 lg:py-28">
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
                    Most Popular
                  </span>
                </div>
                <h3 className="text-xl font-bold text-foreground mt-2">MartPoint Retail Cloud</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-5xl font-extrabold text-retail">₦99,999</span>
                  <span className="text-muted-foreground">/ Year</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Everything you need to run a modern retail business.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    "POS Sales",
                    "Inventory Management",
                    "Customer Management",
                    "Expense Tracking",
                    "Supplier Management",
                    "Reports & Analytics",
                    "Receipt Printing",
                    "Cloud Backup",
                    "Software Updates",
                    "Technical Support",
                    "Mobile, Tablet & Desktop Access",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="w-4 h-4 text-retail shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 rounded-lg bg-retail-soft p-4 text-center">
                  <p className="text-sm font-semibold text-foreground">Includes 1 Branch</p>
                  <p className="text-xs text-muted-foreground mt-1">Additional Branch: ₦50,000 / Year</p>
                </div>
                <div className="mt-6">
                  <Button asChild size="lg" variant="retail" className="w-full">
                    <a href="https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20the%20MartPoint%20Retail%20Cloud%20plan.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
                      Get Started
                    </a>
                  </Button>
                </div>
              </div>

              {/* Offline Plan */}
              <div className="rounded-2xl border border-border bg-card p-8 shadow-sm">
                <h3 className="text-xl font-bold text-foreground">MartPoint Retail Offline</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-5xl font-extrabold text-foreground">₦250,000</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">One-Time Payment</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  For businesses that prefer a perpetual offline deployment.
                </p>
                <ul className="mt-6 space-y-3">
                  {[
                    "Full Retail Software",
                    "POS Sales",
                    "Inventory Management",
                    "Receipt Printing",
                    "Reporting",
                    "Local Installation",
                    "Staff Setup & Training",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm text-foreground">
                      <Check className="w-4 h-4 text-retail shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-6 rounded-lg bg-muted p-4 text-center">
                  <p className="text-sm font-semibold text-foreground">Additional Branch: ₦100,000 One-Time</p>
                  <p className="text-xs text-muted-foreground mt-1">Optional Support Renewal: ₦50,000 / Year</p>
                </div>
                <div className="mt-6">
                  <Button asChild size="lg" variant="outline" className="w-full">
                    <a href="https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20the%20MartPoint%20Retail%20Offline%20setup.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
                      Request Offline Setup
                    </a>
                  </Button>
                </div>
              </div>
            </div>

            {/* Price Examples */}
            <div className="max-w-2xl mx-auto mb-16">
              <h3 className="text-xl font-bold text-center text-foreground mb-6">
                Growing? Adding More Stores Is Simple.
              </h3>
              <div className="rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left px-6 py-3 font-semibold text-foreground">Branches</th>
                      <th className="text-right px-6 py-3 font-semibold text-foreground">Annual Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { branches: "1 Branch", cost: "₦99,999" },
                      { branches: "2 Branches", cost: "₦149,999" },
                      { branches: "3 Branches", cost: "₦199,999" },
                      { branches: "5 Branches", cost: "₦299,999" },
                      { branches: "10 Branches", cost: "₦549,999" },
                    ].map((row) => (
                      <tr key={row.branches} className="border-t border-border">
                        <td className="px-6 py-3 text-foreground">{row.branches}</td>
                        <td className="px-6 py-3 text-right font-bold text-retail">{row.cost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 text-center space-y-1">
                <p className="text-sm text-muted-foreground">Only pay for the branches you operate.</p>
                <p className="text-sm text-muted-foreground">No hidden charges. No forced upgrades.</p>
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 7 — HARDWARE & SETUP OPTIONS */}
        <section className="w-full bg-muted py-16 md:py-24 lg:py-28">
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
        <section className="w-full bg-[#023047] py-16 md:py-24 lg:py-28">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                Why Nigerian Businesses Choose MartPoint
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
        <section className="w-full bg-muted py-16 md:py-24 lg:py-28">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
                Testimonials
              </span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Trusted by Retail Businesses Across Nigeria
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
              <div className="flex flex-wrap justify-center items-center gap-x-12 gap-y-10 max-w-6xl mx-auto">
                {trustedBy.map((brand) => (
                  <div
                    key={brand.name}
                    className="relative h-28 w-auto shrink-0 grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all duration-300"
                    title={brand.name}
                  >
                    <Image
                      src={brand.logo}
                      alt={`${brand.name} logo`}
                      width={320}
                      height={112}
                      className="h-28 w-auto object-contain"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 9 — FINAL CTA */}
        <section className="w-full bg-background py-16 md:py-24 lg:py-28">
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
      </main>
      <Footer />
      <ExitIntentPopup />
    </>
  )
}
