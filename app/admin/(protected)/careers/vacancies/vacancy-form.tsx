"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Plus, Trash2, AlertCircle } from "lucide-react"
import {
  EMPLOYMENT_TYPES, WORK_ARRANGEMENTS, COMPENSATION_TYPES, ANSWER_TYPES,
  EMPLOYMENT_TYPE_LABELS, WORK_ARRANGEMENT_LABELS, COMPENSATION_TYPE_LABELS,
  EQUIPMENT_FIELD_KEYS,
  DEFAULT_APPLICATION_CONFIRMATION, CONFIRMATION_MESSAGE_VARS,
  type CareerVacancy,
} from "@/lib/careers"
import type { TemplateVacancyPrefill } from "@/lib/careers-role-templates"
import { STATES } from "@/lib/locations"
import { enumLabel } from "@/lib/utils"

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const labelCls = "block text-sm font-medium mb-1.5"

interface Lookup { id: string; name: string }
interface AdminUser { id: string; name: string; role: string }

interface LocationInput {
  state: string; lga: string; city: string; area_site: string
  full_address: string; public_description: string; nearby_preferred: boolean
}

interface QuestionInput {
  question_text: string; answer_type: string; required: boolean
  knockout: boolean; correct_answer: string; options: string
}

const EQUIPMENT_LABELS: Record<string, string> = {
  owns_android: "Owns Android smartphone",
  smartphone_model: "Smartphone model",
  has_mobile_data: "Reliable mobile data",
  owns_laptop: "Owns laptop",
  owns_power_bank: "Owns power bank",
  transportation: "Means of transportation",
}

const emptyLocation: LocationInput = { state: "", lga: "", city: "", area_site: "", full_address: "", public_description: "", nearby_preferred: false }
const emptyQuestion: QuestionInput = { question_text: "", answer_type: "YES_NO", required: true, knockout: false, correct_answer: "", options: "" }

function toLines(arr: string[] | undefined): string {
  return (arr || []).join("\n")
}
function fromLines(s: string): string[] {
  return s.split("\n").map((l) => l.trim()).filter(Boolean)
}

function rulesToForm(rules: Record<string, unknown> | undefined) {
  const r = (rules || {}) as Record<string, unknown>
  const list = (v: unknown) => (Array.isArray(v) ? (v as string[]).join(", ") : "")
  return {
    eligible_categories: list(r.eligible_categories),
    excluded_categories: list(r.excluded_categories),
    include_overrides: list(r.include_overrides),
    basis: (r.basis as string) || "PERCENTAGE",
    percentage: r.percentage != null ? String(r.percentage) : "",
    fixed_amount: r.fixed_amount_kobo != null ? String(Number(r.fixed_amount_kobo) / 100) : "",
    self_lead_rate: r.self_lead_rate != null ? String(r.self_lead_rate) : "",
    company_lead_rate: r.company_lead_rate != null ? String(r.company_lead_rate) : "",
    minimum_payout: r.minimum_payout_kobo != null ? String(Number(r.minimum_payout_kobo) / 100) : "",
    clawback_on_refund: r.clawback_on_refund !== false,
  }
}

function scorecardToLines(list: { criterion: string; max_score: number }[] | undefined): string {
  return (list || []).map((s) => `${s.criterion}|${s.max_score}`).join("\n")
}

