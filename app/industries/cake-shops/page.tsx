import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ArrowRight,
  CalendarDays,
  Package,
  Receipt,
  BarChart3,
  AlertTriangle,
  ChefHat,
  Check,
  X,
  ChevronDown,
  TrendingUp,
  Users,
  Eye,
  Lightbulb,
  Monitor,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Cake Shop POS & Order Software — MartPoint Retail",
  description:
    "Manage custom cake orders, track ingredient stock and plan production. MartPoint Retail is built for African cake shops and pastry businesses.",
}

const painPoints = [
  { icon: CalendarDays, title: "Lost Order Details", desc: "Customer orders written on paper get misplaced. Flavours, sizes and delivery dates are forgotten." },
  { icon: Package, title: "Ingredient Shortages", desc: "You start decorating and realise you are out of fondant or food colouring. Orders get delayed." },
  { icon: Receipt, title: "Deposit Tracking Chaos", desc: "Customers pay deposits but you have no system to track balances or due dates." },
  { icon: BarChart3, title: "No Order Profitability", desc: "You do not know which cake sizes or flavours earn the most profit after ingredients and labour." },
  { icon: AlertTriangle, title: "Expired Ingredients", desc: "Baking supplies sit unused and expire. You only discover the loss when you need them." },
  { icon: ChefHat, title: "Custom Orders Overwhelm", desc: "Wedding and event season brings dozens of orders. Managing them without a system becomes impossible." },
]

const workflow = [
  { step: "Customer places an order", desc: "Record flavour, size, design, delivery date and deposit. A receipt prints instantly for the customer." },
  { step: "Order enters the production queue", desc: "The order appears on your production board with baking and decoration deadlines clearly marked." },
  { step: "Ingredients are checked and reserved", desc: "Flour, eggs, fondant and colouring are automatically reserved. Low-stock alerts fire before you run out." },
  { step: "Deposit is recorded, balance tracked", desc: "Partial payments, deposits and final balances are logged with automatic due-date reminders." },
  { step: "Production begins on schedule", desc: "Baking and decoration follow the planned timeline. Staff know exactly what to make and when it is due." },
  { step: "Reminder is sent before delivery", desc: "Automatic reminders notify the customer and your delivery team the day before collection or drop-off." },
  { step: "Cake is collected or delivered", desc: "Final payment is processed, the order is marked complete and the customer receives a beautiful cake on time." },
  { step: "Business reports update automatically", desc: "Revenue, ingredient usage and order history update in real time. No spreadsheets needed." },
]

const dashboardMetrics = [
  { label: "Today's Orders", value: "12" },
  { label: "Revenue Today", value: "₦85K" },
  { label: "Outstanding Balances", value: "₦42K" },
  { label: "Low Stock Items", value: "4" },
  { label: "Upcoming Deliveries", value: "7" },
  { label: "Completed This Week", value: "34" },
  { label: "Repeat Customers", value: "18" },
  { label: "Top Flavour", value: "Red Velvet" },
]

const beforeAfter = {
  before: [
    "Orders scribbled on paper and sticky notes",
    "Forgotten delivery dates and angry customers",
    "Ingredients running out mid-decoration",
    "No idea which cakes are actually profitable",
    "Expired fondant and wasted supplies",
  ],
  after: [
    "Every order digitally recorded and searchable",
    "Automatic reminders before every delivery",
    "Stock alerts before you run out",
    "Profit reports for every cake size and flavour",
    "Expiry tracking that protects your ingredients",
  ],
}

const intelligence = [
  { icon: Package, title: "Ingredients Running Low", desc: "Know exactly which baking supplies need reordering before your next batch of orders." },
  { icon: Users, title: "Customers Awaiting Collection", desc: "See which orders are ready and which customers still owe a final balance before pickup." },
  { icon: Receipt, title: "Outstanding Balances", desc: "Track deposit payments and alert customers when final payments are due before delivery." },
  { icon: AlertTriangle, title: "Slow-Moving Flavours", desc: "Identify which cake flavours are not selling so you can promote them or remove them from the menu." },
  { icon: TrendingUp, title: "Sales Trends", desc: "Spot seasonal demand patterns — wedding season, holidays, back-to-school — and plan production ahead." },
  { icon: Lightbulb, title: "Suggested Actions", desc: "Get alerts to reorder supplies, follow up late payments or offer discounts during slow weeks." },
]

const faqs = [
  { q: "Can I track custom cake orders with all the details?", a: "Yes. Record flavour, size, design, delivery date, customer contact and special instructions. Search and update any order instantly." },
  { q: "Does it track deposits and final balances?", a: "Absolutely. Record deposits, track remaining balances and get automatic alerts when final payments are due before delivery." },
  { q: "Can it alert me before ingredients expire?", a: "Yes. Set expiry dates on all baking supplies and receive alerts before fondant, colouring or flavourings go bad." },
  { q: "Does it work during wedding and event season?", a: "Yes. MartPoint handles high order volumes during peak seasons. Production scheduling keeps every deadline visible." },
  { q: "Can I see which cakes make the most profit?", a: "Yes. Profit reports show revenue minus ingredient and labour costs for every cake size and flavour." },
  { q: "Does it remind customers before collection?", a: "Yes. Automatic SMS and WhatsApp reminders notify customers the day before pickup or delivery." },
]

export default function CakeShopsPage() {
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
                Never Miss a Cake Order or Run Out of Icing Again
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Cake shops blend creativity with tight deadlines. MartPoint Retail tracks custom orders, manages ingredient stock and alerts you before supplies run low so every celebration gets its cake on time.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20cake%20shop%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
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
                The Challenges Holding Your Cake Shop Back
              </h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
                These operational leaks cost African cake shops money and reputation every single day. MartPoint was built to eliminate them.
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
              headline="How MartPoint Fits Into Your Daily Cake Shop Workflow"
              description="From customer order to final delivery, every step is tracked, scheduled and connected."
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
              headline="See Your Cake Shop At A Glance"
              description="The numbers that matter most, updated in real time every single day."
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
              headline="Why Cake Shops Switch To MartPoint"
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
                &ldquo;During wedding season I used to write orders in three different notebooks. Now everything is in one place. I have not missed a delivery since switching to MartPoint and my customers trust me more than ever.&rdquo;
              </blockquote>
              <div className="mt-8 flex items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-retail/10 flex items-center justify-center text-retail font-bold text-base">BN</div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">Blessing N.</div>
                  <div className="text-xs text-muted-foreground">Owner, Sugar & Spice Cakes, Abuja</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader label="FAQ" headline="Questions Cake Shops Ask" />
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
                Run Your Cake Shop With Complete Confidence
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Join cake shops across Africa using MartPoint to track every order, never miss a deadline and grow profit with real business intelligence.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20cake%20shop%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
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
