import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/shared/section-header"
import {
  ArrowRight,
  Calculator,
  Truck,
  Users,
  HeartHandshake,
  FileCheck,
  BarChart3,
  Shield,
  Globe,
  Clock,
  CheckCircle,
} from "lucide-react"

export const metadata: Metadata = {
  title: "MartPoint ERP — Business Management Software",
  description:
    "Enterprise software for accounting, procurement, HR, CRM, and operations. Built for Nigerian distributors, wholesalers, and multi-branch businesses.",
}

const capabilities = [
  {
    icon: Calculator,
    title: "Accounting & Finance",
    description:
      "General ledger, accounts payable and receivable, bank reconciliation, and tax reporting. Built for Nigerian GAAP and tax structures.",
  },
  {
    icon: Truck,
    title: "Procurement",
    description:
      "Purchase orders, supplier management, goods receipt, and three-way matching. Track every order from request to payment.",
  },
  {
    icon: Users,
    title: "Human Resources",
    description:
      "Employee records, attendance tracking, leave management, payroll processing, and performance reviews.",
  },
  {
    icon: HeartHandshake,
    title: "CRM",
    description:
      "Customer profiles, sales pipeline, communication history, and opportunity tracking. Know every relationship.",
  },
  {
    icon: FileCheck,
    title: "Approvals & Workflow",
    description:
      "Multi-level approval chains for purchases, expenses, and leave requests. Audit trails for every decision.",
  },
  {
    icon: BarChart3,
    title: "Reporting & Analytics",
    description:
      "Executive dashboards, financial statements, operational KPIs, and custom reports. Data that drives decisions.",
  },
]

const departments = [
  { name: "Finance", role: "Tracks every naira. Manages budgets, cash flow, and compliance." },
  { name: "Procurement", role: "Controls purchasing. Matches orders to receipts to invoices." },
  { name: "HR", role: "Manages people. Attendance, payroll, leave, and growth tracking." },
  { name: "Operations", role: "Oversees execution. Monitors workflows and resolves bottlenecks." },
  { name: "Sales", role: "Drives revenue. Manages customers, deals, and pipeline." },
  { name: "Management", role: "Sees everything. Dashboards, reports, and strategic insights." },
]

export default function MartPointERPPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24 lg:py-32">
            <div className="max-w-3xl">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-erp mb-4">
                MartPoint ERP
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-extrabold tracking-tight leading-[1.05] text-foreground">
                One system that connects every department in your business
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl">
                Accounting, procurement, HR, CRM, approvals, and reporting — all
                connected. Built for Nigerian distributors, wholesalers, and
                multi-branch enterprises.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Button asChild size="lg" variant="erp">
                  <Link href="/book-demo">
                    Book a Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/request-quote">Request a Quote</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Department Connections */}
        <section className="w-full bg-muted py-16 md:py-24 lg:py-32">
          <div className="container-martpoint">
            <SectionHeader
              label="Connected Operations"
              headline="How your departments work together in MartPoint ERP"
              description="No more information silos. Every department sees what they need, when they need it — connected through one platform."
            />
            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {departments.map((dept) => (
                <div
                  key={dept.name}
                  className="rounded-xl border border-border bg-background p-6 transition-all duration-200 hover:border-erp/30 hover:shadow-sm"
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-2 h-2 rounded-full bg-erp" />
                    <h3 className="text-base font-semibold text-foreground">
                      {dept.name}
                    </h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {dept.role}
                  </p>
                </div>
              ))}
            </div>

            {/* Process Flow Visual */}
            <div className="mt-12 rounded-2xl border border-border bg-background p-8 md:p-10">
              <h3 className="text-lg font-semibold text-foreground mb-6">
                A purchase request flows like this:
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {[
                  { who: "Operations", action: "Creates request", detail: "Items needed, supplier, budget" },
                  { who: "Manager", action: "Reviews & approves", detail: "Checks budget and priority" },
                  { who: "Procurement", action: "Issues PO", detail: "Sends to supplier with terms" },
                  { who: "Warehouse", action: "Receives goods", detail: "Verifies quantity and quality" },
                  { who: "Finance", action: "Processes payment", detail: "Three-way match & settlement" },
                ].map((step, i) => (
                  <div key={i} className="relative">
                    <div className="rounded-xl bg-erp-soft border border-erp-muted p-4">
                      <div className="text-xs font-semibold uppercase tracking-wider text-erp mb-1">
                        {step.who}
                      </div>
                      <div className="text-sm font-semibold text-foreground mb-1">
                        {step.action}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {step.detail}
                      </div>
                    </div>
                    {i < 4 && (
                      <div className="hidden md:block absolute top-1/2 -right-2 transform -translate-y-1/2 z-10">
                        <ArrowRight className="w-4 h-4 text-erp/40" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Capabilities */}
        <section className="w-full bg-background py-16 md:py-24 lg:py-32">
          <div className="container-martpoint">
            <SectionHeader
              label="Capabilities"
              headline="Everything your enterprise needs to operate at scale"
            />
            <div className="mt-14 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {capabilities.map((cap) => (
                <div
                  key={cap.title}
                  className="rounded-xl border border-border bg-card p-6 transition-all duration-200 hover:border-erp/30 hover:shadow-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-erp-soft flex items-center justify-center mb-4">
                    <cap.icon className="w-5 h-5 text-erp" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {cap.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {cap.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why ERP */}
        <section className="w-full bg-erp-soft border-y border-erp-muted py-16 md:py-24">
          <div className="container-martpoint">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                  Built for businesses that have outgrown spreadsheets
                </h2>
                <div className="mt-8 space-y-5">
                  {[
                    { icon: Shield, text: "Role-based access — staff only see what they need" },
                    { icon: Globe, text: "Multi-branch consolidation in one dashboard" },
                    { icon: Clock, text: "Audit trails for every transaction and approval" },
                    { icon: CheckCircle, text: "Scales from 10 employees to 500 without switching platforms" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <item.icon className="w-5 h-5 text-erp mt-0.5 shrink-0" />
                      <span className="text-foreground">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-erp-muted bg-white p-8">
                <div className="text-xs font-semibold uppercase tracking-wider text-erp mb-3">
                  Customer Story
                </div>
                <blockquote className="text-lg text-foreground leading-relaxed italic">
                  &ldquo;Placeholder — real customer testimonial will be added
                  here once collection is complete.&rdquo;
                </blockquote>
                <div className="mt-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-erp/10 flex items-center justify-center text-erp font-bold text-sm">
                    MP
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">
                      MartPoint Customer
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Enterprise Business, Nigeria
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                Ready to unify your business operations?
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Book a demo and see how MartPoint ERP connects your departments,
                automates your workflows, and gives you control.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="erp">
                  <Link href="/book-demo">
                    Book a Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/request-quote">Request a Quote</Link>
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
