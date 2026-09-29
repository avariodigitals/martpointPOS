"use client"

import { useEffect, useState } from "react"
import { VacancyForm } from "../vacancy-form"
import { Loader2 } from "lucide-react"
import type { TemplateVacancyPrefill } from "@/lib/careers-role-templates"

interface TemplateOption { id: string; name: string; role_category: string; status: string }

const CATEGORY_LABELS: Record<string, string> = { CORE: "Core", FLEXIBLE: "Flexible", RETAINER: "Retainer" }

export default function NewVacancyPage() {
  const [data, setData] = useState<{ departments: { id: string; name: string }[]; categories: { id: string; name: string }[]; admins: { id: string; name: string; role: string }[] } | null>(null)
  const [templates, setTemplates] = useState<TemplateOption[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState("")
  const [prefill, setPrefill] = useState<{ data: TemplateVacancyPrefill; name: string } | null>(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)

  useEffect(() => {
    fetch("/api/admin/careers/settings").then((r) => r.json()).then(setData).catch(() => setData({ departments: [], categories: [], admins: [] }))
    fetch("/api/admin/careers/role-templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates || []))
      .catch(() => {})
  }, [])

  async function pickTemplate(id: string) {
    setSelectedTemplate(id)
    if (!id) { setPrefill(null); return }
    setLoadingTemplate(true)
    try {
      const res = await fetch(`/api/admin/careers/role-templates/${id}?prefill=1`)
      const d = await res.json()
      if (d.prefill) setPrefill({ data: d.prefill, name: d.template?.name || "Role template" })
    } catch {
      // ignore — admin can still fill the form manually
    } finally {
      setLoadingTemplate(false)
    }
  }

  if (!data) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Vacancy</h2>
        <p className="text-muted-foreground">Create a vacancy — it stays as a draft until published.</p>
      </div>

      {templates.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <label className="block text-sm font-medium mb-1.5">Start from a role template (optional)</label>
          <div className="flex items-center gap-3">
            <select
              className="w-full max-w-md rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={selectedTemplate}
              onChange={(e) => pickTemplate(e.target.value)}
            >
              <option value="">Blank vacancy</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {CATEGORY_LABELS[t.role_category] || t.role_category}{t.status === "INACTIVE" ? " (inactive)" : ""}
                </option>
              ))}
            </select>
            {loadingTemplate && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            A template prefills responsibilities, work conditions, compensation and screening questions — everything stays editable.
          </p>
        </div>
      )}

      <VacancyForm
        key={selectedTemplate || "blank"}
        departments={data.departments}
        categories={data.categories}
        admins={data.admins}
        prefill={prefill?.data}
        templateName={prefill?.name}
      />
    </div>
  )
}
