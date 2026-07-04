export const revalidate = 86400
import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { FAQPageSchema, BreadcrumbSchema } from "@/components/structured-data"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ArrowRight,
  BarChart3,
  Package,
  Users,
  TrendingUp,
  AlertCircle,
  ShoppingCart,
  Receipt,
  Clock,
  Layers,
  Store,
  Pill,
  UtensilsCrossed,
  Shirt,
  Smartphone,
  ShoppingBag,
  Scissors,
  Truck,
  Building2,
  ChevronDown,
  Check,
  Boxes,
  CalendarClock,
  Wallet,
} from "lucide-react"

export const metadata: Metadata = {
  title: "MartPoint Intelligence — Business Insights for African Retailers",
  description:
    "MartPoint Intelligence analyses your sales, inventory and customer data to surface clear insights, alerts and recommendations that help you make better business decisions.",
  keywords: [
    "business intelligence Nigeria", "retail insights software",
    "inventory alerts", "sales insights Africa",
    "MartPoint Intelligence", "business decision support",
    "retail analytics Nigeria", "stock level alerts",
  ],
  alternates: {
    canonical: "/martpoint-intelligence",
  },
  openGraph: {
    title: "MartPoint Intelligence — Business Insights for African Retailers",
    description:
      "Clear insights, alerts and recommendations from your MartPoint data. Make better business decisions every day.",
    url: "https://martpoint.com.ng/martpoint-intelligence",
  },
}

const monitorCards = [
  {
    icon: BarChart3,
    title: "Sales Performance",
    description:
      "Understand daily sales trends, compare performance across different periods and identify products contributing to revenue.",
  },
  {
    icon: Package,
    title: "Inventory Insights",
    description:
      "Monitor products running low, identify items that require attention and understand stock movement more clearly.",
  },
  {
    icon: Users,
    title: "Customer Activity",
    description:
      "Review customer purchasing behaviour, identify repeat customers and understand customer engagement over time.",
  },
  {
    icon: TrendingUp,
    title: "Business Performance",
    description:
      "View important business indicators in one place, making it easier to review performance without opening multiple reports.",
  },
]

const actionableInsights = [
  { icon: AlertCircle, text: "Products currently below minimum stock level" },
  { icon: ShoppingCart, text: "Best-selling products this week" },
  { icon: Clock, text: "Products with little or no recent sales" },
  { icon: Wallet, text: "Customers with outstanding balances" },
  { icon: Building2, text: "Branch sales comparison" },
  { icon: Receipt, text: "Daily sales summary" },
  { icon: Boxes, text: "Recent inventory movement" },
  { icon: CalendarClock, text: "Expenses recorded today" },
]

const workflowModules = [
  { icon: ShoppingCart, name: "Retail" },
  { icon: Package, name: "Inventory" },
  { icon: Receipt, name: "Sales" },
  { icon: Users, name: "Customers" },
  { icon: Wallet, name: "Expenses" },
  { icon: Clock, name: "Attendance" },
  { icon: Layers, name: "PayPlan" },
  { icon: Store, name: "Storefront" },
]

const industries = [
  { icon: Store, name: "Supermarkets", desc: "Review stock movement and fast-selling products." },
  { icon: Pill, name: "Pharmacies", desc: "Monitor stock levels, expiry-related information and sales performance." },
  { icon: UtensilsCrossed, name: "Restaurants", desc: "Review daily sales and inventory usage." },
  { icon: Shirt, name: "Fashion Stores", desc: "Understand product movement across sizes and colours." },
  { icon: Smartphone, name: "Electronics Stores", desc: "Monitor sales performance and inventory by product category." },
  { icon: ShoppingBag, name: "Mini Marts", desc: "Quickly review daily sales, expenses and products needing replenishment." },
  { icon: Scissors, name: "Beauty & Salons", desc: "Monitor appointments, services and retail product performance." },
  { icon: Boxes, name: "Laundry", desc: "Track garment workflow and business activity." },
  { icon: Truck, name: "Distributors", desc: "Review warehouse inventory, customer balances and sales performance." },
  { icon: Building2, name: "Wholesalers", desc: "Monitor purchasing activity, inventory levels and customer accounts." },
]

const benefits = [
  "Spend less time searching through reports",
  "Identify important business information faster",
  "Make decisions using current business data",
  "Keep managers informed",
  "Monitor operations from one place",
  "Reduce manual report analysis",
]

const faqs = [
  {
    q: "What is MartPoint Intelligence?",
    a: "MartPoint Intelligence is a decision-support feature within the MartPoint platform. It analyses data already captured by your MartPoint account — sales, inventory, customers and expenses — and presents clear summaries, alerts and recommendations to help you make better business decisions.",
  },
  {
    q: "Is it included in MartPoint?",
    a: "MartPoint Intelligence is available as part of the MartPoint platform. Contact our team to learn about availability and pricing for your specific plan.",
  },
  {
    q: "Does it replace reports?",
    a: "No. MartPoint Intelligence complements your existing reports by surfacing the most important information so you can focus on what needs attention. Your full reports remain available for detailed analysis whenever you need them.",
  },
  {
    q: "Does it work for all industries?",
    a: "Yes. MartPoint Intelligence works with data from any MartPoint-supported industry including supermarkets, pharmacies, restaurants, fashion stores, electronics stores and more. The insights adapt based on the modules and data available in your account.",
  },
  {
    q: "Can multiple branches be monitored?",
    a: "Yes. If you operate multiple branches with MartPoint, Intelligence can present insights and comparisons across all your locations from one dashboard.",
  },
  {
    q: "How often are insights updated?",
    a: "Insights are generated from your current MartPoint data. As new sales, inventory movements and customer activity are recorded, the information presented by Intelligence reflects those changes.",
  },
  {
    q: "Can I access it on mobile?",
    a: "Yes. MartPoint Intelligence is accessible from any device with a browser, including smartphones and tablets, so you can review business insights on the go.",
  },
]

