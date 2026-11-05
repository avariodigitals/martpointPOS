"use client"

import { useEffect, useState } from "react"
import { Megaphone, RefreshCw } from "lucide-react"

type Campaign = { id: string; name: string; purpose: string; status: string; target_count: number; created_at: string; assigned_queue: string | null }
const queueNames: Record<string, string> = { sales: "Sales", support: "Support", onboarding: "Onboarding", customer_support: "General enquiries" }

export function AssignedVoiceCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  async function load() {
    setLoading(true)
    try {
      const response = await fetch("/api/azera/softphone/campaigns", { cache: "no-store" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Campaigns could not load.")
      setCampaigns(data.campaigns || [])
      setError("")
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Campaigns could not load.") }
    finally { setLoading(false) }
  }
  useEffect(() => { const timer = window.setTimeout(() => { void load() }, 0); return () => window.clearTimeout(timer) }, [])
  return <section className="min-w-0 space-y-3">
    <header className="flex items-center justify-between gap-2"><div><p className="text-xs font-medium text-slate-500">Assigned to you or your queues</p><h3 className="text-lg font-semibold text-slate-900">Voice campaigns</h3></div><button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh campaigns" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-indigo-100 bg-white text-indigo-700"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /></button></header>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
    {loading && !campaigns.length ? <p className="rounded-xl border border-indigo-100 bg-white p-4 text-sm text-slate-500">Loading assigned campaigns…</p> : campaigns.length ? <ul className="space-y-2">{campaigns.map(campaign => <li key={campaign.id} className="min-w-0 rounded-2xl border border-indigo-100 bg-white p-3 shadow-sm"><div className="flex min-w-0 items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700"><Megaphone className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start justify-between gap-2"><strong className="min-w-0 break-words text-sm text-slate-900">{campaign.name}</strong><span className="shrink-0 rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-medium capitalize text-indigo-700">{campaign.status}</span></div><p className="mt-1 text-xs text-slate-500">{campaign.target_count} contacts · {queueNames[campaign.assigned_queue || ""] || "Assigned to you"}</p></div></div></li>)}</ul> : !error ? <div className="rounded-2xl border border-dashed border-indigo-200 bg-white p-6 text-center"><Megaphone className="mx-auto h-7 w-7 text-indigo-300"/><p className="mt-2 text-sm font-medium text-slate-700">No campaigns assigned</p><p className="mt-1 text-xs leading-5 text-slate-500">Your team’s voice campaigns will appear here when they are assigned to you or one of your queues.</p></div> : null}
  </section>
}
