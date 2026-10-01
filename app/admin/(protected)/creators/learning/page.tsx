"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Loader2, Plus, ArrowUp, ArrowDown, Pencil, ListChecks,
} from "lucide-react"

interface LearningItem {
  id: string
  slug: string
  title: string
  type: string
  category: string
  status: string
  required: boolean
  isOnboardingStep: boolean
  onboardingOrder: number | null
  sortOrder: number
  description: string | null
  body: string | null
  videoUrl: string | null
  externalUrl: string | null
  durationSeconds: number | null
  passScore: number
  maxAttempts: number
  questionsCount: number
  businessType: string[] | null
}

interface Question {
  id?: string
  question: string
  type: "SINGLE" | "MULTI" | "TRUE_FALSE"
  options: { key: string; text: string }[]
  correctKeys: string[]
  feedback: string | null
}

const TYPES = ["ARTICLE", "VIDEO", "GUIDE", "LINK", "ASSESSMENT"]
const CATEGORIES = ["GETTING_STARTED", "MARTPOINT_101", "SELLING_INVENTORY", "BUSINESS_MANAGEMENT", "DIGITAL_COMMERCE", "BUSINESS_TYPE", "OTHER"]
const STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"]

const emptyForm = {
  title: "", slug: "", type: "ARTICLE", category: "MARTPOINT_101",
  status: "DRAFT", description: "", body: "", videoUrl: "", externalUrl: "",
  durationSeconds: "", required: false, isOnboardingStep: false,
  onboardingOrder: "", sortOrder: "0", passScore: "70", maxAttempts: "3",
  businessType: "",
}

