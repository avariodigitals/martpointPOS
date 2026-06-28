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
  Package,
  Receipt,
  BarChart3,
  Users,
  ChefHat,
  Check,
  X,
  ChevronDown,
  TrendingUp,
  Sparkles,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Fast Food POS & Kitchen Software — MartPoint Retail",
  description:
    "Speed up service, track combo meals and manage ingredient stock for your fast food outlet. Built for African quick-service restaurants.",
}

const painPoints = [
  { icon: Clock, title: "Long Customer Queues", desc: "Manual order taking creates bottlenecks during lunch and dinner rushes. Customers walk away rather than wait." },
  { icon: AlertTriangle, title: "Combo Pricing Mistakes", desc: "Staff forget combo prices and ring up items separately. Margins slip with every transaction error." },
  { icon: ChefHat, title: "Kitchen Bottlenecks", desc: "Orders stack up with no visibility. Some meals sit too long while others never get started." },
  { icon: Package, title: "Ingredient Shortages", desc: "You discover empty freezers only when a customer orders their favourite meal. Rush hour becomes a disaster." },
  { icon: Receipt, title: "Drive-Through & Delivery Confusion", desc: "Window and phone orders paid in cash often go unlogged. Revenue leaks add up fast and refunds become impossible." },
  { icon: Users, title: "Rush-Hour Staff Chaos", desc: "Untrained staff panic during peak hours. Orders get confused, customers complain and speed collapses." },
]

const workflow = [
  { step: "Customer places order", desc: "Counter, drive-through or phone orders are captured instantly with one-tap combo buttons and clear modifiers." },
  { step: "Combo is selected", desc: "Staff select pre-configured combos automatically. Upsells, substitutions and special requests are tracked without manual pricing." },
  { step: "Kitchen is notified instantly", desc: "Orders route straight to the kitchen printer or display screen with prep instructions, channel and timing. Nothing gets missed." },
  { step: "Meal is prepared", desc: "The kitchen sees exactly what to cook, when and for which channel. Course timing, dietary notes and rush priorities are included." },
  { step: "Packed for dine-in, takeaway or delivery", desc: "Each order is tagged by channel. Staff know which bag is for the counter, the window or the delivery driver." },
  { step: "Payment is completed", desc: "Cash, card, transfer and mobile money are all recorded in one flow. Receipts print or send by SMS instantly." },
  { step: "Inventory updates automatically", desc: "Every combo sold deducts ingredients from stock in real time. Recipe links keep usage accurate without counting." },
  { step: "Manager monitors live performance", desc: "Live dashboards show orders per channel, prep times, revenue and ingredient levels while the kitchen is still running." },
]

const dashboardMetrics = [
  { label: "Orders Waiting", value: "31" },
  { label: "Kitchen Queue", value: "18" },
  { label: "Avg Prep Time", value: "6 min" },
  { label: "Orders Completed", value: "342" },
  { label: "Today's Revenue", value: "₦620K" },
  { label: "Delivery Orders", value: "89" },
  { label: "Takeaway Orders", value: "156" },
  { label: "Top Selling Combo", value: "Rice & Chicken" },
]

const beforeAfter = {
  before: [
    "Long queues that turn customers away at peak hours",
    "Kitchen confusion with lost and delayed orders",
    "Manual combo pricing that staff get wrong daily",
    "Reports that arrive too late to fix anything",
    "Inventory guesswork that leads to mid-service shortages",
    "Rush-hour stress that overwhelms the entire team",
  ],
  after: [
    "Fast ordering with one-tap combo buttons",
    "Instant kitchen communication via printer or display",
    "Automatic combo pricing applied every time",
    "Live dashboards showing sales as they happen",
    "Real-time inventory alerts before stock runs out",
    "Confident decision-making backed by live data",
  ],
}

