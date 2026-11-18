import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { GrowthProgrammeApplicationForm } from "./application-form"
import type { GrowthQuestion } from "@/lib/business-growth-policy"

export const dynamic = "force-dynamic"

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (!isSupabaseConfigured()) return { title: "Business Growth Programme" }
  const { data } = await supabase.from("business_growth_programmes").select("name,description,status").eq("slug", slug).maybeSingle()
  return { title: data?.name || "Business Growth Programme", description: data?.description || "Apply to the MartPoint Business Growth Programme." }
}

export default async function GrowthProgrammePage({ params }: Props) {
  const { slug } = await params
  if (!isSupabaseConfigured()) notFound()
  const { data: programme } = await supabase.from("business_growth_programmes")
    .select("id,name,slug,description,status,opens_at,closes_at,award_count,plan_snapshot,sponsored_duration_months,activation_deadline_days,onboarding_scope,exclusions,renewal_price_note,terms_version,terms_text,privacy_version,privacy_text,questions")
    .eq("slug", slug).maybeSingle()
  // This server-rendered route is force-dynamic; its visibility is time-window based.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now()
  if (!programme || !["OPEN", "SCHEDULED", "COMPLETED"].includes(programme.status) || (programme.opens_at && new Date(programme.opens_at).getTime() > now)) notFound()
  const isOpen = programme.status === "OPEN" && (!programme.closes_at || new Date(programme.closes_at).getTime() > now)
  const plan = (programme.plan_snapshot || {}) as Record<string, unknown>
  const questions = Array.isArray(programme.questions) ? programme.questions as GrowthQuestion[] : []

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 sm:py-16">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 rounded-3xl bg-white p-6 shadow-sm sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-retail">MartPoint Business Growth Programme</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{programme.name}</h1>
          <p className="mt-4 max-w-3xl whitespace-pre-line text-slate-600">{programme.description}</p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4"><p className="font-semibold">Three sponsored places</p><p className="mt-1 text-sm text-slate-600">Standard MartPoint Basic for one store, for {programme.sponsored_duration_months} months.</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="font-semibold">Standard package</p><p className="mt-1 text-sm text-slate-600">Basic’s current annual list price is ₦{Number(plan.base_price || 0).toLocaleString("en-NG")}. Renewal is optional and paid at the price communicated before renewal.</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="font-semibold">Onboarding included</p><p className="mt-1 whitespace-pre-line text-sm text-slate-600">{programme.onboarding_scope}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="font-semibold">Not included</p><p className="mt-1 whitespace-pre-line text-sm text-slate-600">{programme.exclusions} Optional SMS and email credits and payment processing charges are separate.</p></div>
          </div>
          {programme.closes_at && <p className="mt-5 text-sm text-slate-600">Applications close {new Date(programme.closes_at).toLocaleString("en-NG", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Lagos" })} WAT.</p>}
        </header>
        {isOpen ? (
          <GrowthProgrammeApplicationForm programme={{ slug, questions, termsText: programme.terms_text, privacyText: programme.privacy_text }} />
        ) : (
          <section className="rounded-2xl bg-white p-8 text-center shadow-sm"><h2 className="text-xl font-semibold">Applications are closed</h2><p className="mt-2 text-slate-600">This application window has ended. Thank you for your interest.</p>{programme.status === "COMPLETED" && <a href={`/programmes/${programme.slug}/results`} className="mt-4 inline-block text-retail underline">View programme outcome</a>}</section>
        )}
      </div>
    </main>
  )
}
