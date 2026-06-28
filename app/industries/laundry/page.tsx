import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ArrowRight,
  Package,
  AlertTriangle,
  Receipt,
  BarChart3,
  Timer,
  Building2,
  Check,
  X,
  ChevronDown,
  TrendingUp,
  Users,
  Eye,
  Sparkles,
  Monitor,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Laundry POS & Order Software — MartPoint Retail",
  description:
    "Track orders, manage pickup and delivery and simplify billing for your laundry business. Built for African laundry and dry cleaning services.",
}

const painPoints = [
  { icon: Package, title: "Lost Garments", desc: "Items disappear without trace. Customers are furious and compensation costs mount." },
  { icon: AlertTriangle, title: "Missed Deliveries", desc: "Pickup and delivery times are forgotten. Customers wait at home for nothing." },
  { icon: Receipt, title: "Unrecorded Express Orders", desc: "Rush jobs paid in cash go unlogged. Revenue is never fully captured." },
  { icon: BarChart3, title: "No Service Performance Data", desc: "You do not know which services — wash, dry clean, press — earn the most profit." },
  { icon: Timer, title: "Slow Order Intake", desc: "Manual counting and pricing at intake creates long queues during morning rush." },
  { icon: Building2, title: "No Customer History", desc: "You cannot remember a regular customer's preferences or pricing. Personal service is impossible." },
]

const workflow = [
  { step: "Customer drops off clothes", desc: "Quick intake with customer name, service type and garment count. A receipt prints instantly." },
  { step: "Garments tagged and sorted", desc: "Each item gets a unique tag number. Wash, dry clean and press batches are separated automatically." },
  { step: "Service selected and priced", desc: "Standard or express service selected. Pricing applies automatically based on fabric and treatment." },
  { step: "Payment recorded", desc: "Cash, card or transfer logged against the order. Partial payments and credit tracked clearly." },
  { step: "Pickup or delivery scheduled", desc: "Customer chooses pickup time or delivery address. The schedule syncs across all staff devices." },
  { step: "SMS or WhatsApp reminder sent", desc: "Automatic reminders notify customers when garments are ready. No more forgotten collections." },
  { step: "Ready for collection", desc: "Staff scan the tag, confirm the order and hand over clean garments with a smile." },
  { step: "Order completed and archived", desc: "Full history saved for warranty claims, reordering and customer loyalty tracking." },
]

const dashboardMetrics = [
  { label: "Today's Orders", value: "47" },
  { label: "Revenue Today", value: "₦125K" },
  { label: "Garments Ready", value: "89" },
  { label: "Outstanding Payments", value: "₦18K" },
  { label: "Delayed Orders", value: "3" },
  { label: "Repeat Customers", value: "32" },
]

const beforeAfter = {
  before: [
    "Manual notebooks for every order",
    "Lost garments with no trace",
    "Missed pickups and angry customers",
    "Guessing daily profit",
    "Forgotten regular customers",
  ],
  after: [
    "Digital tracking for every garment",
    "Complete item history from intake to delivery",
    "Automatic pickup reminders",
    "Live revenue and profit reports",
    "Customer database with preferences",
  ],
}

const intelligence = [
  { icon: Eye, title: "Garments Waiting for Pickup", desc: "See exactly which orders are ready and which customers have not collected yet." },
  { icon: Users, title: "Customers Overdue for Collection", desc: "Identify overdue pickups so you can follow up and free up storage space." },
  { icon: TrendingUp, title: "Revenue Trends", desc: "Track weekly and monthly revenue patterns to predict busy periods and plan staffing." },
  { icon: BarChart3, title: "Most Requested Services", desc: "Discover which services — wash, press, dry clean — drive the most profit." },
  { icon: Monitor, title: "Repeat Customer Insights", desc: "See who your best customers are and how often they return. Reward loyalty." },
  { icon: Sparkles, title: "Suggested Actions", desc: "Get alerts to reorder supplies, follow up late payments or promote slow periods." },
]

const faqs = [
  { q: "Can I track every garment individually?", a: "Yes. Every garment receives a unique tag number. You can track it from intake through cleaning to delivery with full history." },
  { q: "Can customers receive pickup reminders?", a: "Absolutely. MartPoint sends automatic SMS and WhatsApp reminders when garments are ready for collection." },
  { q: "Can I record different laundry services?", a: "Yes. Wash, dry clean, press, express and special treatments are all recorded separately with accurate pricing for each." },
  { q: "Does MartPoint work for multiple branches?", a: "Yes. You can manage multiple laundry locations from one dashboard with inter-branch transfers and consolidated reporting." },
  { q: "Can I use barcode or QR tags?", a: "Yes. MartPoint supports barcode and QR code scanning for fast garment check-in and check-out." },
  { q: "Can I manage customer history?", a: "Yes. Every customer gets a profile with preferences, pricing, order history and contact details for personalised service." },
]

export default function LaundryPage() {
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
                Never Lose a Garment or Miss a Delivery Again
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Laundry businesses live by organisation and trust. MartPoint Retail tracks every garment, manages pickup and delivery schedules and simplifies billing so your customers always get their clothes back clean, pressed and on time.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20laundry%20business%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
                    See It In Action
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
                The Challenges Holding Your Laundry Back
              </h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
                These operational leaks cost African laundries money every single day. MartPoint was built to eliminate them.
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
              headline="How MartPoint Fits Into Your Daily Laundry Workflow"
              description="From customer drop-off to final collection, every step is tracked and connected."
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
              headline="See Your Laundry Business At A Glance"
              description="The numbers that matter most, updated in real time every single day."
            />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
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
              headline="Why Laundry Businesses Switch To MartPoint"
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

        {/* Testimonial Placeholder */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint max-w-3xl mx-auto text-center">
            <div className="rounded-2xl border border-border bg-card p-8 md:p-12">
              <div className="text-xs font-semibold uppercase tracking-wider text-retail mb-4">Customer Story</div>
              <blockquote className="text-xl md:text-2xl text-foreground leading-relaxed italic max-w-2xl mx-auto">
                &ldquo;Since switching to MartPoint, we have not lost a single garment. Our customers trust us more, our revenue is up and morning rush is actually manageable.&rdquo;
              </blockquote>
              <div className="mt-8 flex items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-retail/10 flex items-center justify-center text-retail font-bold text-base">AO</div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">Adeola O.</div>
                  <div className="text-xs text-muted-foreground">Owner, Spotless Laundry, Lagos</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader label="FAQ" headline="Questions Laundries Ask" />
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
                Run Your Laundry With Complete Confidence
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Join laundries across Africa using MartPoint to track every garment, never miss a delivery and grow profit with real business intelligence.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20laundry%20business%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
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
