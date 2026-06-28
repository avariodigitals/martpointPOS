import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ArrowRight,
  BookOpen,
  EyeOff,
  Puzzle,
  Gauge,
  PackageOpen,
  HandCoins,
  TrendingUp,
  WifiOff,
  GitBranch,
  Smartphone,
  Sparkles,
  ShieldCheck,
  Cloud,
  Lock,
  ClipboardCheck,
  History,
  HeadphonesIcon,
  Store,
  Pill,
  UtensilsCrossed,
  Shirt,
  Scissors,
  ChevronDown,
  Check,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Why MartPoint — The Operating System for African Retail",
  description:
    "Discover why supermarkets, pharmacies, restaurants and retail chains across Africa choose MartPoint. Built for African business realities — not adapted from abroad.",
  openGraph: {
    title: "Why MartPoint — The Operating System for African Retail",
    description:
      "Software built around how African businesses actually operate. From offline-first sales to transfer payment tracking and multi-branch management.",
  },
}

const problems = [
  { icon: BookOpen, title: "Everything Is Manual", desc: "Notebooks, spreadsheets and memory. Stock counts take hours. Mistakes cost money." },
  { icon: EyeOff, title: "No Real Visibility", desc: "You cannot see what sells, what sits or what is missing until it is too late." },
  { icon: Puzzle, title: "Too Many Disconnected Tools", desc: "One app for sales, another for stock, WhatsApp for orders and Excel for reports. Nothing talks to anything." },
  { icon: Gauge, title: "Slow, Reactive Decisions", desc: "By the time you notice a problem, the damage is done. You are always catching up." },
  { icon: PackageOpen, title: "Stock Disappears", desc: "Theft, expiry and poor ordering drain margins. Most businesses only find out at the end of the month." },
  { icon: HandCoins, title: "Credit Sales Go Untracked", desc: "Money owed by customers is written on paper. Some never gets collected. Cash flow suffers." },
]

const differentiators = [
  { icon: Store, title: "Built for African Retail", desc: "Transfer payments, WhatsApp orders, offline sales and local tax rules are first-class features — not afterthoughts." },
  { icon: Puzzle, title: "One Connected Platform", desc: "Sales, stock, staff, payments and customers live in one system. One login. One source of truth." },
  { icon: GitBranch, title: "Retail + Enterprise Growth", desc: "Start with MartPoint Retail. Grow into MartPoint Enterprise for accounting, HR and procurement. Same data. Same team." },
  { icon: HandCoins, title: "PayPlan Built In", desc: "Offer customers installment plans, track deposits and collect balances without a separate system." },
  { icon: Sparkles, title: "MartPoint Intelligence", desc: "AI-powered alerts tell you what is low, what is slow and what to reorder before you run out." },
  { icon: WifiOff, title: "Offline-Ready Architecture", desc: "Sales never stop. Work offline and sync automatically when connection returns. No downtime." },
  { icon: Smartphone, title: "Multi-Branch Visibility", desc: "See every branch from one dashboard. Transfer stock, compare performance and manage staff centrally." },
  { icon: TrendingUp, title: "Continuous Innovation", desc: "We ship every month based on real customer feedback. The platform you buy today keeps getting better." },
]

const industries = [
  { icon: Store, name: "Supermarkets", desc: "Fast checkout, real-time stock and expiry tracking for high-volume retail." },
  { icon: Pill, name: "Pharmacies", desc: "Batch tracking, prescription records and controlled inventory for regulated healthcare." },
  { icon: UtensilsCrossed, name: "Restaurants", desc: "Table management, kitchen routing and ingredient-level stock control." },
  { icon: Shirt, name: "Fashion", desc: "Size and colour variants, seasonal trends and dead-stock alerts." },
  { icon: Smartphone, name: "Electronics", desc: "Serial numbers, warranty tracking and high-value inventory protection." },
  { icon: Scissors, name: "Beauty & Salons", desc: "Appointment scheduling, product sales and staff commission tracking." },
  { icon: GitBranch, name: "Multi-Branch Retail", desc: "Centralised control, inter-branch transfers and unified reporting for chains." },
]

const trustPoints = [
  { icon: ShieldCheck, title: "Encrypted & Protected", desc: "AES-256 encryption at rest and in transit. Your business data is always secure." },
  { icon: Cloud, title: "Automatic Cloud Backups", desc: "Daily backups protect every transaction. Restore instantly if anything goes wrong." },
  { icon: Lock, title: "Role-Based Permissions", desc: "Control who can see what. Cashiers, managers and owners each get the right access." },
  { icon: ClipboardCheck, title: "Full Audit Logs", desc: "Every change is recorded. Know who did what, when and why." },
  { icon: History, title: "Continuous Updates", desc: "Security patches and feature releases ship regularly. You are always on the latest version." },
  { icon: HeadphonesIcon, title: "Reliable Local Support", desc: "WhatsApp and phone support from a team that understands African retail. Response within hours." },
]

