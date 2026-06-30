export const revalidate = 86400
import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ArrowRight, AlertTriangle, Package, Receipt, BarChart3,
  Clock, Check, X, ChevronDown, TrendingUp, Lightbulb,
  ArrowDown, Leaf, Truck, Trash2, Sprout, Banana,
} from "lucide-react"
import { FAQPageSchema, HowToSchema } from "@/components/structured-data"

export const metadata: Metadata = {
  title: "Grocery Store POS & Inventory — MartPoint Retail",
  description:
    "Manage fresh produce, packaged goods and daily sales with real-time stock tracking, expiry alerts and supplier management built for African grocery stores.",
}

const painPoints = [
  { icon: Leaf, title: "Fresh Produce Spoilage", desc: "Fruits and vegetables rot before you sell them. Every spoiled batch is money you cannot recover." },
  { icon: Package, title: "Bread Selling Out Before Evening", desc: "Your best-selling staple runs out by 5 PM. Regulars come back to empty shelves and go to the store down the road." },
  { icon: AlertTriangle, title: "Expired Packaged Goods", desc: "A customer finds an expired tin on your shelf. One complaint spreads fast and damages the trust you built for years." },
  { icon: BarChart3, title: "Unknown Fast-Moving Staples", desc: "You do not know which products sell fastest. So you overstock slow-movers and understock the items customers want most." },
  { icon: Truck, title: "Poor Supplier Planning", desc: "You reorder based on memory. Some suppliers deliver late, others raise prices without warning and you are never prepared." },
  { icon: Clock, title: "Daily Stock Shortages", desc: "Every morning you discover what ran out yesterday. By the time the new delivery arrives, you have already lost a full day of sales." },
]

const workflow = [
  { step: "Morning Delivery", desc: "Fresh produce and packaged goods arrive from suppliers. Every item is received with quantity, cost and expiry date recorded." },
  { step: "Goods Received", desc: "Stock is checked against the delivery note. Discrepancies are flagged immediately before the supplier leaves your premises." },
  { step: "Shelves Replenished", desc: "Fresh produce goes to the display. Packaged goods are shelved by expiry date so older stock sells first." },
  { step: "Customers Purchase", desc: "Checkout is fast with barcode scanning for packaged goods and integrated weighing for fresh produce. Prices are always accurate." },
  { step: "Inventory Updates", desc: "Every sale deducts stock in real time. You know exactly what is left on every shelf without walking the store." },
  { step: "Low Stock Alerts", desc: "Fast-moving staples approaching minimum levels trigger alerts automatically. Reorder before you run out." },
  { step: "Supplier Reorder", desc: "Purchase orders are created based on actual sales data, not guesswork. You know which supplier to call and how much to order." },
  { step: "Daily Reports", desc: "Sales, profit, spoilage and stock levels are compiled automatically. You close knowing exactly how the day performed." },
]

const dashboardMetrics = [
  { label: "Fresh Produce Stock", value: "142 kg" },
  { label: "Expiring Items", value: "8 items" },
  { label: "Best Sellers", value: "Rice 5kg" },
  { label: "Today's Sales", value: "₦186K" },
  { label: "Low Stock", value: "11 items" },
  { label: "Supplier Deliveries", value: "3 today" },
  { label: "Daily Profit", value: "₦42K" },
  { label: "Customers Served", value: "156" },
]

const freshProduceCapabilities = [
  { icon: Leaf, title: "Expiry Monitoring", desc: "Track expiry dates on packaged goods and spoilage windows on fresh produce. Get alerts before anything goes bad." },
  { icon: Trash2, title: "Wastage Tracking", desc: "Record every spoiled or damaged item with reason and cost. See wastage trends by category and supplier." },
  { icon: Sprout, title: "Daily Replenishment", desc: "Know exactly what to restock each morning based on yesterday's sales and current shelf levels." },
  { icon: Truck, title: "Supplier Comparison", desc: "Compare delivery times, quality and pricing across all suppliers. Negotiate better terms with data to back you up." },
  { icon: Banana, title: "Fresh Produce Profitability", desc: "See margins by produce category. Know whether tomatoes, plantain or yam generates the most profit per kilogram." },
  { icon: TrendingUp, title: "Reorder Recommendations", desc: "Get automatic reorder suggestions based on sales velocity, spoilage rates and current stock levels." },
]