const intelligence = [
  { icon: TrendingUp, title: "Traffic Spike Alert", desc: "Lunch traffic is 34% higher than yesterday. Recommend opening an extra counter and prepping more rice." },
  { icon: Package, title: "Ingredient Running Low", desc: "Chicken stock will finish before dinner. Recommend placing an order before 2 PM to avoid evening shortages." },
  { icon: BarChart3, title: "Top Combo Today", desc: "Combo Meal 2 is today's best seller. Consider promoting it in your window display and delivery apps." },
  { icon: Clock, title: "Prep Time Alert", desc: "Average preparation time increased by 15% this hour. Investigate kitchen workflow or equipment issues." },
  { icon: Users, title: "Channel Shift Detected", desc: "Delivery orders now exceed walk-in orders. Consider allocating more kitchen space to delivery prep." },
  { icon: ChefHat, title: "Batch Recommendation", desc: "Recommend preparing another batch of fried rice. Historical data shows a 7 PM demand spike on weekends." },
  { icon: Receipt, title: "Cashier Performance", desc: "Cashier 3 handled the highest number of transactions today. Consider scheduling them for the weekend rush." },
]

const faqs = [
  { q: "Can MartPoint manage combo meals?", a: "Yes. Set up combo buttons with fixed or variable pricing. Modifiers, upsells and substitutions are tracked automatically without manual calculations." },
  { q: "Can I track takeaway and delivery separately?", a: "Absolutely. Every order is tagged by channel — counter, drive-through, phone or delivery — with separate reporting and performance tracking." },
  { q: "Can kitchen orders be sent automatically?", a: "Yes. Orders route directly to your kitchen printer or display screen with prep instructions, modifiers and channel details. No shouting required." },
  { q: "Can I monitor rush-hour performance?", a: "Yes. Live dashboards show orders per hour, prep times, revenue and ingredient levels so you can react before problems develop." },
  { q: "Can inventory reduce automatically after meals are sold?", a: "Yes. Recipe-based inventory deducts exact ingredients with every combo sold. You always know what is left in real time." },
  { q: "Can I compare cashier performance?", a: "Yes. Every staff member gets their own login. Sales, refunds and voids are tracked per user for accountability and scheduling insights." },
  { q: "Can I manage multiple fast food branches?", a: "Yes. Compare sales, stock and staff performance across every location from one central dashboard with unified reporting." },
]

export default function FastFoodPage() {
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
                Every Second Counts During Rush Hour
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Faster orders. Happier customers. Higher daily sales. MartPoint Retail is built for the speed, volume and pressure of African quick-service restaurants.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20fast%20food%20outlet%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
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
                The Challenges Holding Your Fast Food Business Back
              </h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
                These daily operational leaks cost African quick-service restaurants profit, speed and customer loyalty. MartPoint was built to close every one of them.
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
              headline="How MartPoint Fits Into Your Fast Food Workflow"
              description="From order placement to live performance monitoring, every step is optimised for speed, accuracy and volume."
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
              headline="Your Store Live"
              description="The numbers that drive QSR decisions, updated in real time while your kitchen is still running."
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
              headline="Why Fast Food Operators Switch To MartPoint"
              description="See the difference between how you operate now and how MartPoint transforms your QSR."
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
                &ldquo;We used to lose track of drive-through orders every weekend. With MartPoint, every sale is logged instantly and our kitchen gets clear tickets. Our lunch rush is now smooth and our revenue is up 20%.&rdquo;
              </blockquote>
              <div className="mt-8 flex items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-retail/10 flex items-center justify-center text-retail font-bold text-base">KA</div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">Kunle A.</div>
                  <div className="text-xs text-muted-foreground">Operations Manager, Dra Chickens</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader label="FAQ" headline="Questions Fast Food Operators Ask" />
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
                Serve More Customers. Reduce Waiting Time. Increase Profit.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Join quick-service restaurants across Africa using MartPoint to handle rush hour with confidence, speed and complete operational visibility.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20fast%20food%20outlet%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
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
