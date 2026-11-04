"use client"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Copy, Download, Eye, Loader2, Mail, MousePointerClick, RefreshCw, Search, Send, Users } from "lucide-react"
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from "recharts"
import { Button } from "@/components/ui/button"
import { CampaignBack, CampaignStatus, EmailCampaignShell, emailRoot, inputClass } from "./email-campaign-shell"
import { audienceLabels, campaignDate, campaignMetrics, downloadCsv, rate, type CampaignSend, type EmailCampaign } from "@/lib/email-campaign-report"

type Tab = "overview" | "recipients" | "opens" | "clicks" | "sending" | "email"
export default function EmailCampaignReport({ id }: { id: string }) {
  const [campaign, setCampaign] = useState<EmailCampaign | null>(null)
  const [sends, setSends] = useState<CampaignSend[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState("")
  const [tab, setTab] = useState<Tab>("overview")
  const [filter, setFilter] = useState("all")
  const [query, setQuery] = useState("")
  const [page, setPage] = useState(0)
  const [preview, setPreview] = useState("")
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const res = await fetch(`/api/admin/marketing/${encodeURIComponent(id)}`, { signal })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Unable to load campaign")
      setCampaign(data.campaign); setSends(data.sends); setError("")
    } catch (e) { if (!signal?.aborted) setError(e instanceof Error ? e.message : "Unable to load campaign") }
    finally { if (!signal?.aborted) { setLoading(false); setRefreshing(false) } }
  }, [id])
  useEffect(() => { const controller = new AbortController(); const timer = setTimeout(() => void load(controller.signal), 0); return () => { clearTimeout(timer); controller.abort() } }, [load])
  useEffect(() => {
    if (campaign?.status !== "sending" && campaign?.status !== "scheduled") return
    const timer = setInterval(() => void load(), 15000)
    return () => clearInterval(timer)
  }, [campaign?.status, load])
  useEffect(() => {
    if (tab !== "email" || !campaign?.html) return
    const controller = new AbortController()
    fetch("/api/admin/marketing/preview", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ html: campaign.html, preheader: campaign.preheader, from: campaign.fromAddress, replyTo: campaign.replyTo }), signal: controller.signal }).then(async res => {
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Unable to load email review")
      setPreview(data.html)
    }).catch(e => { if (!controller.signal.aborted) setError(e.message) })
    return () => controller.abort()
  }, [tab, campaign?.html, campaign?.preheader, campaign?.fromAddress, campaign?.replyTo])
  const metrics = campaignMetrics(sends)
  const filtered = sends.filter(s => {
    if (query && !`${s.email} ${s.name}`.toLowerCase().includes(query.toLowerCase())) return false
    if (tab === "opens" && !s.opened_at) return false
    if (tab === "clicks" && !s.clicked_at) return false
    if (filter === "failed") return s.status === "failed"
    if (filter === "sent") return s.status === "sent"
    if (filter === "queued") return s.status === "queued"
    if (filter === "unopened") return s.status === "sent" && !s.opened_at
    return true
  })
  const pageRows = filtered.slice(page * 25, (page + 1) * 25)
  const chartData = Array.from(sends.reduce((map, send) => {
    for (const [key, value] of [["opens", send.opened_at], ["clicks", send.clicked_at]] as const) {
      if (!value) continue
      const day = new Date(value).toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" })
      const item = map.get(day) || { day, opens: 0, clicks: 0 }
      item[key]++
      map.set(day, item)
    }
    return map
  }, new Map<string, { day: string; opens: number; clicks: number }>()).values()).sort((a, b) => a.day.localeCompare(b.day))
  function navigate(value: Tab, nextFilter = "all") { setTab(value); setFilter(nextFilter); setPage(0); setQuery("") }
  function exportReport() {
    downloadCsv(`campaign-${id}-${tab}.csv`, [["Email", "Name", "Send status", "Sent at", "First opened", "Total opens", "First clicked", "Total clicks", "Error"], ...filtered.map(s => [s.email, s.name, s.status, s.sent_at, s.opened_at, s.open_count, s.clicked_at, s.click_count, s.error_message])])
  }
  return <EmailCampaignShell>
    <CampaignBack />
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<button onClick={() => void load()} className="ml-3 underline">Retry</button></p>}
    {loading ? <div role="status" className="flex justify-center p-20"><Loader2 className="h-6 w-6 animate-spin" /><span className="sr-only">Loading report</span></div> : campaign && <>
      <header className="flex flex-wrap items-start justify-between gap-4"><div><div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground"><Mail className="h-4 w-4" />Regular email campaign<CampaignStatus status={campaign.status} /></div><h1 className="text-3xl font-bold tracking-tight">{campaign.name}</h1><p className="mt-2 text-sm text-muted-foreground">{campaign.scheduledFor ? `Scheduled ${campaignDate(campaign.scheduledFor)}` : `Created ${campaignDate(campaign.createdAt)}`}</p></div><div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => { setRefreshing(true); void load() }} disabled={refreshing}><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Refresh</Button><Button asChild size="sm" variant="outline"><Link href={`${emailRoot}/new?duplicate=${id}`}><Copy className="h-4 w-4" />Replicate</Link></Button><Button size="sm" onClick={exportReport}><Download className="h-4 w-4" />Export report</Button></div></header>
      <nav aria-label="Campaign report" className="flex gap-1 overflow-x-auto border-b border-border">{([{ key: "overview", label: "Overview", icon: Eye }, { key: "recipients", label: "Recipients", icon: Users }, { key: "opens", label: "Open log", icon: Eye }, { key: "clicks", label: "Click log", icon: MousePointerClick }, { key: "sending", label: "Sending log", icon: Send }, { key: "email", label: "Email review", icon: Mail }] as const).map(t => <button key={t.key} onClick={() => navigate(t.key)} aria-current={tab === t.key ? "page" : undefined} className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium ${tab === t.key ? "border-retail text-retail" : "border-transparent text-muted-foreground hover:text-foreground"}`}><t.icon className="h-4 w-4" />{t.label}</button>)}</nav>
      {tab === "overview" && <>
        <section className="grid gap-6 rounded-xl border bg-white p-6 lg:grid-cols-[200px_1fr] border-border"><div className="lg:border-r border-border"><Users className="mb-3 h-6 w-6 text-retail" /><p className="text-4xl font-semibold tracking-tight">{campaign.recipientCount.toLocaleString()}</p><p className="mt-2 text-sm text-muted-foreground">campaign recipients</p><button onClick={() => navigate("recipients")} className="mt-4 text-xs font-medium text-retail">View recipient activity →</button></div><dl className="grid gap-5 text-sm sm:grid-cols-2"><div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Subject</dt><dd className="mt-1 font-semibold">{campaign.subject}</dd></div>{[["From", campaign.fromAddress || "Not recorded for this campaign"], ["Reply to", campaign.replyTo || "Not recorded for this campaign"], ["Audience", campaign.audienceName || audienceLabels[campaign.audience] || campaign.audience], ["Sending service", campaign.provider === "default" ? "Default email service" : campaign.provider], ["Preview text", campaign.preheader || "None"], ["Completed at", campaign.status === "sending" ? "In progress" : campaign.status === "scheduled" ? "Awaiting schedule" : campaignDate(campaign.sentAt)]].map(([label, value]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words font-medium">{value}</dd></div>)}</dl></section>
        <div><h2 className="text-lg font-semibold">Campaign performance</h2><p className="mt-1 text-sm text-muted-foreground">See how your audience engaged with this email.</p></div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[{ label: "Open rate", value: rate(metrics.opens, metrics.sent), note: `${metrics.opens} unique / ${metrics.openTotal} total opens`, tab: "opens" as Tab }, { label: "Click rate", value: rate(metrics.clicks, metrics.sent), note: `${metrics.clicks} unique / ${metrics.clickTotal} total clicks`, tab: "clicks" as Tab }, { label: "Not opened", value: rate(Math.max(0, metrics.sent - metrics.opens), metrics.sent), note: `${Math.max(0, metrics.sent - metrics.opens)} sent emails`, tab: "recipients" as Tab, filter: "unopened" }, { label: "Send failures", value: metrics.failed.toLocaleString(), note: `${rate(metrics.failed, campaign.recipientCount)} of recipients`, tab: "sending" as Tab, filter: "failed" }].map(item => <button key={item.label} onClick={() => navigate(item.tab, item.filter)} className="rounded-xl border border-border bg-white p-5 text-left transition-shadow hover:shadow-md border-border"><p className="text-xs text-muted-foreground">{item.label}</p><p className="my-3 text-3xl font-semibold tracking-tight">{item.value}</p><p className="text-xs text-muted-foreground">{item.note}</p><p className="mt-4 text-xs font-medium text-retail">View log →</p></button>)}</div>
        <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]"><section className="rounded-xl border bg-white p-6 border-border"><h3 className="font-semibold">Engagement over time</h3><p className="mt-1 text-xs text-muted-foreground">First opens and first clicks by day · West Africa Time</p>{chartData.length ? <div className="mt-6 h-64"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartData}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" /><XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={s => s.slice(5)} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} width={30} /><Tooltip /><Area type="monotone" dataKey="opens" name="First opens" stroke="#2563eb" fill="#dbeafe" /><Area type="monotone" dataKey="clicks" name="First clicks" stroke="#7c3aed" fill="#ede9fe" /></AreaChart></ResponsiveContainer></div> : <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Engagement will appear here as subscribers open and click.</div>}<div className="flex gap-5 text-xs text-muted-foreground"><span className="text-blue-600">● First opens</span><span className="text-violet-600">● First clicks</span></div></section><section className="rounded-xl border bg-white p-6 border-border"><h3 className="font-semibold">Sending summary</h3><dl className="mt-5 divide-y divide-border text-sm">{[["Accepted by provider", metrics.sent], ["Failed to send", metrics.failed], ["Awaiting send / record", Math.max(0, campaign.recipientCount - metrics.sent - metrics.failed)], ["Total tracked opens", metrics.openTotal], ["Total tracked clicks", metrics.clickTotal], ["Click-to-open rate", rate(metrics.clicks, metrics.opens)]].map(([label, value]) => <div key={label} className="flex justify-between gap-3 py-3"><dt className="text-muted-foreground">{label}</dt><dd className="font-semibold">{value}</dd></div>)}</dl><p className="mt-4 text-xs leading-5 text-muted-foreground">Sent means accepted by the sending provider. Delivery, bounce, complaint, geographic, and per-link events are not collected by the current campaign tracker.</p></section></div>
        <section className="rounded-xl border bg-white p-6 border-border"><div className="flex items-center justify-between"><h3 className="font-semibold">Most engaged subscribers</h3><button onClick={() => navigate("opens")} className="text-xs text-retail">View activity →</button></div>{sends.some(s => s.open_count || s.click_count) ? <div className="mt-4 divide-y divide-border">{[...sends].filter(s => s.open_count || s.click_count).sort((a, b) => b.click_count - a.click_count || b.open_count - a.open_count).slice(0, 5).map(s => <div key={s.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span>{s.name || s.email}{s.name && <span className="ml-2 text-xs text-muted-foreground">{s.email}</span>}</span><span className="text-xs text-muted-foreground">{s.open_count} opens · {s.click_count} clicks</span></div>)}</div> : <p className="mt-4 text-sm text-muted-foreground">No subscriber engagement recorded yet.</p>}</section>
        <p className="text-xs leading-5 text-muted-foreground">Open and click rates use unique recipients divided by sent emails. Privacy protection, image blocking, and automated link scanners can affect these metrics. The chart records the first interaction per subscriber, not every event.</p>
      </>}
      {tab === "email" && <section className="overflow-hidden rounded-xl border bg-white border-border"><div className="border-b p-5 border-border"><h2 className="font-semibold">{campaign.subject}</h2><p className="mt-1 text-xs text-muted-foreground">Campaign content with sample personalization and inactive tracking links.</p></div><div className="bg-slate-100 p-4"><iframe title="Campaign email review" sandbox="" referrerPolicy="no-referrer" srcDoc={preview} className="mx-auto h-[850px] w-full max-w-[760px] border-0 bg-white border-border" /></div></section>}
      {tab !== "overview" && tab !== "email" && <section className="overflow-hidden rounded-xl border bg-white border-border"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 border-border"><div><h2 className="font-semibold">{tab === "opens" ? "Subscribers who opened" : tab === "clicks" ? "Subscribers who clicked" : tab === "sending" ? "Per-recipient sending log" : "Recipient activity"}</h2><p className="mt-1 text-xs text-muted-foreground">{filtered.length} matching records{campaign.status === "scheduled" ? " · Awaiting the scheduled send" : ""}</p></div><div className="flex flex-wrap gap-2"><label className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input className={`${inputClass} !mt-0 !pl-9`} aria-label="Search recipients" placeholder="Search name or email" value={query} onChange={e => { setQuery(e.target.value); setPage(0) }} /></label><select aria-label="Filter sending status" value={filter} onChange={e => { setFilter(e.target.value); setPage(0) }} className={`${inputClass} !mt-0 !w-auto`}><option value="all">All records</option><option value="sent">Sent</option><option value="failed">Failed</option><option value="queued">Queued</option><option value="unopened">Not opened</option></select></div></div><div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-xs"><thead className="bg-slate-50 text-muted-foreground"><tr>{["Subscriber", "Send status", "Sent at", "Opens", "Clicks", "Error"].map(label => <th key={label} className="px-5 py-3 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-border">{pageRows.map(s => <tr key={s.id}><td className="px-5 py-4"><p className="font-medium">{s.name || s.email}</p>{s.name && <p className="mt-1 text-muted-foreground">{s.email}</p>}</td><td className="px-5"><span className={s.status === "failed" ? "text-red-600" : s.status === "queued" ? "text-muted-foreground" : "text-emerald-700"}>{s.status === "sent" ? "Sent" : s.status}</span></td><td className="px-5 text-muted-foreground">{campaignDate(s.sent_at)}</td><td className="px-5">{s.open_count}<p className="mt-1 text-[10px] text-muted-foreground">{s.opened_at ? `First: ${campaignDate(s.opened_at)}` : "Not opened"}</p></td><td className="px-5">{s.click_count}<p className="mt-1 text-[10px] text-muted-foreground">{s.clicked_at ? `First: ${campaignDate(s.clicked_at)}` : "No clicks"}</p></td><td className="max-w-xs px-5 text-red-600">{s.error_message || "—"}</td></tr>)}{!pageRows.length && <tr><td colSpan={6} className="p-12 text-center text-muted-foreground">No matching activity yet.</td></tr>}</tbody></table></div><div className="flex items-center justify-between border-t p-4 text-xs text-muted-foreground border-border"><span>{filtered.length ? page * 25 + 1 : 0}–{Math.min((page + 1) * 25, filtered.length)} of {filtered.length}</span><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!page} onClick={() => setPage(page - 1)}>Previous</Button><Button size="sm" variant="outline" disabled={(page + 1) * 25 >= filtered.length} onClick={() => setPage(page + 1)}>Next</Button></div></div></section>}
    </>}
  </EmailCampaignShell>
}
