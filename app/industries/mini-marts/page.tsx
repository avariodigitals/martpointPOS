import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ArrowRight, AlertTriangle, Package, Receipt, BarChart3,
  Clock, Building2, Check, X, ChevronDown, TrendingUp, Lightbulb,
  ArrowDown, WifiOff, Printer, Landmark, ScanLine, Users,
} from "lucide-react"
import { FAQPageSchema, HowToSchema } from "@/components/structured-data"

export const metadata: Metadata = {
  title: "Mini Mart POS & Stock Software — MartPoint Retail",
  description:
    "Run your neighbourhood mini mart without manual stock counts or missed sales. Real-time inventory, fast checkout, simple reordering and daily profit reports built for African convenience stores.",
}

const painPoints = [
  { icon: Package, title: "Fast-Moving Products Gone By Evening", desc: "Bread, milk and soft drinks sell out before you notice. Customers leave empty-handed and shop elsewhere tomorrow." },
  { icon: AlertTriangle, title: "Manual Pricing Mistakes", desc: "Staff guess prices or use old tags. Customers complain, margins slip and trust erodes with every wrong charge." },
  { icon: Receipt, title: "Cash Drawer Shortages", desc: "Without sales-to-cash matching, you cannot explain why the drawer never balances at closing time." },
  { icon: BarChart3, title: "Unknown Daily Profit", desc: "You close the shop every night not knowing if you made a profit or a loss. The numbers are always a guess." },
  { icon: Clock, title: "Weekend Stock Shortages", desc: "Weekend demand surges but stock is planned for weekdays. Saturday afternoons become a constant apology to regular customers." },
  { icon: Users, title: "Customers Requesting Unavailable Products", desc: "Regulars ask for items you stopped stocking weeks ago. You never tracked what they actually wanted." },
]

const workflow = [
  { step: "Customer Enters", desc: "The shop opens. You already know what sold yesterday, what needs restocking and what profit you made." },
  { step: "Product Scanned", desc: "Every item is scanned at checkout. Prices are accurate, promotions apply automatically and mistakes are eliminated." },
  { step: "Payment Received", desc: "Cash, transfer and card payments are recorded instantly. The sale is linked to the customer, the product and the staff member." },
  { step: "Inventory Updated", desc: "Stock levels update in real time with every sale. You know exactly what is left on the shelf without walking around." },
  { step: "Low Stock Alert", desc: "Fast-moving items approaching minimum levels trigger automatic alerts before they run out completely." },
  { step: "Daily Sales Report", desc: "Sales by product, payment method and profit margin are compiled automatically. No notebook calculations required." },
  { step: "Profit Calculated", desc: "Revenue minus cost of goods sold gives you true daily profit. You close knowing exactly how the business performed." },
  { step: "Store Closes", desc: "You lock up with confidence. Tomorrow's reorder list is ready and your cash reconciles to the naira." },
]

const dashboardMetrics = [
  { label: "Sales Today", value: "₦124K" },
  { label: "Cash Drawer", value: "₦87.5K" },
  { label: "Low Stock", value: "7 items" },
  { label: "Best Seller Today", value: "Soft Drinks" },
  { label: "Profit Today", value: "₦31K" },
  { label: "Inventory Value", value: "₦456K" },
  { label: "Customers Served", value: "89" },
  { label: "Expenses Today", value: "₦12K" },
]

const beforeAfter = {
  before: [
    "Manual notebook for sales and stock",
    "Guessing stock levels by looking at shelves",
    "Slow checkout with manual price lookup",
    "No profit visibility until end of month",
    "Expired products discovered by customers",
    "No idea which products earn the most money",
  ],
  after: [
    "Live inventory updated with every sale",
    "Instant stock levels on any device",
    "Barcode scanning checkout under 10 seconds",
    "Daily profit report before locking up",
    "Expiry alerts before products go bad",
    "Best-seller and margin reports every morning",
  ],
}

const intelligence = [
  { icon: AlertTriangle, title: "Stock Alert", desc: "Bread usually sells out before 5 PM. Current stock will not last through tomorrow afternoon." },
  { icon: TrendingUp, title: "Reorder Recommendation", desc: "Reorder soft drinks before Saturday. Historical data shows 40% higher demand every weekend." },
  { icon: Package, title: "Low Stock Warning", desc: "Sugar stock is below the minimum level. Reorder today to avoid disappointing regular customers." },
  { icon: BarChart3, title: "Sales Pattern", desc: "Mondays generate your highest sales. Consider increasing Monday morning stock levels for bread and milk." },
  { icon: Receipt, title: "Profit Insight", desc: "Drinks delivered the highest profit today at 35% margin. Consider expanding the drinks shelf space." },
  { icon: Lightbulb, title: "Trend Alert", desc: "Eggs are selling 22% faster than last week. Recommend increasing your next order quantity by 15%." },
]

