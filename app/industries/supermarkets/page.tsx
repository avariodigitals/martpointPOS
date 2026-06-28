import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ArrowRight,
  AlertTriangle,
  Timer,
  Package,
  Building2,
  BarChart3,
  Receipt,
  Check,
  X,
  ChevronDown,
  TrendingUp,
  Lightbulb,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Supermarket POS & Inventory Software — MartPoint Retail",
  description:
    "Run your supermarket without stockouts, long queues or manual counting. MartPoint Retail gives you real-time inventory, fast checkout and multi-branch control.",
}

const painPoints = [
  { icon: Timer, title: "Long Checkout Queues", desc: "Slow manual entry frustrates shoppers and kills sales, especially on weekends and holidays." },
  { icon: Package, title: "Stock Shortages", desc: "Shelves go bare before you notice. Customers leave empty-handed and shop elsewhere next time." },
  { icon: AlertTriangle, title: "Expired Products", desc: "Without expiry tracking, you lose money to spoilage and risk losing customer trust forever." },
  { icon: Receipt, title: "Cashier Errors & Shrinkage", desc: "Without sales-to-stock matching, gaps go unnoticed until stock count reveals massive losses." },
  { icon: Building2, title: "Branch Stock Differences", desc: "Each store operates in isolation. You cannot see what sells where or transfer stock efficiently." },
  { icon: BarChart3, title: "Daily Reconciliation Stress", desc: "Closing stock takes hours every week, and the numbers are usually wrong by Monday morning." },
]

const workflow = [
  { step: "Stock arrives at the store", desc: "Goods are received into inventory with batch numbers and expiry dates recorded automatically." },
  { step: "Products are shelved", desc: "Staff know exactly where each item goes. Shelf quantities update as stock is put out for customers." },
  { step: "Customer shops and checks out", desc: "Barcode scanning keeps checkout under 15 seconds per customer. Queues move fast even at peak hours." },
  { step: "Inventory updates instantly", desc: "Every sale deducts stock in real time. You know exactly what is left on the shelf after each transaction." },
  { step: "Manager monitors sales live", desc: "Live dashboards show transactions, revenue and stock levels as they happen, not at the end of the day." },
  { step: "Low stock alerts are generated", desc: "Products approaching reorder levels trigger automatic alerts before they run out completely." },
  { step: "Supplier reorder is initiated", desc: "Purchase orders are created based on actual sales data, not guesswork. Supplier delivery is tracked." },
  { step: "End-of-day reconciliation completes", desc: "Sales, stock and cash are reconciled automatically. Discrepancies are flagged for review instantly." },
]

const dashboardMetrics = [
  { label: "Today's Sales", value: "₦1.4M" },
  { label: "Transactions Today", value: "1,247" },
  { label: "Low Stock Products", value: "23" },
  { label: "Items Expiring Soon", value: "12" },
  { label: "Top Selling Product", value: "Rice 5kg" },
  { label: "Cashier Performance", value: "Amina" },
  { label: "Branch Comparison", value: "Branch 2" },
  { label: "Gross Profit Today", value: "₦312K" },
]

const beforeAfter = {
  before: [
    "Manual stock counts every Sunday evening",
    "Long queues during weekends and holidays",
    "Stockouts discovered only when customers complain",
    "Paper reports that take days to compile",
    "Cashier mistakes and theft go unnoticed",
    "Delayed decisions because data is never current",
  ],
  after: [
    "Real-time inventory updated with every sale",
    "Fast barcode checkout under 15 seconds",
    "Automatic stock alerts before shelves go bare",
    "Live dashboards available on any device",
    "Accurate reconciliation with discrepancy alerts",
    "Better business decisions backed by live data",
  ],
}

const intelligence = [
  { icon: Package, title: "Products Below Reorder Level", desc: "See exactly which 23 items need restocking before your next supplier delivery arrives." },
  { icon: TrendingUp, title: "Sales Spikes Detected", desc: "Milk sales increased 28% this week. Recommend increasing the next order quantity." },
  { icon: Receipt, title: "Cashier Reconciliation Review", desc: "Three cashiers have discrepancies above threshold. Review recommended before end of shift." },
  { icon: Building2, title: "Branch Performance Comparison", desc: "Branch 2 is outperforming Branch 1 by 18% this month. Investigate what is working there." },
  { icon: BarChart3, title: "Highest Gross Profit Today", desc: "Soft drinks generated the highest margin today. Consider moving them to a more visible shelf position." },
  { icon: Lightbulb, title: "Suggested Actions", desc: "Reorder cooking oil before Friday. Promote slow-moving pasta. Review Branch 1 staffing on weekends." },
]

const faqs = [
  { q: "Can MartPoint manage thousands of SKUs?", a: "Yes. MartPoint is built for large catalogues. Import SKUs in bulk, organise by category and search instantly at checkout." },
  { q: "Can I monitor multiple supermarket branches?", a: "Yes. The multi-branch dashboard shows live sales, stock levels and staff performance for every location from one login." },
  { q: "Can I track expiry dates on products?", a: "Absolutely. Batch-level expiry management with FIFO alerts ensures nothing goes to waste and customers never receive expired goods." },
  { q: "Can different cashiers use the same system?", a: "Yes. Each cashier gets their own login. Sales, refunds and voids are tracked per user for full accountability." },
  { q: "Does inventory update automatically after every sale?", a: "Yes. Every barcode scan deducts stock instantly. You always know what is on the shelf in real time." },
  { q: "Can I manage suppliers and purchase orders?", a: "Yes. Create purchase orders, track supplier deliveries and compare supplier pricing within the same system." },
  { q: "Can I compare branch performance?", a: "Yes. Compare sales, profit, stock turnover and staff productivity across every branch with unified reporting." },
]

