export const revalidate = 60
import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { SectionHeader } from "@/components/shared/section-header"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  Target,
  HeartHandshake,
  Zap,
  Users,
  Briefcase,
  GraduationCap,
  Clock,
  Check,
  MapPin,
} from "lucide-react"
import { listPublicVacancies } from "@/lib/careers"
import { VacancyBoard } from "./vacancy-board"

export const metadata: Metadata = {
  title: "Careers — Join the MartPoint Team",
  description:
    "Build the future of African business software. Explore open roles, field deployments and the MartPoint talent pool.",
  alternates: {
    canonical: "/careers",
  },
}

const values = [
  { icon: Target, title: "Impact First", desc: "We measure success by the businesses we help grow, not just features shipped." },
  { icon: HeartHandshake, title: "Customer Obsession", desc: "We design for African business realities, not assumptions from abroad." },
  { icon: Zap, title: "Move Fast", desc: "Speed matters. We ship, learn and iterate quickly to stay ahead." },
  { icon: Users, title: "Build Together", desc: "Great products come from diverse perspectives working as one team." },
]

const benefits = [
  "Compensation and benefits vary by role and engagement type — each vacancy lists what applies",
  "Field and project roles may include daily rates, transport allowance and on-site meals",
  "Remote-friendly collaboration for eligible roles",
  "Learning and mentorship opportunities",
  "Real ownership of work that shapes how businesses run",
  "Clear, transparent hiring process with defined stages",
]

const process = [
  { step: "01", title: "Apply", desc: "Complete the vacancy-specific application form — it only takes a few minutes." },
  { step: "02", title: "Review", desc: "Our team reviews your application against the role requirements." },
  { step: "03", title: "Assessment", desc: "Shortlisted candidates may be invited to an interview or practical task." },
  { step: "04", title: "Decision", desc: "Selected candidates receive an offer; others are notified or added to our reserve list." },
]

const faqs = [
  {
    q: "How do I apply for a role?",
    a: "Open a vacancy under Current Opportunities, read the details and click Apply. Each vacancy has its own application form — you never need to type the job title yourself.",
  },
  {
    q: "Can I apply if there is no open vacancy for me?",
    a: "Yes. Join our Talent Pool and we will contact you when a role matching your skills and location opens up. Joining is optional and requires your consent.",
  },
  {
    q: "How do I check my application status?",
    a: "Use the Application Status page with your application reference and the email you applied with. You will see a safe, simplified status — internal review notes are never shared.",
  },
  {
    q: "What are field roles like?",
    a: "Field roles such as inventory projects are short-term, on-site engagements. Pay is typically daily, with transport allowance and meals where stated on the vacancy. Compensation and benefits always depend on the specific role and engagement type.",
  },
  {
    q: "Do I need a LinkedIn profile to apply?",
    a: "No. LinkedIn is always optional. Some vacancies ask for a CV or other documents — the form shows exactly what is required for that role.",
  },
  {
    q: "Will I hear back about my application?",
    a: "You can check your application status at any time using your reference number. If you consent to notifications, we will also email you when your status changes.",
  },
]

