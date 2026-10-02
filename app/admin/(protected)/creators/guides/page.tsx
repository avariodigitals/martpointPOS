"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react"
import { enumLabel } from "@/lib/utils"

interface Guide {
  id: string
  industrySlug: string
  title: string
  status: string
  overview: string | null
  commonProblems: string[]
  howHelps: string | null
  features: string[]
  contentAngles: string[]
  hooks: string[]
  useCases: string[]
  claimsToAvoid: string[]
  recommendedCta: string | null
  relatedLinks: { label: string; url: string }[]
}

interface Industry { slug: string; name: string; category: string }

const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"]

const emptyForm = {
  industrySlug: "", title: "", status: "DRAFT", overview: "", howHelps: "",
  commonProblems: "", features: "", contentAngles: "", hooks: "", useCases: "",
  claimsToAvoid: "", recommendedCta: "", relatedLinks: "", sortOrder: "0",
}

function lines(s: string) { return s.split("\n").map((x) => x.trim()).filter(Boolean) }
function join(a: string[] | null | undefined) { return (a || []).join("\n") }

export default function AdminGuidesPage() {
  const [items, setItems] = useState<Guide[]>([])
  const [industries, setIndustries] = useState<Industry[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/creators/guides")
      const d = await r.json()
      setItems(d.items || [])
      setIndustries(d.industries || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function openNew() {
    setEditing("new")
    setForm({ ...emptyForm })
    setMsg(null)
  }

  function openEdit(g: Guide) {
    setEditing(g.id)
    setForm({
      industrySlug: g.industrySlug, title: g.title, status: g.status,
      overview: g.overview || "", howHelps: g.howHelps || "",
      commonProblems: join(g.commonProblems), features: join(g.features),
      contentAngles: join(g.contentAngles), hooks: join(g.hooks),
      useCases: join(g.useCases), claimsToAvoid: join(g.claimsToAvoid),
      recommendedCta: g.recommendedCta || "",
      relatedLinks: (g.relatedLinks || []).map((l) => `${l.label} | ${l.url}`).join("\n"),
      sortOrder: "0",
    })
    setMsg(null)
  }

  async function save() {
    setSaving(true)
    setMsg(null)
    const payload = {
      industrySlug: form.industrySlug,
      title: form.title,
      status: form.status,
      overview: form.overview || null,
      howHelps: form.howHelps || null,
      commonProblems: lines(form.commonProblems),
      features: lines(form.features),
      contentAngles: lines(form.contentAngles),
      hooks: lines(form.hooks),
      useCases: lines(form.useCases),
      claimsToAvoid: lines(form.claimsToAvoid),
      recommendedCta: form.recommendedCta || null,
      relatedLinks: lines(form.relatedLinks).map((l) => {
        const [label, url] = l.split("|").map((x) => x.trim())
        return { label: label || url || "", url: url || "" }
      }).filter((l) => l.url),
      sortOrder: Number(form.sortOrder) || 0,
    }
    try {
      const url = editing === "new" ? "/api/admin/creators/guides" : `/api/admin/creators/guides/${editing}`
      const r = await fetch(url, {
        method: editing === "new" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (!r.ok) setMsg({ kind: "err", text: d.error || "Save failed" })
      else {
        setMsg({ kind: "ok", text: "Saved" })
        setEditing(null)
        await load()
      }
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this guide?")) return
    await fetch(`/api/admin/creators/guides/${id}`, { method: "DELETE" })
    await load()
  }

  const covered = new Set(items.map((g) => g.industrySlug))
  const uncovered = industries.filter((i) => !covered.has(i.slug))
  const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Business Type Guides</h2>
          <p className="text-muted-foreground">One creator guide per supported MartPoint business type.</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> New guide</Button>
      </div>

      {msg && <p className={`text-sm ${msg.kind === "ok" ? "text-green-600" : "text-destructive"}`}>{msg.text}</p>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="p-4">Guide</th>
                  <th className="p-4">Business type</th>
                  <th className="p-4">Status</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((g) => (
                  <tr key={g.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="p-4 font-medium">{g.title}</td>
                    <td className="p-4 text-xs">{industries.find((i) => i.slug === g.industrySlug)?.name || g.industrySlug}</td>
                    <td className="p-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${g.status === "PUBLISHED" ? "bg-green-100 text-green-700" : g.status === "ARCHIVED" ? "bg-muted text-muted-foreground" : "bg-amber-100 text-amber-700"}`}>
                        {enumLabel(g.status)}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => openEdit(g)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="outline" onClick={() => remove(g.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {uncovered.length > 0 && (
                  <tr>
                    <td colSpan={4} className="p-4 text-xs text-muted-foreground">
                      {uncovered.length} business type{uncovered.length === 1 ? "" : "s"} without a guide: {uncovered.slice(0, 8).map((i) => i.name).join(", ")}{uncovered.length > 8 ? "…" : ""}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{editing === "new" ? "New guide" : "Edit guide"}</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Close</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Business type</span>
                <select className={field} value={form.industrySlug} onChange={(e) => setForm({ ...form, industrySlug: e.target.value })}>
                  <option value="">— select —</option>
                  {industries.map((i) => <option key={i.slug} value={i.slug}>{i.name} ({enumLabel(i.category)})</option>)}
                </select></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Title</span>
                <input className={field} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Status</span>
                <select className={field} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{enumLabel(s)}</option>)}</select></label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Business overview</span>
                <textarea rows={3} className={field} value={form.overview} onChange={(e) => setForm({ ...form, overview: e.target.value })} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">How MartPoint helps</span>
                <textarea rows={3} className={field} value={form.howHelps} onChange={(e) => setForm({ ...form, howHelps: e.target.value })} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Common problems (one per line)</span>
                <textarea rows={4} className={field} value={form.commonProblems} onChange={(e) => setForm({ ...form, commonProblems: e.target.value })} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Relevant features (one per line)</span>
                <textarea rows={4} className={field} value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Content angles (one per line)</span>
                <textarea rows={4} className={field} value={form.contentAngles} onChange={(e) => setForm({ ...form, contentAngles: e.target.value })} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Hooks (one per line)</span>
                <textarea rows={4} className={field} value={form.hooks} onChange={(e) => setForm({ ...form, hooks: e.target.value })} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Use cases (one per line)</span>
                <textarea rows={4} className={field} value={form.useCases} onChange={(e) => setForm({ ...form, useCases: e.target.value })} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Claims to avoid (one per line)</span>
                <textarea rows={4} className={field} value={form.claimsToAvoid} onChange={(e) => setForm({ ...form, claimsToAvoid: e.target.value })} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Recommended CTA</span>
                <textarea rows={2} className={field} value={form.recommendedCta} onChange={(e) => setForm({ ...form, recommendedCta: e.target.value })} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Related links (one per line: Label | URL)</span>
                <textarea rows={4} className={field} value={form.relatedLinks} onChange={(e) => setForm({ ...form, relatedLinks: e.target.value })} /></label>
            </div>
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