export default function SupermarketsPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24 lg:py-32">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-4">
                MartPoint Retail
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.05] text-foreground">
                Stop Losing Money to Stock Gaps and Slow Checkout
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Know what is selling, what is running low and what is costing you money — all in real time. MartPoint Retail protects supermarket profit by connecting every sale to your inventory, your staff and your bottom line.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20supermarket%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
                    Book a Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/pricing">View Pricing</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Pain Points */}
        <section className="w-full bg-[#023047] py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                The Challenges Holding Your Supermarket Back
              </h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
                These daily operational leaks cost African supermarkets profit, customers and competitive edge. MartPoint was built to close every one of them.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {painPoints.map((item) => (
                <div key={item.title} className="rounded-xl bg-white/5 border border-white/10 p-6 text-center transition-all duration-200 hover:bg-white/10">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-white/95 mb-2">{item.title}</p>
                  <p className="text-xs text-white/60 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Workflow */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="How It Works"
              headline="How MartPoint Fits Into Your Store's Daily Operations"
              description="From stock arrival to end-of-day reconciliation, every step is connected, tracked and automated."
            />
            <div className="mt-14 max-w-3xl mx-auto">
              <div className="relative">
                {workflow.map((step, i) => (
                  <div key={i} className="flex gap-4 mb-8 last:mb-0">
                    <div className="flex flex-col items-center">
                      <div className="w-10 h-10 rounded-full bg-retail text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-sm">
                        {i + 1}
                      </div>
                      {i < workflow.length - 1 && <div className="w-px h-full bg-retail/20 my-2" />}
                    </div>
                    <div className="pb-2">
                      <h3 className="text-base font-semibold text-foreground mb-1">{step.step}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Dashboard Metrics */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="Dashboard"
              headline="Your Store At A Glance"
              description="The numbers that drive supermarket decisions, updated in real time every single day."
            />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
              {dashboardMetrics.map((metric) => (
                <div key={metric.label} className="rounded-xl border border-border bg-card p-6 text-center transition-all duration-200 hover:border-retail/30 hover:shadow-sm">
                  <div className="text-3xl font-extrabold text-retail mb-2">{metric.value}</div>
                  <div className="text-sm font-medium text-foreground">{metric.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Before / After */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-5xl mx-auto">
            <SectionHeader
              label="Transformation"
              headline="Why Supermarket Owners Switch To MartPoint"
              description="See the difference between how you work now and how MartPoint changes everything."
            />
            <div className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="rounded-2xl border border-border bg-background p-8">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-6">Before MartPoint</div>
                <div className="space-y-4">
                  {beforeAfter.before.map((text, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <X className="w-5 h-5 text-destructive mt-0.5 shrink-0" />
                      <span className="text-foreground">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-retail/20 bg-background p-8">
                <div className="text-xs font-semibold uppercase tracking-wider text-retail mb-6">After MartPoint</div>
                <div className="space-y-4">
                  {beforeAfter.after.map((text, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-retail mt-0.5 shrink-0" />
                      <span className="text-foreground">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Intelligence */}
        <section className="w-full bg-[#023047] py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-4">MartPoint Intelligence</span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">More Than Reports. Actionable Business Intelligence.</h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
                MartPoint does not just record your data. It analyses patterns, highlights opportunities and suggests what to do next.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {intelligence.map((item) => (
                <div key={item.title} className="rounded-xl bg-white/5 border border-white/10 p-6 text-center transition-all duration-200 hover:bg-white/10">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-4">
                    <item.icon className="w-6 h-6 text-white" />
                  </div>
                  <p className="text-sm font-semibold text-white/95 mb-2">{item.title}</p>
                  <p className="text-xs text-white/60 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonial */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint max-w-3xl mx-auto text-center">
            <div className="rounded-2xl border border-border bg-card p-8 md:p-12">
              <div className="text-xs font-semibold uppercase tracking-wider text-retail mb-4">Customer Story</div>
              <blockquote className="text-xl md:text-2xl text-foreground leading-relaxed italic max-w-2xl mx-auto">
                &ldquo;We run two supermarkets in Lagos. Before MartPoint, we counted stock manually every Sunday. Now I know exactly what each branch has in real time. Checkout is faster and our waste has dropped significantly.&rdquo;
              </blockquote>
              <div className="mt-8 flex items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-retail/10 flex items-center justify-center text-retail font-bold text-base">AB</div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">Adeola B.</div>
                  <div className="text-xs text-muted-foreground">Owner, FreshMart Supermarket</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader label="FAQ" headline="Questions Supermarkets Ask" />
            <div className="mt-10 space-y-4">
              {faqs.map((faq, i) => (
                <details key={i} className="group rounded-xl border border-border bg-background p-5 cursor-pointer">
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

        {/* CTA */}
        <section className="w-full bg-retail-soft border-y border-retail-muted py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Run Your Supermarket With Total Visibility
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Join supermarkets across Africa using MartPoint to reduce stock loss, speed up checkout and make better decisions with real business intelligence.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20supermarket%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
                    Book a Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/pricing">View Pricing</Link>
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
