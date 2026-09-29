export const revalidate = 60
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { MapPin, Clock, Briefcase, Users, Check, ArrowLeft, Flame, Star } from "lucide-react"
import {
  getPublicVacancyBySlug,
  isVacancyPubliclyListed,
  formatCompensation,
  formatKobo,
  EMPLOYMENT_TYPE_LABELS,
  WORK_ARRANGEMENT_LABELS,
  type CareerVacancy,
} from "@/lib/careers"

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://martpoint.com.ng"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const v = await getPublicVacancyBySlug(slug)
  if (!v) return { title: "Vacancy not found | MartPoint Careers" }
  return {
    title: `${v.title} | MartPoint Careers`,
    description: v.short_summary || `Apply for ${v.title} at MartPoint.`,
    alternates: { canonical: `/careers/jobs/${v.slug}` },
    openGraph: { title: `${v.title} | MartPoint Careers`, description: v.short_summary || undefined },
  }
}

function employmentTypeSchema(t: string): string {
  switch (t) {
    case "PERMANENT": return "FULL_TIME"
    case "CONTRACT": return "CONTRACTOR"
    case "TEMPORARY": return "TEMPORARY"
    case "INTERNSHIP": return "INTERN"
    default: return "OTHER"
  }
}

function jobPostingJsonLd(v: CareerVacancy) {
  const locations = (v.locations || []).map((l) => ({
    "@type": "Place",
    address: {
      "@type": "PostalAddress",
      addressLocality: l.city || undefined,
      addressRegion: l.state || undefined,
      addressCountry: l.country || "NG",
    },
  }))
  const json: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: v.title,
    description: [v.short_summary, v.description, (v.responsibilities || []).map((r) => `• ${r}`).join("\n"), (v.requirements || []).map((r) => `• ${r}`).join("\n")]
      .filter(Boolean)
      .join("\n\n"),
    identifier: { "@type": "PropertyValue", name: "MartPoint", value: v.reference_number },
    hiringOrganization: {
      "@type": "Organization",
      name: "MartPoint",
      sameAs: SITE_URL,
    },
    employmentType: employmentTypeSchema(v.employment_type),
    datePosted: v.published_at || v.created_at,
    validThrough: v.application_closes_at || undefined,
    url: `${SITE_URL}/careers/jobs/${v.slug}`,
    jobLocation: locations.length > 0 ? locations : undefined,
  }
  if (v.show_compensation && v.compensation_min_kobo) {
    json.baseSalary = {
      "@type": "MonetaryAmount",
      currency: v.currency,
      value: {
        "@type": "QuantitativeValue",
        minValue: v.compensation_min_kobo / 100,
        maxValue: v.compensation_max_kobo ? v.compensation_max_kobo / 100 : undefined,
        unitText:
          v.compensation_type === "DAILY" ? "DAY"
          : v.compensation_type === "WEEKLY" ? "WEEK"
          : v.compensation_type === "MONTHLY" ? "MONTH"
          : "YEAR",
      },
    }
  }
  return json
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  if (!children) return null
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-foreground">{children}</p>
    </div>
  )
}

