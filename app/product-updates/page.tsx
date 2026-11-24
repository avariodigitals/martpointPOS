export const revalidate = 86400
import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { BreadcrumbSchema, FAQPageSchema } from "@/components/structured-data"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  Users,
  Zap,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Product Updates: MartPoint Pay, AI Ads & Customer Messaging",
  description:
    "See the latest MartPoint releases: online invoice payments with MartPoint Pay, AI Ads connected to your product catalogue, and SMS, email and automation tools.",
  keywords: [
    "MartPoint product updates", "MartPoint Pay", "retail invoice payments Nigeria",
    "AI Ads for retailers", "retail SMS campaigns", "retail email marketing",
    "sales automation software", "POS and inventory updates",
  ],
  alternates: {
    canonical: "/product-updates",
  },
  openGraph: {
    title: "MartPoint Product Updates: Payments, AI Ads & Customer Messaging",
    description:
      "Run retail operations and customer growth from one connected system: online invoice payments, AI Ads, SMS, email and automation.",
    url: "https://martpoint.com.ng/product-updates",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MartPoint Product Updates",
    description:
      "Explore MartPoint Pay, AI Ads, SMS and email campaigns, and customer follow-up automation.",
  },
}

const latestReleases = [
  {
    month: "November 2026",
    items: [
      {
        title: "AI Ads — Turn Product Knowledge Into Campaigns",
        description: "Plan Meta campaigns from the products you already manage in MartPoint. AI helps prepare ad copy and creative, while the campaign workspace keeps drafts, publishing and results alongside your retail operation.",
        value: "Choose what to promote with your catalogue and stock context close at hand. Your sales and inventory stay in MartPoint; advertising spend is charged separately by Meta to your advertising account.",
      },
      {
        title: "MartPoint Pay — Online Invoice Payments",
        description: "Send customers an invoice with a secure online card-payment option. When an invoice is paid, the payment is verified and the invoice balance updates in MartPoint.",
        value: "MartPoint Pay is the name of MartPoint’s in-app payment experience. Card transactions are processed by integrated payment providers (currently Paystack for invoice checkout); MartPoint is retail software, not a fintech or financial institution, and does not itself process or hold customer funds.",
      },
    ],
  },
  {
    month: "October 2026",
    items: [
      {
        title: "SMS & Email Campaigns",
        description: "Reach customers from the same workspace where you manage sales and customer records. Prepare and send SMS or email campaigns to selected audiences, then review delivery and engagement activity.",
        value: "Keep customers informed about new stock, offers and store news without exporting contact lists into separate tools. SMS and email delivery charges may apply.",
      },
      {
        title: "Customer Follow-up Automation",
        description: "Set up scheduled follow-ups for supported customer and sales events, including new leads, meetings, questionnaires, estimates and quotes. Email workflows can also help follow up on unpaid invoices.",
        value: "MartPoint can keep the next follow-up moving while your team focuses on customers. Workflows respect replies, opt-outs and approval settings, so your business stays in control of what is sent.",
      },
    ],
  },
  {
    month: "September 2026",
    items: [
      {
        title: "Digital Creator Support",
        description: "MartPoint Retail is now deployed for digital creators — sell online courses, ebooks, templates and downloads with payments, access control and customer tracking built in.",
        value: "Creators can sell digital products without stitching together payment links, spreadsheets and manual delivery.",
      },
      {
        title: "Automobile & Car Sales",
        description: "Live deployments for automobile businesses: track every vehicle by make, model, year, colour and VIN, plus test drives, customer deposits and trade-ins.",
        value: "Dealers manage high-value stock and instalment sales in one place instead of paper records.",
      },
      {
        title: "Perfume Shops",
        description: "Dedicated setup for fragrance retailers — bottle-level stock tracking, tester bottle management and low-stock alerts for high-value inventory.",
        value: "Perfume retailers protect expensive stock and finally see which fragrances actually sell.",
      },
      {
        title: "Frozen Foods & Local Restaurants",
        description: "New deployments for frozen food businesses and bukka/mama put restaurants, with expiry and batch tracking for frozen stock and fast counter service flows.",
        value: "Food businesses reduce waste from expired stock and serve customers faster at the counter.",
      },
    ],
  },
  {
    month: "July 2026",
    items: [
      {
        title: "MartPoint Intelligence — General Availability",
        description: "Our proactive insights engine is now fully launched: daily summaries of sales trends, low stock, expiring products and staff performance across every branch.",
        value: "Owners start each day knowing exactly what needs attention, without digging through reports.",
      },
    ],
  },
  {
    month: "June 2026",
    items: [
      {
        title: "MartPoint Intelligence",
        description: "Proactive business alerts that highlight sales trends, low stock, expiring products and staff performance before problems develop.",
        value: "Owners now receive daily summaries showing exactly what needs attention across every branch.",
      },
      {
        title: "WhatsApp Ordering",
        description: "Customers can browse products and place orders directly through WhatsApp. Orders flow into the system automatically with no extra setup.",
        value: "Retailers using WhatsApp Ordering report higher repeat purchase rates and reduced order-taking time.",
      },
      {
        title: "Customer Loyalty Program",
        description: "Built-in loyalty points, tiered rewards and birthday discounts that work across all branches without third-party integrations.",
        value: "Fashion retailers and supermarkets are using loyalty data to identify their best customers and increase average basket size.",
      },
    ],
  },
  {
    month: "May 2026",
    items: [
      {
        title: "Online Store Integration",
        description: "Sync inventory between your physical locations and online storefront automatically. Stock levels update in real time across every channel.",
        value: "Fashion boutiques no longer oversell online. When the last item sells in-store, the online listing updates instantly.",
      },
      {
        title: "PayPlan Installment Dashboard",
        description: "Track customer deposits, outstanding balances and payment schedules for high-value purchases in one dedicated view.",
        value: "Electronics stores and furniture retailers report fewer missed collections and clearer payment visibility.",
      },
      {
        title: "QR Menu for Restaurants",
        description: "Diners scan a QR code at their table, browse the menu and place orders that route directly to the kitchen printer.",
        value: "Restaurants using QR Menu have reduced order errors and turned tables faster during peak hours.",
      },
    ],
  },
  {
    month: "April 2026",
    items: [
      {
        title: "Attendance & Staff Management",
        description: "Clock-in, clock-out and shift tracking linked directly to sales performance. See which staff are working and how their shifts compare to revenue.",
        value: "Multi-branch supermarkets now reconcile labour costs against daily sales without manual spreadsheets.",
      },
      {
        title: "Multi-Branch Stock Transfer",
        description: "Move inventory between locations with full tracking. Each transfer updates stock at both the sending and receiving branch automatically.",
        value: "Pharmacies with multiple locations no longer lose track of stock movements between branches.",
      },
      {
        title: "Barcode Improvements",
        description: "Faster scanning, support for more barcode formats and better handling of damaged labels at checkout.",
        value: "Supermarkets report smoother checkout during rush hour with fewer manual overrides.",
      },
    ],
  },
  {
    month: "March 2026",
    items: [
      {
        title: "MartPoint Enterprise Launch",
        description: "Full ERP suite with accounting, procurement, HR, CRM and multi-level approvals for distributors, wholesalers and growing enterprises.",
        value: "Distributors now manage suppliers, staff and finances in the same system they use for sales and inventory.",
      },
      {
        title: "Enhanced Offline Reliability",
        description: "Continue selling and recording stock even without internet. Data syncs automatically when connectivity returns.",
        value: "Restaurants in areas with unstable networks no longer lose sales or stock records during outages.",
      },
    ],
  },
]

