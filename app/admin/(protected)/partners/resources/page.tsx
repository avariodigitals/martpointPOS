"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Trash2, Download, UploadCloud } from "lucide-react"
import { PARTNER_TYPE_LABELS, type PartnerType } from "@/lib/partners"
import { ORG_CAPABILITY_LABELS, type PartnerOrgCapability } from "@/lib/partner-permissions"

interface Resource {
  id: string
  title: string
  description: string
  category: string
  visibility: "ALL" | "TYPES" | "CAPABILITIES" | "PARTNER"
  allowed_partner_types: PartnerType[] | null
  allowed_capabilities: PartnerOrgCapability[] | null
  active: boolean
  external_url: string | null
  file_url: string | null
  storage_path: string | null
  partner_id: string | null
  signedUrl: string | null
}

interface PartnerMini {
  id: string
  partner_id: string
  business_name: string
  display_name: string
}

const VISIBILITY_OPTIONS: { value: "ALL" | "TYPES" | "CAPABILITIES" | "PARTNER"; label: string }[] = [
  { value: "ALL", label: "All Partners" },
  { value: "TYPES", label: "Specific Partner Types" },
  { value: "CAPABILITIES", label: "Specific Capabilities" },
  { value: "PARTNER", label: "One Specific Partner" },
]

const CATEGORY_OPTIONS = [
  "Training",
  "Certification",
  "Branded Materials",
  "Brochure",
  "Badge",
  "Partner Logo",
  "Learning Materials",
  "Demo",
  "Product Brochures",
  "Sales Materials",
  "Brand Assets",
  "Technical Guides",
  "Product Updates",
  "Templates",
  "Pricing",
]

const PARTNER_TYPES = Object.keys(PARTNER_TYPE_LABELS) as PartnerType[]
const CAPABILITIES = Object.keys(ORG_CAPABILITY_LABELS) as PartnerOrgCapability[]

