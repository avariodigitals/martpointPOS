export const dynamic = "force-dynamic"
import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { getPublicVacancyBySlug, countApplications, vacancyAcceptsApplications } from "@/lib/careers"
import { ApplicationForm } from "./apply-form"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const v = await getPublicVacancyBySlug(slug)
  if (!v) return { title: "Apply | MartPoint Careers" }
  return {
    title: `Apply — ${v.title} | MartPoint Careers`,
    description: `Apply for ${v.title} at MartPoint.`,
    robots: { index: false },
  }
}

export default async function ApplyPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const v = await getPublicVacancyBySlug(slug)
  if (!v) notFound()

  const appCount = await countApplications(v.id)
  const accepting = vacancyAcceptsApplications(v, appCount)

  if (!accepting) {
    return (
      <>
        <Header />
        <main className="flex-1 bg-muted/30">
          <div className="container-martpoint py-16 md:py-24">
            <div className="max-w-xl mx-auto text-center rounded-xl border border-border bg-card p-10">
              <h1 className="text-2xl font-bold text-foreground mb-3">Applications Closed</h1>
              <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                {v.title} is no longer accepting applications. Join our Talent Pool to be notified of similar roles.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button asChild variant="retail">
                  <Link href="/careers/talent-pool">Join Our Talent Pool</Link>
                </Button>
                <Button asChild variant="outline">
                  <Link href={`/careers/jobs/${v.slug}`}>Back to vacancy</Link>
                </Button>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="flex-1 bg-muted/30">
        <div className="container-martpoint py-10 md:py-16">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
                Application
              </span>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                {v.title}
              </h1>
              <p className="mt-3 text-muted-foreground">
                {[v.locations?.find((l) => l.is_primary)?.city, v.locations?.find((l) => l.is_primary)?.state]
                  .filter(Boolean)
                  .join(", ")}{" "}
                · Reference {v.reference_number}
              </p>
            </div>
            <ApplicationForm
              vacancyId={v.id}
              vacancySlug={v.slug}
              cvRequired={v.cv_required}
              coverLetterRequired={v.cover_letter_required}
              portfolioEnabled={v.portfolio_enabled}
              equipmentFields={v.equipment_fields || {}}
              questions={(v.questions || []).map((q) => ({
                id: q.id,
                question_text: q.question_text,
                answer_type: q.answer_type,
                required: q.required,
                options: (q.options || []).map((o) => o.option_text),
              }))}
              workingHoursLabel={
                v.work_start_time && v.work_end_time
                  ? `${v.work_start_time} – ${v.work_end_time}${v.working_days ? `, ${v.working_days}` : ""}`
                  : null
              }
              durationLabel={v.duration_description}
              locationLabel={
                [v.locations?.find((l) => l.is_primary)?.city, v.locations?.find((l) => l.is_primary)?.state]
                  .filter(Boolean)
                  .join(", ") || null
              }
              consentText={v.consent_text || null}
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