const performanceImprovements = [
  {
    title: "Dashboard Load Speed",
    description: "Branch dashboards now load faster, even for businesses tracking hundreds of products across multiple locations.",
  },
  {
    title: "Report Generation",
    description: "Daily sales, profit and inventory reports generate more quickly for high-transaction businesses.",
  },
  {
    title: "Mobile Optimisation",
    description: "Key dashboard views and inventory checks are now easier to use on smartphones and tablets.",
  },
  {
    title: "Export Flexibility",
    description: "Sales and inventory data now export cleanly to Excel and PDF formats for accounting and audit purposes.",
  },
]

const comingSoon = [
  {
    title: "Mobile Manager App",
    status: "In Development",
    description: "Approve purchases, view live sales and monitor branch performance from your phone.",
  },
  {
    title: "Supplier Portal",
    status: "Coming Soon",
    description: "Give suppliers direct access to purchase orders, delivery schedules and payment status.",
  },
  {
    title: "Public API",
    status: "In Development",
    description: "Connect MartPoint to your website, accounting software and third-party tools securely.",
  },
  {
    title: "Advanced Analytics",
    status: "Coming Soon",
    description: "Deeper insights into seasonal trends, customer behaviour and long-term business patterns.",
  },
  {
    title: "Accounting Integrations",
    status: "Coming Soon",
    description: "Direct sync with popular accounting packages to reduce manual reconciliation.",
  },
]

