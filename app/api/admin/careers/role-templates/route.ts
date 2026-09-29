import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import {
  listRoleTemplates,
  createRoleTemplate,
  ROLE_CATEGORIES,
  type TemplateScreeningQuestion,
} from "@/lib/careers-role-templates"
import { EMPLOYMENT_TYPES, WORK_ARRANGEMENTS, COMPENSATION_TYPES, ANSWER_TYPES } from "@/lib/careers"

export const dynamic = "force-dynamic"

export interface RoleTemplateInput {
  name: string
  role_category?: string
  department_id?: string | null
  job_category_id?: string | null
  purpose?: string | null
  employment_type?: string
  work_arrangement?: string
  default_location?: Record<string, unknown>
  openings?: number
  responsibilities?: string[]
  requirements?: string[]
  performance_indicators?: string[]
  reporting_line?: string | null
  working_days?: string | null
  work_start_time?: string | null
  work_end_time?: string | null
  probation_period?: string | null
  base_compensation_kobo?: number | null
  compensation_type?: string
  currency?: string
  transport_allowance_kobo?: number | null
  feeding_arrangement?: string | null
  data_call_allowance_kobo?: number | null
  commission_eligible?: boolean
  commission_rules?: Record<string, unknown>
  performance_bonus?: string | null
  show_compensation_public?: boolean
  required_equipment?: Record<string, unknown>
  screening_questions?: TemplateScreeningQuestion[]
  assessment_type?: string | null
  interview_scorecard?: { criterion: string; max_score: number }[]
  consent_text?: string | null
  status?: string
}

/** Validate + normalize role-template input. Returns row or error string. */
export function buildTemplateRow(input: RoleTemplateInput): { row?: Record<string, unknown>; error?: string } {
  const name = String(input.name || "").trim()
  if (!name) return { error: "Role title is required" }
  if (input.role_category && !ROLE_CATEGORIES.includes(input.role_category as never)) {
    return { error: "Invalid role category" }
  }
  if (input.employment_type && !EMPLOYMENT_TYPES.includes(input.employment_type as never)) {
    return { error: "Invalid employment type" }
  }
  if (input.work_arrangement && !WORK_ARRANGEMENTS.includes(input.work_arrangement as never)) {
    return { error: "Invalid work arrangement" }
  }
  if (input.compensation_type && !COMPENSATION_TYPES.includes(input.compensation_type as never)) {
    return { error: "Invalid compensation type" }
  }
  if (input.assessment_type && !["WRITTEN", "PRACTICAL", "PRODUCT_CAPTURE", "INTERVIEW", "OTHER"].includes(input.assessment_type)) {
    return { error: "Invalid assessment type" }
  }
  if (input.status && !["ACTIVE", "INACTIVE", "ARCHIVED"].includes(input.status)) {
    return { error: "Invalid template status" }
  }
  const openings = input.openings == null ? 1 : Number(input.openings)
  if (!Number.isFinite(openings) || openings < 1) return { error: "Number required must be at least 1" }

  const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v))
  const questions = (Array.isArray(input.screening_questions) ? input.screening_questions : [])
    .filter((q) => q && String(q.question_text || "").trim())
    .map((q) => ({
      question_text: String(q.question_text).trim(),
      answer_type: ANSWER_TYPES.includes(q.answer_type as never) ? q.answer_type : "YES_NO",
      required: q.required !== false,
      knockout: q.knockout === true,
      correct_answer: q.correct_answer || null,
      options: Array.isArray(q.options) ? q.options.filter(Boolean) : [],
    }))
  const scorecard = (Array.isArray(input.interview_scorecard) ? input.interview_scorecard : [])
    .filter((s) => s && String(s.criterion || "").trim())
    .map((s) => ({ criterion: String(s.criterion).trim(), max_score: Number(s.max_score) || 10 }))

  const row: Record<string, unknown> = {
    name,
    role_category: input.role_category || "CORE",
    department_id: input.department_id || null,
    job_category_id: input.job_category_id || null,
    purpose: input.purpose || null,
    employment_type: input.employment_type || "PERMANENT",
    work_arrangement: input.work_arrangement || "HYBRID",
    default_location: input.default_location && typeof input.default_location === "object" ? input.default_location : {},
    openings,
    responsibilities: Array.isArray(input.responsibilities) ? input.responsibilities.filter(Boolean) : [],
    requirements: Array.isArray(input.requirements) ? input.requirements.filter(Boolean) : [],
    performance_indicators: Array.isArray(input.performance_indicators) ? input.performance_indicators.filter(Boolean) : [],
    reporting_line: input.reporting_line || null,
    working_days: input.working_days || null,
    work_start_time: input.work_start_time || null,
    work_end_time: input.work_end_time || null,
    probation_period: input.probation_period || null,
    base_compensation_kobo: num(input.base_compensation_kobo),
    compensation_type: input.compensation_type || "NEGOTIABLE",
    currency: input.currency || "NGN",
    transport_allowance_kobo: num(input.transport_allowance_kobo),
    feeding_arrangement: input.feeding_arrangement || null,
    data_call_allowance_kobo: num(input.data_call_allowance_kobo),
    commission_eligible: input.commission_eligible === true,
    commission_rules: input.commission_rules && typeof input.commission_rules === "object" ? input.commission_rules : {},
    performance_bonus: input.performance_bonus || null,
    show_compensation_public: input.show_compensation_public === true,
    required_equipment: input.required_equipment && typeof input.required_equipment === "object" ? input.required_equipment : {},
    screening_questions: questions,
    assessment_type: input.assessment_type || null,
    interview_scorecard: scorecard,
    consent_text: input.consent_text || null,
    status: input.status || "INACTIVE",
    updated_at: new Date().toISOString(),
  }
  return { row }
}

/* GET: list role templates (non-archived by default; ?status= to filter). */
export async function GET(request: Request) {
  const { denied } = await authorizeAdmin("careers.role_templates.view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ templates: [] })
  const { searchParams } = new URL(request.url)
  const templates = await listRoleTemplates({
    status: searchParams.get("status") || undefined,
    category: searchParams.get("category") || undefined,
  })
  return NextResponse.json({ templates })
}

/* POST: create a role template. */
export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("careers.role_templates.create")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })

  const input = (await request.json().catch(() => ({}))) as RoleTemplateInput
  const { row, error } = buildTemplateRow(input)
  if (error || !row) return NextResponse.json({ error: error || "Invalid input" }, { status: 400 })

  const { id, error: insErr } = await createRoleTemplate(row, { id: session.userId, name: session.name })
  if (insErr || !id) {
    return NextResponse.json({ error: insErr === "Database not configured" ? insErr : "Failed to create template" }, { status: 500 })
  }

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_ROLE_TEMPLATE_CREATED,
    entityType: AUDIT_ENTITIES.CAREER_ROLE_TEMPLATE,
    entityId: id,
    metadata: { name: row.name, role_category: row.role_category },
  })

  return NextResponse.json({ success: true, id })
}
