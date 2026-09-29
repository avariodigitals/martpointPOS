"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { RoleTemplateForm } from "../role-template-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"
import type { CareerRoleTemplate, RoleTemplateVersion } from "@/lib/careers-role-templates"
import { TEMPLATE_STATUS_LABELS } from "@/lib/careers-role-templates"

export default function RoleTemplateDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [loading, setLoading] = useState(true)
  const [template, setTemplate] = useState<CareerRoleTemplate | null>(null)
  const [versions, setVersions] = useState<RoleTemplateVersion[]>([])
  const [meta, setMeta] = useState<{ departments: { id: string; name: string }[]; categories: { id: string; name: string }[] }>({ departments: [], categories: [] })

  const load = useCallback(() => {
    Promise.all([
      fetch(`/api/admin/careers/role-templates/${id}`).then((r) => r.json()),
      fetch("/api/admin/careers/settings").then((r) => r.json()),
    ]).then(([t, m]) => {
      setTemplate(t.template || null)
      setVersions(t.versions || [])
      setMeta({ departments: m.departments || [], categories: m.categories || [] })
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  useEffect(load, [load])

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  if (!template) return <p className="text-sm text-muted-foreground">Template not found.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">{template.name}</h2>
          <p className="text-muted-foreground">
            v{template.version} · {TEMPLATE_STATUS_LABELS[template.status] || template.status}
          </p>
        </div>
        {template.status !== "ARCHIVED" && (
          <Button asChild>
            <Link href={`/admin/careers/vacancies/new`}>Create vacancy from template</Link>
          </Button>
        )}
      </div>

      <RoleTemplateForm template={template} departments={meta.departments} categories={meta.categories} />

      <Card>
        <CardHeader><CardTitle className="text-base">Version history</CardTitle></CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recorded versions.</p>
          ) : (
            <ul className="space-y-2">
              {versions.map((v) => (
                <li key={v.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                  <span className="font-medium">Version {v.version}{v.version === template.version ? " (current)" : ""}</span>
                  <span className="text-xs text-muted-foreground">
                    {v.changed_by_name || "System"} · {new Date(v.created_at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
