"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react"

interface ResourceRow {
  id: string
  name: string
  description: string | null
  category: string
  resourceType: string
  filePath: string | null
  externalUrl: string | null
  version: string | null
  usageNotes: string | null
  active: boolean
  sortOrder: number
  body: string | null
  pdfEnabled: boolean
}

const CATEGORIES = [
  "GETTING_STARTED", "BRAND_ASSETS", "LOGOS", "SCREENSHOTS", "PRODUCT_VIDEOS",
  "FEATURE_GUIDES", "BUSINESS_GUIDES", "PLAYBOOK", "CHALLENGE_RESOURCES",
  "TEMPLATES", "PRODUCT_DESCRIPTIONS", "FAQ", "OTHER",
]
const TYPES = ["FILE", "IMAGE", "VIDEO", "ARTICLE", "LINK"]

const emptyForm = {
  name: "", description: "", category: "GETTING_STARTED", resourceType: "FILE",
  externalUrl: "", version: "", usageNotes: "", active: true, sortOrder: "0",
  body: "", pdfEnabled: false,
}

export default function AdminKitPage() {
  const [items, setItems] = useState<ResourceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [file, setFile] = useState<File | null>(null)
  const [existingFilePath, setExistingFilePath] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/creators/resources")
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
    setFile(null)
    setExistingFilePath(null)
    if (fileRef.current) fileRef.current.value = ""
    setMsg(null)
  }

  function openEdit(it: ResourceRow) {
    setEditing(it.id)
    setForm({
      name: it.name, description: it.description || "", category: it.category,
      resourceType: it.resourceType, externalUrl: it.externalUrl || "",
      version: it.version || "", usageNotes: it.usageNotes || "",
      active: it.active, sortOrder: String(it.sortOrder),
      body: it.body || "", pdfEnabled: it.pdfEnabled,
    })
    setFile(null)
    setExistingFilePath(it.filePath)
    if (fileRef.current) fileRef.current.value = ""
    setMsg(null)
  }

  async function save() {
    setSaving(true)
    setMsg(null)
    try {
      const fd = new FormData()
      Object.entries({ ...form, active: String(form.active) }).forEach(([k, v]) => fd.set(k, String(v)))
      if (existingFilePath) fd.set("existingFilePath", existingFilePath)
      if (file) fd.set("file", file)
      const url = editing === "new" ? "/api/admin/creators/resources" : `/api/admin/creators/resources/${editing}`
      const r = await fetch(url, { method: editing === "new" ? "POST" : "PUT", body: fd })
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
    if (!confirm("Delete this resource? Creators will lose access to it.")) return
    await fetch(`/api/admin/creators/resources/${id}`, { method: "DELETE" })
    await load()
  }

  async function toggleActive(it: ResourceRow) {
    const fd = new FormData()
    fd.set("name", it.name)
    fd.set("category", it.category)
    fd.set("resourceType", it.resourceType)
    fd.set("description", it.description || "")
    fd.set("externalUrl", it.externalUrl || "")
    fd.set("version", it.version || "")
    fd.set("usageNotes", it.usageNotes || "")
    fd.set("body", it.body || "")
    fd.set("pdfEnabled", String(it.pdfEnabled))
    fd.set("active", String(!it.active))
    fd.set("sortOrder", String(it.sortOrder))
    if (it.filePath) fd.set("existingFilePath", it.filePath)
    await fetch(`/api/admin/creators/resources/${it.id}`, { method: "PUT", body: fd })
    await load()
  }

  const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Creator Kit</h2>
          <p className="text-muted-foreground">Manage approved assets — logos, screenshots, videos, templates, playbooks.</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> New resource</Button>
      </div>

      {msg && <p className={`text-sm ${msg.kind === "ok" ? "text-green-600" : "text-destructive"}`}>{msg.text}</p>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">No resources yet. Upload the first creator asset.</CardContent></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="p-4">Resource</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Version</th>
                  <th className="p-4">Status</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => (
                  <tr key={it.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="p-4">
                      <p className="font-medium">{it.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {it.filePath ? "Uploaded file" : it.externalUrl || "—"}
                      </p>
                    </td>
                    <td className="p-4 text-xs">{it.category}</td>
                    <td className="p-4 text-xs">{it.resourceType}</td>
                    <td className="p-4 text-xs">{it.version || "—"}</td>
                    <td className="p-4">
                      <button
                        onClick={() => toggleActive(it)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${it.active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}
                      >
                        {it.active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" onClick={() => openEdit(it)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button size="sm" variant="outline" onClick={() => remove(it.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
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
              <h3 className="font-semibold">{editing === "new" ? "New resource" : "Edit resource"}</h3>
              <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>Close</Button>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Name</span>
                <input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Version</span>
                <input className={field} value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="e.g. v1.0" /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Category</span>
                <select className={field} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Type</span>
                <select className={field} value={form.resourceType} onChange={(e) => setForm({ ...form, resourceType: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
              <label className="space-y-1 md:col-span-2"><span className="text-xs text-muted-foreground">Description</span>
                <textarea rows={2} className={field} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">File {editing !== "new" && "(leave empty to keep current)"}</span>
                <input ref={fileRef} type="file" className={field} onChange={(e) => setFile(e.target.files?.[0] || null)} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">External URL (if no file)</span>
                <input className={field} value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Usage notes</span>
                <input className={field} value={form.usageNotes} onChange={(e) => setForm({ ...form, usageNotes: e.target.value })} /></label>
              <label className="space-y-1"><span className="text-xs text-muted-foreground">Sort order</span>
                <input className={field} type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} /></label>
              {form.resourceType === "ARTICLE" && (
                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs text-muted-foreground">
                    Document body — drives &quot;View online&quot; and the branded PDF.
                    Markup: # heading · ## sub-heading · - bullet · 1. numbered · &gt; callout · | col | col | tables · ![caption](/path.png)
                  </span>
                  <textarea rows={12} className={`${field} font-mono text-xs`} value={form.body}
                    onChange={(e) => setForm({ ...form, body: e.target.value })} />
                </label>
              )}
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active
              </label>
              {form.resourceType === "ARTICLE" && (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.pdfEnabled} onChange={(e) => setForm({ ...form, pdfEnabled: e.target.checked })} /> Enable PDF download
                </label>
              )}
            </div>
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
