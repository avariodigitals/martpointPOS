import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ArrowRight,
  AlertTriangle,
  Pill,
  ClipboardList,
  BarChart3,
  Receipt,
  Building2,
  ShieldCheck,
  Check,
  X,
  ChevronDown,
  TrendingUp,
  Sparkles,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Pharmacy Inventory & POS Software — MartPoint Retail",
  description:
    "Never run out of essential medicines. Track batches, monitor expiry dates and manage prescription sales with MartPoint Retail built for African pharmacies.",
}

const painPoints = [
  { icon: Pill, title: "Medicine Stockouts", desc: "Patients leave when essential medicines are unavailable. You lose trust, reputation and revenue every single time." },
  { icon: AlertTriangle, title: "Expired Drugs", desc: "Expired stock risks patient safety, regulatory fines and reputational damage you cannot afford." },
  { icon: ClipboardList, title: "Batch Tracking Difficulties", desc: "Without audit trails, compliance becomes impossible and product recalls become a nightmare to manage." },
  { icon: BarChart3, title: "Inventory Discrepancies", desc: "Counting hundreds of SKUs by hand wastes evenings and produces numbers that are wrong before Monday morning." },
  { icon: Receipt, title: "Unrecorded Sales", desc: "Cash and transfer sales slip through the cracks. You never know your real revenue or what was actually dispensed." },
  { icon: Building2, title: "Branch Stock Differences", desc: "Running two pharmacy locations feels like running two separate businesses with no visibility between them." },
]

const workflow = [
  { step: "Medicines received from supplier", desc: "Every delivery is logged with supplier details, invoice numbers and receiving timestamps for full traceability." },
  { step: "Batch numbers recorded", desc: "Each medicine is tracked by batch number from the moment it enters your store. Full audit trail from day one." },
  { step: "Expiry dates captured", desc: "Expiry dates are recorded for every batch. FIFO alerts ensure older stock is sold before newer stock." },
  { step: "Products added to inventory", desc: "Stock is categorised by drug type, dosage and brand. Searchable instantly at the counter or in the back office." },
  { step: "Prescription is fulfilled", desc: "The pharmacist dispenses the correct medicine, dosage and quantity. Prescription details are linked to the sale automatically." },
  { step: "Inventory updates automatically", desc: "Every sale deducts stock in real time. Batch and expiry data stay accurate without manual updates." },
  { step: "Low stock alerts are generated", desc: "Critical medicines approaching reorder levels trigger automatic alerts before you run out completely." },
  { step: "Reorder recommendations created", desc: "Purchase suggestions based on actual sales velocity, not guesswork. Order the right quantities every time." },
  { step: "End-of-day reconciliation completes", desc: "Sales, stock and cash are reconciled automatically. Discrepancies are flagged for review before closing." },
]

const dashboardMetrics = [
  { label: "Today's Sales", value: "₦890K" },
  { label: "Medicines Running Low", value: "17" },
  { label: "Products Expiring Soon", value: "9" },
  { label: "Outstanding Supplier Orders", value: "4" },
  { label: "Top Selling Medicine", value: "Paracetamol" },
  { label: "Prescription Transactions", value: "156" },
  { label: "Branch Comparison", value: "Branch 1" },
  { label: "Gross Profit Today", value: "₦245K" },
]

const beforeAfter = {
  before: [
    "Manual stock books updated by hand every evening",
    "Unexpected stockouts discovered when patients ask",
    "Expired medicines found during quarterly checks",
    "Slow reconciliation that takes hours every night",
    "Paper prescription records that are impossible to search",
    "Guesswork when deciding what to reorder",
  ],
  after: [
    "Live inventory updated with every sale automatically",
    "Stock alerts before medicines run out completely",
    "Expiry monitoring with FIFO and early warnings",
    "Real-time reports available on any device instantly",
    "Digital prescription history searchable in seconds",
    "Smarter purchasing decisions backed by sales data",
  ],
}

const intelligence = [
  { icon: Pill, title: "Stock Running Out Soon", desc: "Paracetamol stock will run out within three days. Recommend placing an order before the weekend rush." },
  { icon: AlertTriangle, title: "Expiring Medicines", desc: "Five medicines expire next month. Promote or return them before they become a total loss." },
  { icon: Building2, title: "Branch Stock Imbalance", desc: "Branch 2 has excess insulin stock while Branch 1 is running low. Transfer recommended." },
  { icon: BarChart3, title: "Profit Leader Today", desc: "Pain relief products generated the highest profit today. Consider increasing shelf visibility." },
  { icon: TrendingUp, title: "Reorder Recommendation", desc: "Recommend reordering antibiotics before the weekend based on current sales velocity." },
  { icon: Sparkles, title: "Suggested Actions", desc: "Two products have not sold in 90 days. Review for return. Increase antimalarial stock for rainy season." },
]

const faqs = [
  { q: "Can MartPoint track medicine batch numbers?", a: "Yes. Every product is logged with batch number, manufacturing date and supplier details. Full traceability from receipt to sale." },
  { q: "Can it monitor expiry dates?", a: "Absolutely. Expiry dates are captured at receipt and monitored continuously. FIFO alerts and expiry warnings protect patients and reduce waste." },
  { q: "Can I manage multiple pharmacy branches?", a: "Yes. See live stock, sales and staff performance across every pharmacy location from one central dashboard." },
  { q: "Can I record prescription sales?", a: "Yes. Link every sale to prescription details including patient, drug, dosage and pharmacist. Searchable history for audits and recalls." },
  { q: "Does inventory update automatically after every sale?", a: "Yes. Every dispensed item deducts stock in real time. Batch and expiry data stay accurate without manual counting." },
  { q: "Can I monitor supplier purchases?", a: "Yes. Track purchase orders, supplier deliveries and pricing history. Compare suppliers and manage credit terms in one place." },
  { q: "Can I generate pharmacy reports?", a: "Yes. Daily sales, profit by drug category, stock levels, expiry summaries and branch comparisons are all generated automatically." },
]

export default function PharmaciesPage() {
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
                Never Run Out of the Medicines Your Patients Need
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Protect patient trust with real-time inventory, expiry tracking and smarter pharmacy operations. MartPoint Retail gives you the control to focus on care while the system handles the complexity.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20pharmacy%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
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
                The Challenges Holding Your Pharmacy Back
              </h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
                These operational risks cost African pharmacies patient trust, regulatory compliance and profit. MartPoint was built to eliminate every one of them.
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
              headline="How MartPoint Fits Into Your Pharmacy's Daily Workflow"
              description="From supplier delivery to end-of-day reconciliation, every step is tracked, compliant and automated."
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
              headline="Your Pharmacy At A Glance"
              description="The numbers that protect patient care and pharmacy profit, updated in real time every day."
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
              headline="Why Pharmacy Owners Switch To MartPoint"
              description="See the difference between how you operate now and how MartPoint transforms your pharmacy."
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
                &ldquo;Expiry tracking alone has saved us thousands. We used to throw away expired stock every quarter. Now we get alerts two months ahead and sell older batches first. Our patients are safer and our margins are better.&rdquo;
              </blockquote>
              <div className="mt-8 flex items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-retail/10 flex items-center justify-center text-retail font-bold text-base">EN</div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">Dr. Emeka N.</div>
                  <div className="text-xs text-muted-foreground">Manager, GreenLife Pharmacy</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader label="FAQ" headline="Questions Pharmacies Ask" />
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
                Run Your Pharmacy With Complete Control
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Join pharmacies across Africa using MartPoint to reduce losses, improve patient satisfaction and maintain complete inventory visibility every single day.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20pharmacy%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
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