const faqs = [
  { q: "Why is MartPoint different from other POS software?", a: "Most POS systems were built for markets with reliable internet, card-only payments and dedicated IT teams. MartPoint was built from the ground up for African business realities: transfer payments, intermittent connectivity, offline sales, multi-branch operations and local compliance." },
  { q: "Can I use MartPoint for multiple branches?", a: "Yes. MartPoint Retail supports unlimited branches from one central dashboard. You can transfer stock, compare sales and manage staff across every location." },
  { q: "Can I migrate my existing data?", a: "Yes. Our team helps migrate your products, stock levels and customer records from spreadsheets or other systems. Most migrations are completed within a few days." },
  { q: "Does MartPoint work for my industry?", a: "MartPoint serves supermarkets, pharmacies, restaurants, fashion stores, electronics stores, beauty businesses and multi-branch retailers. Each industry gets tailored features for its specific challenges." },
  { q: "Can I grow into Enterprise later?", a: "Absolutely. Many customers start with MartPoint Retail and upgrade to MartPoint Enterprise when they need accounting, procurement, HR and advanced approvals. Your data transfers seamlessly." },
  { q: "Does it work without internet?", a: "Yes. MartPoint's offline-first architecture lets you process sales, manage stock and print receipts without an internet connection. Everything syncs automatically when you are back online." },
  { q: "What happens to my data if I stop using MartPoint?", a: "You own your data. We provide full exports in standard formats at any time. Your information is never held hostage." },
  { q: "How long does setup take?", a: "Most single-store businesses are up and running within a day. Multi-branch setups typically take 2-3 days including training. Our team guides you through every step." },
  { q: "Is there a free trial?", a: "We offer personalised demos where our team walks you through the features relevant to your business. Book a demo and we will show you exactly how MartPoint fits your operations." },
  { q: "What support do I get after signing up?", a: "Every customer gets access to our local support team via WhatsApp and phone. Enterprise clients receive a dedicated account manager and on-site training where available." },
]

