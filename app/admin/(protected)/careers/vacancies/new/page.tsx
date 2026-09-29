"use client"

import { useEffect, useState } from "react"
import { VacancyForm } from "../vacancy-form"
import { Loader2 } from "lucide-react"

export default function NewVacancyPage() {
  const [data, setData] = useState<{ departments: { id: string; name: string }[]; categories: { id: string; name: string }[]; admins: { id: string; name: string; role: string }[] } | null>(null)

  useEffect(() => {
    fetch("/api/admin/careers/settings").then((r) => r.json()).then(setData).catch(() => setData({ departments: [], categories: [], admins: [] }))
  }, [])

  if (!data) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">New Vacancy</h2>
        <p className="text-muted-foreground">Create a vacancy — it stays as a draft until published.</p>
      </div>
      <VacancyForm departments={data.departments} categories={data.categories} admins={data.admins} />
    </div>
  )
}
