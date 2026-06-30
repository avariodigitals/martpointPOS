export const revalidate = 86400
import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ArrowRight, ArrowDown, Package, Warehouse, Users, Receipt,
  BarChart3, Shield, FileCheck, TrendingUp, GitBranch, ArrowLeftRight,
  ClipboardList, Code, ScrollText, MapPin, Crown, Banknote, AlertTriangle,
  CalendarDays, WifiOff, Building2, Cloud, ChevronDown, Target, TrendingDown,
  Clock,
} from "lucide-react"
import { FAQPageSchema, HowToSchema } from "@/components/structured-data"

export const metadata: Metadata = {
  title: "Distribution Management Platform — MartPoint Enterprise",
  description:
    "Modern ERP for African distributors, wholesalers and FMCG companies. Manage warehouses, sales teams, dealer credit, inventory and logistics from one connected platform.",
}

const painPoints = [
  { icon: Package, title: "Warehouse Blindness", desc: "Multiple warehouses operate in isolation. You do not know what is where until a customer complains." },
  { icon: AlertTriangle, title: "Stock Imbalance", desc: "One warehouse overflows while another runs out of the same product. No transfer process exists." },
  { icon: Receipt, title: "Credit Chaos", desc: "Retailers buy on credit with no system to track limits or collections. Bad debt grows silently." },
  { icon: BarChart3, title: "No Demand Forecasting", desc: "You cannot predict which products will be needed where. Orders are reactive and expensive." },
  { icon: Clock, title: "Inefficient Routes", desc: "Delivery routes planned by memory. Fuel costs soar and customers wait too long." },
  { icon: Building2, title: "No Customer Hierarchy", desc: "You cannot see which retailers are your best customers or which are slipping away." },
]

const enterpriseFlow = [
  { label: "Supplier", desc: "Purchase orders, delivery schedules and supplier management" },
  { label: "Warehouse", desc: "Receiving, put-away and centralised stock control" },
  { label: "Inventory", desc: "Real-time visibility across all locations and branches" },
  { label: "Sales Team", desc: "Orders, targets, commissions and territory management" },
  { label: "Dealers", desc: "Credit limits, outstanding balances and order history" },
  { label: "Collections", desc: "Payment tracking, reconciliation and cash flow visibility" },
  { label: "Reports", desc: "Executive dashboards, profit analysis and business intelligence" },
]

const distributionWorkflow = [
  { step: "Supplier Delivery", desc: "Goods arrive with digital GRN. Quantities and quality are verified against purchase orders instantly." },
  { step: "Warehouse Receiving", desc: "Stock is put away with location codes. Every pallet and batch is traceable from day one." },
  { step: "Inventory Allocation", desc: "Available stock is allocated to sales orders by priority, region and dealer credit status." },
  { step: "Sales Order", desc: "Sales reps create orders on mobile. Pricing, discounts and credit limits are validated automatically." },
  { step: "Delivery Planning", desc: "Orders are grouped by route, vehicle capacity and delivery priority. Fuel and time are optimised." },
  { step: "Dealer Delivery", desc: "Deliveries are tracked in real time. Proof of delivery is captured digitally with signatures and photos." },
  { step: "Payment Collection", desc: "Cash, transfer and credit payments are recorded per dealer. Outstanding balances update instantly." },
  { step: "Business Intelligence", desc: "Leadership sees regional performance, product trends, rep rankings and profit margins in real time." },
]

const commandCentreMetrics = [
  { label: "Warehouse Stock", value: "12,847 units", icon: Package },
  { label: "Outstanding Orders", value: "384 orders", icon: ClipboardList },
  { label: "Dealer Credit Exposure", value: "₦24.3M", icon: Receipt },
  { label: "Regional Sales", value: "North: ₦8.2M", icon: MapPin },
  { label: "Sales Rep Performance", value: "James: 112%", icon: Users },
  { label: "Top Customer", value: "Dealer XYZ", icon: Crown },
  { label: "Inventory Value", value: "₦156M", icon: Banknote },
  { label: "Products Requiring Reorder", value: "47 items", icon: AlertTriangle },
  { label: "Delivery Schedule", value: "Today: 42 drops", icon: CalendarDays },
]