export function VacancyForm({
  vacancy,
  departments,
  categories,
  admins,
  prefill,
  templateName,
}: {
  vacancy?: CareerVacancy
  departments: Lookup[]
  categories: Lookup[]
  admins: AdminUser[]
  prefill?: TemplateVacancyPrefill
  templateName?: string
}) {
  const router = useRouter()
  const isEdit = Boolean(vacancy)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  const [f, setF] = useState({
    title: vacancy?.title || prefill?.title || "",
    slug: vacancy?.slug || "",
    department_id: vacancy?.department_id || prefill?.department_id || "",
    job_category_id: vacancy?.job_category_id || prefill?.job_category_id || "",
    short_summary: vacancy?.short_summary || prefill?.short_summary || "",
    description: vacancy?.description || prefill?.description || "",
    responsibilities: toLines(vacancy?.responsibilities || prefill?.responsibilities),
    requirements: toLines(vacancy?.requirements || prefill?.requirements),
    openings: vacancy?.openings ?? prefill?.openings ?? 1,
    show_openings: vacancy?.show_openings !== false,
    hiring_manager_id: vacancy?.hiring_manager_id || "",
    featured: vacancy?.featured === true,
    urgent: vacancy?.urgent === true,
    employment_type: vacancy?.employment_type || prefill?.employment_type || "PROJECT_BASED",
    work_arrangement: vacancy?.work_arrangement || prefill?.work_arrangement || "ON_SITE",
    working_days: vacancy?.working_days || prefill?.working_days || "",
    work_start_time: vacancy?.work_start_time || prefill?.work_start_time || "",
    work_end_time: vacancy?.work_end_time || prefill?.work_end_time || "",
    project_start_date: vacancy?.project_start_date || "",
    project_end_date: vacancy?.project_end_date || "",
    duration_description: vacancy?.duration_description || "",
    compensation_type: vacancy?.compensation_type || prefill?.compensation_type || "DAILY",
    compensation_min: vacancy?.compensation_min_kobo != null ? vacancy.compensation_min_kobo / 100
      : prefill?.compensation_min_kobo != null ? prefill.compensation_min_kobo / 100 : "",
    compensation_max: vacancy?.compensation_max_kobo != null ? vacancy.compensation_max_kobo / 100
      : prefill?.compensation_max_kobo != null ? prefill.compensation_max_kobo / 100 : "",
    show_compensation: vacancy ? vacancy.show_compensation === true : prefill?.show_compensation === true,
    transport_allowance: vacancy?.transport_allowance_kobo != null ? vacancy.transport_allowance_kobo / 100
      : prefill?.transport_allowance_kobo != null ? prefill.transport_allowance_kobo / 100 : "",
    lunch_provided: vacancy ? vacancy.lunch_provided === true : prefill?.lunch_provided === true,
    accommodation_provided: vacancy?.accommodation_provided === true,
    other_benefits: vacancy?.other_benefits || prefill?.other_benefits || "",
    application_opens_at: vacancy?.application_opens_at ? vacancy.application_opens_at.slice(0, 16) : "",
    application_closes_at: vacancy?.application_closes_at ? vacancy.application_closes_at.slice(0, 16) : "",
    max_applications: vacancy?.max_applications ?? "",
    cv_required: vacancy?.cv_required !== false,
    cover_letter_required: vacancy?.cover_letter_required === true,
    portfolio_enabled: vacancy?.portfolio_enabled === true,
    pass_score: vacancy?.pass_score ?? "",
    confirmation_message: vacancy?.confirmation_message || "",
    auto_close_on_deadline: vacancy?.auto_close_on_deadline !== false,
    auto_close_on_max_applications: vacancy?.auto_close_on_max_applications === true,
  })
  const [equipment, setEquipment] = useState<Record<string, boolean>>(
    vacancy?.equipment_fields || (prefill?.equipment_fields as Record<string, boolean>) || {}
  )
  const [locations, setLocations] = useState<LocationInput[]>(
    vacancy?.locations?.length
      ? vacancy.locations.map((l) => ({
          state: l.state || "", lga: l.lga || "", city: l.city || "",
          area_site: l.area_site || "", full_address: l.full_address || "",
          public_description: l.public_description || "", nearby_preferred: l.nearby_preferred,
        }))
      : prefill?.locations?.length
        ? prefill.locations.map((l) => ({
            state: l.state || "", lga: l.lga || "", city: l.city || "",
            area_site: l.area_site || "", full_address: "",
            public_description: l.public_description || "", nearby_preferred: l.nearby_preferred === true,
          }))
        : [{ ...emptyLocation }]
  )
  const [questions, setQuestions] = useState<QuestionInput[]>(
    vacancy?.questions?.map((q) => ({
      question_text: q.question_text,
      answer_type: q.answer_type,
      required: q.required,
      knockout: q.knockout,
      correct_answer: q.correct_answer || "",
      options: (q.options || []).map((o) => o.option_text).join("\n"),
    })) || prefill?.questions.map((q) => ({
      question_text: q.question_text,
      answer_type: q.answer_type,
      required: q.required,
      knockout: q.knockout,
      correct_answer: q.correct_answer || "",
      options: (q.options || []).join("\n"),
    })) || []
  )

  // Internal workforce fields (mirrored from the role template; never public).
  const [internal, setInternal] = useState({
    role_template_id: vacancy?.role_template_id || prefill?.role_template_id || "",
    role_purpose: vacancy?.role_purpose || prefill?.role_purpose || "",
    probation_period: vacancy?.probation_period || prefill?.probation_period || "",
    reporting_line: vacancy?.reporting_line || prefill?.reporting_line || "",
    performance_indicators: toLines(vacancy?.performance_indicators || prefill?.performance_indicators),
    feeding_arrangement: vacancy?.feeding_arrangement || prefill?.feeding_arrangement || "",
    data_call_allowance: vacancy?.data_call_allowance_kobo != null ? vacancy.data_call_allowance_kobo / 100
      : prefill?.data_call_allowance_kobo != null ? prefill.data_call_allowance_kobo / 100 : "",
    performance_bonus: vacancy?.performance_bonus || prefill?.performance_bonus || "",
    assessment_type: vacancy?.assessment_type || prefill?.assessment_type || "",
    consent_text: vacancy?.consent_text || prefill?.consent_text || "",
    interview_scorecard: scorecardToLines(vacancy?.interview_scorecard || prefill?.interview_scorecard),
  })
  const [commissionEligible, setCommissionEligible] = useState(
    vacancy ? vacancy.commission_eligible === true : prefill?.commission_eligible === true
  )
  const [cr, setCr] = useState(() => rulesToForm(vacancy?.commission_rules || prefill?.commission_rules))
  const setI = <K extends keyof typeof internal>(k: K, v: (typeof internal)[K]) => { setInternal((p) => ({ ...p, [k]: v })); setSaved(false) }
  const setCrField = <K extends keyof typeof cr>(k: K, v: (typeof cr)[K]) => { setCr((p) => ({ ...p, [k]: v })); setSaved(false) }

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF((p) => ({ ...p, [k]: v })); setSaved(false) }
  const setLoc = (i: number, k: keyof LocationInput, v: string | boolean) =>
    setLocations((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  const setQ = (i: number, k: keyof QuestionInput, v: string | boolean) =>
    setQuestions((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)))

  const toIso = (v: string) => (v ? new Date(v).toISOString() : null)
  const toKobo = (v: string | number) => (v === "" || v == null ? null : Math.round(Number(v) * 100))

  async function save(): Promise<string | null> {
    setError("")
    setSaving(true)
    try {
      const payload = {
        title: f.title,
        slug: f.slug || undefined,
        department_id: f.department_id || null,
        job_category_id: f.job_category_id || null,
        short_summary: f.short_summary || null,
        description: f.description || null,
        responsibilities: fromLines(f.responsibilities),
        requirements: fromLines(f.requirements),
        openings: Number(f.openings),
        show_openings: f.show_openings,
        hiring_manager_id: f.hiring_manager_id || null,
        featured: f.featured,
        urgent: f.urgent,
        employment_type: f.employment_type,
        work_arrangement: f.work_arrangement,
        working_days: f.working_days || null,
        work_start_time: f.work_start_time || null,
        work_end_time: f.work_end_time || null,
        project_start_date: f.project_start_date || null,
        project_end_date: f.project_end_date || null,
        duration_description: f.duration_description || null,
        compensation_type: f.compensation_type,
        compensation_min_kobo: toKobo(f.compensation_min),
        compensation_max_kobo: toKobo(f.compensation_max),
        currency: "NGN",
        show_compensation: f.show_compensation,
        transport_allowance_kobo: toKobo(f.transport_allowance),
        lunch_provided: f.lunch_provided,
        accommodation_provided: f.accommodation_provided,
        other_benefits: f.other_benefits || null,
        application_opens_at: toIso(f.application_opens_at),
        application_closes_at: toIso(f.application_closes_at),
        max_applications: f.max_applications === "" ? null : Number(f.max_applications),
        cv_required: f.cv_required,
        cover_letter_required: f.cover_letter_required,
        portfolio_enabled: f.portfolio_enabled,
        pass_score: f.pass_score === "" ? null : Number(f.pass_score),
        confirmation_message: f.confirmation_message || null,
        auto_close_on_deadline: f.auto_close_on_deadline,
        auto_close_on_max_applications: f.auto_close_on_max_applications,
        equipment_fields: equipment,
        locations,
        role_template_id: internal.role_template_id || null,
        role_purpose: internal.role_purpose || null,
        probation_period: internal.probation_period || null,
        reporting_line: internal.reporting_line || null,
        performance_indicators: fromLines(internal.performance_indicators),
        feeding_arrangement: internal.feeding_arrangement || null,
        data_call_allowance_kobo: toKobo(internal.data_call_allowance),
        commission_eligible: commissionEligible,
        commission_rules: {
          basis: cr.basis,
          eligible_categories: cr.eligible_categories.split(",").map((s) => s.trim()).filter(Boolean),
          excluded_categories: cr.excluded_categories.split(",").map((s) => s.trim()).filter(Boolean),
          include_overrides: cr.include_overrides.split(",").map((s) => s.trim()).filter(Boolean),
          percentage: cr.percentage === "" ? null : Number(cr.percentage),
          fixed_amount_kobo: toKobo(cr.fixed_amount),
          self_lead_rate: cr.self_lead_rate === "" ? null : Number(cr.self_lead_rate),
          company_lead_rate: cr.company_lead_rate === "" ? null : Number(cr.company_lead_rate),
          minimum_payout_kobo: toKobo(cr.minimum_payout),
          clawback_on_refund: cr.clawback_on_refund,
        },
        performance_bonus: internal.performance_bonus || null,
        required_equipment: equipment,
        assessment_type: internal.assessment_type || null,
        interview_scorecard: fromLines(internal.interview_scorecard).map((line) => {
          const [criterion, max] = line.split("|").map((s) => s.trim())
          return { criterion, max_score: Number(max) || 10 }
        }).filter((s) => s.criterion),
        consent_text: internal.consent_text || null,
      }

      const url = isEdit ? `/api/admin/careers/vacancies/${vacancy!.id}` : "/api/admin/careers/vacancies"
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")

      const vacancyId = isEdit ? vacancy!.id : data.id

      // Save screening questions
      const qRes = await fetch(`/api/admin/careers/vacancies/${vacancyId}/questions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions: questions.filter((q) => q.question_text.trim()).map((q) => ({
            ...q,
            options: q.options.split("\n").map((o) => o.trim()).filter(Boolean),
          })),
        }),
      })
      const qData = await qRes.json()
      if (!qRes.ok) throw new Error(qData.error || "Failed to save questions")

      setSaved(true)
      if (!isEdit) router.push(`/admin/careers/vacancies/${vacancyId}`)
      return vacancyId
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
      return null
    } finally {
      setSaving(false)
    }
  }

  async function lifecycle(action: string, extra?: Record<string, unknown>) {
    setError("")
    setSaving(true)
    try {
      // Save latest edits first when publishing/scheduling
      if (isEdit && ["publish", "schedule"].includes(action)) {
        const id = await save()
        if (!id) return
      }
      const res = await fetch(`/api/admin/careers/vacancies/${vacancy!.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Action failed")
      router.refresh()
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed")
    } finally {
      setSaving(false)
    }
  }

  const checkField = (label: string, k: keyof typeof f, hint?: string) => (
    <label key={k} className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-0.5 accent-retail" checked={f[k] as boolean} onChange={(e) => set(k, e.target.checked as never)} />
      <span>{label}{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</span>
    </label>
  )

  return (
    <div className="space-y-6">
      {templateName && !isEdit && (
        <div className="rounded-lg border border-retail/30 bg-retail/5 p-3 text-sm text-foreground">
          Prefilled from role template: <strong>{templateName}</strong>. All fields remain editable before publication.
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {saved && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">Saved.</div>}

      {/* Lifecycle actions for existing vacancies */}
      {isEdit && (
        <Card>
          <CardContent className="p-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted-foreground mr-2">Status: <strong>{vacancy!.status}</strong></span>
            {vacancy!.status === "DRAFT" && (
              <>
                <Button size="sm" onClick={() => lifecycle("publish")}>Publish now</Button>
                <Button size="sm" variant="outline" onClick={() => {
                  const when = prompt("Publish at (YYYY-MM-DD HH:mm):")
                  if (when) lifecycle("schedule", { scheduledPublishAt: when })
                }}>Schedule…</Button>
              </>
            )}
            {vacancy!.status === "SCHEDULED" && (
              <Button size="sm" onClick={() => lifecycle("publish")}>Publish now</Button>
            )}
            {vacancy!.status === "PUBLISHED" && (
              <>
                <Button size="sm" variant="outline" onClick={() => lifecycle("pause")}>Pause applications</Button>
                <Button size="sm" variant="outline" onClick={() => lifecycle("close")}>Close vacancy</Button>
              </>
            )}
            {vacancy!.status === "PAUSED" && (
              <>
                <Button size="sm" onClick={() => lifecycle("reopen")}>Resume applications</Button>
                <Button size="sm" variant="outline" onClick={() => lifecycle("close")}>Close vacancy</Button>
              </>
            )}
            {vacancy!.status === "CLOSED" && (
              <>
                <Button size="sm" variant="outline" onClick={() => lifecycle("reopen")}>Reopen</Button>
                <Button size="sm" variant="outline" onClick={() => lifecycle("archive")}>Archive</Button>
              </>
            )}
            <Button size="sm" variant="outline" onClick={async () => {
              const res = await fetch(`/api/admin/careers/vacancies/${vacancy!.id}/duplicate`, { method: "POST" })
              const d = await res.json()
              if (d.id) router.push(`/admin/careers/vacancies/${d.id}`)
            }}>Duplicate</Button>
            {(vacancy!.status === "PUBLISHED" || vacancy!.status === "PAUSED" || vacancy!.status === "CLOSED") && (
              <Button size="sm" variant="outline" asChild>
                <a href={`/careers/jobs/${vacancy!.slug}`} target="_blank">Preview public page</a>
              </Button>
            )}
            <Button size="sm" variant="outline" asChild>
              <a href={`/api/admin/careers/applications/export?vacancyId=${vacancy!.id}`}>Export applicants (CSV)</a>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Basic */}
      <Card>
        <CardHeader><CardTitle className="text-base">Basic details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className={labelCls}>Job title *</label>
            <input className={inputCls} value={f.title} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>URL slug</label>
            <input className={inputCls} value={f.slug} onChange={(e) => set("slug", e.target.value)} placeholder="auto-generated from title" />
          </div>
          <div>
            <label className={labelCls}>Hiring manager</label>
            <select className={inputCls} value={f.hiring_manager_id} onChange={(e) => set("hiring_manager_id", e.target.value)}>
              <option value="">None</option>
              {admins.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.role})</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Department</label>
            <select className={inputCls} value={f.department_id} onChange={(e) => set("department_id", e.target.value)}>
              <option value="">None</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Job category</label>
            <select className={inputCls} value={f.job_category_id} onChange={(e) => set("job_category_id", e.target.value)}>
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Short summary (shown on cards)</label>
            <input className={inputCls} value={f.short_summary} onChange={(e) => set("short_summary", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Full description</label>
            <textarea rows={6} className={inputCls} value={f.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Responsibilities (one per line)</label>
            <textarea rows={6} className={inputCls} value={f.responsibilities} onChange={(e) => set("responsibilities", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Requirements (one per line)</label>
            <textarea rows={6} className={inputCls} value={f.requirements} onChange={(e) => set("requirements", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Number of openings</label>
            <input type="number" min={1} className={inputCls} value={f.openings} onChange={(e) => set("openings", Number(e.target.value))} />
          </div>
          <div className="flex flex-col gap-3 pt-6">
            {checkField("Show number of openings publicly", "show_openings")}
            {checkField("Featured vacancy", "featured")}
            {checkField("Urgent", "urgent")}
          </div>
        </CardContent>
      </Card>

      {/* Engagement */}
      <Card>
        <CardHeader><CardTitle className="text-base">Engagement & compensation</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Employment type</label>
            <select className={inputCls} value={f.employment_type} onChange={(e) => set("employment_type", e.target.value as never)}>
              {EMPLOYMENT_TYPES.map((t) => <option key={t} value={t}>{EMPLOYMENT_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Work arrangement</label>
            <select className={inputCls} value={f.work_arrangement} onChange={(e) => set("work_arrangement", e.target.value as never)}>
              {WORK_ARRANGEMENTS.map((t) => <option key={t} value={t}>{WORK_ARRANGEMENT_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Working days</label>
            <input className={inputCls} value={f.working_days} onChange={(e) => set("working_days", e.target.value)} placeholder="e.g. Monday – Friday" />
          </div>
          <div>
            <label className={labelCls}>Start time</label>
            <input type="time" className={inputCls} value={f.work_start_time} onChange={(e) => set("work_start_time", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>End time</label>
            <input type="time" className={inputCls} value={f.work_end_time} onChange={(e) => set("work_end_time", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Duration description</label>
            <input className={inputCls} value={f.duration_description} onChange={(e) => set("duration_description", e.target.value)} placeholder="e.g. 5 working days" />
          </div>
          <div>
            <label className={labelCls}>Project start date</label>
            <input type="date" className={inputCls} value={f.project_start_date} onChange={(e) => set("project_start_date", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Project end date</label>
            <input type="date" className={inputCls} value={f.project_end_date} onChange={(e) => set("project_end_date", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Compensation type</label>
            <select className={inputCls} value={f.compensation_type} onChange={(e) => set("compensation_type", e.target.value as never)}>
              {COMPENSATION_TYPES.map((t) => <option key={t} value={t}>{t === "NEGOTIABLE" ? "Negotiable" : COMPENSATION_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Min compensation (₦)</label>
            <input type="number" min={0} className={inputCls} value={f.compensation_min} onChange={(e) => set("compensation_min", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Max compensation (₦)</label>
            <input type="number" min={0} className={inputCls} value={f.compensation_max} onChange={(e) => set("compensation_max", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Transport allowance (₦)</label>
            <input type="number" min={0} className={inputCls} value={f.transport_allowance} onChange={(e) => set("transport_allowance", e.target.value)} />
          </div>
          <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {checkField("Show compensation publicly", "show_compensation")}
            {checkField("Lunch provided", "lunch_provided")}
            {checkField("Accommodation provided", "accommodation_provided")}
          </div>
          <div className="md:col-span-3">
            <label className={labelCls}>Other role-specific benefits/support</label>
            <textarea rows={2} className={inputCls} value={f.other_benefits} onChange={(e) => set("other_benefits", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Locations */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Locations</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setLocations((l) => [...l, { ...emptyLocation, nearby_preferred: false }])}>
            <Plus className="w-3.5 h-3.5" /> Add location
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {locations.map((loc, i) => (
            <div key={i} className="rounded-lg border border-border p-4 space-y-4 relative">
              {locations.length > 1 && (
                <button type="button" onClick={() => setLocations((l) => l.filter((_, j) => j !== i))}
                  className="absolute top-3 right-3 text-muted-foreground hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <p className="text-xs font-semibold uppercase text-muted-foreground">Location {i + 1}{i === 0 ? " (primary)" : ""}</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className={labelCls}>State</label>
                  <select className={inputCls} value={loc.state} onChange={(e) => setLoc(i, "state", e.target.value)}>
                    <option value="">Select</option>
                    {STATES["Nigeria"].map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>LGA</label>
                  <input className={inputCls} value={loc.lga} onChange={(e) => setLoc(i, "lga", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>City / town</label>
                  <input className={inputCls} value={loc.city} onChange={(e) => setLoc(i, "city", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Area / site</label>
                  <input className={inputCls} value={loc.area_site} onChange={(e) => setLoc(i, "area_site", e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Full address (internal only)</label>
                  <input className={inputCls} value={loc.full_address} onChange={(e) => setLoc(i, "full_address", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Public location description</label>
                  <input className={inputCls} value={loc.public_description} onChange={(e) => setLoc(i, "public_description", e.target.value)} placeholder="e.g. Ilobu, Osun State (site shared after selection)" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-retail" checked={loc.nearby_preferred} onChange={(e) => setLoc(i, "nearby_preferred", e.target.checked)} />
                Nearby applicants preferred
              </label>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Application config */}
      <Card>
        <CardHeader><CardTitle className="text-base">Application configuration</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Opens at</label>
            <input type="datetime-local" className={inputCls} value={f.application_opens_at} onChange={(e) => set("application_opens_at", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Closes at (deadline)</label>
            <input type="datetime-local" className={inputCls} value={f.application_closes_at} onChange={(e) => set("application_closes_at", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Max applications</label>
            <input type="number" min={1} className={inputCls} value={f.max_applications} onChange={(e) => set("max_applications", e.target.value)} placeholder="Unlimited" />
          </div>
          <div>
            <label className={labelCls}>Screening pass score (%)</label>
            <input type="number" min={0} max={100} className={inputCls} value={f.pass_score} onChange={(e) => set("pass_score", e.target.value)} placeholder="Optional" />
          </div>
          <div className="md:col-span-3">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">Confirmation message shown to applicants</label>
              <button type="button" className="text-xs text-retail hover:underline"
                onClick={() => set("confirmation_message", DEFAULT_APPLICATION_CONFIRMATION)}>
                Insert default template
              </button>
            </div>
            <textarea rows={10} className={`${inputCls} font-mono text-xs`} value={f.confirmation_message}
              onChange={(e) => set("confirmation_message", e.target.value)}
              placeholder="Leave empty to use the default confirmation template (Careers Settings)." />
            <p className="text-xs text-muted-foreground mt-1">
              Shown on the post-submit screen and inside the &quot;application received&quot; email.
              Placeholders: {CONFIRMATION_MESSAGE_VARS.map((v) => `{{${v}}}`).join(", ")}
            </p>
          </div>
          <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {checkField("CV required", "cv_required")}
            {checkField("Cover letter required", "cover_letter_required")}
            {checkField("Portfolio field enabled", "portfolio_enabled")}
            {checkField("Auto-close on deadline", "auto_close_on_deadline")}
            {checkField("Auto-close at max applications", "auto_close_on_max_applications")}
          </div>
        </CardContent>
      </Card>

      {/* Equipment fields */}
      <Card>
        <CardHeader><CardTitle className="text-base">Equipment & mobility questions</CardTitle></CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-3">Enable which equipment questions appear on the application form for this vacancy.</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {EQUIPMENT_FIELD_KEYS.map((k) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-retail" checked={equipment[k] === true}
                  onChange={(e) => setEquipment((p) => ({ ...p, [k]: e.target.checked }))} />
                {EQUIPMENT_LABELS[k]}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Screening questions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Screening questions</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setQuestions((q) => [...q, { ...emptyQuestion }])}>
            <Plus className="w-3.5 h-3.5" /> Add question
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {questions.length === 0 && <p className="text-sm text-muted-foreground">No screening questions.</p>}
          {questions.map((q, i) => (
            <div key={i} className="rounded-lg border border-border p-4 space-y-3 relative">
              <button type="button" onClick={() => setQuestions((l) => l.filter((_, j) => j !== i))}
                className="absolute top-3 right-3 text-muted-foreground hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="md:col-span-2">
                  <label className={labelCls}>Question {i + 1}</label>
                  <input className={inputCls} value={q.question_text} onChange={(e) => setQ(i, "question_text", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Answer type</label>
                  <select className={inputCls} value={q.answer_type} onChange={(e) => setQ(i, "answer_type", e.target.value)}>
                    {ANSWER_TYPES.map((t) => <option key={t} value={t}>{enumLabel(t)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Correct answer (for auto-scoring)</label>
                  <input className={inputCls} value={q.correct_answer} onChange={(e) => setQ(i, "correct_answer", e.target.value)} placeholder="Optional" />
                </div>
              </div>
              {(q.answer_type === "SINGLE_CHOICE" || q.answer_type === "MULTIPLE_CHOICE") && (
                <div>
                  <label className={labelCls}>Options (one per line)</label>
                  <textarea rows={3} className={inputCls} value={q.options} onChange={(e) => setQ(i, "options", e.target.value)} />
                </div>
              )}
              <div className="flex gap-5">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-retail" checked={q.required} onChange={(e) => setQ(i, "required", e.target.checked)} />
                  Required
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-retail" checked={q.knockout} onChange={(e) => setQ(i, "knockout", e.target.checked)} />
                  Knockout
                </label>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Internal workforce fields — never rendered publicly */}
      <Card>
        <CardHeader><CardTitle className="text-base">Internal — workforce &amp; commission details</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <p className="md:col-span-3 text-xs text-muted-foreground">
            Internal only — these fields are never shown on the public vacancy page.
            {internal.role_template_id && " Prefilled from the selected role template."}
          </p>
          <div className="md:col-span-3">
            <label className={labelCls}>Role purpose</label>
            <textarea rows={2} className={inputCls} value={internal.role_purpose} onChange={(e) => setI("role_purpose", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Reporting line</label>
            <input className={inputCls} value={internal.reporting_line} onChange={(e) => setI("reporting_line", e.target.value)} placeholder="e.g. Sales & Conversion Lead" />
          </div>
          <div>
            <label className={labelCls}>Probation period</label>
            <input className={inputCls} value={internal.probation_period} onChange={(e) => setI("probation_period", e.target.value)} placeholder="e.g. 3 months" />
          </div>
          <div>
            <label className={labelCls}>Assessment type</label>
            <select className={inputCls} value={internal.assessment_type} onChange={(e) => setI("assessment_type", e.target.value)}>
              <option value="">None</option>
              {["WRITTEN", "PRACTICAL", "PRODUCT_CAPTURE", "INTERVIEW", "OTHER"].map((t) => (
                <option key={t} value={t}>{enumLabel(t)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Feeding arrangement</label>
            <input className={inputCls} value={internal.feeding_arrangement} onChange={(e) => setI("feeding_arrangement", e.target.value)} placeholder="e.g. Lunch and water provided" />
          </div>
          <div>
            <label className={labelCls}>Data/call allowance (₦)</label>
            <input type="number" min={0} className={inputCls} value={internal.data_call_allowance} onChange={(e) => setI("data_call_allowance", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Performance bonus</label>
            <input className={inputCls} value={internal.performance_bonus} onChange={(e) => setI("performance_bonus", e.target.value)} placeholder="e.g. Retention bonus after 90 days" />
          </div>
          <div className="md:col-span-3">
            <label className={labelCls}>Performance indicators / KPIs (one per line, internal)</label>
            <textarea rows={4} className={inputCls} value={internal.performance_indicators} onChange={(e) => setI("performance_indicators", e.target.value)} />
          </div>
          <div className="md:col-span-3">
            <label className={labelCls}>Interview scorecard (one per line: criterion|max score)</label>
            <textarea rows={4} className={`${inputCls} font-mono text-xs`} value={internal.interview_scorecard} onChange={(e) => setI("interview_scorecard", e.target.value)} placeholder={"Pipeline leadership|10\nCommunication|10"} />
          </div>
          <div className="md:col-span-3">
            <label className={labelCls}>Vacancy-specific consent text</label>
            <textarea rows={3} className={inputCls} value={internal.consent_text} onChange={(e) => setI("consent_text", e.target.value)}
              placeholder="If set, applicants must tick an extra consent checkbox with this text before submitting." />
          </div>
        </CardContent>
      </Card>

      {/* Commission rules */}
      <Card>
        <CardHeader><CardTitle className="text-base">Commission rules (internal)</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-start gap-2 text-sm md:col-span-3">
            <input type="checkbox" className="mt-0.5 accent-retail" checked={commissionEligible} onChange={(e) => { setCommissionEligible(e.target.checked); setSaved(false) }} />
            <span>Role is commission eligible — commission is calculated only from qualifying collected revenue.</span>
          </label>
          {commissionEligible && (
            <>
              <div>
                <label className={labelCls}>Basis</label>
                <select className={inputCls} value={cr.basis} onChange={(e) => setCrField("basis", e.target.value)}>
                  <option value="PERCENTAGE">Percentage of collected revenue</option>
                  <option value="FIXED">Fixed amount per qualifying payment</option>
                </select>
              </div>
              {cr.basis === "PERCENTAGE" ? (
                <>
                  <div>
                    <label className={labelCls}>Self-generated lead rate (%)</label>
                    <input type="number" min={0} step="0.1" className={inputCls} value={cr.self_lead_rate} onChange={(e) => setCrField("self_lead_rate", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Company lead rate (%)</label>
                    <input type="number" min={0} step="0.1" className={inputCls} value={cr.company_lead_rate} onChange={(e) => setCrField("company_lead_rate", e.target.value)} />
                  </div>
                  <div>
                    <label className={labelCls}>Fallback rate (%)</label>
                    <input type="number" min={0} step="0.1" className={inputCls} value={cr.percentage} onChange={(e) => setCrField("percentage", e.target.value)} />
                  </div>
                </>
              ) : (
                <div>
                  <label className={labelCls}>Fixed amount (₦)</label>
                  <input type="number" min={0} className={inputCls} value={cr.fixed_amount} onChange={(e) => setCrField("fixed_amount", e.target.value)} />
                </div>
              )}
              <div>
                <label className={labelCls}>Minimum payout threshold (₦)</label>
                <input type="number" min={0} className={inputCls} value={cr.minimum_payout} onChange={(e) => setCrField("minimum_payout", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Eligible revenue categories (comma-separated — empty = all except excluded)</label>
                <input className={inputCls} value={cr.eligible_categories} onChange={(e) => setCrField("eligible_categories", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Excluded categories (comma-separated)</label>
                <input className={inputCls} value={cr.excluded_categories} onChange={(e) => setCrField("excluded_categories", e.target.value)} placeholder="Taxes, Refunds, Logistics, Hardware" />
              </div>
              <div>
                <label className={labelCls}>Re-include categories (management override)</label>
                <input className={inputCls} value={cr.include_overrides} onChange={(e) => setCrField("include_overrides", e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-retail" checked={cr.clawback_on_refund} onChange={(e) => setCrField("clawback_on_refund", e.target.checked)} />
                Reverse commission when the payment is refunded
              </label>
            </>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {isEdit ? "Save changes" : "Save as draft"}
        </Button>
        <Button variant="outline" onClick={() => router.push("/admin/careers/vacancies")}>Cancel</Button>
      </div>
    </div>
  )
}
