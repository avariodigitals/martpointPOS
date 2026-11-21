import Link from "next/link"
import type { Metadata } from "next"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"
import { Footer } from "@/components/layout/footer"

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Available Programmes — MartPoint",
  description: "Browse MartPoint programmes that are currently accepting applications.",
}

type Programme = {
  name: string
  slug: string
  description: string
  opens_at: string | null
  closes_at: string | null
  sponsored_duration_months: number
}

export default async function ProgrammesPage() {
  let programmes: Programme[] = []

  if (isSupabaseConfigured()) {
    const { data } = await supabase.from("business_growth_programmes")
      .select("name,slug,description,opens_at,closes_at,sponsored_duration_months")
      .eq("status", "OPEN")
      .order("opens_at", { ascending: true })
    const now = Date.now()
    programmes = ((data || []) as Programme[]).filter((programme) =>
      (!programme.opens_at || new Date(programme.opens_at).getTime() <= now) &&
      (!programme.closes_at || new Date(programme.closes_at).getTime() > now),
    )
  }

  return (
    <>
    <main className="min-h-screen bg-slate-50 px-4 py-14 sm:py-20">
      <div className="mx-auto max-w-5xl">
        <header className="mb-9 max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-retail">MartPoint opportunities</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Available programmes</h1>
          <p className="mt-4 text-slate-600">Browse programmes that are currently accepting applications and review their details before applying.</p>
        </header>

        {programmes.length ? (
          <div className="grid gap-5 md:grid-cols-2">
            {programmes.map((programme) => (
              <article key={programme.slug} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex-1">
                  <span className="inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Applications open</span>
                  <h2 className="mt-4 text-xl font-semibold text-slate-950">{programme.name}</h2>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">{programme.description}</p>
                  <p className="mt-4 text-sm text-slate-600">Sponsored MartPoint Basic licence · {programme.sponsored_duration_months} months</p>
                  {programme.closes_at && <p className="mt-2 text-sm text-slate-500">Applications close {new Date(programme.closes_at).toLocaleString("en-NG", { dateStyle: "long", timeStyle: "short", timeZone: "Africa/Lagos" })} WAT.</p>}
                </div>
                <Link href={`/programmes/${programme.slug}`} className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-retail px-5 text-sm font-semibold text-white hover:opacity-90">
                  View programme and apply
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-slate-950">No programmes are accepting applications right now</h2>
            <p className="mt-2 text-sm text-slate-600">Please check back later for new MartPoint programme opportunities.</p>
          </section>
        )}
      </div>
    </main>
    <Footer />
    </>
  )
}