export default function WhyMartPointPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* 1. Hero */}
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24 lg:py-32">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-4">
                Why MartPoint
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.05] text-foreground">
                Software That Works the Way African Business Works
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Most business tools were built for different markets. MartPoint was designed around the daily realities of African retail — from transfer payments and WhatsApp orders to intermittent internet and multi-branch growth.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20want%20to%20understand%20why%20MartPoint%20is%20different.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
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

        {/* 2. The Problem */}
        <section className="w-full bg-[#023047] py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                Running a Business Should Not Feel This Hard
              </h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
                African retailers face challenges that foreign software ignores. These are the daily struggles we set out to solve.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {problems.map((item) => (
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

        {/* 3. Why We Built MartPoint */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-4xl">
            <SectionHeader
              label="Our Origin"
              headline="Why We Built MartPoint"
              description="It was not because Africa needed another POS. It was because African businesses deserved software designed around how they actually operate."
            />
            <div className="mt-14 space-y-6 text-muted-foreground leading-relaxed">
              <p>
                We spent months inside supermarkets, pharmacies and restaurants across Nigeria. We watched shop owners write sales in notebooks because the POS app crashed when the Wi-Fi dropped. We saw pharmacists throw away expired stock they never knew was close to expiry. We heard restaurant managers describe the daily chaos of reconciling cash, transfers and credit sales across three different apps.
              </p>
              <p>
                The software available to these businesses was either too expensive, too fragile or built for markets with reliable infrastructure and card-only payments. None of it understood transfer payments. None of it handled offline sales gracefully. None of it scaled from one store to twenty without forcing a complete system change.
              </p>
              <p>
                So we built MartPoint differently. Cash sales, transfer payments and credit tracking are core features — not plugins. Offline mode means you never stop selling. WhatsApp orders flow directly into your system. Multi-branch management happens from one login. And when you are ready for accounting, procurement and HR, <Link href="/martpoint-erp" className="text-retail font-medium hover:underline">MartPoint Enterprise</Link> picks up exactly where Retail leaves off.
              </p>
              <p>
                Every line of code was written with African business realities in mind. That is why MartPoint feels different from the moment you start using it.
              </p>
            </div>
          </div>
        </section>

        {/* 4. What Makes MartPoint Different */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="Differentiators"
              headline="What Makes MartPoint Different"
              description="Eight reasons MartPoint has become the operating system for growing African businesses."
            />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {differentiators.map((item) => (
                <div key={item.title} className="rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mb-4">
                    <item.icon className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. From First Sale To Enterprise */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-4xl">
            <SectionHeader
              label="Growth Path"
              headline="From First Sale To Enterprise"
              description="Start simple. Grow powerful. Never re-platform."
            />
            <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-xl border border-border bg-background p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-retail text-white font-bold text-base flex items-center justify-center mx-auto mb-4">1</div>
                <h3 className="text-lg font-semibold text-foreground mb-2">MartPoint Retail</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  POS, inventory, staff tracking, payments and reports for single and multi-branch retail. Everything you need to run your store professionally from day one.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-background p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-retail text-white font-bold text-base flex items-center justify-center mx-auto mb-4">2</div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Add Intelligence</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  As you grow, MartPoint Intelligence surfaces insights: what to reorder, what is slow, which customers are most valuable. Decisions become proactive instead of reactive.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-background p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-retail text-white font-bold text-base flex items-center justify-center mx-auto mb-4">3</div>
                <h3 className="text-lg font-semibold text-foreground mb-2">MartPoint Enterprise</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  When you need accounting, procurement, HR and advanced approvals, <Link href="/martpoint-erp" className="text-retail font-medium hover:underline">Enterprise</Link> extends your existing data. No migration. No disruption.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 6. Built Around Real Businesses */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="Industries"
              headline="Built Around Real Businesses"
              description="MartPoint is not generic software with industry labels. Each sector gets features designed for its specific challenges."
            />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {industries.slice(0, 4).map((ind) => (
                <Link key={ind.name} href={`/industries/${ind.name.toLowerCase().replace(/ & /g, '-and-').replace(/ /g, '-')}`} className="group rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mb-4">
                    <ind.icon className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-retail transition-colors">{ind.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{ind.desc}</p>
                </Link>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
              {industries.slice(4).map((ind) => (
                <Link key={ind.name} href={`/industries/${ind.name.toLowerCase().replace(/ & /g, '-and-').replace(/ /g, '-')}`} className="group rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mb-4">
                    <ind.icon className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2 group-hover:text-retail transition-colors">{ind.name}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{ind.desc}</p>
                </Link>
              ))}
            </div>
            <div className="mt-8 text-center">
              <Button asChild variant="outline" size="lg">
                <Link href="/industries">View All Industries</Link>
              </Button>
            </div>
          </div>
        </section>

        {/* 7. MartPoint Intelligence */}
        <section className="w-full bg-retail-soft border-y border-retail-muted py-16 md:py-24">
          <div className="container-martpoint max-w-4xl">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">Smart Business</span>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                  MartPoint Intelligence
                </h2>
                <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                  Most software generates reports. MartPoint recommends actions. Our AI reads your sales, stock and customer patterns and tells you what needs attention before it becomes a problem.
                </p>
                <div className="mt-8 space-y-4">
                  {[
                    "Products running low before they stock out",
                    "Customers with overdue payments",
                    "Dead stock that is tying up capital",
                    "Sales trends you should capitalise on",
                    "Staff performance shifts across branches",
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-retail mt-0.5 shrink-0" />
                      <span className="text-foreground">{item}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-background p-8">
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-retail" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-retail">Example Alert</span>
                </div>
                <div className="rounded-xl bg-muted p-5 border border-border">
                  <p className="text-sm text-foreground leading-relaxed">
                    &ldquo;Paracetamol 500mg has dropped below reorder threshold at Lagos Branch. Sales are up 34% this week. Recommend placing order by Thursday to avoid stockout.&rdquo;
                  </p>
                  <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-retail" />
                    Generated automatically from your data
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 8. Built For Trust */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="Trust"
              headline="Built For Trust"
              description="Your business data is your most valuable asset. We protect it like our own."
            />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {trustPoints.map((item) => (
                <div key={item.title} className="rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mb-4">
                    <item.icon className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 9. FAQ */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader
              label="FAQ"
              headline="Questions Business Owners Ask"
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

        {/* 10. Final CTA */}
        <section className="w-full bg-[#023047] py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                Stop Managing Chaos. Start Running Your Business.
              </h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed">
                You have spent long enough juggling notebooks, spreadsheets and disconnected apps. MartPoint brings your sales, stock, staff and customers into one system built for how African businesses actually work.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20want%20to%20understand%20why%20MartPoint%20is%20different.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
                    Book a Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="border-white/20 text-white hover:bg-white/10">
                  <Link href="/pricing">View Pricing</Link>
                </Button>
              </div>
              <p className="mt-6 text-sm text-white/50">
                Or read how <Link href="/customer-stories" className="text-white/70 hover:text-white underline">other businesses are growing with MartPoint</Link>.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