export default async function CareersPage() {
  const vacancies = await listPublicVacancies()

  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24 lg:py-32">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-4">
                Careers
              </span>
              <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight leading-[1.05] text-foreground">
                Build Software That Powers African Business
              </h1>
              <p className="mt-6 text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                MartPoint is building the operating system for African retail and growing enterprises — and the field network that powers it. Explore open roles and project deployments.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="#opportunities">View Open Roles</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/careers/talent-pool">Join Our Talent Pool</Link>
                </Button>
              </div>
              <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
                <Link href="/careers/application-status" className="underline underline-offset-4 hover:text-foreground">
                  Check application status
                </Link>
                <span aria-hidden>·</span>
                <Link href="/careers/privacy" className="underline underline-offset-4 hover:text-foreground">
                  Recruitment privacy notice
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Values */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="Culture"
              headline="How We Work"
            />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {values.map((v) => (
                <div key={v.title} className="rounded-xl border border-border bg-background p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm">
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center mb-4">
                    <v.icon className="w-5 h-5 text-retail" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{v.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{v.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
              <div>
                <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
                  What To Expect
                </span>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                  Benefits That Matter
                </h2>
                <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                  Compensation and benefits depend on the role and engagement type — permanent, contract, temporary, internship or project-based field work. Every vacancy page states exactly what that role offers.
                </p>
                <div className="mt-8 space-y-5">
                  {benefits.map((text, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-retail mt-0.5 shrink-0" />
                      <span className="text-foreground">{text}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-card p-6 text-center">
                  <GraduationCap className="w-8 h-8 text-retail mx-auto mb-3" />
                  <div className="text-sm font-semibold text-foreground">Grow With Us</div>
                  <div className="text-xs text-muted-foreground mt-1">Learning and mentorship opportunities across teams</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-6 text-center">
                  <Clock className="w-8 h-8 text-retail mx-auto mb-3" />
                  <div className="text-sm font-semibold text-foreground">Flexible Engagements</div>
                  <div className="text-xs text-muted-foreground mt-1">Permanent, contract, temporary and project roles</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-6 text-center">
                  <MapPin className="w-8 h-8 text-retail mx-auto mb-3" />
                  <div className="text-sm font-semibold text-foreground">Field Network</div>
                  <div className="text-xs text-muted-foreground mt-1">On-call inventory deployments across Nigeria</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-6 text-center">
                  <Users className="w-8 h-8 text-retail mx-auto mb-3" />
                  <div className="text-sm font-semibold text-foreground">Inclusive Team</div>
                  <div className="text-xs text-muted-foreground mt-1">Diverse perspectives build better products</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Hiring Process */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint">
            <SectionHeader
              label="How We Hire"
              headline="Our Hiring Process"
              description="Transparent and respectful. Track your application status anytime with your reference number."
            />
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
              {process.map((step) => (
                <div key={step.step} className="relative">
                  <div className="w-12 h-12 rounded-full bg-retail text-white font-bold text-base flex items-center justify-center shrink-0 shadow-sm mb-4">
                    {step.step}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Current Opportunities */}
        <section id="opportunities" className="w-full bg-background py-16 md:py-24 scroll-mt-8">
          <div className="container-martpoint max-w-4xl">
            <SectionHeader
              label="Open Positions"
              headline="Current Opportunities"
              description={vacancies.length > 0 ? `${vacancies.length} open ${vacancies.length === 1 ? "role" : "roles"}` : undefined}
            />
            <VacancyBoard vacancies={vacancies} />
          </div>
        </section>

        {/* Talent Pool CTA */}
        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <div className="rounded-2xl border border-border bg-background p-8 md:p-12 text-center">
              <div className="w-14 h-14 rounded-full bg-retail-soft flex items-center justify-center mx-auto mb-5">
                <Briefcase className="w-7 h-7 text-retail" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">Join Our Talent Pool</h2>
              <p className="mt-4 text-muted-foreground leading-relaxed max-w-xl mx-auto">
                No suitable opening right now? Join the MartPoint Talent Pool and we will reach out when a role matches your skills, location and availability — including short-notice field deployments.
              </p>
              <div className="mt-8">
                <Button asChild size="lg" variant="retail">
                  <Link href="/careers/talent-pool">Join Our Talent Pool</Link>
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Optional and consent-based. Your details are handled under our{" "}
                <Link href="/careers/privacy" className="underline underline-offset-2">recruitment privacy notice</Link>.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader label="FAQ" headline="Careers FAQ" />
            <div className="mt-10 space-y-4">
              {faqs.map((f) => (
                <details key={f.q} className="group rounded-xl border border-border bg-card p-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-foreground">
                    {f.q}
                    <span className="text-retail transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