export default function AdminLearningPage() {
  const [items, setItems] = useState<LearningItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("")
  const [editing, setEditing] = useState<string | null>(null) // id or "new"
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null)
  const [questionsFor, setQuestionsFor] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Question[]>([])
  const [savingQuestions, setSavingQuestions] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/creators/learning")
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
    setQuestionsFor(null)
  }

  function openEdit(it: LearningItem) {
    setEditing(it.id)
    setForm({
      title: it.title, slug: it.slug, type: it.type, category: it.category,
      status: it.status, description: it.description || "", body: it.body || "",
      videoUrl: it.videoUrl || "", externalUrl: it.externalUrl || "",
      durationSeconds: it.durationSeconds ? String(it.durationSeconds) : "",
      required: it.required, isOnboardingStep: it.isOnboardingStep,
      onboardingOrder: it.onboardingOrder ? String(it.onboardingOrder) : "",
      sortOrder: String(it.sortOrder), passScore: String(it.passScore),
      maxAttempts: String(it.maxAttempts),
      businessType: (it.businessType || []).join(", "),
    })
    setMsg(null)
    setQuestionsFor(null)
  }

  async function save() {
    setSaving(true)
    setMsg(null)
    const payload = {
      title: form.title,
      slug: form.slug || undefined,
      type: form.type, category: form.category, status: form.status,
      description: form.description || null,
      body: form.body || null,
      videoUrl: form.videoUrl || null,
      externalUrl: form.externalUrl || null,
      durationSeconds: form.durationSeconds ? Number(form.durationSeconds) : null,
      required: form.required,
      isOnboardingStep: form.isOnboardingStep,
      onboardingOrder: form.onboardingOrder ? Number(form.onboardingOrder) : null,
      sortOrder: Number(form.sortOrder) || 0,
      passScore: Number(form.passScore) || 70,
      maxAttempts: Number(form.maxAttempts) || 3,
      businessType: form.businessType ? form.businessType.split(",").map((s) => s.trim()).filter(Boolean) : null,
    }
    try {
      const url = editing === "new" ? "/api/admin/creators/learning" : `/api/admin/creators/learning/${editing}`
      const r = await fetch(url, {
        method: editing === "new" ? "POST" : "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const d = await r.json()
      if (!r.ok) {
        setMsg({ kind: "err", text: d.error || "Save failed" })
      } else {
        setMsg({ kind: "ok", text: "Saved" })
        await load()
        if (editing === "new") setEditing(d.id)
      }
    } finally {
      setSaving(false)
    }
  }

  async function setStatus(id: string, status: string) {
    await fetch(`/api/admin/creators/learning/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    await load()
  }

  async function move(id: string, dir: -1 | 1) {
    const idx = items.findIndex((i) => i.id === id)
    const swapWith = items[idx + dir]
    if (!swapWith) return
    const ids = items.map((i) => i.id)
    ids[idx] = swapWith.id
    ids[idx + dir] = id
    setItems(items.map((i) => ({ ...i, sortOrder: ids.indexOf(i.id) })))
    await fetch("/api/admin/creators/learning/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds: ids }),
    })
  }

  async function openQuestions(id: string) {
    const r = await fetch(`/api/admin/creators/learning/${id}/questions`)
    const d = await r.json()
    setQuestions(d.questions || [])
    setQuestionsFor(id)
  }

  async function saveQuestions() {
    if (!questionsFor) return
    setSavingQuestions(true)
    try {
      const r = await fetch(`/api/admin/creators/learning/${questionsFor}/questions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions }),
      })
      const d = await r.json()
      setMsg(r.ok ? { kind: "ok", text: "Questions saved" } : { kind: "err", text: d.error || "Failed" })
      if (r.ok) await load()
    } finally {
      setSavingQuestions(false)
    }
  }

  const visible = filter ? items.filter((i) => i.status === filter || i.type === filter) : items
  const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Learning Centre</h2>
          <p className="text-muted-foreground">Manage Creator Academy content — lessons, videos, guides, links, assessments.</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> New content</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">All items</option>
          <optgroup label="Status">{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</optgroup>
          <optgroup label="Type">{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</optgroup>
        </select>
      </div>

      {msg && !editing && (
        <p className={`text-sm ${msg.kind === "ok" ? "text-green-600" : "text-destructive"}`}>{msg.text}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : visible.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">No learning content yet. Create the first item.</CardContent></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="p-3 w-16">Order</th>
                  <th className="p-3">Title</th>
                  <th className="p-3">Type</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Flags</th>
                  <th className="p-3">Status</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((it) => (
                  <tr key={it.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="p-3">
                      <div className="flex gap-1">
                        <button onClick={() => move(it.id, -1)} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Move up"><ArrowUp className="w-3.5 h-3.5" /></button>
                        <button onClick={() => move(it.id, 1)} className="p-1 text-muted-foreground hover:text-foreground" aria-label="Move down"><ArrowDown className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                    <td className="p-3">
                      <p className="font-medium">{it.title}</p>
                      <p className="text-xs text-muted-foreground font-mono">{it.slug}</p>
                    </td>
                    <td className="p-3 text-xs">{it.type}{it.type === "ASSESSMENT" ? ` · ${it.questionsCount}q` : ""}</td>
                    <td className="p-3 text-xs">{it.category}</td>
                    <td className="p-3 text-xs space-x-1">
                      {it.required && <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5">Required</span>}
                      {it.isOnboardingStep && <span className="rounded-full bg-blue-100 text-blue-700 px-2 py-0.5">Onboarding{it.onboardingOrder != null ? ` #${it.onboardingOrder}` : ""}</span>}
                    </td>
                    <td className="p-3">
                      <select
                        value={it.status}
                        onChange={(e) => setStatus(it.id, e.target.value)}
                        className={`rounded-full px-2 py-0.5 text-xs border-0 ${it.status === "PUBLISHED" ? "bg-green-100 text-green-700" : it.status === "ARCHIVED" ? "bg-muted text-muted-foreground" : "bg-amber-100 text-amber-700"}`}
                      >
                        {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => openEdit(it)}><Pencil className="w-3.5 h-3.5" /></Button>
                        {it.type === "ASSESSMENT" && (
                          <Button size="sm" variant="outline" onClick={() => openQuestions(it.id)} title="Edit questions">
                            <ListChecks className="w-3.5 h-3.5" />
                          </Button>
                        )}
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
              <h3 className="font-semibold">{editing === "new" ? "New content" : "Edit content"}</h3>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(null); setQuestionsFor(null) }}>Close</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <label className="space-y-1 md:col-span-2"><span className="text-xs text-muted-foreground">Title</span>
                <input className={field} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Slug (blank = auto)</span>
                <input className={field} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Type</span>
                <select className={field} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Category</span>
                <select className={field} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Status</span>
                <select className={field} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></label>
              <label className="space-y-1 md:col-span-3"><span className="text-xs text-muted-foreground">Short description</span>
                <input className={field} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
              {(form.type === "ARTICLE" || form.type === "GUIDE" || form.type === "ASSESSMENT") && (
                <label className="space-y-1 md:col-span-3"><span className="text-xs text-muted-foreground">Body</span>
                  <textarea rows={10} className={field} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} /></label>
              )}
              {form.type === "VIDEO" && (
                <>
                  <label className="space-y-1 md:col-span-2"><span className="text-xs text-muted-foreground">Video URL (YouTube embed/Vimeo/MP4)</span>
                    <input className={field} value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} /></label>
                  <label className="space-y-1"><span className="text-xs text-muted-foreground">Duration (seconds)</span>
                    <input className={field} type="number" value={form.durationSeconds} onChange={(e) => setForm({ ...form, durationSeconds: e.target.value })} /></label>
                </>
              )}
              {form.type === "LINK" && (
                <label className="space-y-1 md:col-span-3"><span className="text-xs text-muted-foreground">External URL (e.g. /help-centre/article-slug)</span>
                  <input className={field} value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })} /></label>
              )}
              {form.type === "ASSESSMENT" && (
                <>
                  <label className="space-y-1"><span className="text-xs text-muted-foreground">Pass score (%)</span>
                    <input className={field} type="number" value={form.passScore} onChange={(e) => setForm({ ...form, passScore: e.target.value })} /></label>
                  <label className="space-y-1"><span className="text-xs text-muted-foreground">Max attempts (0 = unlimited)</span>
                    <input className={field} type="number" value={form.maxAttempts} onChange={(e) => setForm({ ...form, maxAttempts: e.target.value })} /></label>
                </>
              )}
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Sort order</span>
                <input className={field} type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Onboarding order (blank = not a step)</span>
                <input className={field} type="number" value={form.onboardingOrder} onChange={(e) => setForm({ ...form, onboardingOrder: e.target.value })} /></label>
              <label className="space-y-1 md:col-span-3"><span className="text-xs text-muted-foreground">Business types (comma-separated slugs, optional)</span>
                <input className={field} value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })} placeholder="e.g. retail-store, fashion-boutique" /></label>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} /> Required</label>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isOnboardingStep} onChange={(e) => setForm({ ...form, isOnboardingStep: e.target.checked })} /> Onboarding step</label>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}</Button>
              {msg && <p className={`text-sm ${msg.kind === "ok" ? "text-green-600" : "text-destructive"}`}>{msg.text}</p>}
            </div>
          </CardContent>
        </Card>
      )}

      {questionsFor && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Assessment questions</h3>
              <Button variant="ghost" size="sm" onClick={() => setQuestionsFor(null)}>Close</Button>
            </div>
            {questions.map((q, qi) => (
              <div key={qi} className="rounded-md border p-4 space-y-3">
                <div className="flex gap-3">
                  <input className={field} value={q.question} placeholder="Question text"
                    onChange={(e) => setQuestions(questions.map((x, i) => i === qi ? { ...x, question: e.target.value } : x))} />
                  <select className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={q.type}
                    onChange={(e) => {
                      const t = e.target.value as Question["type"]
                      setQuestions(questions.map((x, i) => i === qi ? {
                        ...x, type: t,
                        options: t === "TRUE_FALSE" ? [] : x.options,
                        correctKeys: [],
                      } : x))
                    }}>
                    <option value="SINGLE">Single choice</option>
                    <option value="MULTI">Multi select</option>
                    <option value="TRUE_FALSE">True / False</option>
                  </select>
                  <Button variant="ghost" size="sm" onClick={() => setQuestions(questions.filter((_, i) => i !== qi))}>Remove</Button>
                </div>
                {q.type === "TRUE_FALSE" ? (
                  <div className="flex gap-4 text-sm">
                    {(["true", "false"] as const).map((k) => (
                      <label key={k} className="flex items-center gap-2">
                        <input type="radio" name={`q-${qi}`} checked={q.correctKeys.includes(k)}
                          onChange={() => setQuestions(questions.map((x, i) => i === qi ? { ...x, correctKeys: [k] } : x))} />
                        {k === "true" ? "True" : "False"}
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <input type={q.type === "SINGLE" ? "radio" : "checkbox"} name={`q-${qi}`}
                          checked={q.correctKeys.includes(opt.key)}
                          onChange={() => setQuestions(questions.map((x, i) => {
                            if (i !== qi) return x
                            const checked = x.correctKeys.includes(opt.key)
                            return {
                              ...x,
                              correctKeys: x.type === "SINGLE" ? [opt.key]
                                : checked ? x.correctKeys.filter((k) => k !== opt.key) : [...x.correctKeys, opt.key],
                            }
                          }))} />
                        <span className="text-xs font-mono w-5">{opt.key}.</span>
                        <input className={field} value={opt.text}
                          onChange={(e) => setQuestions(questions.map((x, i) => i === qi ? {
                            ...x, options: x.options.map((o, j) => j === oi ? { ...o, text: e.target.value } : o),
                          } : x))} />
                        <Button variant="ghost" size="sm" onClick={() => setQuestions(questions.map((x, i) => i === qi ? { ...x, options: x.options.filter((_, j) => j !== oi), correctKeys: x.correctKeys.filter((k) => k !== opt.key) } : x))}>×</Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => {
                      const nextKey = String.fromCharCode(97 + q.options.length)
                      setQuestions(questions.map((x, i) => i === qi ? { ...x, options: [...x.options, { key: nextKey, text: "" }] } : x))
                    }}>+ Option</Button>
                  </div>
                )}
                <input className={field} value={q.feedback || ""} placeholder="Feedback shown when wrong (optional)"
                  onChange={(e) => setQuestions(questions.map((x, i) => i === qi ? { ...x, feedback: e.target.value } : x))} />
              </div>
            ))}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setQuestions([...questions, { question: "", type: "SINGLE", options: [{ key: "a", text: "" }, { key: "b", text: "" }], correctKeys: [], feedback: null }])}>
                + Add question
              </Button>
              <Button onClick={saveQuestions} disabled={savingQuestions}>
                {savingQuestions ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save questions"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
