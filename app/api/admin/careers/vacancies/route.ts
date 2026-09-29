import { NextResponse } from "next/server"
import crypto from "crypto"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import {
  listVacancies,
  generateVacancyReference,
  slugify,
  EMPLOYMENT_TYPES,
  WORK_ARRANGEMENTS,
  COMPENSATION_TYPES,
} from "@/lib/careers"

export const dynamic = "force-dynamic"

export interface VacancyLocationInput {
  country?: string
  state?: string | null
  lga?: string | null
  city?: string | null
  area_site?: string | null
  full_address?: string | null
  public_description?: string | null
  nearby_preferred?: boolean
  is_primary?: boolean
}

export interface VacancyInput {
  title: string
  slug?: string
  department_id?: string | null
  job_category_id?: string | null
  short_summary?: string | null
  description?: string | null
  responsibilities?: string[]
  requirements?: string[]
  openings?: number
  show_openings?: boolean
  hiring_manager_id?: string | null
  featured?: boolean
  urgent?: boolean
  employment_type?: string
  work_arrangement?: string
  working_days?: string | null
  work_start_time?: string | null
  work_end_time?: string | null
  project_start_date?: string | null
  project_end_date?: string | null
  duration_description?: string | null
  compensation_type?: string
  compensation_min_kobo?: number | null
  compensation_max_kobo?: number | null
  currency?: string
  show_compensation?: boolean
  transport_allowance_kobo?: number | null
  lunch_provided?: boolean
  accommodation_provided?: boolean
  other_benefits?: string | null
  application_opens_at?: string | null
  application_closes_at?: string | null
  max_applications?: number | null
  cv_required?: boolean
  cover_letter_required?: boolean
  portfolio_enabled?: boolean
  pass_score?: number | null
  confirmation_message?: string | null
  auto_close_on_deadline?: boolean
  auto_close_on_max_applications?: boolean
  equipment_fields?: Record<string, boolean>
  locations?: VacancyLocationInput[]
}

/** Validate + normalize admin vacancy input. Returns row or error string. */
export function buildVacancyRow(input: VacancyInput): { row?: Record<string, unknown>; error?: string } {
  const title = String(input.title || "").trim()
  if (!title) return { error: "Title is required" }
  if (input.employment_type && !EMPLOYMENT_TYPES.includes(input.employment_type as never)) {
    return { error: "Invalid employment type" }
  }
  if (input.work_arrangement && !WORK_ARRANGEMENTS.includes(input.work_arrangement as never)) {
    return { error: "Invalid work arrangement" }
  }
  if (input.compensation_type && !COMPENSATION_TYPES.includes(input.compensation_type as never)) {
    return { error: "Invalid compensation type" }
  }
  const openings = input.openings == null ? 1 : Number(input.openings)
  if (!Number.isFinite(openings) || openings < 1) return { error: "Openings must be at least 1" }

  const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v))
  const minKobo = num(input.compensation_min_kobo)
  const maxKobo = num(input.compensation_max_kobo)
  if (minKobo != null && (!Number.isFinite(minKobo) || minKobo < 0)) return { error: "Invalid minimum compensation" }
  if (maxKobo != null && (!Number.isFinite(maxKobo) || maxKobo < 0)) return { error: "Invalid maximum compensation" }
  if (minKobo != null && maxKobo != null && minKobo > maxKobo) {
    return { error: "Minimum compensation cannot exceed maximum" }
  }
  if (input.application_opens_at && input.application_closes_at &&
      new Date(input.application_opens_at) >= new Date(input.application_closes_at)) {
    return { error: "Application closing date must be after the opening date" }
  }

  const row: Record<string, unknown> = {
    title,
    department_id: input.department_id || null,
    job_category_id: input.job_category_id || null,
    short_summary: input.short_summary || null,
    description: input.description || null,
    responsibilities: Array.isArray(input.responsibilities) ? input.responsibilities.filter(Boolean) : [],
    requirements: Array.isArray(input.requirements) ? input.requirements.filter(Boolean) : [],
    openings,
    show_openings: input.show_openings !== false,
    hiring_manager_id: input.hiring_manager_id || null,
    featured: input.featured === true,
    urgent: input.urgent === true,
    employment_type: input.employment_type || "PERMANENT",
    work_arrangement: input.work_arrangement || "ON_SITE",
    working_days: input.working_days || null,
    work_start_time: input.work_start_time || null,
    work_end_time: input.work_end_time || null,
    project_start_date: input.project_start_date || null,
    project_end_date: input.project_end_date || null,
    duration_description: input.duration_description || null,
    compensation_type: input.compensation_type || "NEGOTIABLE",
    compensation_min_kobo: minKobo,
    compensation_max_kobo: maxKobo,
    currency: input.currency || "NGN",
    show_compensation: input.show_compensation === true,
    transport_allowance_kobo: num(input.transport_allowance_kobo),
    lunch_provided: input.lunch_provided === true,
    accommodation_provided: input.accommodation_provided === true,
    other_benefits: input.other_benefits || null,
    application_opens_at: input.application_opens_at || null,
    application_closes_at: input.application_closes_at || null,
    max_applications: num(input.max_applications),
    cv_required: input.cv_required !== false,
    cover_letter_required: input.cover_letter_required === true,
    portfolio_enabled: input.portfolio_enabled === true,
    pass_score: num(input.pass_score),
    confirmation_message: input.confirmation_message || null,
    auto_close_on_deadline: input.auto_close_on_deadline !== false,
    auto_close_on_max_applications: input.auto_close_on_max_applications === true,
    equipment_fields: input.equipment_fields && typeof input.equipment_fields === "object" ? input.equipment_fields : {},
    updated_at: new Date().toISOString(),
  }
  return { row }
}

