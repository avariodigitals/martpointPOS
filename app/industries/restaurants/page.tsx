import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ArrowRight,
  Clock,
  AlertTriangle,
  UtensilsCrossed,
  Receipt,
  BarChart3,
  Users,
  ChefHat,
  Check,
  X,
  ChevronDown,
  TrendingUp,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Restaurant POS & Kitchen Software — MartPoint Retail",
  description:
    "Take orders faster, manage kitchen flow and track ingredient inventory. MartPoint Retail is built for African restaurants, fast-food outlets and cafes.",
}

const painPoints = [
  { icon: Clock, title: "Slow Service", desc: "Waiters scribble orders by hand. Mistakes delay service and frustrate hungry customers during peak hours." },
  { icon: AlertTriangle, title: "Kitchen Miscommunication", desc: "Orders get lost between the floor and the kitchen. Some dishes never make it to the table at all." },
  { icon: UtensilsCrossed, title: "Food Waste", desc: "Without portion tracking, food costs spiral and profitability disappears before the end of the month." },
  { icon: Receipt, title: "Long Payment Queues", desc: "Splitting bills manually takes forever and customers lose patience at checkout, killing repeat visits." },
  { icon: BarChart3, title: "No Visibility Into Profitable Meals", desc: "You do not know which dishes are profitable or which ingredients to reorder until it is too late." },
  { icon: Users, title: "Busy Periods Becoming Chaotic", desc: "Peak hours turn into chaos. Staff are overwhelmed, orders back up and service quality collapses." },
]

const workflow = [
  { step: "Customer enters the restaurant", desc: "The host seats them at a table that is tracked in real time. Reservations and walk-ins are organised instantly." },
  { step: "Table is assigned", desc: "Staff know which tables are free, occupied or waiting to be cleared. Turn times are visible at a glance." },
  { step: "Order is captured", desc: "Waiters enter orders digitally with modifiers and special requests. No more scribbled notes or misheard instructions." },
  { step: "Kitchen ticket generated", desc: "Orders route directly to the kitchen printer with table numbers, modifiers and timing. Nothing gets missed." },
  { step: "Chef prepares the meal", desc: "The kitchen sees exactly what to cook, when and for which table. Course timing and dietary notes are included." },
  { step: "Server delivers the food", desc: "Staff know when each dish is ready. Food goes to the right table, hot and on time, every single time." },
  { step: "Bill is generated", desc: "The bill is calculated automatically including split payments, discounts and service charges. No calculator needed." },
  { step: "Payment is completed", desc: "Cash, card, transfer and mobile money are all recorded in one flow. Receipts print or send by SMS instantly." },
  { step: "Inventory is updated", desc: "Ingredients are deducted from stock automatically based on the recipes linked to each menu item sold." },
  { step: "Manager reviews sales and profits", desc: "Revenue, table turnover, top dishes and ingredient usage are all available before the last customer leaves." },
]

const dashboardMetrics = [
  { label: "Orders In Progress", value: "24" },
  { label: "Kitchen Queue", value: "12" },
  { label: "Today's Revenue", value: "₦450K" },
  { label: "Top Selling Meal", value: "Jollof Rice" },
  { label: "Low Stock Ingredients", value: "8" },
  { label: "Average Order Value", value: "₦4,200" },
  { label: "Tables Occupied", value: "18/22" },
  { label: "Completed Orders", value: "187" },
]

const beforeAfter = {
  before: [
    "Handwritten orders that get lost or misread",
    "Kitchen mistakes that delay service and waste food",
    "Slow service that frustrates customers at peak hours",
    "Manual stock tracking that is always behind",
    "Guessing which dishes actually make money",
    "End-of-day stress with piles of paper receipts",
  ],
  after: [
    "Digital order flow from table to kitchen instantly",
    "Kitchen accuracy with printed tickets and modifiers",
    "Faster service that turns more tables per shift",
    "Real-time ingredient tracking with recipe links",
    "Dish profitability insights updated with every sale",
    "Instant business reports before you close for the night",
  ],
}

