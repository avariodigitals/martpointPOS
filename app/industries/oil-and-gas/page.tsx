import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Building2, Check, ChevronDown, ClipboardCheck, Droplets, Fuel, Gauge, Layers3, Truck, Users } from "lucide-react"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/shared/section-header"
import { BreadcrumbSchema, FAQPageSchema } from "@/components/structured-data"
import { oilAndGas } from "@/lib/industries"

export const revalidate = 86400

const consultationHref = "/book-demo?product=erp&industry=oil-and-gas"
const quoteHref = "/request-quote?product=erp&industry=oil-and-gas"
const pageUrl = "https://martpoint.com.ng/industries/oil-and-gas"

export const metadata: Metadata = {
  title: { absolute: oilAndGas.seo.title },
  description: oilAndGas.seo.description,
  alternates: { canonical: "/industries/oil-and-gas" },
  openGraph: {
    title: oilAndGas.seo.title,
    description: oilAndGas.seo.description,
    url: pageUrl,
    type: "website",
    locale: "en_NG",
    siteName: "MartPoint",
    images: [{ url: "/industries/oil-and-gas/opengraph-image", width: 1200, height: 630, alt: "MartPoint for Oil & Gas — connected commercial operations" }],
  },
  twitter: {
    card: "summary_large_image",
    title: oilAndGas.seo.title,
    description: oilAndGas.seo.description,
    images: ["/industries/oil-and-gas/opengraph-image"],
  },
}

const businesses = [
  {
    icon: Fuel, title: "Filling Stations & Forecourts",
    points: ["Fuel sales records", "Attendant and shift accountability", "Cash and payment reconciliation", "Stock monitoring", "Fleet and customer credit accounts", "Branch-level reporting"],
    note: "Pump readings, tank dips and equipment integration must be assessed separately.",
  },
  {
    icon: Droplets, title: "LPG Plants & Gas Retailers",
    points: ["Gas purchases and stock records", "Plant and retail point visibility", "Cylinder sales and exchanges", "Customer and distributor accounts", "Daily quantity reconciliation", "Sales and financial reports"],
    note: "Cylinder lifecycle management, weighing systems and specialised reconciliation require validation.",
  },
  {
    icon: Gauge, title: "CNG Stations & Fleet Supply",
    points: ["Commercial sales recording", "Fleet customer accounts", "Quantity-based stock and sales records", "Payment collection", "Operational reporting"],
    note: "Compressor, cascade, meter and dispensing integrations are specialist requirements subject to discovery.",
  },
  {
    icon: Truck, title: "Bulk Petroleum Trading & Distribution",
    points: ["PMS, AGO, DPK and other product records", "Supplier and procurement management", "Bulk customer orders", "Warehouse and depot visibility", "Dispatch documentation", "Invoicing, receivables and collections"],
    note: "Bulk quantity reconciliation and logistics integration require assessment.",
  },
  {
    icon: Layers3, title: "Base Oil, Lubricants & Chemical Suppliers",
    points: ["Product catalogue and inventory", "Wholesale and distributor sales", "Purchase records", "Customer credit management", "Warehouse stock visibility", "Financial reporting"],
    note: "Blending, quality assurance and chemical batch traceability are requirements to evaluate during discovery.",
  },
  {
    icon: Users, title: "Corporate Fuel & Dealer Networks",
    points: ["B2B customer records", "Contract and account visibility", "Customer invoicing", "Credit balances", "Payment and collections reporting", "Centralised management oversight"],
    note: "Contract automation and fleet integrations require separate validation and scoping.",
  },
]

const requirements = [
  "Pump readings and shift reconciliation",
  "Tank dipping and product variance reporting",
  "LPG quantity and cylinder movement reconciliation",
  "CNG dispensing and cascade records",
  "Bulk loading, dispatch and delivery reconciliation",
  "Fleet and dealer account workflows",
  "Product batch, blending and quality records",
  "Multi-company financial consolidation",
  "Existing system, meter or hardware integrations",
  "Industry-specific control, reporting and compliance requirements",
]