export async function replaceVacancyLocations(vacancyId: string, locations: VacancyLocationInput[]) {
  await supabase.from("career_vacancy_locations").delete().eq("vacancy_id", vacancyId)
  const rows = (locations || [])
    .filter((l) => l.state || l.city || l.public_description)
    .map((l, i) => ({
      vacancy_id: vacancyId,
      country: l.country || "Nigeria",
      state: l.state || null,
      lga: l.lga || null,
      city: l.city || null,
      area_site: l.area_site || null,
      full_address: l.full_address || null,
      public_description: l.public_description || null,
      nearby_preferred: l.nearby_preferred === true,
      is_primary: i === 0 ? true : l.is_primary === true,
      sort_order: i,
    }))
  if (rows.length > 0) {
    await supabase.from("career_vacancy_locations").insert(rows)
  }
}

/* GET: list vacancies (admin). */
export async function GET(request: Request) {
  const { session, denied } = await authorizeAdmin("careers.vacancies.view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ vacancies: [] })

  const { searchParams } = new URL(request.url)
  const list = await listVacancies({
    status: searchParams.get("status") || undefined,
    q: searchParams.get("q") || undefined,
  })

  // Hiring managers only see vacancies they own.
  const visible =
    session.role === "Hiring Manager"
      ? list.filter((v) => v.hiring_manager_id === session.userId)
      : list

  return NextResponse.json({ vacancies: visible })
}

/* POST: create vacancy (DRAFT by default). */
export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("careers.vacancies.create")
  if (denied) return denied
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  const input = (await request.json().catch(() => ({}))) as VacancyInput
  const { row, error } = buildVacancyRow(input)
  if (error || !row) return NextResponse.json({ error: error || "Invalid input" }, { status: 400 })

  // Unique slug
  let slug = slugify(input.slug || String(row.title))
  if (!slug) slug = `vacancy-${Date.now()}`
  const { data: existing } = await supabase.from("career_vacancies").select("id").eq("slug", slug).maybeSingle()
  if (existing) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`

  const id = crypto.randomUUID()
  const { error: insErr } = await supabase.from("career_vacancies").insert({
    ...row,
    id,
    slug,
    reference_number: generateVacancyReference(),
    status: "DRAFT",
    created_by: session.userId,
    updated_by: session.userId,
  })
  if (insErr) {
    console.error("[careers] vacancy insert failed:", insErr.message)
    return NextResponse.json({ error: "Failed to create vacancy" }, { status: 500 })
  }

  await replaceVacancyLocations(id, input.locations || [])

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_VACANCY_CREATED,
    entityType: AUDIT_ENTITIES.CAREER_VACANCY,
    entityId: id,
    metadata: { title: row.title, slug },
  })

  return NextResponse.json({ success: true, id, slug })
}