const beforeAfter = {
  before: [
    "Guessing stock levels by walking the aisles",
    "Product spoilage discovered only when customers complain",
    "Slow checkout with manual weighing and price lookup",
    "No daily visibility into profit or best sellers",
    "Suppliers delivering late with no accountability",
    "Expired goods sitting on shelves unnoticed",
  ],
  after: [
    "Live inventory updated with every sale in real time",
    "Expiry alerts before products spoil or expire",
    "Barcode and integrated weighing under 10 seconds",
    "Daily profit, margin and best-seller reports every evening",
    "Supplier delivery tracking with performance history",
    "FIFO shelf rotation so older stock always sells first",
  ],
}

const intelligence = [
  { icon: AlertTriangle, title: "Stock Alert", desc: "Bread usually sells out before 6 PM. Current stock will not meet tomorrow's demand. Recommend increasing the morning order." },
  { icon: TrendingUp, title: "Sales Trend", desc: "Tomatoes are selling 34% faster than last week. Consider increasing your produce purchase before the weekend rush." },
  { icon: Package, title: "Stock Warning", desc: "Rice stock will finish before the weekend based on current sales velocity. Reorder by Thursday to avoid a shortage." },
  { icon: Clock, title: "Expiry Alert", desc: "Milk expiry is approaching on 12 units received last Monday. Sell or discount these before Friday to avoid wastage." },
  { icon: Receipt, title: "Profit Insight", desc: "Eggs generated the highest profit today at 38% margin. Consider increasing shelf space and visibility for eggs." },
  { icon: Lightbulb, title: "Reorder Suggestion", desc: "Reorder soft drinks tomorrow morning. Weekend demand is historically 45% higher and current stock is below safe levels." },
  { icon: Truck, title: "Supplier Insight", desc: "Supplier A consistently delivers 2 hours faster than Supplier B. Consider shifting more orders to Supplier A for fresher stock." },
]

const faqs = [
  { q: "Can MartPoint track expiry dates?", a: "Yes. Set expiry dates on every packaged product. MartPoint alerts you before items expire so you can discount or rotate stock before wastage occurs." },
  { q: "Can I manage fresh produce separately?", a: "Absolutely. Fresh produce is tracked by weight, spoilage window and supplier. You see exactly what is fresh, what is aging and what needs replenishing." },
  { q: "Can I compare suppliers?", a: "Yes. Track delivery times, product quality, pricing and margins by supplier. MartPoint helps you negotiate better terms with real performance data." },
  { q: "Can I track packaged and fresh goods together?", a: "Yes. One unified dashboard shows produce, packaged and frozen sections together. Stock, sales and profit are visible across every category." },
  { q: "Can I know my fastest-selling products?", a: "Yes. Sales velocity reports show exactly which products move fastest by day, week and month. Stock smarter based on real demand patterns." },
  { q: "Can I receive automatic low stock alerts?", a: "Yes. Set minimum stock levels for any product. MartPoint alerts you automatically when stock approaches those levels so you reorder in time." },
  { q: "Can it handle weighing scales at checkout?", a: "Yes. MartPoint integrates with standard weighing scales for accurate pricing of fruits, vegetables and bulk items at the counter." },
  { q: "Can I see profit by product category?", a: "Yes. Profit reports by category show margins for fresh produce, packaged goods, beverages and frozen items separately so you know what earns you money." },
]