const faqs = [
  { q: "Can I use MartPoint with just one shop?", a: "Absolutely. MartPoint is designed for single-store owners. Setup takes under an hour and most owners are comfortable using it within a day." },
  { q: "Does it work offline?", a: "Yes. MartPoint works offline so your mini mart never stops selling during network issues. Data syncs automatically when connectivity returns." },
  { q: "Can I track daily expenses?", a: "Yes. Record rent, electricity, transport and supplier payments alongside your sales. See true daily profit after all costs." },
  { q: "Can I print receipts for customers?", a: "Yes. MartPoint works with standard thermal receipt printers. Every customer gets a professional receipt with your store name and details." },
  { q: "Can I add more branches later?", a: "Yes. Start with one store and add new locations whenever you are ready. All branches report into one dashboard." },
  { q: "Can I use a barcode scanner?", a: "Yes. MartPoint works with standard USB barcode scanners. Simply plug in and start scanning products at checkout." },
  { q: "Will it help me know what to reorder?", a: "Yes. MartPoint tracks sales velocity and alerts you when stock approaches minimum levels. Your reorder list is generated automatically." },
  { q: "Can I see which products make the most profit?", a: "Yes. Profit reports by product and category show exactly what earns you money. Stock smarter based on real margin data." },
]

export default function MiniMartsPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* 1. Hero */}
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24 lg:py-32">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-4">MartPoint Retail</span>
              <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.05] text-foreground">Know Every Sale. Every Stock Item. Every Day.</h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">Run your neighbourhood store like a pro. MartPoint Retail gives you real-time inventory, fast checkout and automatic low-stock alerts so you never miss a sale or run out of your best-selling products.</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20mini%20mart%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">Book a Demo<ArrowRight className="ml-2 h-4 w-4" /></Link>
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
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">The Everyday Problems Mini Mart Owners Face</h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">Running a neighbourhood store is hard work. These daily headaches cost you sales, profit and customer loyalty.</p>
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
            <SectionHeader label="How It Works" headline="From Morning Sales To End-of-Day Reports" description="A simple daily flow that gives you complete visibility and control over your neighbourhood store from open to close." />
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
            <SectionHeader label="Dashboard" headline="Your Store At A Glance" description="The numbers that matter for a neighbourhood store owner, updated in real time every single day." />
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

        {/* 5. Before / After */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-5xl mx-auto">
            <SectionHeader label="Transformation" headline="Why Mini Mart Owners Switch To MartPoint" description="See the difference between running your store on guesswork and running it with complete daily visibility." />
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

        {/* 6. Intelligence */}
        <section className="w-full bg-[#023047] py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-4">MartPoint Intelligence</span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">Practical Recommendations For Your Store</h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">MartPoint learns your store's patterns and suggests what to stock, when to reorder and what to focus on before problems arise.</p>
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

        {/* 7. Testimonial */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint max-w-3xl mx-auto text-center">
            <div className="rounded-2xl border border-border bg-card p-8 md:p-12">
              <div className="text-xs font-semibold uppercase tracking-wider text-retail mb-4">Customer Story</div>
              <blockquote className="text-xl md:text-2xl text-foreground leading-relaxed italic max-w-2xl mx-auto">
                &ldquo;I used to close the shop every night not knowing if I made money or lost money. Now I see my daily profit before I lock up. I know exactly what sells, what to reorder and what to stop stocking. My customers never find empty shelves anymore.&rdquo;
              </blockquote>
              <div className="mt-8 flex items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-retail/10 flex items-center justify-center text-retail font-bold text-base">FO</div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">Fatima O.</div>
                  <div className="text-xs text-muted-foreground">Owner, Fatima's Mini Mart, Abuja</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 8. FAQ */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader label="FAQ" headline="Questions Mini Mart Owners Ask" />
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

        {/* 9. CTA */}
        <section className="w-full bg-retail-soft border-y border-retail-muted py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Run Your Mini Mart With Complete Confidence</h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">Join neighbourhood store owners across Africa using MartPoint to track every sale, manage every stock item and close every day knowing exactly how their business performed.</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20mini%20mart%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">Book a Demo<ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" size="lg"><Link href="/pricing">View Pricing</Link></Button>
              </div>
            </div>
          </div>
        </section>

        <FAQPageSchema faqs={faqs.map((f) => ({ question: f.q, answer: f.a }))} />
        <HowToSchema name="How MartPoint Works for Mini Marts" description="Step-by-step daily workflow for mini mart owners using MartPoint Retail." steps={workflow.map((w) => ({ name: w.step, text: w.desc }))} />
      </main>
      <Footer />
    </>
  )
}
