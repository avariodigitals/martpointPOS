"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, Mail, Plus, Search, Users, Loader2, Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EmailCampaignShell, CampaignStatus, emailRoot, inputClass } from "./email-campaign-shell"
import { audienceLabels, campaignDate, rate, type EmailCampaign } from "@/lib/email-campaign-report"

export default function EmailCampaignList() {
  const [campaigns, setCampaigns] = useState<EmailCampaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/admin/marketing", { signal: controller.signal }).then(async res => {
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Unable to load campaigns")
      setCampaigns(data.campaigns)
    }).catch(error => { if (error.name !== "AbortError") setError(error.message) }).finally(() => setLoading(false))
    return () => controller.abort()
  }, [])
  const visible = campaigns.filter(c => (status === "all" || c.status === status) && `${c.name} ${c.subject}`.toLowerCase().includes(query.toLowerCase()))
  const sent = campaigns.reduce((n, c) => n + c.metrics.sent, 0)
  const opens = campaigns.reduce((n, c) => n + c.metrics.opens, 0)
  const clicks = campaigns.reduce((n, c) => n + c.metrics.clicks, 0)
  return <EmailCampaignShell>
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-retail">Reach your audience</p><h1 className="text-3xl font-bold tracking-tight">Email campaigns</h1><p className="mt-2 text-sm text-muted-foreground">Create meaningful emails. Follow every campaign from send to engagement.</p></div><Button asChild size="sm"><Link href={`${emailRoot}/new`}><Plus className="h-4 w-4" />Create campaign</Link></Button></header>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Campaigns", campaigns.length.toLocaleString(), "Across all audiences"], ["Emails sent", sent.toLocaleString(), "Accepted by sending provider"], ["Open rate", rate(opens, sent), `${opens.toLocaleString()} unique opens`], ["Click rate", rate(clicks, sent), `${clicks.toLocaleString()} unique clickers`]].map(([label, value, note]) => <div key={label} className="rounded-xl border bg-white p-5 border-border"><p className="text-xs text-muted-foreground">{label}</p><p className="my-2 text-3xl font-semibold tracking-tight">{loading ? "—" : value}</p><p className="text-xs text-muted-foreground">{note}</p></div>)}</div>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</p>}
    <section className="overflow-hidden rounded-xl border bg-white border-border">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 border-border"><div className="flex flex-wrap gap-1" role="group" aria-label="Filter campaigns">{[["all", "All campaigns"], ["sent", "Completed"], ["scheduled", "Scheduled"], ["sending", "Sending"], ["partial", "Partial"], ["failed", "Failed"]].map(([value, label]) => <button key={value} onClick={() => setStatus(value)} aria-pressed={status === value} className={`rounded-md px-3 py-2 text-xs font-medium ${status === value ? "bg-slate-100 text-slate-950" : "text-muted-foreground hover:bg-slate-50"}`}>{label}</button>)}</div><label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input aria-label="Search campaigns" placeholder="Search campaigns…" value={query} onChange={e => setQuery(e.target.value)} className={`${inputClass} !mt-0 !pl-9`} /></label></div>
      {loading ? <div role="status" className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin" /><span className="sr-only">Loading campaigns</span></div> : !visible.length ? <div className="p-16 text-center"><Mail className="mx-auto mb-4 h-10 w-10 text-slate-300" /><h2 className="font-semibold">{campaigns.length ? "No matching campaigns" : "Your next great email starts here"}</h2><p className="my-3 text-sm text-muted-foreground">{campaigns.length ? "Try another search or status." : "Choose an audience, design your email, and see the results in one place."}</p><Button asChild size="sm" variant="outline"><Link href={`${emailRoot}/new`}>Create campaign</Link></Button></div> : <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b bg-slate-50/70 text-xs text-muted-foreground border-border"><tr>{["Campaign", "Status", "Recipients", "Open rate", "Click rate", ""].map((title, i) => <th key={i} className="px-5 py-3 font-medium" scope="col">{title}</th>)}</tr></thead><tbody className="divide-y divide-border">{visible.map(c => <tr key={c.id} className="hover:bg-slate-50/60"><td className="max-w-sm px-5 py-5"><Link href={`${emailRoot}/${c.id}`} className="font-semibold text-slate-900 hover:text-retail">{c.name}</Link><p className="mt-1 truncate text-xs text-muted-foreground">{c.audienceName || audienceLabels[c.audience] || c.audience}</p><p className="mt-1 text-[11px] text-slate-400">{campaignDate(c.scheduledFor || c.sentAt || c.createdAt)}</p></td><td className="px-5"><CampaignStatus status={c.status} /></td><td className="px-5">{c.recipientCount.toLocaleString()}<p className="mt-1 text-xs text-muted-foreground">{c.metrics.sent} sent</p></td><td className="px-5 font-medium">{rate(c.metrics.opens, c.metrics.sent)}<p className="mt-1 text-xs font-normal text-muted-foreground">{c.metrics.opens} opened</p></td><td className="px-5 font-medium">{rate(c.metrics.clicks, c.metrics.sent)}<p className="mt-1 text-xs font-normal text-muted-foreground">{c.metrics.clicks} clicked</p></td><td className="px-5"><div className="flex items-center gap-4"><Link href={`${emailRoot}/new?duplicate=${c.id}`} aria-label={`Duplicate ${c.name}`} className="text-muted-foreground hover:text-retail"><Copy className="h-4 w-4" /></Link><Link href={`${emailRoot}/${c.id}`} aria-label={`View ${c.name} report`} className="text-retail"><ArrowUpRight className="h-4 w-4" /></Link></div></td></tr>)}</tbody></table></div>}
    </section>
    <Link href={`${emailRoot}/audiences`} className="flex items-center gap-3 rounded-xl border border-dashed p-5 text-sm text-muted-foreground hover:bg-white border-border"><Users className="h-5 w-5 text-retail" /><span><strong className="text-foreground">Build your audience</strong> · Create lists and import subscribers from CSV.</span><ArrowUpRight className="ml-auto h-4 w-4" /></Link>
  </EmailCampaignShell>
}