export default function GroceryStoresPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* 1. Hero */}
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24 lg:py-32">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-4">MartPoint Retail</span>
              <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.05] text-foreground">Fresh Stock Every Morning. Happy Customers Every Day.</h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">Sell fresher products, waste less and earn more. MartPoint Retail tracks fresh produce, packaged goods and household essentials so you never run out of everyday staples or lose money to spoilage.</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20grocery%20store%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">Book a Demo<ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" size="lg"><Link href="/pricing">View Pricing</Link></Button>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Pain Points */}
        <section className="w-full bg-[#023047] py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">The Daily Challenges Grocery Store Owners Face</h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">Fresh produce, fast-moving staples and supplier unpredictability make grocery retail one of the hardest businesses to manage well.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {painPoints.map((item) => (
                <div key={item.title} className="rounded-xl bg-white/5 border border-white/10 p-6 text-center transition-all duration-200 hover:bg-white/10">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-4"><item.icon className="w-6 h-6 text-white" /></div>
                  <p className="text-sm font-semibold text-white/95 mb-2">{item.title}</p>
                  <p className="text-xs text-white/60 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 3. Workflow */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader label="How It Works" headline="From Supplier Delivery To Customer Checkout" description="A complete daily workflow that keeps your grocery store stocked fresh, your customers satisfied and your profit protected." />
            <div className="mt-14 max-w-3xl mx-auto">
              <div className="space-y-0">
                {workflow.map((item, i) => (
                  <div key={item.step} className="relative">
                    <div className="rounded-xl border border-border bg-card p-5">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-retail-soft flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-retail">{String(i + 1).padStart(2, "0")}</span>
                        </div>
                        <p className="text-sm font-semibold text-foreground">{item.step}</p>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed pl-11">{item.desc}</p>
                    </div>
                    {i < workflow.length - 1 && (
                      <div className="flex justify-center py-2"><ArrowDown className="w-4 h-4 text-retail/40" /></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 4. Dashboard Metrics */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader label="Dashboard" headline="Your Grocery Dashboard" description="The numbers that drive grocery store decisions, updated in real time every single day." />
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

        {/* 5. Fresh Produce Management */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader label="Capabilities" headline="Fresh Produce Management Built In" description="Tools designed specifically for the realities of selling fresh, perishable and fast-moving goods every single day." />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {freshProduceCapabilities.map((item) => (
                <div key={item.title} className="rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mb-4">
                    <item.icon className="w-5 h-5 text-retail" />
                  </div>
                  <p className="text-sm font-semibold text-foreground mb-1">{item.title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Before / After */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint max-w-5xl mx-auto">
            <SectionHeader label="Transformation" headline="Why Grocery Store Owners Switch To MartPoint" description="See the difference between running your store on instinct and running it with complete daily visibility." />
            <div className="mt-14 grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="rounded-2xl border border-border bg-muted p-8">
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
              <div className="rounded-2xl border border-retail/20 bg-muted p-8">
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

        {/* 7. Intelligence */}
        <section className="w-full bg-[#023047] py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-4">MartPoint Intelligence</span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">Smart Recommendations For Your Grocery Store</h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">MartPoint learns your store's patterns and suggests what to stock, when to reorder and which suppliers to trust before problems cost you money.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {intelligence.map((item) => (
                <div key={item.title} className="rounded-xl bg-white/5 border border-white/10 p-6 text-center transition-all duration-200 hover:bg-white/10">
                  <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mx-auto mb-4"><item.icon className="w-6 h-6 text-white" /></div>
                  <p className="text-sm font-semibold text-white/95 mb-2">{item.title}</p>
                  <p className="text-xs text-white/60 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 8. Testimonial */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint max-w-3xl mx-auto text-center">
            <div className="rounded-2xl border border-border bg-card p-8 md:p-12">
              <div className="text-xs font-semibold uppercase tracking-wider text-retail mb-4">Customer Story</div>
              <blockquote className="text-xl md:text-2xl text-foreground leading-relaxed italic max-w-2xl mx-auto">
                &ldquo;I used to throw away spoiled tomatoes and plantain every single week. Now I get alerts before anything goes bad and my reorder suggestions are based on actual sales, not guesswork. My wastage dropped by 60% and my customers always find fresh stock.&rdquo;
              </blockquote>
              <div className="mt-8 flex items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-retail/10 flex items-center justify-center text-retail font-bold text-base">AO</div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">Adebayo O.</div>
                  <div className="text-xs text-muted-foreground">Owner, GreenLeaf Grocers, Lagos</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 9. FAQ */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader label="FAQ" headline="Questions Grocery Store Owners Ask" />
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

        {/* 10. CTA */}
        <section className="w-full bg-retail-soft border-y border-retail-muted py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Run Your Grocery Store With Complete Freshness</h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">Join grocery store owners across Africa using MartPoint to sell fresher products, reduce wastage and make smarter purchasing decisions every single day.</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20grocery%20store%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">Book a Demo<ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" size="lg"><Link href="/pricing">View Pricing</Link></Button>
              </div>
            </div>
          </div>
        </section>

        <FAQPageSchema faqs={faqs.map((f) => ({ question: f.q, answer: f.a }))} />
        <HowToSchema name="How MartPoint Works for Grocery Stores" description="Step-by-step daily workflow for grocery store owners using MartPoint Retail." steps={workflow.map((w) => ({ name: w.step, text: w.desc }))} />
      </main>
      <Footer />
    </>
  )
}
