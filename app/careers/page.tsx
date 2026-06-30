export const revalidate = 86400
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
} from "lucide-react"
import { CareersApplicationForm } from "@/components/careers-application-form"

export const metadata: Metadata = {
  title: "Careers — Join the MartPoint Team",
  description:
    "Build the future of African business software. Explore open roles, culture and benefits at MartPoint.",
}

const values = [
  { icon: Target, title: "Impact First", desc: "We measure success by the businesses we help grow, not just features shipped." },
  { icon: HeartHandshake, title: "Customer Obsession", desc: "We design for African business realities, not assumptions from abroad." },
  { icon: Zap, title: "Move Fast", desc: "Speed matters. We ship, learn and iterate quickly to stay ahead." },
  { icon: Users, title: "Build Together", desc: "Great products come from diverse perspectives working as one team." },
]

const benefits = [
  "Competitive salary and performance bonuses",
  "Remote-first with flexible working hours",
  "Health insurance for you and dependents",
  "Learning budget for courses and conferences",
  "Equity participation for key roles",
  "Team retreats and off-site bonding events",
  "Latest equipment and software allowance",
  "Mentorship and clear growth pathways",
]

const process = [
  { step: "01", title: "Apply", desc: "Send your CV and a short note about why MartPoint interests you." },
  { step: "02", title: "Interview", desc: "Conversation with the hiring manager about your experience and aspirations." },
  { step: "03", title: "Task", desc: "A short, relevant task so we can see how you think and work." },
  { step: "04", title: "Offer", desc: "If it is a fit, we move fast. Most offers are extended within one week." },
]

const openRoles: { title: string; team: string; location: string; type: string }[] = [
  // Uncomment and edit when hiring
  // { title: "Senior Frontend Engineer", team: "Engineering", location: "Remote (Africa)", type: "Full-time" },
  // { title: "Customer Success Manager", team: "Operations", location: "Lagos, Nigeria", type: "Full-time" },
  // { title: "Product Designer", team: "Design", location: "Remote (Africa)", type: "Full-time" },
]

export default function CareersPage() {
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
                MartPoint is building the operating system for African retail and growing enterprises. We are looking for people who want their work to matter.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg" variant="retail">
                  <Link href="#apply">Apply Now</Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link href="/about">About MartPoint</Link>
                </Button>
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
                  Perks
                </span>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
                  Benefits That Matter
                </h2>
                <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                  We invest in our people because they are the reason we build great products.
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
                  <div className="text-sm font-semibold text-foreground">Continuous Learning</div>
                  <div className="text-xs text-muted-foreground mt-1">Budget for courses, books and conferences</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-6 text-center">
                  <Clock className="w-8 h-8 text-retail mx-auto mb-3" />
                  <div className="text-sm font-semibold text-foreground">Flexible Hours</div>
                  <div className="text-xs text-muted-foreground mt-1">Work when you are most productive</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-6 text-center">
                  <Users className="w-8 h-8 text-retail mx-auto mb-3" />
                  <div className="text-sm font-semibold text-foreground">Inclusive Team</div>
                  <div className="text-xs text-muted-foreground mt-1">Diverse perspectives build better products</div>
                </div>
                <div className="rounded-xl border border-border bg-card p-6 text-center">
                  <Briefcase className="w-8 h-8 text-retail mx-auto mb-3" />
                  <div className="text-sm font-semibold text-foreground">Real Ownership</div>
                  <div className="text-xs text-muted-foreground mt-1">Equity and autonomy for key contributors</div>
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
              description="Transparent, respectful and fast. We value your time as much as ours."
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

        {/* Open Positions */}
        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint max-w-3xl">
            <SectionHeader
              label="Open Positions"
              headline="Current Opportunities"
            />
            {openRoles.length > 0 ? (
              <div className="mt-10 space-y-4">
                {openRoles.map((role) => (
                  <div key={role.title} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-retail/30">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{role.title}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{role.team} · {role.location} · {role.type}</p>
                    </div>
                    <Button asChild variant="retail" size="sm">
                      <Link href="#apply">Apply</Link>
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-10 rounded-xl border border-border bg-card p-8 text-center">
                <Briefcase className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No Current Vacancies</h3>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-md mx-auto mb-6">
                  We are not actively hiring right now, but we always welcome exceptional talent. Send us your details and we will reach out when a fitting role opens.
                </p>
                <Button asChild variant="outline">
                  <Link href="#apply">Send Your CV</Link>
                </Button>
              </div>
            )}
          </div>
        </section>

        {/* Application Form */}
        <section id="apply" className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint max-w-2xl">
            <div className="text-center mb-10">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">Apply</span>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">Join the MartPoint Team</h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                All fields are required. We review every application personally and respond within one week.
              </p>
            </div>
            <CareersApplicationForm />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
