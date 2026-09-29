/* ───────────────────────────  Careers role templates  ───────────────────────────
 * Reusable vacancy blueprints for the conversion-first workforce. An admin
 * selects a template when creating a vacancy; the template pre-fills the
 * vacancy fields and screening questions, and stays fully editable before
 * publication. Templates are never rendered on the public careers page.
 *
 * Server-side only — uses the service-role client.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import type { EmploymentType, WorkArrangement, CompensationType, AnswerType } from "./careers"
import type { CommissionRules } from "./careers-commissions"

export const ROLE_CATEGORIES = ["CORE", "FLEXIBLE", "RETAINER"] as const
export type RoleCategory = (typeof ROLE_CATEGORIES)[number]

export const ROLE_CATEGORY_LABELS: Record<RoleCategory, string> = {
  CORE: "Core workforce",
  FLEXIBLE: "Flexible workforce",
  RETAINER: "Supporting retainer",
}

export const TEMPLATE_STATUSES = ["ACTIVE", "INACTIVE", "ARCHIVED"] as const
export type TemplateStatus = (typeof TEMPLATE_STATUSES)[number]

export const TEMPLATE_STATUS_LABELS: Record<TemplateStatus, string> = {
  ACTIVE: "Active",
  INACTIVE: "Inactive",
  ARCHIVED: "Archived",
}

export interface TemplateLocation {
  country?: string
  state?: string | null
  lga?: string | null
  city?: string | null
  area_site?: string | null
  public_description?: string | null
  nearby_preferred?: boolean
}

export interface TemplateScreeningQuestion {
  question_text: string
  answer_type: AnswerType
  required?: boolean
  knockout?: boolean
  correct_answer?: string | null
  options?: string[]
}

export interface ScorecardCriterion {
  criterion: string
  max_score: number
}

export interface CareerRoleTemplate {
  id: string
  name: string
  role_category: RoleCategory
  department_id: string | null
  job_category_id: string | null
  purpose: string | null
  employment_type: EmploymentType
  work_arrangement: WorkArrangement
  default_location: TemplateLocation
  openings: number
  responsibilities: string[]
  requirements: string[]
  performance_indicators: string[]
  reporting_line: string | null
  working_days: string | null
  work_start_time: string | null
  work_end_time: string | null
  probation_period: string | null
  base_compensation_kobo: number | null
  compensation_type: CompensationType
  currency: string
  transport_allowance_kobo: number | null
  feeding_arrangement: string | null
  data_call_allowance_kobo: number | null
  commission_eligible: boolean
  commission_rules: CommissionRules
  performance_bonus: string | null
  show_compensation_public: boolean
  required_equipment: Record<string, unknown>
  screening_questions: TemplateScreeningQuestion[]
  assessment_type: string | null
  interview_scorecard: ScorecardCriterion[]
  consent_text: string | null
  status: TemplateStatus
  version: number
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  // joined
  department_name?: string | null
  category_name?: string | null
}

export interface RoleTemplateVersion {
  id: string
  template_id: string
  version: number
  snapshot: Record<string, unknown>
  changed_by: string | null
  changed_by_name: string | null
  created_at: string
}

/* ─── Queries ─── */

const TEMPLATE_SELECT = "*, career_departments(name), career_job_categories(name)"

function mapTemplate(row: Record<string, unknown>): CareerRoleTemplate {
  const t = row as unknown as CareerRoleTemplate
  t.department_name = (row.career_departments as { name?: string } | null)?.name ?? null
  t.category_name = (row.career_job_categories as { name?: string } | null)?.name ?? null
  delete (t as unknown as Record<string, unknown>).career_departments
  delete (t as unknown as Record<string, unknown>).career_job_categories
  return t
}

export async function listRoleTemplates(filters: { status?: string; category?: string } = {}): Promise<CareerRoleTemplate[]> {
  if (!isSupabaseConfigured()) return []
  let query = supabase
    .from("career_role_templates")
    .select(TEMPLATE_SELECT)
    .order("role_category")
    .order("name")
  if (filters.status) query = query.eq("status", filters.status)
  else query = query.neq("status", "ARCHIVED")
  if (filters.category) query = query.eq("role_category", filters.category)
  const { data } = await query
  return (data || []).map(mapTemplate)
}

export async function getRoleTemplate(id: string): Promise<CareerRoleTemplate | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase.from("career_role_templates").select(TEMPLATE_SELECT).eq("id", id).maybeSingle()
  return data ? mapTemplate(data) : null
}

export async function listTemplateVersions(templateId: string): Promise<RoleTemplateVersion[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("career_role_template_versions")
    .select("id, template_id, version, changed_by, changed_by_name, created_at")
    .eq("template_id", templateId)
    .order("version", { ascending: false })
  return (data || []) as RoleTemplateVersion[]
}

export async function getTemplateVersion(templateId: string, version: number): Promise<RoleTemplateVersion | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase
    .from("career_role_template_versions")
    .select("*")
    .eq("template_id", templateId)
    .eq("version", version)
    .maybeSingle()
  return (data as RoleTemplateVersion | null) ?? null
}

export async function createRoleTemplate(
  row: Record<string, unknown>,
  actor: { id: string | null; name: string | null }
): Promise<{ id?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Database not configured" }
  const id = crypto.randomUUID()
  const { error } = await supabase.from("career_role_templates").insert({
    ...row,
    id,
    version: 1,
    created_by: actor.id,
    updated_by: actor.id,
  })
  if (error) return { error: error.message }
  await supabase.from("career_role_template_versions").insert({
    template_id: id,
    version: 1,
    snapshot: { ...row, id },
    changed_by: actor.id,
    changed_by_name: actor.name,
  })
  return { id }
}

