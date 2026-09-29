"use client"

import { useEffect, useState } from "react"
import { RoleTemplateForm } from "../role-template-form"
import { Loader2 } from "lucide-react"

export default function NewRoleTemplatePage() {
  const [data, setData] = useState<{ departments: { id: string; name: string }[]; categories: { id: string; name: string }[] } | null>(null)

  useEffect(() => {
    fetch("/api/admin/careers/settings").then((r) => r.json()).then(setData).catch(() => setData({ departments: [], categories: [] }))
  }, [])

  if (!data) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Role Template</h2>
        <p className="text-muted-foreground">Define a reusable vacancy blueprint — it starts inactive until you activate it.</p>
      </div>
      <RoleTemplateForm departments={data.departments} categories={data.categories} />
    </div>
  )
}
