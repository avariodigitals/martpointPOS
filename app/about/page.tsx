import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { OrganizationSchema } from "@/components/structured-data"
import { PreFooterCTA } from "@/components/sections/pre-footer-cta"
import { Building2, Users, Globe, Lightbulb, Award, MapPin, Layers, ShieldCheck, TrendingUp, RefreshCw } from "lucide-react"

export const metadata: Metadata = {
  title: "About Us — MartPoint by Avario Digitals",
  description:
    "Learn about Avario Digitals, the African technology company behind MartPoint Retail and MartPoint ERP. Built for African businesses, by Africans.",
  openGraph: {
    title: "About Us — MartPoint by Avario Digitals",
    description:
      "Learn about Avario Digitals, the African technology company behind MartPoint Retail and MartPoint ERP.",
  },
}

const values = [
  {
    icon: Globe,
    title: "Built For Real Conditions",
    description:
      "We design software that works when the internet drops, when power fluctuates and when customers pay by transfer. African business is not broken — the tools built for other markets are.",
  },
  {
    icon: Users,
    title: "Design With Shopkeepers",
    description:
      "Every feature starts with a conversation. We sit with retailers, pharmacists and restaurant owners to understand what actually slows them down. Then we build.",
  },
  {
    icon: TrendingUp,
    title: "Grow Without Limits",
    description:
      "From a single checkout counter to twenty branches across the country, MartPoint scales with your ambition. No re-platforming. No enterprise IT team required.",
  },
  {
    icon: Lightbulb,
    title: "Stay Ahead, Stay Simple",
    description:
      "Technology should reduce complexity, not add to it. We bring advanced capabilities — AI insights, offline sync, real-time reports — and make them feel effortless.",
  },
]

const milestones = [
  {
    year: "2019",
    title: "Started With a Clear Mission",
    description:
      "Avario Digitals was founded to build technology that actually works for African businesses — not imported tools that break under local conditions.",
  },
  {
    year: "2020",
    title: "First Retailers Ditched the Notebook",
    description:
      "MartPoint Retail launched with POS and real-time inventory. Shop owners could finally see what was selling while they were still selling it.",
  },
  {
    year: "2021",
    title: "One Dashboard for Every Branch",
    description:
      "Multi-branch support meant business owners could track stock, sales and staff across every location without phone calls and spreadsheets.",
  },
  {
    year: "2022",
    title: "Enterprises Got the Same Clarity",
    description:
      "MartPoint ERP brought accounting, procurement and HR to manufacturers and distributors — replacing fragmented systems with one connected platform.",
  },
  {
    year: "2024",
    title: "Pharmacies Stopped Losing Money to Expired Stock",
    description:
      "Expiry and manufacturing date tracking gave regulated businesses precise control. Automated end-of-day backups protected every day's data.",
  },
  {
    year: "2025",
    title: "Restaurants Served More Without Hiring More",
    description:
      "Multiple barcodes simplified bulk and unit pricing. QR menu codes let customers order directly from their tables, cutting wait times.",
  },
  {
    year: "2026",
    title: "Every Business Got a Digital Storefront",
    description:
      "The full retail suite launched: online stores, WhatsApp ordering, offline-first sales, PayPlan instalments, staff attendance, customer verification and loyalty rewards.",
  },
]

