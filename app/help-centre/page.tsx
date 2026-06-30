export const revalidate = 86400
import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  Search,
  Rocket,
  ShoppingCart,
  Package,
  CreditCard,
  HandCoins,
  Gift,
  BarChart3,
  Wrench,
  MessageCircle,
  ChevronDown,
} from "lucide-react"

export const metadata: Metadata = {
  title: "Help Centre — MartPoint Support",
  description:
    "Find answers, guides and support for MartPoint Retail and Enterprise. Search our knowledge base or contact our support team.",
}

const categories = [
  {
    icon: Rocket,
    title: "Getting Started",
    description: "Installation, setup, onboarding and first steps with MartPoint.",
    articles: [
      "How to install MartPoint Retail",
      "Setting up your first branch",
      "Adding products and categories",
      "Configuring payment methods",
      "Staff accounts and permissions",
    ],
  },
  {
    icon: ShoppingCart,
    title: "Sales & POS",
    description: "Checkout, receipts, refunds, split payments and sales reporting.",
    articles: [
      "Processing a sale at checkout",
      "Handling returns and refunds",
      "Split payments and partial payments",
      "Printing and sending receipts",
      "Daily sales reconciliation",
    ],
  },
  {
    icon: Package,
    title: "Inventory",
    description: "Stock management, transfers, expiry tracking and reordering.",
    articles: [
      "Adding and editing products",
      "Stock transfers between branches",
      "Setting low-stock alerts",
      "Tracking batch numbers and expiry dates",
      "Physical stock count procedures",
    ],
  },
  {
    icon: CreditCard,
    title: "Payments",
    description: "Cash, card, transfer, mobile money and payment reconciliation.",
    articles: [
      "Recording transfer payments",
      "Reconciling daily cash and card takings",
      "Setting up PayPlan installment plans",
      "Payment link generation and tracking",
      "Handling disputed transactions",
    ],
  },
  {
    icon: HandCoins,
    title: "PayPlan",
    description: "Installment payments, deposit tracking and customer credit.",
    articles: [
      "Creating an installment plan",
      "Tracking customer deposits and balances",
      "PayPlan reminders and collections",
      "Closing out completed plans",
      "PayPlan reporting for finance teams",
    ],
  },
  {
    icon: Gift,
    title: "Loyalty & Rewards",
    description: "Points, rewards, customer tiers and redemption.",
    articles: [
      "Setting up a loyalty programme",
      "Earning and redeeming points",
      "Creating customer tiers",
      "Loyalty campaign management",
      "Loyalty reporting and analytics",
    ],
  },
  {
    icon: BarChart3,
    title: "Reports",
    description: "Daily summaries, profit analysis and operational dashboards.",
    articles: [
      "Understanding the daily sales report",
      "Profit and margin analysis",
      "Staff performance reports",
      "Branch comparison dashboards",
      "Exporting reports to Excel or PDF",
    ],
  },
  {
    icon: Wrench,
    title: "Troubleshooting",
    description: "Common issues, error messages and quick fixes.",
    articles: [
      "Printer not responding",
      "Barcode scanner not working",
      "Sync errors between branches",
      "Offline mode and data recovery",
      "Login and password issues",
    ],
  },
]

const contactFAQs = [
  { q: "How do I contact MartPoint support?", a: "Message us on WhatsApp at +234 803 602 8069 or email hello@martpoint.com.ng. Our local support team responds within hours during business hours." },
  { q: "What are your support hours?", a: "We provide support Monday to Saturday, 8:00 AM to 6:00 PM WAT. Critical issues are handled outside hours for Enterprise clients." },
  { q: "Do you offer on-site support?", a: "Yes. For Enterprise clients and larger retail setups, we offer on-site training and technical support in major Nigerian cities." },
  { q: "Is there a self-service knowledge base?", a: "You are looking at it. Browse the categories above or reach out directly if you need personalised help." },
]

export default function HelpCentrePage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24 lg:py-32">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-4">
                Support
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.05] text-foreground">
                How Can We Help?
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                Find guides, troubleshooting steps and answers to common questions about MartPoint Retail and Enterprise.
              </p>
              <div className="mt-8 flex items-center gap-3 max-w-lg mx-auto rounded-xl border border-border bg-card px-4 py-3">
                <Search className="w-5 h-5 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Search for guides, topics or errors..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  readOnly
                />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Search is coming soon. Browse categories below or contact us directly.
              </p>
            </div>
          </div>
        </section>

        {/* Categories */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="Browse by Topic"
              headline="Find Answers Fast"
            />
            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {categories.map((cat) => (
                <div key={cat.title} className="rounded-xl border border-border bg-background p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mb-4">
                    <cat.icon className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{cat.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-4">{cat.description}</p>
                  <ul className="space-y-2">
                    {cat.articles.map((article) => (
                      <li key={article} className="text-sm text-muted-foreground flex items-start gap-2">
                        <span className="w-1 h-1 rounded-full bg-retail mt-2 shrink-0" />
                        {article}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader
              label="Contact Support"
              headline="Still Need Help?"
              description="Our local support team is ready to assist. Reach out and we will get you back on track."
            />
            <div className="mt-10 space-y-4">
              {contactFAQs.map((faq, i) => (
                <details key={i} className="group rounded-xl border border-border bg-card p-5 cursor-pointer">
                  <summary className="flex items-center justify-between list-none">
                    <span className="text-sm font-semibold text-foreground">{faq.q}</span>
                    <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                </details>
              ))}
            </div>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" variant="retail">
                <Link href="https://wa.me/+2348036028069?text=Hi%2C%20I%20need%20support%20with%20MartPoint.%20Can%20you%20help%3F" target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Chat on WhatsApp
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href="mailto:hello@martpoint.com.ng">Email Support</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