export default function MartPointIntelligencePage() {
  return (
    <>
      <BreadcrumbSchema items={[
        { name: "Home", href: "/" },
        { name: "MartPoint Intelligence", href: "/martpoint-intelligence" },
      ]} />
      <FAQPageSchema faqs={faqs.map((f) => ({ question: f.q, answer: f.a }))} />
      <Header />
      <main className="flex-1">
        {/* 1. Hero */}
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24 lg:py-32">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-4">
                MartPoint Intelligence
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.05] text-foreground">
                Understand Your Business Beyond Sales Reports
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                MartPoint Intelligence analyses the information already available inside your MartPoint account and presents meaningful insights about sales, inventory, customers and business performance, helping you focus on what needs attention.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%27d%20like%20to%20learn%20more%20about%20MartPoint%20Intelligence.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
                    Book a Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/martpoint-retail">Explore MartPoint Retail</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Why MartPoint Intelligence */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-4xl">
            <SectionHeader
              label="The Challenge"
              headline="Business Data Is Only Valuable When You Understand It"
            />
            <div className="mt-14 space-y-6 text-muted-foreground leading-relaxed">
              <p>
                Every day your business generates valuable information through sales transactions, inventory movements, customer activity and expenses. This data lives inside your MartPoint account, but extracting useful meaning from it usually means opening multiple reports, comparing figures manually and trying to spot what matters.
              </p>
              <p>
                MartPoint Intelligence helps organise this information into clear summaries, alerts and recommendations that are easier to act on than traditional reports. Instead of searching for the numbers that matter, Intelligence surfaces them for you — so you can spend less time analysing and more time making decisions.
              </p>
            </div>
          </div>
        </section>

        {/* 3. What Intelligence Helps You Monitor */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="Capabilities"
              headline="What MartPoint Intelligence Helps You Monitor"
              description="Four key areas where Intelligence turns your existing data into clear, actionable information."
            />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {monitorCards.map((card) => (
                <div
                  key={card.title}
                  className="rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mb-4">
                    <card.icon className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{card.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{card.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 4. Actionable Insights */}
        <section className="w-full bg-[#023047] py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-white/70 mb-3">
                Practical Examples
              </span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                Insights Designed For Everyday Decisions
              </h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
                Realistic examples of the kind of information MartPoint Intelligence presents to help you run your business more effectively.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-5xl mx-auto">
              {actionableInsights.map((insight) => (
                <div
                  key={insight.text}
                  className="rounded-xl bg-white/5 border border-white/10 p-5 flex items-start gap-3 transition-all duration-200 hover:bg-white/10"
                >
                  <insight.icon className="w-5 h-5 text-white/80 mt-0.5 shrink-0" />
                  <span className="text-sm text-white/90 leading-relaxed">{insight.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Built Into Your Existing Workflow */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-4xl">
            <SectionHeader
              label="Integration"
              headline="Built Into Your Existing Workflow"
              description="MartPoint Intelligence works alongside existing MartPoint modules. It is a layer that helps you understand information already collected by the platform."
            />
            <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-4">
              {workflowModules.map((mod) => (
                <div
                  key={mod.name}
                  className="rounded-xl border border-border bg-background p-5 text-center transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mx-auto mb-3">
                    <mod.icon className="w-5 h-5 text-retail" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{mod.name}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Designed For Different Businesses */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="Industries"
              headline="Designed For Different Businesses"
              description="MartPoint Intelligence supports the industries MartPoint serves, providing relevant insights based on how each business operates."
            />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              {industries.slice(0, 5).map((ind) => (
                <div
                  key={ind.name}
                  className="rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mb-3">
                    <ind.icon className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-1">{ind.name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{ind.desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5">
              {industries.slice(5).map((ind) => (
                <div
                  key={ind.name}
                  className="rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mb-3">
                    <ind.icon className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-1">{ind.name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{ind.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7. Why Business Owners Like Intelligence */}
        <section className="w-full bg-retail-soft border-y border-retail-muted py-16 md:py-24">
          <div className="container-martpoint max-w-4xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
                  Benefits
                </span>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                  Why Business Owners Like MartPoint Intelligence
                </h2>
                <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                  Intelligence helps you focus on what matters by reducing the time spent searching through reports and making important business information easier to find.
                </p>
              </div>
              <div className="space-y-4">
                {benefits.map((item) => (
                  <div key={item} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-retail flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 8. FAQ */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader
              label="FAQ"
              headline="Frequently Asked Questions"
            />
            <div className="mt-10 space-y-4">
              {faqs.map((faq, i) => (
                <details key={i} className="group rounded-xl border border-border bg-card p-5 cursor-pointer">
                  <summary className="flex items-center justify-between list-none">
                    <span className="text-sm font-semibold text-foreground">{faq.q}</span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 9. Final CTA */}
        <section className="w-full bg-[#023047] py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                Make Better Business Decisions With Confidence
              </h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
                MartPoint Intelligence helps business owners understand what is happening inside their business using information already available within MartPoint.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%27d%20like%20to%20learn%20more%20about%20MartPoint%20Intelligence.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
                    Book a Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10">
                  <Link href="/martpoint-retail">Explore MartPoint</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
