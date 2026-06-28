import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ArrowRight, AlertTriangle, Package, Building2, BarChart3, Receipt,
  Check, X, ChevronDown, TrendingUp, Lightbulb, Smartphone, ShieldCheck,
  Wrench, MousePointer, Eye, ArrowDown,
} from "lucide-react"
import { FAQPageSchema, HowToSchema } from "@/components/structured-data"

export const metadata: Metadata = {
  title: "Electronics Store POS & Inventory — MartPoint Retail",
  description:
    "Track IMEI, serial numbers, warranties and high-value stock across showroom and warehouse. MartPoint Retail is built for African electronics retailers selling phones, laptops and appliances.",
}

const painPoints = [
  { icon: AlertTriangle, title: "Missing IMEI or Serial Numbers", desc: "Without serial tracking, you cannot verify stock authenticity, handle returns or prove a device was sold from your store." },
  { icon: ShieldCheck, title: "Warranty Disputes", desc: "Customers claim warranty coverage you have no record of. Disputes cost time, money and customer trust every single day." },
  { icon: Package, title: "High-Value Inventory Loss", desc: "Phones and laptops worth hundreds of thousands disappear without trace. You discover the loss days later with no way to trace it." },
  { icon: MousePointer, title: "Wrong Accessories Sold", desc: "Staff sell incompatible chargers, cases or cables. Returns pile up and customers blame your brand, not the mistake." },
  { icon: Eye, title: "Demo Unit Confusion", desc: "Demo devices are sold by mistake or never tracked separately. Your display stock becomes your lost stock." },
  { icon: Wrench, title: "Returns & Repair Tracking", desc: "Devices sent for repair disappear into a black hole. Customers call daily and you have no status update to give them." },
]

const workflow = [
  { step: "Supplier", desc: "Devices arrive with IMEI lists and supplier invoices. Every unit is registered before it enters your stock." },
  { step: "Warehouse", desc: "Units are received into warehouse inventory with IMEI, serial number, supplier and cost price recorded." },
  { step: "Serial Number Registration", desc: "Every phone, laptop and appliance is logged with its unique identifier. No unit enters your store without traceability." },
  { step: "Showroom", desc: "Stock is transferred to the showroom floor. Demo units are tagged separately so they cannot be sold by mistake." },
  { step: "Sale", desc: "At checkout, the exact IMEI is linked to the customer, receipt and payment method. Every high-value sale is fully documented." },
  { step: "Warranty Activation", desc: "Warranty period is calculated automatically from the sale date and stored against the serial number for instant lookup." },
  { step: "Repair History", desc: "If a device is returned or sent for repair, the entire history is tracked against the original sale and customer record." },
  { step: "Customer Record", desc: "Every purchase, warranty claim and repair is stored under the customer's profile. Service staff have full context in seconds." },
]

const dashboardMetrics = [
  { label: "Devices Sold Today", value: "47 units" },
  { label: "Warranty Registrations", value: "38 active" },
  { label: "Repairs Pending", value: "6 devices" },
  { label: "High-Value Inventory", value: "₦12.4M" },
  { label: "Top Selling Brand", value: "Samsung" },
  { label: "Low Stock Alerts", value: "9 items" },
  { label: "Profit by Brand", value: "Apple: 28%" },
  { label: "Accessories Sales", value: "₦340K" },
]

const beforeAfter = {
  before: [
    "Manual warranty tracking on paper and WhatsApp",
    "Serial number confusion between warehouse and showroom",
    "High-value inventory losses discovered too late",
    "Incompatible accessories sold with every third device",
    "Demo units sold by mistake or never tracked",
    "Repair status unknown when customers call",
  ],
  after: [
    "Complete serial and IMEI tracking from supplier to customer",
    "Instant warranty lookup by IMEI at the counter",
    "Real-time inventory visibility across warehouse and showroom",
    "Accessory compatibility checks at point of sale",
    "Demo units tagged and excluded from sales automatically",
    "Full repair history linked to customer and original sale",
  ],
}

const intelligence = [
  { icon: AlertTriangle, title: "Stock Alert", desc: "Samsung Galaxy A54 stock will run out this week based on current sales velocity. Recommend reordering 30 units." },
  { icon: TrendingUp, title: "Margin Insight", desc: "iPhone accessories generated the highest margin today at 42%. Consider promoting accessory bundles at checkout." },
  { icon: ShieldCheck, title: "Warranty Alert", desc: "Three devices sold last week have incomplete warranty registration. Complete registration to protect after-sales revenue." },
  { icon: Package, title: "Slow-Moving Stock", desc: "Tecno Spark 20 inventory has not moved in 14 days. Recommend a promotional discount or branch transfer." },
  { icon: Building2, title: "Transfer Recommendation", desc: "Lekki branch is low on Samsung stock while Ikeja has excess. Recommend transferring 15 units to balance inventory." },
  { icon: Lightbulb, title: "Reorder Suggestion", desc: "Recommended reorder quantity: 25 units of Infinix Note 40 based on forecasted demand and current stock levels." },
]

