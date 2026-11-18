import type { Metadata } from "next"
import { ClarificationForm } from "./clarification-form"

export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Programme application clarification", robots: { index: false, follow: false }, referrer: "no-referrer" }

export default async function ClarificationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <main className="min-h-screen bg-slate-50 px-4 py-12"><div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-sm sm:p-10"><p className="text-sm font-semibold uppercase tracking-wider text-retail">MartPoint Business Growth Programme</p><h1 className="mt-3 text-2xl font-bold">Application clarification</h1><p className="mt-2 text-sm text-slate-600">Use this secure link to answer only the questions needed to complete your assessment.</p><ClarificationForm token={token} /></div></main>
}