const intelligence = [
  { icon: TrendingUp, title: "Profit Leader Today", desc: "Jollof Rice generated the highest profit today. Consider featuring it in your weekend specials." },
  { icon: UtensilsCrossed, title: "Ingredient Running Low", desc: "Chicken stock will finish before dinner service. Recommend placing an order before 3 PM." },
  { icon: Clock, title: "Table Turnover Alert", desc: "Table turnover is slower than yesterday. Investigate kitchen delays or review table assignments." },
  { icon: BarChart3, title: "Sales Performance", desc: "Lunch sales increased by 22% this week. Analyse what changed and replicate it next week." },
  { icon: AlertTriangle, title: "Slow-Moving Menu Items", desc: "Three menu items have not sold today. Consider a daily special to clear ingredients and test pricing." },
  { icon: ChefHat, title: "Preparation Recommendation", desc: "Recommend preparing more grilled chicken before the evening rush. Historical data shows high demand at 7 PM." },
]

const faqs = [
  { q: "Can MartPoint manage tables and reservations?", a: "Yes. Track table status, manage reservations and monitor dining time to maximise seating capacity during every shift." },
  { q: "Does it send orders directly to the kitchen?", a: "Yes. Orders route automatically to your kitchen printer or display with table numbers, modifiers and special requests clearly listed." },
  { q: "Can I track ingredient usage per dish?", a: "Absolutely. Link recipes to raw ingredients and MartPoint deducts stock automatically with every order sold. You know exactly what you have left." },
  { q: "Can I monitor profitable menu items?", a: "Yes. See revenue, cost and profit for every menu item in real time. Know what to promote and what to remove." },
  { q: "Can multiple cashiers use the system?", a: "Yes. Each staff member gets their own login. Orders, payments and voids are tracked per user for full accountability." },
  { q: "Can I manage multiple restaurant branches?", a: "Yes. Compare sales, stock and staff performance across every location from one central dashboard with unified reporting." },
  { q: "Does inventory reduce automatically after meals are sold?", a: "Yes. Every order deducts the exact recipe ingredients from stock in real time. No manual updates required." },
]

export default function RestaurantsPage() {
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
                Turn More Tables. Waste Less Food.
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Serve customers faster, reduce kitchen mistakes and understand exactly which meals make your restaurant the most money. MartPoint Retail connects your floor, kitchen and back office into one smooth operation.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20restaurant%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
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
                The Challenges Holding Your Restaurant Back
              </h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
                These daily operational leaks cost African restaurants profit, customers and growth. MartPoint was built to close every one of them.
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
              headline="How MartPoint Fits Into Your Restaurant's Daily Workflow"
              description="From the first customer to the final report, every step is connected, tracked and optimised for speed and accuracy."
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
              headline="Your Restaurant At A Glance"
              description="The numbers that drive restaurant decisions, updated live while your kitchen is still running."
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
              headline="Why Restaurant Owners Switch To MartPoint"
              description="See the difference between how you operate now and how MartPoint transforms your restaurant."
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
                &ldquo;Orders now go straight from the table to the kitchen printer. No more lost tickets. Our wait times dropped by half and we finally know which dishes actually make us money.&rdquo;
              </blockquote>
              <div className="mt-8 flex items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-retail/10 flex items-center justify-center text-retail font-bold text-base">CO</div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">Chioma O.</div>
                  <div className="text-xs text-muted-foreground">Manager, Spice Kitchen Restaurant</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader label="FAQ" headline="Questions Restaurants Ask" />
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
                Serve Faster. Waste Less. Grow Your Restaurant.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Join restaurants across Africa using MartPoint to serve customers faster, reduce kitchen mistakes and make confident decisions with real business intelligence.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20restaurant%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
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
