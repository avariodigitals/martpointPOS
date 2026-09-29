"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, ClipboardCheck, Plus } from "lucide-react"

interface Assessment {
  id: string; name: string; assessment_type: string; vacancy_title?: string
  max_score: number; pass_score: number | null; scheduled_at: string | null
  status: string; created_at: string
}
interface VacancyOpt { id: string; title: string }

export default function AssessmentsPage() {
  const [loading, setLoading] = useState(true)
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [vacancies, setVacancies] = useState<VacancyOpt[]>([])
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: "", assessment_type: "PRACTICAL", vacancy_id: "", instructions: "", max_score: "100", pass_score: "", scheduled_at: "" })
  const [msg, setMsg] = useState("")

  const load = useCallback(() => {
    fetch("/api/admin/careers/assessments").then((r) => r.json())
      .then((d) => setAssessments(d.assessments || []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])
  useEffect(() => {
    fetch("/api/admin/careers/vacancies").then((r) => r.json()).then((d) => setVacancies(d.vacancies || []))
  }, [])

  async function create() {
    setMsg("")
    const res = await fetch("/api/admin/careers/assessments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        vacancy_id: form.vacancy_id || null,
        max_score: Number(form.max_score) || 100,
        pass_score: form.pass_score === "" ? null : Number(form.pass_score),
        scheduled_at: form.scheduled_at || null,
      }),
    })
    const d = await res.json()
    if (res.ok) { setShowNew(false); setForm({ name: "", assessment_type: "PRACTICAL", vacancy_id: "", instructions: "", max_score: "100", pass_score: "", scheduled_at: "" }); load() }
    else setMsg(d.error || "Failed")
  }

  const inputCls = "rounded-md border border-input bg-background px-3 py-1.5 text-sm w-full"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><ClipboardCheck className="w-5 h-5" /> Assessments</h2>
          <p className="text-muted-foreground">Create assessments, invite candidates, and record scores.</p>
        </div>
        <Button onClick={() => setShowNew((s) => !s)}><Plus className="w-4 h-4" /> New assessment</Button>
      </div>

      {showNew && (
        <Card><CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input className={inputCls} placeholder="Assessment name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <select className={inputCls} value={form.assessment_type} onChange={(e) => setForm((f) => ({ ...f, assessment_type: e.target.value }))}>
              <option value="WRITTEN">Written</option>
              <option value="PRACTICAL">Practical</option>
              <option value="PRODUCT_CAPTURE">Product capture (inventory)</option>
              <option value="INTERVIEW">Interview</option>
              <option value="OTHER">Other</option>
            </select>
            <select className={inputCls} value={form.vacancy_id} onChange={(e) => setForm((f) => ({ ...f, vacancy_id: e.target.value }))}>
              <option value="">Linked vacancy (optional)</option>
              {vacancies.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
            </select>
            <input className={inputCls} type="number" placeholder="Max score" value={form.max_score} onChange={(e) => setForm((f) => ({ ...f, max_score: e.target.value }))} />
            <input className={inputCls} type="number" placeholder="Pass score" value={form.pass_score} onChange={(e) => setForm((f) => ({ ...f, pass_score: e.target.value }))} />
            <input className={inputCls} type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))} />
            <textarea className={inputCls + " md:col-span-3"} rows={2} placeholder="Instructions for candidates" value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} />
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={create}>Create</Button>
            {msg && <p className="text-xs text-red-600">{msg}</p>}
          </div>
        </CardContent></Card>
      )}

      <Card><CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : assessments.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No assessments yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
              <th className="py-3 px-4">Assessment</th><th className="py-3 px-4">Type</th><th className="py-3 px-4">Vacancy</th><th className="py-3 px-4">Pass score</th><th className="py-3 px-4">Scheduled</th><th className="py-3 px-4">Status</th>
            </tr></thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.id} className="border-b border-border hover:bg-muted/30">
                  <td className="py-3 px-4"><Link href={`/admin/careers/assessments/${a.id}`} className="font-medium text-retail hover:underline">{a.name}</Link></td>
                  <td className="py-3 px-4 text-xs">{a.assessment_type?.replace(/_/g, " ")}</td>
                  <td className="py-3 px-4 text-xs">{a.vacancy_title || "—"}</td>
                  <td className="py-3 px-4 text-xs">{a.pass_score != null ? `${a.pass_score}/${a.max_score}` : "—"}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{a.scheduled_at ? new Date(a.scheduled_at).toLocaleString() : "—"}</td>
                  <td className="py-3 px-4 text-xs">{a.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent></Card>
    </div>
  )
}
