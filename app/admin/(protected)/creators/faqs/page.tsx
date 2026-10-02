"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react"
import { enumLabel } from "@/lib/utils"

interface Faq {
  id: string
  question: string
  answer: string
  category: string
  status: string
  sortOrder: number
}

const CATEGORIES = ["APPLICATIONS", "ACCOUNT", "LEARNING", "CONTENT", "CHALLENGES", "SUBMISSIONS", "REFERRALS", "REWARDS", "PAYMENTS", "RULES", "GENERAL"]
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"]

const emptyForm = { question: "", answer: "", category: "GENERAL", status: "PUBLISHED", sortOrder: "0" }

export default function AdminFaqsPage() {
  const [items, setItems] = useState<Faq[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/creators/faqs")
      const d = await r.json()
      setItems(d.items || [])
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

  function openEdit(f: Faq) {
    setEditing(f.id)
    setForm({ question: f.question, answer: f.answer, category: f.category, status: f.status, sortOrder: String(f.sortOrder) })
    setMsg(null)
  }

  async function save() {
    setSaving(true)
    setMsg(null)
    try {
      const url = editing === "new" ? "/api/admin/creators/faqs" : `/api/admin/creators/faqs/${editing}`
      const r = await fetch(url, {
        method: editing === "new" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, sortOrder: Number(form.sortOrder) || 0 }),
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
    if (!confirm("Delete this FAQ?")) return
    await fetch(`/api/admin/creators/faqs/${id}`, { method: "DELETE" })
    await load()
  }

  const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Creator FAQs</h2>
          <p className="text-muted-foreground">Manage the questions creators see in their portal.</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> New FAQ</Button>
      </div>

      {msg && <p className={`text-sm ${msg.kind === "ok" ? "text-green-600" : "text-destructive"}`}>{msg.text}</p>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">No FAQs yet.</CardContent></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="p-4">Question</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Status</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((f) => (
                  <tr key={f.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="p-4 font-medium">{f.question}</td>
                    <td className="p-4 text-xs">{enumLabel(f.category)}</td>
                    <td className="p-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${f.status === "PUBLISHED" ? "bg-green-100 text-green-700" : f.status === "ARCHIVED" ? "bg-muted text-muted-foreground" : "bg-amber-100 text-amber-700"}`}>
                        {enumLabel(f.status)}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => openEdit(f)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="outline" onClick={() => remove(f.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {editing && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{editing === "new" ? "New FAQ" : "Edit FAQ"}</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Close</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 md:col-span-2"><span className="text-xs text-muted-foreground">Question</span>
                <input className={field} value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Category</span>
                <select className={field} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{enumLabel(c)}</option>)}</select></label>
              <label className="space-y-1 md:col-span-3"><span className="text-xs text-muted-foreground">Answer</span>
                <textarea rows={5} className={field} value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Status</span>
                <select className={field} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{enumLabel(s)}</option>)}</select></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Sort order</span>
                <input className={field} type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></label>
            </div>
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