const faqs = [
  { q: "Can MartPoint record IMEI and serial numbers?", a: "Yes. Every unit can be logged with IMEI, serial number, supplier, purchase date and cost price. You can search by any field instantly at checkout or during warranty lookup." },
  { q: "Can warranty registration happen automatically?", a: "Yes. Warranty periods are calculated automatically from the sale date and stored against each serial number. Lookup is instant when a customer visits or calls." },
  { q: "Can I manage repairs and service requests?", a: "Absolutely. Track devices sent for repair, record service status, manage warranty claims and update customers with accurate status at any time." },
  { q: "Can I transfer devices between branches?", a: "Yes. Transfer stock between showrooms and warehouses with full IMEI tracking. Every movement is logged for complete traceability." },
  { q: "Can I analyse profit by brand or category?", a: "Yes. See gross profit, margin percentage and turnover by brand, category, supplier or individual product. Know exactly what earns you money." },
  { q: "Can I manage accessories separately from devices?", a: "Yes. Accessories are tracked as separate SKUs with their own stock levels, pricing and compatibility rules. Staff see matching accessories at point of sale." },
  { q: "Does MartPoint prevent demo units from being sold?", a: "Yes. Demo units are tagged separately in the system. They are excluded from sales and flagged if a staff member attempts to process them." },
  { q: "Can I see which sales rep sold which device?", a: "Yes. Every sale is linked to the staff member who processed it. Commission reports, performance rankings and accountability are built in." },
]

export default function ElectronicsStoresPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* 1. Hero */}
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24 lg:py-32">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-4">MartPoint Retail</span>
              <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.05] text-foreground">Sell High-Value Electronics With Complete Confidence</h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">Every device. Every serial number. Fully accounted for. MartPoint Retail tracks IMEI, warranties and high-value stock across your showroom and warehouse so you never lose track of another phone, laptop or appliance.</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20an%20electronics%20store%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">Book a Demo<ArrowRight className="ml-2 h-4 w-4" /></Link>
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
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">The Challenges Electronics Retailers Face Every Day</h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">Selling phones, laptops and appliances is high stakes. These operational gaps cost African electronics retailers money, trust and competitive edge.</p>
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
            <SectionHeader label="How It Works" headline="From Supplier To Customer — Every Device Tracked" description="A complete operational flow that gives electronics retailers full accountability from the moment a device arrives to the moment it reaches the customer." />
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
            <SectionHeader label="Dashboard" headline="Your Electronics Store Dashboard" description="The metrics that matter when you sell high-value devices, updated in real time every single day." />
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
            <SectionHeader label="Transformation" headline="Why Electronics Retailers Switch To MartPoint" description="See the difference between how you operate now and how MartPoint changes everything for your store." />
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
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">AI-Powered Insights For Electronics Retailers</h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">MartPoint does not just record your data. It analyses patterns, highlights risks and suggests what to do next before problems cost you money.</p>
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
                &ldquo;We sell phones and laptops worth millions every month. Before MartPoint, we had no way to verify warranties or trace stolen stock. Now every unit is logged from day one with its IMEI, warranty status and sale history. Our warranty disputes dropped to almost zero and we have not lost a high-value device in six months.&rdquo;
              </blockquote>
              <div className="mt-8 flex items-center justify-center gap-3">
                <div className="w-12 h-12 rounded-full bg-retail/10 flex items-center justify-center text-retail font-bold text-base">IK</div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">Ibrahim K.</div>
                  <div className="text-xs text-muted-foreground">Director, TechWorld Electronics</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 8. FAQ */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader label="FAQ" headline="Questions Electronics Retailers Ask" />
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
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Run Your Electronics Store With Total Confidence</h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">Join electronics retailers across Africa using MartPoint to track every device, manage every warranty and sell high-value products with complete accountability.</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20an%20electronics%20store%20and%20I%27m%20interested%20in%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">Book a Demo<ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" size="lg"><Link href="/pricing">View Pricing</Link></Button>
              </div>
            </div>
          </div>
        </section>

        <FAQPageSchema faqs={faqs.map((f) => ({ question: f.q, answer: f.a }))} />
        <HowToSchema name="How MartPoint Works for Electronics Stores" description="Step-by-step workflow for electronics retailers using MartPoint Retail." steps={workflow.map((w) => ({ name: w.step, text: w.desc }))} />
      </main>
      <Footer />
    </>
  )
}
