"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { PARTNER_TYPE_LABELS, type PartnerType } from "@/lib/partners"
import { ORG_CAPABILITY_LABELS, type PartnerOrgCapability } from "@/lib/partner-permissions"

interface Resource {
  id: string
  title: string
  description: string
  category: string
  visibility: "ALL" | "TYPES" | "CAPABILITIES"
  allowed_partner_types: PartnerType[] | null
  allowed_capabilities: PartnerOrgCapability[] | null
  active: boolean
  external_url: string | null
  file_url: string | null
}

const VISIBILITY_OPTIONS = ["ALL", "TYPES", "CAPABILITIES"] as const
const PARTNER_TYPES = Object.keys(PARTNER_TYPE_LABELS) as PartnerType[]
const CAPABILITIES = Object.keys(ORG_CAPABILITY_LABELS) as PartnerOrgCapability[]

export default function PartnerResourcesAdminPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    visibility: "ALL",
    allowedPartnerTypes: [] as PartnerType[],
    allowedCapabilities: [] as PartnerOrgCapability[],
    externalUrl: "",
    fileUrl: "",
    active: true,
  })

  useEffect(() => {
    fetchResources()
  }, [])

  async function fetchResources() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/partner-resources")
      const data = await res.json()
      setResources(data.resources || [])
    } finally {
      setLoading(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        category: form.category,
        visibility: form.visibility,
        active: form.active,
      }
      if (form.externalUrl) body.externalUrl = form.externalUrl
      if (form.fileUrl) body.fileUrl = form.fileUrl
      if (form.visibility === "TYPES") body.allowedPartnerTypes = form.allowedPartnerTypes
      if (form.visibility === "CAPABILITIES") body.allowedCapabilities = form.allowedCapabilities

      const res = await fetch("/api/admin/partner-resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setShowForm(false)
        setForm({ title: "", description: "", category: "", visibility: "ALL", allowedPartnerTypes: [], allowedCapabilities: [], externalUrl: "", fileUrl: "", active: true })
        fetchResources()
      }
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/partner-resources?id=${encodeURIComponent(id)}`, { method: "DELETE" })
    if (res.ok) fetchResources()
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Partner Resources</h2>
          <p className="text-muted-foreground">Manage resources visible inside the Partner Portal.</p>
        </div>
        {!showForm && <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" /> Add Resource</Button>}
      </div>

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">New Resource</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <input placeholder="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <input placeholder="External URL" value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <input placeholder="File URL" value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as "ALL" | "TYPES" | "CAPABILITIES" })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                {VISIBILITY_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
              {form.visibility === "TYPES" && (
                <div className="flex flex-wrap gap-2">
                  {PARTNER_TYPES.map((t) => (
                    <label key={t} className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={form.allowedPartnerTypes.includes(t)} onChange={(e) => {
                        const set = new Set(form.allowedPartnerTypes)
                        if (e.target.checked) set.add(t)
                        else set.delete(t)
                        setForm({ ...form, allowedPartnerTypes: Array.from(set) })
                      }} />
                      {PARTNER_TYPE_LABELS[t]}
                    </label>
                  ))}
                </div>
              )}
              {form.visibility === "CAPABILITIES" && (
                <div className="flex flex-wrap gap-2">
                  {CAPABILITIES.map((c) => (
                    <label key={c} className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={form.allowedCapabilities.includes(c)} onChange={(e) => {
                        const set = new Set(form.allowedCapabilities)
                        if (e.target.checked) set.add(c)
                        else set.delete(c)
                        setForm({ ...form, allowedCapabilities: Array.from(set) })
                      }} />
                      {ORG_CAPABILITY_LABELS[c]}
                    </label>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Resources</CardTitle></CardHeader>
        <CardContent>
          {resources.length === 0 ? <p className="text-sm text-muted-foreground">No resources yet.</p> : (
            <div className="space-y-2">
              {resources.map((r) => (
                <div key={r.id} className="flex items-center justify-between p-3 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.category} · {r.visibility}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => remove(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