const feedbackSources = [
  "Supermarkets needing real-time visibility across multiple branches",
  "Pharmacies requiring batch tracking and expiry alerts",
  "Restaurants struggling with kitchen communication and order accuracy",
  "Fashion retailers managing thousands of size and colour variants",
  "Beauty salons tracking appointments, products and commissions",
  "Distributors coordinating stock between warehouses and retail outlets",
]

export default function ProductUpdatesPage() {
  const featureFaqs = [
    {
      question: "What is MartPoint Pay?",
      answer: "MartPoint Pay is the name of MartPoint’s in-app online payment experience for customer invoices. Card payments are processed by an integrated payment provider; invoice card checkout currently uses Paystack. MartPoint is not a fintech or financial institution and does not itself process or hold customer funds.",
    },
    {
      question: "Can customers pay a MartPoint invoice online by card?",
      answer: "Yes. A customer can open the invoice payment link and pay an eligible NGN invoice online by card through Paystack. The payment is verified and applied to the invoice in MartPoint. Bank transfer details can also be included where the business has provided them.",
    },
    {
      question: "What does MartPoint AI Ads do?",
      answer: "AI Ads helps a retailer prepare product-led Meta advertising campaigns from the MartPoint workspace, including AI-assisted ad copy and creative. The retailer connects their Meta account and controls campaign publishing and spend; Meta charges advertising spend directly to that account.",
    },
    {
      question: "Can MartPoint send SMS and email campaigns or automate follow-ups?",
      answer: "MartPoint supports SMS and email campaigns for selected audiences and scheduled follow-up workflows for supported events such as leads, meetings, estimates and quotes. Email workflows can also follow up on unpaid invoices. Availability depends on the business setup and configured messaging services.",
    },
  ]

  return (
    <>
      <BreadcrumbSchema items={[
        { name: "Home", href: "/" },
        { name: "Product Updates", href: "/product-updates" },
      ]} />
      <FAQPageSchema faqs={featureFaqs} />
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24 lg:py-32">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-4">
                Official Changelog
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.05] text-foreground">
                Product Updates
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                New ways to collect invoice payments, market products and keep customer conversations moving — all connected to the system that runs your stock and sales.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="https://wa.me/+2348037978230?text=Hi%2C%20I%27m%20interested%20in%20MartPoint.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/book-demo">Book a Demo</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Latest Releases */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-4xl">
            <SectionHeader
              label="Shipped"
              headline="Latest Releases"
              description="Recent releases for retail payments, customer marketing and sales follow-up — alongside the POS and inventory tools your team already uses."
            />
            <div className="mt-14 space-y-16">
              {latestReleases.map((group) => (
                <div key={group.month} className="pt-4">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-8">
                    {group.month}
                  </h3>
                  <div className="space-y-8">
                    {group.items.map((item) => (
                      <div
                        key={item.title}
                        className="rounded-xl border border-border bg-background p-6 md:p-8 transition-all duration-200 hover:shadow-sm"
                      >
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle2 className="w-5 h-5 text-retail" />
                          <h4 className="text-lg font-bold text-foreground">
                            {item.title}
                          </h4>
                        </div>
                        <p className="text-base text-muted-foreground leading-relaxed mb-3">
                          {item.description}
                        </p>
                        <p className="text-base text-foreground font-medium leading-relaxed">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Clear answers for customers and search engines */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint max-w-4xl">
            <SectionHeader
              label="Feature Guide"
              headline="Payments and marketing, connected to retail operations"
              description="Short answers about MartPoint Pay, AI Ads and customer messaging."
            />
            <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-5">
              {featureFaqs.map((faq) => (
                <article key={faq.question} className="rounded-xl border border-border bg-card p-6">
                  <h3 className="text-base font-semibold text-foreground">{faq.question}</h3>
                  <p className="mt-3 text-base leading-relaxed text-muted-foreground">{faq.answer}</p>
                </article>
              ))}
            </div>
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Explore <Link className="font-medium text-retail underline underline-offset-4" href="/martpoint-retail">MartPoint Retail</Link> or compare <Link className="font-medium text-retail underline underline-offset-4" href="/pricing">plans and pricing</Link>.
            </p>
          </div>
        </section>

        {/* Performance & Improvements */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint max-w-4xl">
            <SectionHeader
              label="Improvements"
              headline="Performance & Reliability"
              description="Behind-the-scenes upgrades that make MartPoint faster, more reliable and easier to use every day."
            />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-4xl mx-auto">
              {performanceImprovements.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-retail" />
                    <h4 className="text-sm font-semibold text-foreground">
                      {item.title}
                    </h4>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Built From Customer Feedback */}
        <section className="w-full bg-[#023047] py-16 md:py-24">
          <div className="container-martpoint max-w-4xl">
            <div className="max-w-3xl mx-auto text-center mb-14">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-4">
                How We Build
              </span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
                Built From Customer Feedback
              </h2>
              <p className="mt-4 text-lg text-white/70 leading-relaxed">
                Every feature on this page exists because a business owner told us what they needed. We do not build in isolation. We build with the businesses that use MartPoint every day.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
              {feedbackSources.map((source) => (
                <div
                  key={source}
                  className="rounded-xl bg-white/5 border border-white/10 p-6 text-center transition-all duration-200 hover:bg-white/10"
                >
                  <Users className="w-6 h-6 text-retail mx-auto mb-3" />
                  <p className="text-sm text-white/90 leading-relaxed">
                    {source}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Coming Soon */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-4xl">
            <SectionHeader
              label="Roadmap"
              headline="Coming Soon"
              description="Features we are actively building. Want early access? Get in touch."
            />
            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 gap-6">
              {comingSoon.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-border bg-background p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                        item.status === "In Development"
                          ? "bg-blue-600 text-white"
                          : "bg-amber-500 text-white"
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {item.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              <Button asChild variant="retail">
                <Link
                  href="https://wa.me/+2348037978230?text=Hi%2C%20I%20want%20early%20access%20to%20upcoming%20MartPoint%20features.%20Can%20you%20add%20me%20to%20the%20early%20access%20list%3F"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Request Early Access
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="w-full bg-retail-soft border-y border-retail-muted py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Stay Ahead of Every Update
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Get notified when new features ship. Join the update list to see what is coming next.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link
                    href="https://wa.me/+2348037978230?text=Hi%2C%20I%20want%20to%20stay%20updated%20on%20MartPoint%20features.%20Can%20you%20add%20me%20to%20your%20update%20list%3F"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Get Product Updates
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/book-demo">Book a Demo</Link>
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