const enterpriseCapabilities = [
  { icon: Warehouse, title: "Multi-Warehouse", desc: "Unlimited warehouses with centralised visibility and inter-location transfers." },
  { icon: Shield, title: "Role Permissions", desc: "Granular access control. Warehouse staff, sales reps and accountants see only what they need." },
  { icon: FileCheck, title: "Approval Workflows", desc: "Multi-level approvals for purchases, credit limits and discounts. Every decision is traceable." },
  { icon: Receipt, title: "Dealer Credit", desc: "Set credit limits per dealer, track balances and monitor collections automatically." },
  { icon: TrendingUp, title: "Demand Planning", desc: "Predict product demand by region, season and category. Order proactively, not reactively." },
  { icon: BarChart3, title: "Sales Forecasting", desc: "Historical trends and seasonality models predict future sales with accuracy." },
  { icon: GitBranch, title: "Multi-Branch", desc: "Operate across cities and regions from one system. Consolidated reporting at group level." },
  { icon: ArrowLeftRight, title: "Transfer Orders", desc: "Move stock between warehouses based on demand signals. Balance inventory automatically." },
  { icon: ClipboardList, title: "Purchase Planning", desc: "Automated reorder suggestions based on sales velocity, lead time and safety stock." },
  { icon: Code, title: "API Ready", desc: "Connect MartPoint to your existing systems. Bi-directional data sync via REST API." },
  { icon: ScrollText, title: "Audit Logs", desc: "Every transaction, edit and approval is logged. Compliance-ready traceability." },
]

const intelligenceAlerts = [
  { icon: AlertTriangle, title: "Stock Alert", text: "Warehouse Kano will run out of Cooking Oil in two days based on current sales velocity." },
  { icon: ArrowLeftRight, title: "Transfer Recommendation", text: "Transfer 240 units of Cooking Oil from Lagos warehouse to Kano to prevent stockout." },
  { icon: Receipt, title: "Credit Alert", text: "Dealer XYZ has exceeded their credit limit of ₦5M. New orders are on hold pending payment." },
  { icon: TrendingDown, title: "Sales Decline", text: "Northern region sales declined 15% this month versus last month. Review rep assignments." },
  { icon: TrendingUp, title: "Demand Surge", text: "Cooking Oil demand in the East increased 34% this quarter. Recommend increasing purchase order." },
  { icon: Target, title: "Performance Milestone", text: "Sales Rep James exceeded monthly target by 112%. Consider territory expansion." },
  { icon: ClipboardList, title: "Purchase Recommendation", text: "Recommend increasing Q3 purchase order for rice by 20% based on forecasted demand." },
]

const scaleFeatures = [
  { icon: Warehouse, label: "Unlimited Warehouses" },
  { icon: Users, label: "Unlimited Dealers" },
  { icon: Package, label: "Unlimited Products" },
  { icon: Building2, label: "Multi-Company" },
  { icon: WifiOff, label: "Offline Support" },
  { icon: ScrollText, label: "Audit Logs" },
  { icon: Shield, label: "User Permissions" },
  { icon: Cloud, label: "Cloud Hosted" },
]

const implementationSteps = [
  { phase: "Discovery", desc: "We audit your current operations, workflows and pain points." },
  { phase: "Migration", desc: "Your product, dealer and historical data are imported and validated." },
  { phase: "Configuration", desc: "Warehouses, roles, credit limits and approval chains are configured." },
  { phase: "Training", desc: "Your team is trained on warehouse, sales and admin workflows." },
  { phase: "Go Live", desc: "MartPoint goes live with dedicated support during the first month." },
  { phase: "Ongoing Support", desc: "Continuous optimisation, new features and account management." },
]

const faqs = [
  { q: "Can MartPoint handle multiple warehouses?", a: "Yes. Track stock across unlimited warehouses with centralised visibility and inter-warehouse transfers." },
  { q: "Does it manage dealer credit and collections?", a: "Absolutely. Set credit limits per dealer, track balances, monitor collections and auto-hold orders when limits are exceeded." },
  { q: "Can sales reps create orders in the field?", a: "Yes. Sales reps use mobile devices to create orders, check stock, verify pricing and confirm delivery schedules in real time." },
  { q: "Does it help with delivery route planning?", a: "Yes. Plan routes by location, priority and vehicle capacity to reduce fuel costs and improve service levels." },
  { q: "Can it forecast demand by region?", a: "Yes. Historical sales data, seasonality and regional trends help predict demand for proactive ordering." },
  { q: "Is MartPoint suitable for national distributors?", a: "Yes. MartPoint scales from regional distributors to national networks with multiple warehouses, sales teams and dealer territories." },
  { q: "Does it integrate with accounting software?", a: "Yes. MartPoint includes a full general ledger, or you can integrate with external accounting systems via our API." },
  { q: "What happens during implementation?", a: "Our enterprise team leads you through discovery, migration, configuration, training and go-live with dedicated support throughout." },
]

