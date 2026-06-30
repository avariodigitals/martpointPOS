export const revalidate = 86400
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
  Users,
  Building2,
  Check,
  X,
  ChevronDown,
  TrendingUp,
  Lightbulb,
} from "lucide-react"
import { FAQPageSchema, HowToSchema } from "@/components/structured-data"

export const metadata: Metadata = {
  title: "Salon & Beauty Business Software — MartPoint Retail",
  description:
    "Manage appointments, product sales and inventory for your salon or beauty business. MartPoint Retail is built for African beauty entrepreneurs.",
}

const painPoints = [
  { icon: CalendarDays, title: "Missed Appointments", desc: "No-shows and double-bookings waste time and cost you money every single day." },
  { icon: Receipt, title: "No Client History", desc: "You cannot remember what treatment a client had last time or what products were used." },
  { icon: AlertTriangle, title: "Commission Disputes", desc: "Tracking who did what service and earned what commission is a monthly headache." },
  { icon: Package, title: "Retail Stock Shortages", desc: "Beauty products expire on shelves because you do not know what is selling and what is not." },
  { icon: BarChart3, title: "Invisible Revenue", desc: "Services and retail sales mix together. You have no idea which makes you more money." },
  { icon: Building2, title: "Multiple Locations, No Sync", desc: "Each salon branch keeps its own records. You cannot see the full picture of your brand." },
]

const workflow = [
  { step: "Customer books an appointment", desc: "Clients book online, by phone or walk-in. Availability is checked instantly against stylist schedules." },
  { step: "Reception confirms and assigns stylist", desc: "The appointment is assigned to the right stylist with service details and estimated duration." },
  { step: "Treatment stock is reserved", desc: "Hair colour, creams and treatment products are automatically reserved from inventory for that appointment." },
  { step: "Client arrives and checks in", desc: "The stylist sees the full service history, allergies and product preferences before starting." },
  { step: "Service is completed", desc: "The stylist marks the service done. Product usage is recorded and stock updates automatically." },
  { step: "Retail products are added", desc: "Any retail products the client purchases are scanned and added to the same bill in seconds." },
  { step: "Payment is processed", desc: "Cash, card or transfer accepted. Split payments between service and retail handled smoothly." },
  { step: "Commission is calculated automatically", desc: "The stylist's commission is calculated from services and retail sales. No spreadsheets needed." },
  { step: "Receipt is sent, next appointment booked", desc: "The client receives a digital receipt and books their next visit before leaving the chair." },
]

const dashboardMetrics = [
  { label: "Today's Appointments", value: "24" },
  { label: "Stylists Working", value: "6" },
  { label: "Products Running Low", value: "5" },
  { label: "Retail Sales Today", value: "₦48K" },
  { label: "Top Performing Staff", value: "Grace" },
  { label: "Repeat Clients", value: "16" },
  { label: "Outstanding Balances", value: "₦12K" },
  { label: "Monthly Revenue", value: "₦1.2M" },
]

const beforeAfter = {
  before: [
    "Paper appointment book with crossed-out entries",
    "Manual commission calculations every month",
    "No record of what treatment a client received",
    "Inventory guesswork and expired products",
    "Forgotten follow-ups and lost regulars",
  ],
  after: [
    "Digital appointments with automatic reminders",
    "Commission calculated instantly per stylist",
    "Complete client profiles with full history",
    "Live inventory with expiry alerts",
    "Automated follow-up reminders and loyalty tracking",
  ],
}

const intelligence = [
  { icon: CalendarDays, title: "Unconfirmed Appointments", desc: "See which upcoming bookings are still unconfirmed so you can follow up and fill empty chairs." },
  { icon: Package, title: "Stock Running Low", desc: "Hair colour, shampoo and treatment products that need reordering before next week." },
  { icon: TrendingUp, title: "Top Performer Today", desc: "Which stylist generated the highest revenue today and which services they delivered." },
  { icon: BarChart3, title: "Fastest-Growing Service", desc: "Track which treatments are trending up so you can promote and price them confidently." },
  { icon: Users, title: "Clients Not Returning", desc: "Identify clients who have not visited in 60 days and send them a win-back offer." },
  { icon: Lightbulb, title: "Suggested Actions", desc: "Get prompts to restock, reward top staff, run promotions or follow up outstanding payments." },
]

const faqs = [
  { q: "Can I manage appointments and avoid double bookings?", a: "Yes. MartPoint shows real-time availability for every stylist. Online booking, walk-ins and phone appointments all sync instantly." },
  { q: "Does MartPoint calculate staff commissions automatically?", a: "Absolutely. Set commission rates per service or retail sale and MartPoint calculates earnings per stylist automatically." },
  { q: "Can I sell retail products and services together?", a: "Yes. Services and retail sales are tracked separately but billed together. You know exactly where your profit comes from." },
  { q: "Can I track client treatment history and preferences?", a: "Yes. Every client gets a full profile with treatment history, product allergies, preferences and purchase records." },
  { q: "Does it work for multiple salon branches?", a: "Yes. Manage appointments, stock and staff across every branch from one central dashboard with consolidated reporting." },
  { q: "Can I monitor beauty product inventory?", a: "Yes. Track retail and treatment stock with automatic reorder alerts and expiry warnings for sensitive products." },
  { q: "Can customers receive appointment reminders?", a: "Yes. Automatic SMS and WhatsApp reminders reduce no-shows and keep your schedule full." },
]

export default function BeautyAndSalonsPage() {
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
                Run Your Salon Like the Business It Is
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Spend less time managing appointments, commissions and inventory — and more time growing your beauty business. MartPoint Retail tracks everything so you can focus on your clients.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20salon%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
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
                The Challenges Holding Your Salon Back
              </h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
                These daily frustrations cost African salons clients, staff and profit. MartPoint was built to eliminate every one of them.
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
              headline="How MartPoint Fits Into Your Daily Salon Workflow"
              description="From booking to checkout, every step is connected, tracked and automated."
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
              headline="Your Salon At A Glance"
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
              headline="Why Salon Owners Switch To MartPoint"
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
                &ldquo;We used to write appointments in a book and lose track of product stock separately. Now everything is in one place. My stylists know their commissions automatically and I finally know which services make us the most money.&rdquo;
              </blockquote>
              <div className="mt-8 flex items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-retail/10 flex items-center justify-center text-retail font-bold text-base">TA</div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">Tunde A.</div>
                  <div className="text-xs text-muted-foreground">Founder, Clean Bubbles Beauty</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader label="FAQ" headline="Questions Salons Ask" />
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
                Grow Your Salon With Confidence
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Join salons across Africa using MartPoint to simplify appointments, automate commissions and deliver a better client experience every single day.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20salon%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
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
      <FAQPageSchema faqs={faqs.map((f) => ({ question: f.q, answer: f.a }))} />
      <HowToSchema name="How MartPoint Works for Salons & Beauty Businesses" description="Step-by-step workflow using MartPoint Retail." steps={workflow.map((w) => ({ name: w.step, text: w.desc }))} />
      </main>
      <Footer />
    </>
  )
}
