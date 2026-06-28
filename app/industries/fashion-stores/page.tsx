import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ArrowRight,
  AlertTriangle,
  BarChart3,
  Package,
  Tag,
  Building2,
  Shirt,
  Check,
  X,
  ChevronDown,
  TrendingUp,
  Users,
  Lightbulb,
} from "lucide-react"
import { FAQPageSchema, HowToSchema } from "@/components/structured-data"

export const metadata: Metadata = {
  title: "Fashion Retail POS & Inventory — MartPoint Retail",
  description:
    "Manage sizes, colours, seasons and styles with real-time sales visibility. MartPoint Retail is built for African fashion boutiques and retailers.",
}

const painPoints = [
  { icon: AlertTriangle, title: "Unsold Seasonal Collections", desc: "You overbuy every season and end up with racks of dead inventory nobody wants at full price." },
  { icon: Shirt, title: "Wrong Sizes Selling Out", desc: "Popular sizes run out while less popular ones sit untouched. You never know the right mix to stock." },
  { icon: Package, title: "Too Much Dead Inventory", desc: "Trends shift before you clear your stock. Markdowns eat your margin and cash gets tied up." },
  { icon: BarChart3, title: "No Visibility Into Best Sellers", desc: "You do not know which styles, colours or collections actually drive profit until it is too late." },
  { icon: Tag, title: "Manual Pricing Changes", desc: "Sale prices, promotions and branch pricing are updated by hand. Mistakes cost margin and confuse customers." },
  { icon: Building2, title: "Stock Scattered Across Branches", desc: "The right size exists in another store but you cannot find it. Sales are lost to poor visibility." },
]

const workflow = [
  { step: "New collection arrives", desc: "Every item is received with full variant details — sizes, colours, styles and cost prices recorded automatically." },
  { step: "Products are displayed in-store", desc: "Staff know exactly what is on the floor and in the back room. Shelf quantities update as stock is put out." },
  { step: "Customer browses and purchases", desc: "Barcode scanning keeps checkout fast and accurate. Every sale is linked to the exact variant sold." },
  { step: "Inventory updates instantly", desc: "Stock deducts in real time for every size and colour. You always know what is left without walking the floor." },
  { step: "Best-selling variants are highlighted", desc: "Live reports show which sizes, colours and styles are moving fastest so you can reorder confidently." },
  { step: "Slow-moving products are identified", desc: "Items that have not sold in 30 or 60 days are flagged automatically for promotion or clearance." },
  { step: "Promotion is recommended and applied", desc: "Discounts are applied centrally and reflected at every branch instantly. Margins are protected with minimum-price rules." },
  { step: "Reorder suggestions are generated", desc: "Purchase recommendations based on sell-through rates, not guesswork. Buy the right quantities every time." },
  { step: "Owner reviews daily performance", desc: "Sales by collection, profit by category and branch comparison — all ready at close of business." },
]

const dashboardMetrics = [
  { label: "Today's Sales", value: "₦680K" },
  { label: "Top Selling Style", value: "Maxi Dress" },
  { label: "Best Selling Size", value: "Medium" },
  { label: "Low Stock Variants", value: "34" },
  { label: "Slow Moving Products", value: "18" },
  { label: "Revenue by Collection", value: "Summer" },
  { label: "Branch Performance", value: "Ikeja" },
  { label: "Gross Profit Today", value: "₦195K" },
]

const beforeAfter = {
  before: [
    "Guessing what customers want every season",
    "Unsold collections marked down at 70%",
    "Manual stock counts that take all Sunday",
    "No record of what a customer bought last time",
    "Pricing confusion between branches",
    "The right size exists somewhere — but where?",
  ],
  after: [
    "Live inventory shows exactly what sells",
    "Best sellers identified before they run out",
    "Variant tracking for every size and colour",
    "Complete customer purchase history",
    "Consistent pricing and promotions everywhere",
    "Centralised multi-branch stock visibility",
  ],
}

