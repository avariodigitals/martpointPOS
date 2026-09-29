"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Plus } from "lucide-react"
import type { CareerRoleTemplate } from "@/lib/careers-role-templates"
import { ROLE_CATEGORY_LABELS, TEMPLATE_STATUS_LABELS } from "@/lib/careers-role-templates"
import { EMPLOYMENT_TYPE_LABELS } from "@/lib/careers"

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-50 text-green-700",
  INACTIVE: "bg-amber-50 text-amber-700",
  ARCHIVED: "bg-gray-200 text-gray-500",
}

export default function RoleTemplatesPage() {
  const [loading, setLoading] = useState(true)
  const [templates, setTemplates] = useState<CareerRoleTemplate[]>([])
  const [category, setCategory] = useState("")
  const [includeArchived, setIncludeArchived] = useState(false)

  useEffect(() => {
    void Promise.resolve().then(() => {
      setLoading(true)
      const params = new URLSearchParams()
      if (category) params.set("category", category)
      if (includeArchived) params.set("status", "")
      fetch(`/api/admin/careers/role-templates?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => setTemplates(d.templates || []))
        .catch(() => {})
        .finally(() => setLoading(false))
    })
  }, [category, includeArchived])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Role Templates</h2>
          <p className="text-muted-foreground">
            Reusable vacancy blueprints — selecting one when creating a vacancy prefills responsibilities,
            work conditions, compensation and screening questions.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/careers/role-templates/new"><Plus className="w-4 h-4" /> New Template</Link>
        </Button>
      </div>

      <div className="flex gap-3 items-center">
        <select
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="">All categories</option>
          {Object.entries(ROLE_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" className="accent-retail" checked={includeArchived} onChange={(e) => setIncludeArchived(e.target.checked)} />
          Show archived only
        </label>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : templates.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No role templates found.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Employment</th>
                  <th className="py-3 px-4">Commission</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-border hover:bg-muted/30">
                    <td className="py-3 px-4">
                      <Link href={`/admin/careers/role-templates/${t.id}`} className="font-medium text-retail hover:underline">
                        {t.name}
                      </Link>
                      {t.purpose && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{t.purpose}</p>}
                    </td>
                    <td className="py-3 px-4 text-xs">{ROLE_CATEGORY_LABELS[t.role_category] || t.role_category}</td>
                    <td className="py-3 px-4 text-xs">{t.department_name || "—"}</td>
                    <td className="py-3 px-4 text-xs">{EMPLOYMENT_TYPE_LABELS[t.employment_type] || t.employment_type}</td>
                    <td className="py-3 px-4 text-xs">{t.commission_eligible ? "Eligible" : "—"}</td>
                    <td className="py-3 px-4 text-xs">v{t.version}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[t.status] || ""}`}>
                        {TEMPLATE_STATUS_LABELS[t.status] || t.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