/** Update a template and append an immutable version snapshot. */
export async function updateRoleTemplate(
  id: string,
  row: Record<string, unknown>,
  actor: { id: string | null; name: string | null }
): Promise<{ version?: number; error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Database not configured" }
  const { data: current } = await supabase
    .from("career_role_templates")
    .select("version")
    .eq("id", id)
    .maybeSingle()
  if (!current) return { error: "Template not found" }
  const nextVersion = (current.version || 1) + 1

  const { error } = await supabase
    .from("career_role_templates")
    .update({ ...row, version: nextVersion, updated_by: actor.id, updated_at: new Date().toISOString() })
    .eq("id", id)
  if (error) return { error: error.message }

  await supabase.from("career_role_template_versions").insert({
    template_id: id,
    version: nextVersion,
    snapshot: { ...row, id },
    changed_by: actor.id,
    changed_by_name: actor.name,
  })
  return { version: nextVersion }
}

export async function archiveRoleTemplate(
  id: string,
  actor: { id: string | null }
): Promise<{ error?: string }> {
  if (!isSupabaseConfigured()) return { error: "Database not configured" }
  const { error } = await supabase
    .from("career_role_templates")
    .update({ status: "ARCHIVED", updated_by: actor.id, updated_at: new Date().toISOString() })
    .eq("id", id)
  return { error: error?.message }
}

/* ─── Template → vacancy prefill (pure — unit tested) ─── */

/**
 * Maps a role template to the vacancy input shape used by the admin vacancy
 * form / POST /api/admin/careers/vacancies. Everything returned is a starting
 * point — the administrator edits before publication.
 *
 * Sensitive internals (performance indicators, commission rules, scorecard)
 * land in dedicated vacancy columns that are never rendered publicly.
 */
export function templateToVacancyPrefill(t: CareerRoleTemplate) {
  const descriptionParts: string[] = []
  if (t.purpose) descriptionParts.push(t.purpose)
  const conditions: string[] = []
  if (t.working_days || t.work_start_time) {
    conditions.push(
      `Working hours: ${[t.working_days, t.work_start_time && t.work_end_time ? `${t.work_start_time} – ${t.work_end_time}` : null].filter(Boolean).join(", ")}.`
    )
  }
  if (t.probation_period) conditions.push(`Probation period: ${t.probation_period}.`)
  if (t.feeding_arrangement) conditions.push(t.feeding_arrangement.replace(/\.$/, "") + ".")
  if (conditions.length) descriptionParts.push(conditions.join("\n"))

  const benefits: string[] = []
  if (t.data_call_allowance_kobo) benefits.push(`Data/call allowance: ₦${(t.data_call_allowance_kobo / 100).toLocaleString("en-NG")}`)
  if (t.performance_bonus && t.show_compensation_public) benefits.push(t.performance_bonus)

  const equipment = (t.required_equipment || {}) as Record<string, unknown>
  const equipmentFields: Record<string, boolean> = {}
  for (const key of ["owns_android", "smartphone_model", "has_mobile_data", "owns_laptop", "owns_power_bank", "transportation"]) {
    if (equipment[key]) equipmentFields[key] = true
  }

  return {
    role_template_id: t.id,
    title: t.name,
    department_id: t.department_id,
    job_category_id: t.job_category_id,
    short_summary: t.purpose ? t.purpose.split("\n")[0].slice(0, 300) : null,
    description: descriptionParts.join("\n\n") || null,
    responsibilities: [...(t.responsibilities || [])],
    requirements: [...(t.requirements || [])],
    openings: t.openings || 1,
    employment_type: t.employment_type,
    work_arrangement: t.work_arrangement,
    working_days: t.working_days,
    work_start_time: t.work_start_time,
    work_end_time: t.work_end_time,
    compensation_type: t.compensation_type,
    compensation_min_kobo: t.base_compensation_kobo,
    compensation_max_kobo: t.base_compensation_kobo,
    currency: t.currency || "NGN",
    show_compensation: t.show_compensation_public === true,
    transport_allowance_kobo: t.transport_allowance_kobo,
    lunch_provided: /lunch/i.test(t.feeding_arrangement || ""),
    other_benefits: benefits.length ? benefits.join(". ") : null,
    equipment_fields: equipmentFields,
    locations: t.default_location && Object.keys(t.default_location).length
      ? [{ ...t.default_location, is_primary: true }]
      : [],
    questions: (t.screening_questions || []).map((q) => ({
      question_text: q.question_text,
      answer_type: q.answer_type,
      required: q.required !== false,
      knockout: q.knockout === true,
      correct_answer: q.correct_answer || null,
      options: [...(q.options || [])],
    })),
    // Internal-only fields
    role_purpose: t.purpose,
    probation_period: t.probation_period,
    reporting_line: t.reporting_line,
    performance_indicators: [...(t.performance_indicators || [])],
    feeding_arrangement: t.feeding_arrangement,
    data_call_allowance_kobo: t.data_call_allowance_kobo,
    commission_eligible: t.commission_eligible === true,
    commission_rules: t.commission_rules || {},
    performance_bonus: t.performance_bonus,
    required_equipment: t.required_equipment || {},
    assessment_type: t.assessment_type,
    interview_scorecard: t.interview_scorecard || [],
    consent_text: t.consent_text,
  }
}

export type TemplateVacancyPrefill = ReturnType<typeof templateToVacancyPrefill>