export default function AboutPage() {
  return (
    <>
      <OrganizationSchema />
      <Header />
      <main>
        {/* Hero */}
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
                About Us
              </span>
              <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-foreground">
                Software That Understands African Business
              </h1>
              <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
                Most business tools were built for markets with reliable internet, card-only payments and dedicated IT teams. African retailers operate differently. MartPoint exists because your business deserves software designed around your daily realities — not the other way around.
              </p>
            </div>
          </div>
        </section>

        {/* Our Story */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground mb-6">
                  The Story Behind MartPoint
                </h2>
                <div className="space-y-4 text-muted-foreground leading-relaxed">
                  <p>
                    Running a business in Africa means dealing with realities that foreign software ignores. Internet drops mid-transaction. Customers pay by bank transfer. Stock runs out before you notice. Staff come and go. And every evening, someone sits down to count cash and reconcile a notebook.
                  </p>
                  <p>
                    Avario Digitals was founded because we watched shop owners, pharmacy managers and restaurant operators struggle with tools that were never built for them. Expensive enterprise suites. Fragile apps that crash offline. Spreadsheet workflows that steal hours every day.
                  </p>
                  <p>
                    So we built MartPoint differently. We started by sitting with real businesses — understanding their workflows, their frustrations and their ambitions. Every feature was shaped by those conversations. Offline-first sales. Transfer payment recording. Automatic stock alerts. Staff tracking that actually works.
                  </p>
                  <p>
                    Today, MartPoint powers businesses from single stores to multi-branch chains. But our mission has not changed: build software that works the way African businesses work. Every update still starts with a customer conversation. Every line of code is written with your reality in mind.
                  </p>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-background p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-retail-soft flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-retail" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground">Quick Facts</h3>
                    <p className="text-sm text-muted-foreground">What you should know about MartPoint</p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-retail shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Founded</p>
                      <p className="text-sm text-muted-foreground">2019</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-retail shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Built In</p>
                      <p className="text-sm text-muted-foreground">Lagos, Nigeria</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-retail shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Primary Markets</p>
                      <p className="text-sm text-muted-foreground">Nigeria & Expanding Across Africa</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-retail shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Industries Served</p>
                      <p className="text-sm text-muted-foreground">Retail, Supermarkets, Pharmacies, Restaurants, Fashion, Manufacturing</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-retail shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Platform</p>
                      <p className="text-sm text-muted-foreground">Cloud, Offline & Hybrid</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Award className="w-5 h-5 text-retail shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-foreground">Availability</p>
                      <p className="text-sm text-muted-foreground">24/7 with Local Support</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                What Drives Us
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                These are the principles that shape every product decision we make. They are not slogans. They are the standards we hold ourselves to.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {values.map((v) => (
                <div
                  key={v.title}
                  className="rounded-xl border border-border bg-background p-6 text-center transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                >
                  <div className="w-12 h-12 rounded-xl bg-retail-soft flex items-center justify-center mx-auto mb-4">
                    <v.icon className="w-6 h-6 text-retail" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-2">{v.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{v.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Milestones */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                Our Journey
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Every milestone marks a problem we solved for real businesses. This is how MartPoint evolved from an idea into the operating system for African retail.
              </p>
            </div>
            <div className="max-w-3xl mx-auto space-y-8">
              {milestones.map((m, i) => (
                <div key={m.year} className="flex gap-6">
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-retail text-white flex items-center justify-center text-sm font-bold shrink-0">
                      {i + 1}
                    </div>
                    {i < milestones.length - 1 && (
                      <div className="w-px h-full bg-border mt-2" />
                    )}
                  </div>
                  <div className="pb-8">
                    <span className="text-sm font-semibold text-retail">{m.year}</span>
                    <h3 className="text-lg font-bold text-foreground mt-1">{m.title}</h3>
                    <p className="text-muted-foreground leading-relaxed mt-1">{m.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Trust */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">
                Why Businesses Choose MartPoint
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Four reasons MartPoint has become the operating system for growing African businesses.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="rounded-xl border border-border bg-card p-6 text-center transition-all duration-200 hover:border-retail/30 hover:shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-retail-soft flex items-center justify-center mx-auto mb-4">
                  <MapPin className="w-6 h-6 text-retail" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">Built for African Business</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">From transfer payments to intermittent connectivity, every feature is designed around how African businesses actually operate.</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-6 text-center transition-all duration-200 hover:border-retail/30 hover:shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-retail-soft flex items-center justify-center mx-auto mb-4">
                  <Layers className="w-6 h-6 text-retail" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">One Connected Platform</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Sales, inventory, staff, payments and customer data live in one place. No more switching between apps and spreadsheets.</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-6 text-center transition-all duration-200 hover:border-retail/30 hover:shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-retail-soft flex items-center justify-center mx-auto mb-4">
                  <ShieldCheck className="w-6 h-6 text-retail" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">Reliable & Secure</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">Your data is encrypted and backed up automatically. Offline mode means you never stop selling, even when the network drops.</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-6 text-center transition-all duration-200 hover:border-retail/30 hover:shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-retail-soft flex items-center justify-center mx-auto mb-4">
                  <RefreshCw className="w-6 h-6 text-retail" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-2">Continuously Improving</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">We ship updates every month based on real customer feedback. The platform you buy today keeps getting better tomorrow.</p>
              </div>
            </div>
          </div>
        </section>

        <PreFooterCTA />
      </main>
      <Footer />
    </>
  )
}