const intelligence = [
  { icon: TrendingUp, title: "Unexpected Sales Spikes", desc: "Black dresses are selling 40% faster than expected. Recommend increasing the next order quantity." },
  { icon: Shirt, title: "Sizes Running Low", desc: "Size 40 is almost sold out across all branches. Reorder before you lose customers to competitors." },
  { icon: BarChart3, title: "Collection Performance", desc: "Summer collection has slowed significantly. Consider a mid-season promotion to clear space for autumn stock." },
  { icon: Users, title: "Cross-Sell Opportunities", desc: "Customers who bought handbags are also buying matching wallets. Bundle them for higher average ticket." },
  { icon: AlertTriangle, title: "Slow-Moving Stock", desc: "Three products have not sold in 60 days. Recommend a weekend promotion before they become dead inventory." },
  { icon: Lightbulb, title: "Suggested Actions", desc: "Discount winter jackets before the season ends. Reorder size Medium in the floral print. Review Ikeja branch pricing." },
]

const faqs = [
  { q: "Can MartPoint manage sizes and colours separately?", a: "Yes. Every variant is tracked as its own SKU. See stock by size, colour, style or any combination you define." },
  { q: "Can I track different product variants?", a: "Absolutely. Size, colour, material, pattern and fit are all tracked independently with full stock visibility." },
  { q: "Can I compare seasonal collections?", a: "Yes. Historical sales reports compare collections across seasons so you know what to buy and what to avoid." },
  { q: "Can I manage multiple boutiques?", a: "Yes. Search stock across all locations, transfer variants between stores and compare branch performance from one dashboard." },
  { q: "Can I run promotions and discounts?", a: "Yes. Set discounts, bundles and loyalty rewards centrally. Every branch applies them automatically with margin protection." },
  { q: "Can I track customer purchase history?", a: "Yes. Every customer gets a full profile with sizes, preferences, past purchases and recommended items." },
  { q: "Can I monitor stock across branches?", desc: "Yes. See live stock levels for every variant at every branch. Transfer the right size to where it sells best." },
]

export default function FashionStoresPage() {
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
                Sell More Fashion. Stock Less Dead Inventory.
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Know exactly what sells, what sizes move fastest and which collections need attention before your profits disappear. MartPoint Retail gives fashion boutiques the visibility they need to buy smarter and sell faster.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20fashion%20store%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
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
                The Challenges Holding Your Fashion Business Back
              </h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
                These daily struggles cost African fashion retailers profit, customers and growth. MartPoint was built to eliminate every one of them.
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
              headline="How MartPoint Fits Into Your Daily Workflow"
              description="From collection arrival to reorder, every step is tracked, visible and optimised for fashion retail."
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
              headline="Your Boutique At A Glance"
              description="The numbers that drive fashion buying and merchandising decisions, updated in real time."
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
              headline="Why Boutique Owners Switch To MartPoint"
              description="See the difference between how you buy and sell now and how MartPoint transforms your fashion business."
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
                &ldquo;We used to overbuy because we never knew what sold. Now MartPoint tells us exactly which sizes and colours move fastest. Our stock turns faster and we barely have clearance sales anymore.&rdquo;
              </blockquote>
              <div className="mt-8 flex items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-retail/10 flex items-center justify-center text-retail font-bold text-base">FA</div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">Fatima A.</div>
                  <div className="text-xs text-muted-foreground">Owner, Luxe Fashion Boutique</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader label="FAQ" headline="Questions Fashion Retailers Ask" />
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
                Buy Smarter. Sell Faster. Grow Your Fashion Business.
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Join fashion boutiques across Africa using MartPoint to reduce dead stock, increase sell-through and make confident buying decisions every season.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20fashion%20store%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
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
      <HowToSchema name="How MartPoint Works for Fashion Stores" description="Step-by-step workflow using MartPoint Retail." steps={workflow.map((w) => ({ name: w.step, text: w.desc }))} />
      </main>
      <Footer />
    </>
  )
}
