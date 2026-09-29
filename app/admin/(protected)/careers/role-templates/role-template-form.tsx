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
} from "@/lib/careers"
import {
  ROLE_CATEGORIES, ROLE_CATEGORY_LABELS, TEMPLATE_STATUSES, TEMPLATE_STATUS_LABELS,
  type CareerRoleTemplate,
} from "@/lib/careers-role-templates"
import { STATES } from "@/lib/locations"

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const labelCls = "block text-sm font-medium mb-1.5"

interface Lookup { id: string; name: string }

interface TemplateQuestion {
  question_text: string; answer_type: string; required: boolean
  knockout: boolean; options: string
}

const EQUIPMENT_LABELS: Record<string, string> = {
  owns_android: "Owns Android smartphone",
  smartphone_model: "Smartphone model",
  has_mobile_data: "Reliable mobile data",
  owns_laptop: "Owns laptop",
  owns_power_bank: "Owns power bank",
  transportation: "Means of transportation",
}

const emptyQuestion: TemplateQuestion = { question_text: "", answer_type: "YES_NO", required: true, knockout: false, options: "" }

function toLines(arr: string[] | undefined): string {
  return (arr || []).join("\n")
}
function fromLines(s: string): string[] {
  return s.split("\n").map((l) => l.trim()).filter(Boolean)
}
function toKobo(v: string | number) {
  return v === "" || v == null ? null : Math.round(Number(v) * 100)
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

export function RoleTemplateForm({
  template,
  departments,
  categories,
}: {
  template?: CareerRoleTemplate
  departments: Lookup[]
  categories: Lookup[]
}) {
  const router = useRouter()
  const isEdit = Boolean(template)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  const loc = template?.default_location || {}

  const [f, setF] = useState({
    name: template?.name || "",
    role_category: template?.role_category || "CORE",
    department_id: template?.department_id || "",
    job_category_id: template?.job_category_id || "",
    purpose: template?.purpose || "",
    employment_type: template?.employment_type || "PERMANENT",
    work_arrangement: template?.work_arrangement || "HYBRID",
    openings: template?.openings ?? 1,
    responsibilities: toLines(template?.responsibilities),
    requirements: toLines(template?.requirements),
    performance_indicators: toLines(template?.performance_indicators),
    reporting_line: template?.reporting_line || "",
    working_days: template?.working_days || "Monday – Friday",
    work_start_time: template?.work_start_time || "08:30",
    work_end_time: template?.work_end_time || "17:30",
    probation_period: template?.probation_period || "3 months",
    base_compensation: template?.base_compensation_kobo != null ? template.base_compensation_kobo / 100 : "",
    compensation_type: template?.compensation_type || "MONTHLY",
    transport_allowance: template?.transport_allowance_kobo != null ? template.transport_allowance_kobo / 100 : "",
    feeding_arrangement: template?.feeding_arrangement || "",
    data_call_allowance: template?.data_call_allowance_kobo != null ? template.data_call_allowance_kobo / 100 : "",
    performance_bonus: template?.performance_bonus || "",
    show_compensation_public: template?.show_compensation_public === true,
    consent_text: template?.consent_text || "",
    assessment_type: template?.assessment_type || "",
    status: template?.status || "INACTIVE",
  })
  const [locF, setLocF] = useState({
    state: loc.state || "", lga: loc.lga || "", city: loc.city || "",
    public_description: loc.public_description || "", nearby_preferred: loc.nearby_preferred === true,
  })
  const [equipment, setEquipment] = useState<Record<string, boolean>>(
    Object.fromEntries(EQUIPMENT_FIELD_KEYS.map((k) => [k, (template?.required_equipment || {})[k] === true]))
  )
  const [equipmentItems, setEquipmentItems] = useState(
    ((template?.required_equipment || {}).items as string[] | undefined || []).join("\n")
  )
  const [commissionEligible, setCommissionEligible] = useState(template?.commission_eligible === true)
  const [cr, setCr] = useState(() => rulesToForm(template?.commission_rules))
  const [scorecard, setScorecard] = useState(
    (template?.interview_scorecard || []).map((s) => `${s.criterion}|${s.max_score}`).join("\n")
  )
  const [questions, setQuestions] = useState<TemplateQuestion[]>(
    (template?.screening_questions || []).map((q) => ({
      question_text: q.question_text,
      answer_type: q.answer_type,
      required: q.required !== false,
      knockout: q.knockout === true,
      options: (q.options || []).join("\n"),
    }))
  )

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => { setF((p) => ({ ...p, [k]: v })); setSaved(false) }
  const setQ = (i: number, k: keyof TemplateQuestion, v: string | boolean) =>
    setQuestions((l) => l.map((x, j) => (j === i ? { ...x, [k]: v } : x)))
  const setCrField = <K extends keyof typeof cr>(k: K, v: (typeof cr)[K]) => { setCr((p) => ({ ...p, [k]: v })); setSaved(false) }

  async function save() {
    setError("")
    setSaving(true)
    try {
      const payload = {
        ...f,
        openings: Number(f.openings),
        base_compensation_kobo: toKobo(f.base_compensation),
        transport_allowance_kobo: toKobo(f.transport_allowance),
        data_call_allowance_kobo: toKobo(f.data_call_allowance),
        responsibilities: fromLines(f.responsibilities),
        requirements: fromLines(f.requirements),
        performance_indicators: fromLines(f.performance_indicators),
        default_location: locF.state || locF.city || locF.public_description
          ? { country: "Nigeria", ...locF }
          : {},
        required_equipment: {
          ...Object.fromEntries(Object.entries(equipment).filter(([, v]) => v)),
          items: fromLines(equipmentItems),
        },
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
        interview_scorecard: fromLines(scorecard).map((line) => {
          const [criterion, max] = line.split("|").map((s) => s.trim())
          return { criterion, max_score: Number(max) || 10 }
        }).filter((s) => s.criterion),
        screening_questions: questions.filter((q) => q.question_text.trim()).map((q) => ({
          question_text: q.question_text.trim(),
          answer_type: q.answer_type,
          required: q.required,
          knockout: q.knockout,
          options: q.options.split("\n").map((o) => o.trim()).filter(Boolean),
        })),
        assessment_type: f.assessment_type || null,
      }

      const url = isEdit ? `/api/admin/careers/role-templates/${template!.id}` : "/api/admin/careers/role-templates"
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || "Save failed")
      setSaved(true)
      if (!isEdit) router.push(`/admin/careers/role-templates/${d.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function archive() {
    if (!confirm("Archive this template? It will no longer be selectable for new vacancies.")) return
    const res = await fetch(`/api/admin/careers/role-templates/${template!.id}`, { method: "DELETE" })
    if (res.ok) router.push("/admin/careers/role-templates")
  }

  const checkField = (label: string, k: keyof typeof f, hint?: string) => (
    <label key={k} className="flex items-start gap-2 text-sm">
      <input type="checkbox" className="mt-0.5 accent-retail" checked={f[k] as boolean} onChange={(e) => set(k, e.target.checked as never)} />
      <span>{label}{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</span>
    </label>
  )

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}
      {saved && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">Saved — version incremented.</div>}

      {/* Basics */}
      <Card>
        <CardHeader><CardTitle className="text-base">Role</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Role title *</label>
            <input className={inputCls} value={f.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Role category</label>
            <select className={inputCls} value={f.role_category} onChange={(e) => set("role_category", e.target.value as never)}>
              {ROLE_CATEGORIES.map((c) => <option key={c} value={c}>{ROLE_CATEGORY_LABELS[c]}</option>)}
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
            <label className={labelCls}>Role purpose</label>
            <textarea rows={3} className={inputCls} value={f.purpose} onChange={(e) => set("purpose", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Number required (default openings)</label>
            <input type="number" min={1} className={inputCls} value={f.openings} onChange={(e) => set("openings", Number(e.target.value))} />
          </div>
          <div>
            <label className={labelCls}>Reporting line</label>
            <input className={inputCls} value={f.reporting_line} onChange={(e) => set("reporting_line", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Responsibilities (one per line)</label>
            <textarea rows={7} className={inputCls} value={f.responsibilities} onChange={(e) => set("responsibilities", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Requirements (one per line)</label>
            <textarea rows={7} className={inputCls} value={f.requirements} onChange={(e) => set("requirements", e.target.value)} />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>Performance indicators / KPIs (one per line, internal)</label>
            <textarea rows={4} className={inputCls} value={f.performance_indicators} onChange={(e) => set("performance_indicators", e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Work conditions */}
      <Card>
        <CardHeader><CardTitle className="text-base">Work conditions</CardTitle></CardHeader>
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
            <label className={labelCls}>Probation period</label>
            <input className={inputCls} value={f.probation_period} onChange={(e) => set("probation_period", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Working days</label>
            <input className={inputCls} value={f.working_days} onChange={(e) => set("working_days", e.target.value)} />
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
            <label className={labelCls}>Default state</label>
            <select className={inputCls} value={locF.state} onChange={(e) => setLocF((p) => ({ ...p, state: e.target.value }))}>
              <option value="">None</option>
              {STATES["Nigeria"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Default LGA / city</label>
            <div className="grid grid-cols-2 gap-2">
              <input className={inputCls} value={locF.lga} onChange={(e) => setLocF((p) => ({ ...p, lga: e.target.value }))} placeholder="LGA" />
              <input className={inputCls} value={locF.city} onChange={(e) => setLocF((p) => ({ ...p, city: e.target.value }))} placeholder="City" />
            </div>
          </div>
          <div>
            <label className={labelCls}>Public location description</label>
            <input className={inputCls} value={locF.public_description} onChange={(e) => setLocF((p) => ({ ...p, public_description: e.target.value }))} />
          </div>
        </CardContent>
      </Card>

      {/* Compensation */}
      <Card>
        <CardHeader><CardTitle className="text-base">Compensation structure</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Compensation structure</label>
            <select className={inputCls} value={f.compensation_type} onChange={(e) => set("compensation_type", e.target.value as never)}>
              {COMPENSATION_TYPES.map((t) => <option key={t} value={t}>{t === "NEGOTIABLE" ? "Negotiable" : COMPENSATION_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Base compensation (₦)</label>
            <input type="number" min={0} className={inputCls} value={f.base_compensation} onChange={(e) => set("base_compensation", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Transport allowance (₦)</label>
            <input type="number" min={0} className={inputCls} value={f.transport_allowance} onChange={(e) => set("transport_allowance", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Data/call allowance (₦)</label>
            <input type="number" min={0} className={inputCls} value={f.data_call_allowance} onChange={(e) => set("data_call_allowance", e.target.value)} />
          </div>
          <div>
            <label className={labelCls}>Feeding arrangement</label>
            <input className={inputCls} value={f.feeding_arrangement} onChange={(e) => set("feeding_arrangement", e.target.value)} placeholder="e.g. Lunch and water provided" />
          </div>
          <div>
            <label className={labelCls}>Performance bonus</label>
            <input className={inputCls} value={f.performance_bonus} onChange={(e) => set("performance_bonus", e.target.value)} />
          </div>
          <div className="md:col-span-3">
            {checkField("Show compensation publicly on vacancies created from this template", "show_compensation_public")}
          </div>
        </CardContent>
      </Card>

      {/* Commission */}
      <Card>
        <CardHeader><CardTitle className="text-base">Commission</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-start gap-2 text-sm md:col-span-3">
            <input type="checkbox" className="mt-0.5 accent-retail" checked={commissionEligible} onChange={(e) => { setCommissionEligible(e.target.checked); setSaved(false) }} />
            <span>Commission eligible — calculated only from qualifying collected revenue.</span>
          </label>
          {commissionEligible && (
            <>
              <div>
                <label className={labelCls}>Basis</label>
                <select className={inputCls} value={cr.basis} onChange={(e) => setCrField("basis", e.target.value)}>
                  <option value="PERCENTAGE">Percentage</option>
                  <option value="FIXED">Fixed amount</option>
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
                <label className={labelCls}>Eligible revenue categories (comma — empty = all except excluded)</label>
                <input className={inputCls} value={cr.eligible_categories} onChange={(e) => setCrField("eligible_categories", e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>Excluded categories (comma)</label>
                <input className={inputCls} value={cr.excluded_categories} onChange={(e) => setCrField("excluded_categories", e.target.value)} placeholder="Taxes, Refunds, Logistics, Hardware" />
              </div>
              <div>
                <label className={labelCls}>Management re-include (comma)</label>
                <input className={inputCls} value={cr.include_overrides} onChange={(e) => setCrField("include_overrides", e.target.value)} />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" className="accent-retail" checked={cr.clawback_on_refund} onChange={(e) => setCrField("clawback_on_refund", e.target.checked)} />
                Reverse commission on refunded payments
              </label>
            </>
          )}
        </CardContent>
      </Card>

      {/* Equipment & assessment */}
      <Card>
        <CardHeader><CardTitle className="text-base">Equipment & assessment</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-2">Required tools/equipment — these enable matching questions on the application form.</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {EQUIPMENT_FIELD_KEYS.map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" className="accent-retail" checked={equipment[k] === true}
                    onChange={(e) => setEquipment((p) => ({ ...p, [k]: e.target.checked }))} />
                  {EQUIPMENT_LABELS[k]}
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Other required tools/equipment (one per line)</label>
            <textarea rows={2} className={inputCls} value={equipmentItems} onChange={(e) => { setEquipmentItems(e.target.value); setSaved(false) }} placeholder="e.g. Camera and lenses" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Assessment type</label>
              <select className={inputCls} value={f.assessment_type} onChange={(e) => set("assessment_type", e.target.value)}>
                <option value="">None</option>
                {["WRITTEN", "PRACTICAL", "PRODUCT_CAPTURE", "INTERVIEW", "OTHER"].map((t) => (
                  <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Interview scorecard (criterion|max score per line)</label>
              <textarea rows={3} className={`${inputCls} font-mono text-xs`} value={scorecard} onChange={(e) => { setScorecard(e.target.value); setSaved(false) }} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Vacancy-specific consent text</label>
            <textarea rows={3} className={inputCls} value={f.consent_text} onChange={(e) => set("consent_text", e.target.value)}
              placeholder="If set, applicants must accept this extra consent on the application form." />
          </div>
        </CardContent>
      </Card>

      {/* Screening questions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Default screening questions</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setQuestions((q) => [...q, { ...emptyQuestion }])}>
            <Plus className="w-3.5 h-3.5" /> Add question
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {questions.length === 0 && <p className="text-sm text-muted-foreground">No default questions.</p>}
          {questions.map((q, i) => (
            <div key={i} className="rounded-lg border border-border p-4 space-y-3 relative">
              <button type="button" onClick={() => setQuestions((l) => l.filter((_, j) => j !== i))}
                className="absolute top-3 right-3 text-muted-foreground hover:text-red-600">
                <Trash2 className="w-4 h-4" />
              </button>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="md:col-span-2">
                  <label className={labelCls}>Question {i + 1}</label>
                  <input className={inputCls} value={q.question_text} onChange={(e) => setQ(i, "question_text", e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>Answer type</label>
                  <select className={inputCls} value={q.answer_type} onChange={(e) => setQ(i, "answer_type", e.target.value)}>
                    {ANSWER_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
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

      {/* Status + actions */}
      <Card>
        <CardHeader><CardTitle className="text-base">Template status</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-4">
          <select className={inputCls + " max-w-xs"} value={f.status} onChange={(e) => set("status", e.target.value as never)}>
            {TEMPLATE_STATUSES.filter((s) => s !== "ARCHIVED").map((s) => <option key={s} value={s}>{TEMPLATE_STATUS_LABELS[s]}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">
            Inactive templates can still be selected when creating a vacancy. Archived templates are hidden.
          </p>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {isEdit ? "Save changes (new version)" : "Create template"}
        </Button>
        {isEdit && template!.status !== "ARCHIVED" && (
          <Button variant="outline" onClick={archive}>Archive template</Button>
        )}
        <Button variant="outline" onClick={() => router.push("/admin/careers/role-templates")}>Back</Button>
      </div>
    </div>
  )
}