const implementation = [
  { title: "Discover", desc: "We discuss your existing processes, locations, systems, challenges and operational requirements." },
  { title: "Map", desc: "We identify what existing MartPoint capabilities cover and what needs configuration, integration or additional development." },
  { title: "Demonstrate", desc: "We walk through relevant workflows and validate the proposed solution with your team." },
  { title: "Recommend", desc: "We provide a proposed solution scope, implementation approach and commercial quotation." },
]

function Points({ items }: { items: string[] }) {
  return <ul className="space-y-3">{items.map((item) => <li key={item} className="flex gap-3 text-sm leading-relaxed"><Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-retail" /><span>{item}</span></li>)}</ul>
}

export default function OilAndGasPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="border-b border-border bg-background">
          <div className="container-martpoint pb-16 pt-8 md:pb-24">
            <nav aria-label="Breadcrumb" className="mb-10 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Link href="/" className="hover:text-retail">Home</Link><span aria-hidden="true">/</span>
              <Link href="/industries" className="hover:text-retail">Industries</Link><span aria-hidden="true">/</span>
              <span aria-current="page">Oil &amp; Gas Operations</span>
            </nav>
            <div className="grid min-w-0 items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-14">
              <div className="min-w-0">
                <p className="mb-5 text-xs font-semibold uppercase tracking-widest text-retail">{oilAndGas.hero.label}</p>
                <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight text-foreground md:text-5xl xl:text-[3.5rem]">{oilAndGas.hero.headline}</h1>
                <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{oilAndGas.hero.paragraph}</p>
                <p className="mt-5 border-l-2 border-retail-muted pl-4 text-sm leading-relaxed text-foreground">For businesses with more complex requirements, we recommend a tailored MartPoint ERP engagement built around your existing processes.</p>
                <div className="mt-8 flex flex-col gap-3 sm:items-start">
                  <Button asChild size="lg" className="h-auto min-h-14 w-full whitespace-normal px-5 text-center text-base sm:w-auto"><Link href={consultationHref}>{oilAndGas.hero.ctaText}<ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link></Button>
                  <Button asChild variant="outline" className="w-full sm:w-auto"><Link href="/martpoint-erp">Explore MartPoint ERP</Link></Button>
                </div>
                <p className="mt-5 flex items-center gap-2 text-xs text-muted-foreground"><ClipboardCheck aria-hidden="true" className="h-4 w-4 text-retail" />Industry-specific workflow assessment.</p>
              </div>
              <figure className="min-w-0 overflow-hidden rounded-3xl border border-retail/15 bg-card shadow-sm">
                <Image src="/images/industries/oil-and-gas.svg" alt="Illustration of a filling station, LPG cylinders and distribution depot connected to shared business records." width={1000} height={800} priority className="h-auto w-full" />
                <div className="grid grid-cols-2 gap-px border-t border-border bg-border text-xs font-medium text-foreground">
                  {["Sales Overview", "Inventory Movement", "Customer Receivables", "Multi-Location Reporting"].map((label) => <div key={label} className="flex items-center gap-2 bg-card p-4"><span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-retail" />{label}</div>)}
                </div>
                <figcaption className="bg-card px-4 py-3 text-xs text-muted-foreground">Illustrative operational view. Detailed workflows are agreed during discovery.</figcaption>
              </figure>
            </div>
          </div>
        </section>

        <section className="bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader label="Connected Operations" headline="Your Business Moves Across Locations. Your Information Shouldn't Be Scattered." description="Downstream oil and gas operations connect people, products, payments and locations. Give your commercial records a clearer structure." />
            <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{oilAndGas.painPoints.map((item) => <article key={item.title} className="rounded-2xl border border-border bg-card p-7"><item.icon aria-hidden="true" className="mb-5 h-6 w-6 text-retail" /><h3 className="mb-3 text-lg font-semibold">{item.title}</h3><p className="text-sm leading-relaxed text-muted-foreground">{item.desc}</p></article>)}</div>
          </div>
        </section>

        <section className="bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader label="Built Around Your Operations" headline="Different Energy Businesses. Different Operational Requirements." description="From a single forecourt to a distribution network, the starting point is your workflow. These are typical requirements to discuss, with suitability confirmed during assessment." />
            <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">{businesses.map((business) => <article key={business.title} className="flex flex-col rounded-2xl border border-border bg-card p-7"><div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-retail-soft"><business.icon aria-hidden="true" className="h-6 w-6 text-retail" /></div><h3 className="mb-3 text-xl font-bold">{business.title}</h3><p className="mb-5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Typical requirements</p><Points items={business.points} /><p className="mt-6 border-t border-border pt-5 text-xs leading-relaxed text-muted-foreground">{business.note}</p></article>)}</div>
          </div>
        </section>

        <section className="border-y border-border bg-muted py-16 md:py-24" id="solution-fit">
          <div className="container-martpoint">
            <SectionHeader label="The Right MartPoint Solution" headline="Start With What You Need. Connect More As Your Operations Grow." description="Choose a starting point around your immediate needs, then validate the configuration and implementation scope with our team." />
            <div className="mx-auto mt-12 grid max-w-5xl gap-6 lg:grid-cols-2">
              <article className="flex flex-col rounded-2xl border border-border bg-card p-7 md:p-9"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Retail Operations Entry Point</p><h3 className="text-2xl font-bold">MartPoint Retail</h3><p className="mb-6 mt-3 text-lg font-medium">Bring Daily Sales and Stock Under Control</p><Points items={["Point-of-sale transactions", "Inventory records", "Customer accounts", "Payment tracking", "Basic reporting", "Retail outlet management"]} /><div className="mt-auto pt-8"><Button asChild variant="outline" className="h-auto min-h-12 whitespace-normal text-center"><Link href="/martpoint-retail">Explore MartPoint Retail</Link></Button><p className="mt-4 text-xs leading-relaxed text-muted-foreground">Suitability depends on your products, operating units and required workflow.</p></div></article>
              <article className="flex flex-col rounded-2xl border-2 border-retail/40 bg-retail-soft p-7 md:p-9"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-retail">Recommended for Complex Operations</p><h3 className="text-2xl font-bold">MartPoint ERP</h3><p className="mb-6 mt-3 text-lg font-medium">Connect Your Departments, Locations and Financial Processes</p><Points items={["Central procurement", "Warehouse and stock administration", "Multi-location reporting", "Customer and supplier account management", "Finance and accounting workflows", "Staff roles and approvals", "Management reporting", "Tailored operational processes"]} /><div className="mt-auto pt-8"><Button asChild className="h-auto min-h-12 w-full whitespace-normal px-4 text-center"><Link href={consultationHref}>Discuss Your ERP Requirements</Link></Button><p className="mt-4 text-xs leading-relaxed text-muted-foreground">A tailored scope and quotation follow discovery. Specialist workflows, development and integrations are assessed separately.</p></div></article>
            </div>
          </div>
        </section>

        <section className="bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader label="How It Connects" headline="From Product Receipt to Management Reporting." />
            <ol className="mt-12 grid gap-6 md:grid-cols-3 xl:grid-cols-6">{oilAndGas.solutions.map((step, index) => <li key={step.title} className="relative border-l-2 border-retail-muted pl-5 xl:border-l-0 xl:border-t-2 xl:pl-0 xl:pt-5"><span className="text-sm font-bold text-retail">0{index + 1}</span><step.icon aria-hidden="true" className="mb-4 mt-4 h-6 w-6 text-foreground" /><h3 className="mb-3 font-semibold">{step.title}</h3><p className="text-sm leading-relaxed text-muted-foreground">{step.desc}</p></li>)}</ol>
            <p className="mt-10 rounded-xl border border-border bg-muted p-5 text-sm leading-relaxed text-muted-foreground">Petroleum-specific measurements, dispatch events and reconciliations are defined during discovery. This illustrates a configured commercial workflow; equipment connectivity is subject to technical assessment.</p>
          </div>
        </section>

        <section className="bg-erp py-16 text-white md:py-24">
          <div className="container-martpoint">
            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
              <div><p className="mb-4 text-xs font-semibold uppercase tracking-widest text-retail-muted">Configured Around Your Business</p><h2 className="text-3xl font-bold tracking-tight md:text-4xl">Your Operations May Need More Than Standard Business Software.</h2><p className="mt-6 leading-relaxed text-white/75">Oil &amp; Gas companies have different requirements depending on their facilities, processes and equipment.</p><p className="mt-5 leading-relaxed text-white/75">Examples of operational requirements we can assess and scope during implementation planning.</p><p className="mt-6 rounded-xl border border-white/20 p-5 text-sm leading-relaxed text-white/80">These are discovery topics, not a list of built-in features. Availability, compatibility, development effort and any regulatory requirements must be validated. No petroleum compliance certification is implied.</p></div>
              <ol className="grid gap-x-6 sm:grid-cols-2">{requirements.map((requirement, index) => <li key={requirement} className="flex gap-3 border-b border-white/15 py-5"><span className="text-xs font-semibold text-retail-muted">{String(index + 1).padStart(2, "0")}</span><span className="text-sm leading-relaxed text-white/90">{requirement}</span></li>)}</ol>
            </div>
          </div>
        </section>

        <section className="bg-muted py-16 md:py-24">
          <div className="container-martpoint"><SectionHeader label="Implementation Approach" headline="We Understand Your Operations Before Recommending the System." description="Every enterprise engagement is evaluated individually, with a clear scope before implementation begins." /><ol className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">{implementation.map((step, index) => <li key={step.title} className="rounded-2xl border border-border bg-card p-7"><p className="mb-6 text-3xl font-light text-retail">0{index + 1}</p><h3 className="mb-3 text-xl font-bold">{step.title}</h3><p className="text-sm leading-relaxed text-muted-foreground">{step.desc}</p></li>)}</ol></div>
        </section>

        <section className="bg-background py-16 md:py-24">
          <div className="container-martpoint max-w-3xl"><SectionHeader label="Frequently Asked Questions" headline="Planning Your Oil & Gas Implementation" /><div className="mt-10 space-y-4">{oilAndGas.faqs.map((faq) => <details key={faq.q} className="group rounded-xl border border-border bg-card p-5"><summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold"><span>{faq.q}</span><ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" /></summary><p className="mt-4 text-sm leading-relaxed text-muted-foreground">{faq.a}</p></details>)}</div></div>
        </section>

        <section className="border-y border-retail-muted bg-retail-soft py-16 md:py-24">
          <div className="container-martpoint mx-auto max-w-4xl text-center"><Building2 aria-hidden="true" className="mx-auto mb-5 h-8 w-8 text-retail" /><h2 className="text-3xl font-bold tracking-tight md:text-4xl">Let&apos;s Understand How Your Energy Business Operates.</h2><p className="mt-5 text-lg leading-relaxed text-muted-foreground">Whether you manage a retail fuel outlet, LPG plant, distribution network or multiple business locations, let&apos;s identify where connected systems can improve visibility and control.</p><div className="mt-8 flex flex-col justify-center gap-4 sm:flex-row"><Button asChild className="h-auto min-h-14 whitespace-normal px-5 text-center"><Link href={consultationHref}>Book an Oil &amp; Gas Consultation</Link></Button><Button asChild variant="outline" className="h-auto min-h-14 whitespace-normal px-5 text-center"><Link href={quoteHref}>Request a Tailored Quote<ArrowRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link></Button></div><p className="mt-8 text-sm text-muted-foreground">Also explore <Link href="/industries/distributors" className="font-medium text-retail underline underline-offset-4">distribution operations</Link> and <Link href="/industries/wholesalers" className="font-medium text-retail underline underline-offset-4">wholesale management</Link>.</p></div>
        </section>
      </main>
      <BreadcrumbSchema items={[{ name: "Home", href: "/" }, { name: "Industries", href: "/industries" }, { name: oilAndGas.name, href: "/industries/oil-and-gas" }]} />
      <FAQPageSchema faqs={oilAndGas.faqs.map((faq) => ({ question: faq.q, answer: faq.a }))} />
      <Footer />
    </>
  )
}
