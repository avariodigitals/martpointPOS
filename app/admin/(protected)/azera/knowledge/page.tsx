"use client"

import { useCallback, useEffect, useState } from "react"
import { BookOpen, Loader2, Pencil, Plus, Save, Trash2, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Article = { id: string; title: string; content: string; keywords: string[]; category: string; audience: string; source_url: string | null; status: string; sort_order: number }
type Form = Omit<Article, "id"> & { id?: string }
const empty: Form = { title: "", content: "", keywords: [], category: "General", audience: "all", source_url: "", status: "published", sort_order: 0 }
const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

export default function AzeraKnowledgePage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [faqs, setFaqs] = useState<{ id: string; question: string }[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const load = useCallback(async () => {
    const response = await fetch("/api/admin/azera/knowledge", { cache: "no-store" })
    const data = await response.json()
    if (response.ok) { setArticles(data.articles || []); setFaqs((data.faqs || []).map((f: { id: string; question: string }) => f)) }
    else setMessage(data.error || "Failed to load knowledge base")
    setLoading(false)
  }, [])
  useEffect(() => {
    // The request synchronizes the editor with persisted knowledge articles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  async function save() {
    if (!form) return
    setSaving(true); setMessage("")
    const response = await fetch("/api/admin/azera/knowledge", { method: form.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
    const data = await response.json()
    if (!response.ok) setMessage(data.error || "Failed to save article")
    else { setMessage("Article saved"); setForm(null); await load() }
    setSaving(false)
  }

  async function remove(id: string) {
    if (!confirm("Delete this AI knowledge article?")) return
    await fetch(`/api/admin/azera/knowledge?id=${id}`, { method: "DELETE" }); await load()
  }

  return <div className="space-y-6">
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div><h1 className="text-2xl font-bold tracking-tight flex items-center gap-2"><BookOpen className="h-5 w-5 text-retail" />AI Knowledge Base</h1><p className="text-muted-foreground mt-1">The controlled source Azera uses for support and sales answers. Blog posts remain marketing content.</p></div>
      <Button onClick={() => setForm({ ...empty })}><Plus className="mr-2 h-4 w-4" />New article</Button>
    </div>
    {message && <p className={`text-sm ${message === "Article saved" ? "text-green-600" : "text-red-600"}`}>{message}</p>}
    <Card className="border-retail/20 bg-retail/5"><CardContent className="p-4 text-sm"><strong>How this works:</strong> Published articles are supplied to Azera on every chat. Draft and archived articles are ignored. Existing public FAQs are shown below as a migration reminder; copy important answers into this curated base so they can be categorised and controlled.</CardContent></Card>
    {form && <Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">{form.id ? "Edit article" : "New article"}</CardTitle><Button variant="ghost" size="icon" onClick={() => setForm(null)}><X className="h-4 w-4" /></Button></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">
      <label className="space-y-1 text-sm md:col-span-2">Title<input className={input} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="How do I renew my MartPoint subscription?" /></label>
      <label className="space-y-1 text-sm md:col-span-2">Answer / article content<textarea className={`${input} min-h-40`} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} placeholder="Give Azera the accurate answer. Include the next action and when to hand off to a person." /></label>
      <label className="space-y-1 text-sm">Category<input className={input} value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} placeholder="Billing, Setup, Troubleshooting" /></label>
      <label className="space-y-1 text-sm">Keywords<input className={input} value={form.keywords.join(", ")} onChange={e => setForm({ ...form, keywords: e.target.value.split(",").map(x => x.trim()).filter(Boolean) })} placeholder="renewal, subscription, billing" /></label>
      <label className="space-y-1 text-sm">Audience<select className={input} value={form.audience} onChange={e => setForm({ ...form, audience: e.target.value })}><option value="all">Everyone</option><option value="prospect">Prospects / Sales</option><option value="merchant">Merchants</option><option value="agent">Agents only</option></select></label>
      <label className="space-y-1 text-sm">Status<select className={input} value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}><option value="published">Published — use in chat</option><option value="draft">Draft — do not use</option><option value="archived">Archived — do not use</option></select></label>
      <label className="space-y-1 text-sm md:col-span-2">Source URL (optional)<input className={input} value={form.source_url || ""} onChange={e => setForm({ ...form, source_url: e.target.value })} placeholder="https://www.martpoint.com.ng/help-centre" /></label>
      <div className="md:col-span-2 flex gap-2"><Button onClick={save} disabled={saving}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save article</Button><Button variant="outline" onClick={() => setForm(null)}>Cancel</Button></div>
    </CardContent></Card>}
    <Card><CardHeader><CardTitle className="text-base">Curated articles ({articles.length})</CardTitle></CardHeader><CardContent>{loading ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin" /></div> : articles.length === 0 ? <p className="py-8 text-sm text-muted-foreground">No curated articles yet. Start with pricing, setup, billing, common errors, and support hours.</p> : <div className="divide-y">{articles.map(article => <div key={article.id} className="flex items-start justify-between gap-4 py-4"><div><div className="flex items-center gap-2"><h3 className="font-medium">{article.title}</h3><span className="rounded-full bg-muted px-2 py-0.5 text-xs">{article.status}</span></div><p className="mt-1 text-sm text-muted-foreground line-clamp-2">{article.content}</p><p className="mt-1 text-xs text-muted-foreground">{article.category} · {article.audience} · {article.keywords.join(", ")}</p></div><div className="flex shrink-0 gap-1"><Button variant="outline" size="icon" onClick={() => setForm({ ...article })}><Pencil className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => remove(article.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button></div></div>)}</div>}</CardContent></Card>
    {faqs.length > 0 && <Card><CardHeader><CardTitle className="text-base">Existing public FAQs ({faqs.length})</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">These are managed under Content → FAQs and are not yet copied into the curated AI base. Review them and add the accurate ones above.</p><ul className="mt-3 list-disc pl-5 text-sm">{faqs.map(f => <li key={f.id}>{f.question}</li>)}</ul></CardContent></Card>}
  </div>
}