export default function DistributorsPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* 1. Hero */}
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24 lg:py-32">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-erp mb-4">MartPoint Enterprise</span>
              <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.05] text-foreground">One Platform For Your Entire Distribution Operation</h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">From supplier to dealer, every stage of your distribution network is connected, visible and optimised. Built for African distributors, wholesalers and FMCG companies that refuse to operate in the dark.</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="erp">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20distribution%20business%20and%20I%27m%20interested%20in%20MartPoint%20Enterprise.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">Book an Enterprise Demo<ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" size="lg"><Link href="/request-quote">Request a Quote</Link></Button>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Enterprise Overview */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader label="Enterprise Overview" headline="One Platform For Your Entire Distribution Operation" description="Every department works from one connected system. No silos. No spreadsheets. No guessing." />
            <div className="mt-14 max-w-3xl mx-auto">
              <div className="space-y-0">
                {enterpriseFlow.map((item, i) => (
                  <div key={item.label} className="relative">
                    <div className="rounded-xl border border-border bg-background p-5 flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-erp-soft flex items-center justify-center shrink-0">
                        <span className="text-sm font-bold text-erp">{String(i + 1).padStart(2, "0")}</span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                    </div>
                    {i < enterpriseFlow.length - 1 && (
                      <div className="flex justify-center py-2"><ArrowDown className="w-4 h-4 text-erp/40" /></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 3. Pain Points */}
        <section className="w-full bg-[#023047] py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">The Challenges Holding Your Distribution Network Back</h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">These operational leaks cost African distributors money every single day. MartPoint was built to eliminate them.</p>
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

        {/* 4. Distribution Workflow */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader label="Distribution Workflow" headline="How MartPoint Runs Your Distribution Business" description="From supplier delivery to business intelligence, every step is connected, tracked and automated." />
            <div className="mt-14 max-w-3xl mx-auto">
              <div className="space-y-0">
                {distributionWorkflow.map((item, i) => (
                  <div key={item.step} className="relative">
                    <div className="rounded-xl border border-border bg-card p-5">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-lg bg-erp-soft flex items-center justify-center shrink-0">
                          <span className="text-xs font-bold text-erp">{String(i + 1).padStart(2, "0")}</span>
                        </div>
                        <p className="text-sm font-semibold text-foreground">{item.step}</p>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed pl-11">{item.desc}</p>
                    </div>
                    {i < distributionWorkflow.length - 1 && (
                      <div className="flex justify-center py-2"><ArrowDown className="w-4 h-4 text-erp/40" /></div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 5. Command Centre */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader label="Command Centre" headline="See Your Entire Distribution Network In One View" description="Real-time dashboards built for distribution executives who need operational visibility, not just reports." />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {commandCentreMetrics.map((metric) => (
                <div key={metric.label} className="rounded-xl border border-border bg-background p-6 transition-all duration-200 hover:border-erp/30 hover:shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-lg bg-erp-soft flex items-center justify-center"><metric.icon className="w-5 h-5 text-erp" /></div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{metric.label}</p>
                  </div>
                  <p className="text-2xl font-bold text-foreground">{metric.value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 6. Enterprise Capabilities */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader label="Enterprise Capabilities" headline="Built For Distribution Operations At Scale" description="Not retail features repackaged. These are enterprise capabilities built specifically for distributors, wholesalers and FMCG operations." />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {enterpriseCapabilities.map((cap) => (
                <div key={cap.title} className="rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-erp/30 hover:shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-erp-soft flex items-center justify-center mb-4"><cap.icon className="w-5 h-5 text-erp" /></div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{cap.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{cap.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 7. MartPoint Intelligence */}
        <section className="w-full bg-[#0A0F1C] py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-white/60 mb-4">MartPoint Intelligence</span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">AI-Powered Operational Insights</h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">Proactive alerts that highlight stock risks, credit exposure, sales trends and purchase recommendations before problems develop.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {intelligenceAlerts.map((alert) => (
                <div key={alert.title} className="rounded-xl bg-[#0A0F1C] border border-white/10 p-5 transition-all duration-200 hover:border-white/20">
                  <div className="flex items-center gap-2 mb-3">
                    <alert.icon className="w-5 h-5 text-white" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-white">{alert.title}</span>
                  </div>
                  <p className="text-sm text-white/80 leading-relaxed">{alert.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 8. Built For Scale */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader label="Built For Scale" headline="Enterprise Ready From Day One" description="Whether you operate two warehouses or twenty, MartPoint scales with your distribution network without re-platforming." />
            <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-5 max-w-4xl mx-auto">
              {scaleFeatures.map((feature) => (
                <div key={feature.label} className="rounded-xl border border-border bg-background p-6 text-center transition-all duration-200 hover:border-erp/30 hover:shadow-sm">
                  <div className="w-12 h-12 rounded-xl bg-erp-soft flex items-center justify-center mx-auto mb-3"><feature.icon className="w-6 h-6 text-erp" /></div>
                  <p className="text-sm font-semibold text-foreground">{feature.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 9. Implementation Journey */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader label="Implementation" headline="Your Journey To Enterprise Distribution Management" description="We do not just sell software. We partner with you to transform your distribution operations end to end." />
            <div className="mt-14 max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
                {implementationSteps.map((step, i) => (
                  <div key={step.phase} className="relative">
                    <div className="rounded-xl bg-erp-soft border border-erp-muted p-4 h-full">
                      <div className="text-xs font-semibold uppercase tracking-wider text-erp mb-2">Step {i + 1}</div>
                      <div className="text-sm font-semibold text-foreground mb-1">{step.phase}</div>
                      <div className="text-xs text-muted-foreground leading-relaxed">{step.desc}</div>
                    </div>
                    {i < implementationSteps.length - 1 && (
                      <div className="hidden lg:block absolute top-1/2 -right-2 transform -translate-y-1/2 z-10">
                        <ArrowRight className="w-4 h-4 text-erp/40" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 10. Customer Success Story */}
        <section className="w-full bg-erp-soft border-y border-erp-muted py-16 md:py-24">
          <div className="container-martpoint">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-erp mb-4">Customer Success</div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">From Chaos To Control In 90 Days</h2>
                <p className="mt-6 text-lg text-muted-foreground leading-relaxed">A leading FMCG distributor in Lagos replaced three disconnected systems with MartPoint Enterprise. The result was immediate and measurable.</p>
                <div className="mt-8 grid grid-cols-2 gap-6">
                  <div>
                    <p className="text-3xl font-bold text-erp">38%</p>
                    <p className="text-sm text-muted-foreground mt-1">Reduction in stockouts across all warehouses</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-erp">₦12M</p>
                    <p className="text-sm text-muted-foreground mt-1">Bad debt recovered through credit monitoring</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-erp">4 hrs</p>
                    <p className="text-sm text-muted-foreground mt-1">Daily time saved on reconciliation</p>
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-erp">3x</p>
                    <p className="text-sm text-muted-foreground mt-1">Faster delivery route planning</p>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-erp-muted bg-white p-8">
                <blockquote className="text-lg text-foreground leading-relaxed italic">
                  &ldquo;We used to run our distribution on spreadsheets and WhatsApp. MartPoint Enterprise gave us one source of truth. I can see stock across every warehouse, every dealer's credit balance and every rep's performance in real time. We have not had a stockout in three months.&rdquo;
                </blockquote>
                <div className="mt-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-erp/10 flex items-center justify-center text-erp font-bold text-sm">OA</div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">Olu Adeyemi</div>
                    <div className="text-xs text-muted-foreground">Operations Director, Adeyemi Distributors Ltd</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 11. FAQ */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader label="FAQ" headline="Questions Distributors Ask" />
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

        {/* 12. Enterprise CTA */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Ready To Transform Your Distribution Operation?</h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">Book a consultation with our enterprise team. We will audit your current operations and show you exactly how MartPoint Enterprise fits your distribution network.</p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="erp">
                  <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20run%20a%20distribution%20business%20and%20I%27d%20like%20an%20enterprise%20consultation.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">Book a Consultation<ArrowRight className="ml-2 h-4 w-4" /></Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/request-quote">Request Enterprise Quote</Link>
                </Button>
              </div>
              <p className="mt-6 text-sm text-muted-foreground">Or call us directly on <a href="tel:+2348036028069" className="text-erp font-medium">+234 803 602 8069</a></p>
            </div>
          </div>
        </section>

        <FAQPageSchema faqs={faqs.map((f) => ({ question: f.q, answer: f.a }))} />
        <HowToSchema name="How MartPoint Works for Distributors" description="Step-by-step distribution workflow using MartPoint Enterprise." steps={distributionWorkflow.map((w) => ({ name: w.step, text: w.desc }))} />
      </main>
      <Footer />
    </>
  )
}