export default async function VacancyDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const v = await getPublicVacancyBySlug(slug)
  if (!v) notFound()

  const open = isVacancyPubliclyListed(v)
  const compensation = formatCompensation(v)
  const locations = v.locations || []
  const locLabel = locations
    .map((l) => [l.city, l.state].filter(Boolean).join(", "))
    .filter(Boolean)
    .join(" · ") || "Nigeria"

  const benefits: string[] = []
  if (v.transport_allowance_kobo) benefits.push(`Transport allowance: ${formatKobo(v.transport_allowance_kobo, v.currency)} daily`)
  if (v.lunch_provided) benefits.push("Lunch and water provided")
  if (v.accommodation_provided) benefits.push("Accommodation provided")
  if (v.other_benefits) benefits.push(v.other_benefits)

  return (
    <>
      <Header />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingJsonLd(v)) }}
      />
      <main className="flex-1 bg-muted/30">
        <div className="container-martpoint py-10 md:py-16">
          <Link href="/careers" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
            <ArrowLeft className="w-4 h-4" /> All opportunities
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main */}
            <div className="lg:col-span-2 space-y-8">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  {v.urgent && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                      <Flame className="w-3.5 h-3.5" /> Urgent
                    </span>
                  )}
                  {v.featured && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                      <Star className="w-3.5 h-3.5" /> Featured
                    </span>
                  )}
                  {!open && (
                    <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                      Applications Closed
                    </span>
                  )}
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">{v.title}</h1>
                <p className="mt-3 text-muted-foreground">
                  {[v.department_name || v.category_name, locLabel, EMPLOYMENT_TYPE_LABELS[v.employment_type], WORK_ARRANGEMENT_LABELS[v.work_arrangement]]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Reference: {v.reference_number}</p>
              </div>

              {v.description && (
                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-3">About this role</h2>
                  <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{v.description}</div>
                </section>
              )}

              {v.responsibilities?.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-3">Responsibilities</h2>
                  <ul className="space-y-2">
                    {v.responsibilities.map((r, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-retail mt-0.5 shrink-0" /> {r}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {v.requirements?.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-3">Requirements</h2>
                  <ul className="space-y-2">
                    {v.requirements.map((r, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-retail mt-0.5 shrink-0" /> {r}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {benefits.length > 0 && (
                <section>
                  <h2 className="text-lg font-semibold text-foreground mb-3">Benefits & support for this role</h2>
                  <ul className="space-y-2">
                    {benefits.map((b, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                        <Check className="w-4 h-4 text-retail mt-0.5 shrink-0" /> {b}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              <section className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-lg font-semibold text-foreground mb-2">How to apply</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {open
                    ? "Click Apply to complete the vacancy-specific application form. You will receive a unique application reference you can use to check your status anytime."
                    : "Applications for this vacancy are closed. Join our Talent Pool to be notified of similar roles."}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {open ? (
                    <Button asChild variant="retail">
                      <Link href={`/careers/jobs/${v.slug}/apply`}>Apply for this role</Link>
                    </Button>
                  ) : (
                    <Button asChild variant="retail">
                      <Link href="/careers/talent-pool">Join Our Talent Pool</Link>
                    </Button>
                  )}
                  <Button asChild variant="outline">
                    <Link href="/careers/application-status">Check application status</Link>
                  </Button>
                </div>
              </section>
            </div>

            {/* Sidebar summary */}
            <aside className="lg:col-span-1">
              <div className="rounded-xl border border-border bg-card p-6 space-y-4 lg:sticky lg:top-6">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Role summary</h2>
                <Detail label="Location">
                  <span className="inline-flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-retail" />{locLabel}</span>
                </Detail>
                {locations.map((l) =>
                  l.public_description ? (
                    <p key={l.id} className="text-xs text-muted-foreground -mt-2">{l.public_description}</p>
                  ) : null
                )}
                <Detail label="Employment type">{EMPLOYMENT_TYPE_LABELS[v.employment_type]}</Detail>
                <Detail label="Work arrangement">{WORK_ARRANGEMENT_LABELS[v.work_arrangement]}</Detail>
                {v.show_openings && (
                  <Detail label="Openings">
                    <span className="inline-flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-retail" />{v.openings}</span>
                  </Detail>
                )}
                {compensation && <Detail label="Compensation">{compensation}</Detail>}
                {(v.working_days || v.work_start_time) && (
                  <Detail label="Working hours">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-retail" />
                      {[v.working_days, v.work_start_time && v.work_end_time ? `${v.work_start_time}–${v.work_end_time}` : null].filter(Boolean).join(" · ")}
                    </span>
                  </Detail>
                )}
                {(v.duration_description || v.project_start_date) && (
                  <Detail label="Duration / term">
                    {v.duration_description ||
                      `${v.project_start_date || ""} – ${v.project_end_date || "ongoing"}`}
                  </Detail>
                )}
                {v.application_closes_at && (
                  <Detail label="Application deadline">
                    {new Date(v.application_closes_at).toLocaleDateString("en-NG", {
                      day: "numeric", month: "long", year: "numeric",
                    })}
                  </Detail>
                )}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Status: <span className="font-medium text-foreground">{open ? "Accepting applications" : "Applications closed"}</span>
                  </p>
                </div>
                {open && (
                  <Button asChild variant="retail" className="w-full">
                    <Link href={`/careers/jobs/${v.slug}/apply`}>
                      <Briefcase className="w-4 h-4" /> Apply Now
                    </Link>
                  </Button>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