export default function PartnerResourcesAdminPage() {
  const [resources, setResources] = useState<Resource[]>([])
  const [partners, setPartners] = useState<PartnerMini[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [message, setMessage] = useState("")
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    visibility: "ALL" as "ALL" | "TYPES" | "CAPABILITIES" | "PARTNER",
    allowedPartnerTypes: [] as PartnerType[],
    allowedCapabilities: [] as PartnerOrgCapability[],
    partnerId: "" as string,
    externalUrl: "",
    active: true,
    storagePath: "" as string,
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  useEffect(() => {
    fetchResources()
    fetchPartners()
  }, [])

  async function fetchResources() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/partner-resources")
      const data = await res.json()
      setResources((data.resources || []) as Resource[])
    } finally {
      setLoading(false)
    }
  }

  async function fetchPartners() {
    try {
      const res = await fetch("/api/admin/partners")
      const data = await res.json()
      setPartners((data.partners || []) as PartnerMini[])
    } catch {}
  }

  async function uploadFile() {
    if (!selectedFile) return
    setUploading(true)
    setMessage("")
    try {
      const fd = new FormData()
      fd.append("file", selectedFile)
      const res = await fetch("/api/admin/partner-resources/upload", { method: "POST", body: fd })
      const data = await res.json()
      if (res.ok) {
        setForm((prev) => ({ ...prev, storagePath: data.storagePath }))
        setMessage("File uploaded. You can now save the resource.")
      } else {
        setMessage(data.error || "Upload failed")
      }
    } finally {
      setUploading(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.category) {
      setMessage("Title and category are required.")
      return
    }
    setSaving(true)
    setMessage("")
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        description: form.description,
        category: form.category,
        visibility: form.visibility,
        active: form.active,
        storagePath: form.storagePath || undefined,
        externalUrl: form.externalUrl || undefined,
      }
      if (form.visibility === "TYPES") body.allowedPartnerTypes = form.allowedPartnerTypes
      if (form.visibility === "CAPABILITIES") body.allowedCapabilities = form.allowedCapabilities
      if (form.visibility === "PARTNER") body.partnerId = form.partnerId

      const res = await fetch("/api/admin/partner-resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setShowForm(false)
        setForm({ title: "", description: "", category: "", visibility: "ALL", allowedPartnerTypes: [], allowedCapabilities: [], partnerId: "", externalUrl: "", active: true, storagePath: "" })
        setSelectedFile(null)
        setMessage("Resource saved.")
        fetchResources()
      } else {
        const data = await res.json()
        setMessage(data.error || "Failed to save resource.")
      }
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this resource?")) return
    const res = await fetch(`/api/admin/partner-resources?id=${encodeURIComponent(id)}`, { method: "DELETE" })
    if (res.ok) fetchResources()
  }

  function toggle<T extends string>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Partner Resources</h2>
          <p className="text-muted-foreground">Manage Training, Certification, Branded Materials and other resources.</p>
        </div>
        {!showForm && <Button onClick={() => setShowForm(true)}><Plus className="w-4 h-4 mr-2" /> Add Resource</Button>}
      </div>

      {message && <p className={`text-sm ${message.includes("saved") || message.includes("uploaded") ? "text-green-600" : "text-red-500"}`}>{message}</p>}

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">New Resource</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select category</option>
                  {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value as "ALL" | "TYPES" | "CAPABILITIES" | "PARTNER" })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {VISIBILITY_OPTIONS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
                {form.visibility === "PARTNER" && (
                  <select value={form.partnerId} onChange={(e) => setForm({ ...form, partnerId: e.target.value })} required className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Select partner</option>
                    {partners.map((p) => <option key={p.id} value={p.id}>{p.display_name || p.business_name} ({p.partner_id})</option>)}
                  </select>
                )}
              </div>

              {form.visibility === "TYPES" && (
                <div className="flex flex-wrap gap-2">
                  {PARTNER_TYPES.map((t) => (
                    <label key={t} className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={form.allowedPartnerTypes.includes(t)} onChange={() => setForm({ ...form, allowedPartnerTypes: toggle(form.allowedPartnerTypes, t) })} />
                      {PARTNER_TYPE_LABELS[t]}
                    </label>
                  ))}
                </div>
              )}

              {form.visibility === "CAPABILITIES" && (
                <div className="flex flex-wrap gap-2">
                  {CAPABILITIES.map((c) => (
                    <label key={c} className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={form.allowedCapabilities.includes(c)} onChange={() => setForm({ ...form, allowedCapabilities: toggle(form.allowedCapabilities, c) })} />
                      {ORG_CAPABILITY_LABELS[c]}
                    </label>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input placeholder="External URL (optional)" value={form.externalUrl} onChange={(e) => setForm({ ...form, externalUrl: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>

              <div className="rounded-md border border-border p-3 space-y-2">
                <p className="text-xs font-medium">Upload file</p>
                <div className="flex items-center gap-2">
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.zip" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} className="text-sm flex-1" />
                  <Button type="button" size="sm" variant="outline" onClick={uploadFile} disabled={uploading || !selectedFile}>
                    {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                    Upload
                  </Button>
                </div>
                {form.storagePath && <p className="text-xs text-green-700">File uploaded: {form.storagePath}</p>}
                <p className="text-xs text-muted-foreground">PDF, image, Word, ZIP. Max 10 MB.</p>
              </div>

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
                <div key={r.id} className="flex items-start justify-between p-3 border-b border-border last:border-0 gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.category} · {r.visibility}
                      {r.partner_id && ` · ${partners.find((p) => p.id === r.partner_id)?.display_name || partners.find((p) => p.id === r.partner_id)?.business_name || "Private"}`}
                    </p>
                    {r.description && <p className="text-xs text-muted-foreground mt-1">{r.description}</p>}
                    {r.storage_path && <p className="text-xs text-muted-foreground">{r.storage_path}</p>}
                    {r.external_url && <a href={r.external_url} target="_blank" rel="noopener noreferrer" className="text-xs text-retail hover:underline">{r.external_url}</a>}
                  </div>
                  <div className="flex items-center gap-2">
                    {r.signedUrl && (
                      <a href={r.signedUrl} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline"><Download className="w-3.5 h-3.5" /></Button>
                      </a>
                    )}
                    <Button size="sm" variant="outline" onClick={() => remove(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
