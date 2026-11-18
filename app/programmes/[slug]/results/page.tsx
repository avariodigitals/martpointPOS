import { notFound } from "next/navigation"
import type { Metadata } from "next"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Business Growth Programme results" }

export default async function GrowthProgrammeResults({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  if (!isSupabaseConfigured()) notFound()
  const { data: programme } = await supabase.from("business_growth_programmes").select("id,name,slug,status,award_count").eq("slug", slug).eq("status", "COMPLETED").maybeSingle()
  if (!programme) notFound()
  const { data: awards } = await supabase.from("business_growth_awards").select("id,business_growth_applications(business_name)").eq("programme_id", programme.id).in("status", ["ACCEPTED", "ACTIVATED"]).not("public_announcement_consent_at", "is", null)
  const businesses = (awards || []).map((award) => {
    const application = award.business_growth_applications as unknown as { business_name?: string } | null
    return application?.business_name || ""
  }).filter(Boolean)
  return <main className="min-h-screen bg-slate-50 px-4 py-14"><article className="mx-auto max-w-3xl rounded-3xl bg-white p-7 text-center shadow-sm sm:p-12"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-retail">MartPoint Business Growth Programme</p><h1 className="mt-3 text-3xl font-bold">{programme.name} results</h1><p className="mt-4 text-slate-600">The application round is complete. Three places were available for the standard MartPoint Basic licence.</p>{businesses.length > 0 ? <div className="mt-8"><h2 className="text-lg font-semibold">Selected businesses who agreed to be named</h2><ul className="mt-4 space-y-2">{businesses.map((business, index) => <li key={`${business}-${index}`} className="rounded-xl bg-slate-50 px-4 py-3 font-medium">{business}</li>)}</ul></div> : <p className="mt-8 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Selected participants have not given permission for their business names to be published. We respect their privacy.</p>}<p className="mt-8 text-xs text-slate-500">Public naming is optional and separate from selection, onboarding and support.</p></article></main>
}
