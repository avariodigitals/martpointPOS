/* ───────────────────────────  Careers module  ───────────────────────────
 * Recruitment & field-workforce data access. Server-side only — every
 * function here uses the Supabase service-role client and must never be
 * imported from client components that would ship credentials. Public pages
 * call the read helpers from server components / route handlers only.
 *
 * Money convention: compensation fields are integer kobo (NGN minor unit),
 * consistent with finance (toKobo/fromKobo).
 */

import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "./supabase"

/* ─── Enums / constants ─── */

export const VACANCY_STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED", "PAUSED", "CLOSED", "ARCHIVED"] as const
export type VacancyStatus = (typeof VACANCY_STATUSES)[number]

export const EMPLOYMENT_TYPES = ["PERMANENT", "CONTRACT", "TEMPORARY", "INTERNSHIP", "PROJECT_BASED", "ON_CALL_FIELD"] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]

export const WORK_ARRANGEMENTS = ["ON_SITE", "REMOTE", "HYBRID", "FIELD_BASED"] as const
export type WorkArrangement = (typeof WORK_ARRANGEMENTS)[number]

export const COMPENSATION_TYPES = ["DAILY", "WEEKLY", "MONTHLY", "PROJECT_FEE", "NEGOTIABLE"] as const
export type CompensationType = (typeof COMPENSATION_TYPES)[number]

export const APPLICATION_STATUSES = [
  "NEW",
  "SCREENING_PASSED",
  "SCREENING_FAILED",
  "UNDER_REVIEW",
  "SHORTLISTED",
  "ASSESSMENT_INVITED",
  "ASSESSMENT_COMPLETED",
  "VERIFIED",
  "SELECTED",
  "RESERVE",
  "DEPLOYED",
  "COMPLETED",
  "REJECTED",
  "WITHDRAWN",
  "BLACKLISTED",
] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

export const ANSWER_TYPES = [
  "YES_NO",
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "SHORT_TEXT",
  "LONG_TEXT",
  "NUMBER",
  "DATE",
  "FILE",
  "RATING",
  "LOCATION",
] as const
export type AnswerType = (typeof ANSWER_TYPES)[number]

export const EQUIPMENT_FIELD_KEYS = [
  "owns_android",
  "smartphone_model",
  "has_mobile_data",
  "owns_laptop",
  "owns_power_bank",
  "transportation",
] as const
export type EquipmentFieldKey = (typeof EQUIPMENT_FIELD_KEYS)[number]

export const DEPLOYMENT_STATUSES = ["PLANNED", "ACTIVE", "COMPLETED", "CANCELLED"] as const
export const DEPLOYMENT_WORKER_STATUSES = ["ASSIGNED", "INVITED", "CONFIRMED", "ACTIVE", "COMPLETED", "REMOVED"] as const
export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "HALF_DAY", "EXCUSED"] as const
export const CANDIDATE_STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const
export const VERIFICATION_STATUSES = ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"] as const

export const PRIVACY_VERSION = "careers-privacy-v1"

/* ─── Labels / display maps ─── */

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  PERMANENT: "Permanent",
  CONTRACT: "Contract",
  TEMPORARY: "Temporary",
  INTERNSHIP: "Internship",
  PROJECT_BASED: "Project-based",
  ON_CALL_FIELD: "On-call field worker",
}

export const WORK_ARRANGEMENT_LABELS: Record<WorkArrangement, string> = {
  ON_SITE: "On-site",
  REMOTE: "Remote",
  HYBRID: "Hybrid",
  FIELD_BASED: "Field-based",
}

export const COMPENSATION_TYPE_LABELS: Record<CompensationType, string> = {
  DAILY: "per day",
  WEEKLY: "per week",
  MONTHLY: "per month",
  PROJECT_FEE: "project fee",
  NEGOTIABLE: "Negotiable",
}

export const VACANCY_STATUS_LABELS: Record<VacancyStatus, string> = {
  DRAFT: "Draft",
  SCHEDULED: "Scheduled",
  PUBLISHED: "Published",
  PAUSED: "Paused",
  CLOSED: "Closed",
  ARCHIVED: "Archived",
}

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  NEW: "New",
  SCREENING_PASSED: "Screening passed",
  SCREENING_FAILED: "Screening failed",
  UNDER_REVIEW: "Under review",
  SHORTLISTED: "Shortlisted",
  ASSESSMENT_INVITED: "Assessment invited",
  ASSESSMENT_COMPLETED: "Assessment completed",
  VERIFIED: "Verified",
  SELECTED: "Selected",
  RESERVE: "Reserve list",
  DEPLOYED: "Deployed",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  WITHDRAWN: "Withdrawn",
  BLACKLISTED: "Blacklisted",
}

export const APPLICATION_STATUS_COLORS: Record<ApplicationStatus, string> = {
  NEW: "bg-blue-50 text-blue-700",
  SCREENING_PASSED: "bg-teal-50 text-teal-700",
  SCREENING_FAILED: "bg-gray-100 text-gray-600",
  UNDER_REVIEW: "bg-indigo-50 text-indigo-700",
  SHORTLISTED: "bg-purple-50 text-purple-700",
  ASSESSMENT_INVITED: "bg-amber-50 text-amber-700",
  ASSESSMENT_COMPLETED: "bg-amber-100 text-amber-800",
  VERIFIED: "bg-cyan-50 text-cyan-700",
  SELECTED: "bg-green-50 text-green-700",
  RESERVE: "bg-yellow-50 text-yellow-800",
  DEPLOYED: "bg-green-100 text-green-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-50 text-red-700",
  WITHDRAWN: "bg-gray-100 text-gray-600",
  BLACKLISTED: "bg-red-100 text-red-800",
}

/** Safe label lookup for API-returned status strings. */
export function applicationStatusLabel(status: string): string {
  return (APPLICATION_STATUS_LABELS as Record<string, string>)[status] ?? status.replace(/_/g, " ")
}

export function vacancyStatusLabel(status: string): string {
  return (VACANCY_STATUS_LABELS as Record<string, string>)[status] ?? status.replace(/_/g, " ")
}

export function applicationStatusColor(status: string): string {
  return (APPLICATION_STATUS_COLORS as Record<string, string>)[status] ?? "bg-gray-100 text-gray-600"
}

/**
 * Safe public statuses for the applicant-facing status lookup. Internal
 * workflow detail (scores, reviewer notes, sub-statuses) is never exposed.
 */
export function publicApplicationStatus(status: ApplicationStatus): string {
  switch (status) {
    case "NEW":
      return "Application received"
    case "UNDER_REVIEW":
    case "SCREENING_PASSED":
      return "Under review"
    case "SCREENING_FAILED":
    case "REJECTED":
    case "BLACKLISTED":
      return "Not selected"
    case "SHORTLISTED":
      return "Shortlisted"
    case "ASSESSMENT_INVITED":
    case "ASSESSMENT_COMPLETED":
      return "Assessment stage"
    case "VERIFIED":
    case "SELECTED":
    case "DEPLOYED":
      return "Selected"
    case "RESERVE":
      return "Under review"
    case "WITHDRAWN":
    case "COMPLETED":
      return "Closed"
    default:
      return "Under review"
  }
}

/* ─── Types (DB row shapes) ─── */

export interface CareerDepartment {
  id: string
  name: string
  description: string | null
  active: boolean
  sort_order: number
}

export interface CareerJobCategory {
  id: string
  name: string
  description: string | null
  active: boolean
  sort_order: number
}

export interface VacancyLocation {
  id: string
  vacancy_id: string
  country: string
  state: string | null
  lga: string | null
  city: string | null
  area_site: string | null
  full_address: string | null
  public_description: string | null
  nearby_preferred: boolean
  is_primary: boolean
  sort_order: number
}

export interface ScreeningQuestion {
  id: string
  vacancy_id: string
  question_text: string
  answer_type: AnswerType
  required: boolean
  knockout: boolean
  correct_answer: string | null
  sort_order: number
  options?: { id: string; option_text: string }[]
}

export interface CareerVacancy {
  id: string
  title: string
  slug: string
  reference_number: string
  department_id: string | null
  job_category_id: string | null
  short_summary: string | null
  description: string | null
  responsibilities: string[]
  requirements: string[]
  openings: number
  show_openings: boolean
  hiring_manager_id: string | null
  featured: boolean
  urgent: boolean
  employment_type: EmploymentType
  work_arrangement: WorkArrangement
  working_days: string | null
  work_start_time: string | null
  work_end_time: string | null
  project_start_date: string | null
  project_end_date: string | null
  duration_description: string | null
  compensation_type: CompensationType
  compensation_min_kobo: number | null
  compensation_max_kobo: number | null
  currency: string
  show_compensation: boolean
  transport_allowance_kobo: number | null
  lunch_provided: boolean
  accommodation_provided: boolean
  other_benefits: string | null
  application_opens_at: string | null
  application_closes_at: string | null
  max_applications: number | null
  cv_required: boolean
  cover_letter_required: boolean
  portfolio_enabled: boolean
  pass_score: number | null
  confirmation_message: string | null
  auto_close_on_deadline: boolean
  auto_close_on_max_applications: boolean
  equipment_fields: Record<string, boolean>
  status: VacancyStatus
  scheduled_publish_at: string | null
  published_at: string | null
  closed_at: string | null
  closed_reason: string | null
  archived_at: string | null
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  // joined
  locations?: VacancyLocation[]
  questions?: ScreeningQuestion[]
  department_name?: string | null
  category_name?: string | null
  application_count?: number
}

export interface CareerApplication {
  id: string
  reference_number: string
  vacancy_id: string
  full_name: string
  email: string
  phone: string
  whatsapp: string | null
  country: string
  state: string | null
  lga: string | null
  city: string | null
  residential_area: string | null
  employment_status: string | null
  earliest_available_date: string | null
  available_working_hours: boolean | null
  available_full_duration: boolean | null
  can_travel_to_location: boolean | null
  requires_accommodation: boolean | null
  other_work_cities: string | null
  highest_qualification: string | null
  field_of_study: string | null
  current_occupation: string | null
  years_experience: number | null
  work_history: string | null
  skills: string[]
  excel_proficiency: string | null
  inventory_software_experience: string | null
  owns_android: boolean | null
  smartphone_model: string | null
  has_mobile_data: boolean | null
  owns_laptop: boolean | null
  owns_power_bank: boolean | null
  transportation: string | null
  linkedin_url: string | null
  portfolio_url: string | null
  status: ApplicationStatus
  screening_score: number | null
  screening_passed: boolean | null
  review_score: number | null
  assigned_reviewer_id: string | null
  consent_talent_pool: boolean
  consent_notifications: boolean
  privacy_version: string | null
  consent_at: string | null
  source: string
  duplicate_of: string | null
  candidate_profile_id: string | null
  submitted_at: string
  created_at: string
  updated_at: string
  vacancy_title?: string
  vacancy_slug?: string
}

export interface CandidateProfile {
  id: string
  reference_number: string
  full_name: string
  email: string
  phone: string | null
  whatsapp: string | null
  country: string
  state: string | null
  lga: string | null
  city: string | null
  residential_area: string | null
  qualified_roles: string[]
  employment_preferences: Record<string, unknown>
  availability_notes: string | null
  earliest_available_date: string | null
  other_work_cities: string | null
  highest_qualification: string | null
  field_of_study: string | null
  years_experience: number | null
  equipment: Record<string, unknown>
  verification_status: string
  performance_rating: number | null
  accuracy_rating: number | null
  team_lead_eligible: boolean
  supervisor_comments: string | null
  status: string
  last_contacted_at: string | null
  consent_talent_pool: boolean
  consent_notifications: boolean
  source: string
  created_at: string
  skills?: string[]
}

/* ─── Reference / slug helpers ─── */

const REF_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no ambiguous chars

/** Unguessable, non-sequential reference: MPC-2026-XXXXXX */
export function generateReference(prefix: string, length = 6): string {
  const year = new Date().getFullYear()
  let suffix = ""
  const bytes = crypto.randomBytes(length)
  for (let i = 0; i < length; i++) {
    suffix += REF_ALPHABET[bytes[i] % REF_ALPHABET.length]
  }
  return `${prefix}-${year}-${suffix}`
}

export function generateApplicationReference(): string {
  return generateReference("MPC")
}

export function generateVacancyReference(): string {
  return generateReference("MPV", 5)
}

export function generateCandidateReference(): string {
  return generateReference("MPT")
}

export function generateDeploymentReference(): string {
  return generateReference("MPD", 5)
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
}

/** Money display: kobo → "₦10,000". */
export function formatKobo(kobo: number | null | undefined, currency = "NGN"): string {
  if (kobo == null) return ""
  const naira = kobo / 100
  const symbol = currency === "NGN" ? "₦" : `${currency} `
  return `${symbol}${naira.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`
}

export function formatCompensation(v: Pick<CareerVacancy, "compensation_type" | "compensation_min_kobo" | "compensation_max_kobo" | "currency" | "show_compensation">): string | null {
  if (!v.show_compensation || v.compensation_type === "NEGOTIABLE") return null
  const min = formatKobo(v.compensation_min_kobo, v.currency)
  const max = formatKobo(v.compensation_max_kobo, v.currency)
  const suffix = COMPENSATION_TYPE_LABELS[v.compensation_type]
  if (min && max && min !== max) return `${min} – ${max} ${suffix}`
  if (min || max) return `${min || max} ${suffix}`
  return null
}

/* ─── Visibility rules (pure — unit tested) ─── */

/**
 * A vacancy is publicly listed only when PUBLISHED. CLOSED vacancies remain
 * accessible on their details page (direct link) but are not listed.
 */
export function isVacancyPubliclyListed(v: Pick<CareerVacancy, "status" | "application_opens_at" | "application_closes_at">, now = new Date()): boolean {
  if (v.status !== "PUBLISHED") return false
  if (v.application_opens_at && new Date(v.application_opens_at) > now) return false
  if (v.application_closes_at && new Date(v.application_closes_at) < now) return false
  return true
}

/** Closed vacancies stay viewable (with "Applications Closed") when they were ever published. */
export function isVacancyPubliclyAccessible(v: Pick<CareerVacancy, "status">): boolean {
  return v.status === "PUBLISHED" || v.status === "PAUSED" || v.status === "CLOSED"
}

/** Only PUBLISHED vacancies inside their open window may accept applications. */
export function vacancyAcceptsApplications(
  v: Pick<CareerVacancy, "status" | "application_opens_at" | "application_closes_at" | "max_applications">,
  applicationCount = 0,
  now = new Date()
): boolean {
  if (!isVacancyPubliclyListed(v, now)) return false
  if (v.max_applications != null && applicationCount >= v.max_applications) return false
  return true
}

/**
 * Lifecycle transitions. Applied by the cron route (and lazily by readers):
 * SCHEDULED → PUBLISHED when scheduled_publish_at has passed,
 * PUBLISHED → CLOSED when the deadline passed and auto-close is on.
 */
export function deriveEffectiveStatus(
  v: Pick<CareerVacancy, "status" | "scheduled_publish_at" | "application_closes_at" | "auto_close_on_deadline">,
  now = new Date()
): VacancyStatus {
  if (v.status === "SCHEDULED" && v.scheduled_publish_at && new Date(v.scheduled_publish_at) <= now) {
    return "PUBLISHED"
  }
  if (v.status === "PUBLISHED" && v.auto_close_on_deadline && v.application_closes_at && new Date(v.application_closes_at) < now) {
    return "CLOSED"
  }
  return v.status
}

/* ─── Screening-answer validation (pure — unit tested) ─── */

export interface ScreeningAnswerInput {
  questionId: string
  text?: string | null
  options?: string[] // for choice types — option ids or texts
  fileDocumentId?: string | null
}

/** Returns a map of questionId → error message. Empty = valid. */
export function validateScreeningAnswers(
  questions: ScreeningQuestion[],
  answers: ScreeningAnswerInput[]
): Record<string, string> {
  const errors: Record<string, string> = {}
  const byId = new Map(answers.map((a) => [a.questionId, a]))

  for (const q of questions) {
    const a = byId.get(q.id)
    const empty =
      !a ||
      ((a.text == null || String(a.text).trim() === "") &&
        (!a.options || a.options.length === 0) &&
        !a.fileDocumentId)

    if (q.required && empty) {
      errors[q.id] = "This question is required"
      continue
    }
    if (empty) continue

    switch (q.answer_type) {
      case "YES_NO":
        if (!["yes", "no"].includes(String(a!.text).toLowerCase())) errors[q.id] = "Answer yes or no"
        break
      case "NUMBER":
        if (Number.isNaN(Number(a!.text))) errors[q.id] = "Enter a number"
        break
      case "DATE":
        if (Number.isNaN(Date.parse(String(a!.text)))) errors[q.id] = "Enter a valid date"
        break
      case "RATING": {
        const n = Number(a!.text)
        if (!Number.isFinite(n) || n < 1 || n > 5) errors[q.id] = "Rate 1 to 5"
        break
      }
      case "SINGLE_CHOICE": {
        const valid = new Set((q.options || []).map((o) => o.option_text))
        if (!valid.has(String(a!.options?.[0] ?? a!.text))) errors[q.id] = "Select one option"
        break
      }
      case "MULTIPLE_CHOICE": {
        const valid = new Set((q.options || []).map((o) => o.option_text))
        const chosen = a!.options || []
        if (chosen.length === 0 || chosen.some((c) => !valid.has(c))) errors[q.id] = "Select valid options"
        break
      }
      case "FILE":
        if (q.required && !a!.fileDocumentId) errors[q.id] = "Attach a file"
        break
      default:
        break
    }
  }
  return errors
}

/** Score YES_NO / choice knockout questions. Returns {score, max, passed|null}. */
export function scoreScreeningAnswers(
  questions: ScreeningQuestion[],
  answers: ScreeningAnswerInput[],
  passScore: number | null
): { score: number; max: number; passed: boolean | null } {
  let score = 0
  let max = 0
  for (const q of questions) {
    if (q.correct_answer == null || q.correct_answer === "") continue
    max += 1
    const a = answers.find((x) => x.questionId === q.id)
    const given = a?.options?.[0] ?? a?.text ?? ""
    if (String(given).trim().toLowerCase() === q.correct_answer.trim().toLowerCase()) score += 1
  }
  if (max === 0) return { score, max, passed: null }
  const pct = (score / max) * 100
  return { score: pct, max, passed: passScore == null ? null : pct >= passScore }
}

/* ─── Application confirmation message ───
 * Shown on the post-submit screen and sent inside the
 * career_application_received email. Supports {{placeholders}}. */

export const CONFIRMATION_MESSAGE_VARS = [
  "applicant_name",
  "vacancy_title",
  "application_reference",
  "vacancy_location",
  "status_url",
] as const

export const DEFAULT_APPLICATION_CONFIRMATION = `Thank you, {{applicant_name}}. Your application for the position of {{vacancy_title}} has been received successfully.

Application Reference: {{application_reference}}
Location: {{vacancy_location}}

Our recruitment team will review your application against the requirements of the role. If you are shortlisted, we will contact you using the email address or phone number provided in your application.

Please save your application reference, as you may need it to check your application status.

Submitting an application does not guarantee selection. MartPoint does not request payment for job applications, assessments, training or recruitment consideration.

MartPoint Careers
Building the team powering African businesses.`

/** Substitute {{placeholders}} in a confirmation message template. */
export function renderConfirmationMessage(
  template: string,
  vars: Record<string, string | null | undefined>
): string {
  return template.replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (_, name: string) => vars[name] ?? "")
}

/**
 * Resolve the default confirmation message — the editable
 * career_settings.default_confirmation_message value, else the built-in template.
 */
export async function getDefaultConfirmationMessage(): Promise<string> {
  if (isSupabaseConfigured()) {
    const { data } = await supabase
      .from("career_settings")
      .select("value")
      .eq("key", "default_confirmation_message")
      .maybeSingle()
    if (typeof data?.value === "string" && data.value.trim()) return data.value
  }
  return DEFAULT_APPLICATION_CONFIRMATION
}

/* ─── Vacancy queries ─── */

const VACANCY_SELECT = "*, career_departments(name), career_job_categories(name)"

function mapVacancy(row: Record<string, unknown>): CareerVacancy {
  const v = row as unknown as CareerVacancy
  v.department_name = (row.career_departments as { name?: string } | null)?.name ?? null
  v.category_name = (row.career_job_categories as { name?: string } | null)?.name ?? null
  delete (v as unknown as Record<string, unknown>).career_departments
  delete (v as unknown as Record<string, unknown>).career_job_categories
  return v
}

async function attachLocations<T extends { id: string; locations?: VacancyLocation[] }>(vacancies: T[]): Promise<T[]> {
  if (vacancies.length === 0) return vacancies
  const { data } = await supabase
    .from("career_vacancy_locations")
    .select("*")
    .in("vacancy_id", vacancies.map((v) => v.id))
    .order("sort_order")
  const byVacancy = new Map<string, VacancyLocation[]>()
  for (const loc of (data || []) as VacancyLocation[]) {
    const list = byVacancy.get(loc.vacancy_id) || []
    list.push(loc)
    byVacancy.set(loc.vacancy_id, list)
  }
  for (const v of vacancies) v.locations = byVacancy.get(v.id) || []
  return vacancies
}

async function attachQuestions(vacancy: CareerVacancy): Promise<CareerVacancy> {
  const { data: questions } = await supabase
    .from("career_screening_questions")
    .select("*")
    .eq("vacancy_id", vacancy.id)
    .order("sort_order")
  const qs = (questions || []) as ScreeningQuestion[]
  if (qs.length > 0) {
    const { data: options } = await supabase
      .from("career_question_options")
      .select("id, question_id, option_text, sort_order")
      .in("question_id", qs.map((q) => q.id))
      .order("sort_order")
    const byQ = new Map<string, { id: string; option_text: string }[]>()
    for (const o of options || []) {
      const list = byQ.get(o.question_id) || []
      list.push({ id: o.id, option_text: o.option_text })
      byQ.set(o.question_id, list)
    }
    for (const q of qs) q.options = byQ.get(q.id) || []
  }
  vacancy.questions = qs
  return vacancy
}

export async function listPublicVacancies(): Promise<CareerVacancy[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from("career_vacancies")
    .select(VACANCY_SELECT)
    .eq("status", "PUBLISHED")
    .is("deleted_at", null)
    .order("featured", { ascending: false })
    .order("published_at", { ascending: false })
  if (error || !data) return []
  const now = new Date()
  const list = data.map(mapVacancy).filter((v) => isVacancyPubliclyListed(v, now))
  return attachLocations(list)
}

export async function getPublicVacancyBySlug(slug: string): Promise<CareerVacancy | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from("career_vacancies")
    .select(VACANCY_SELECT)
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle()
  if (error || !data) return null
  const v = mapVacancy(data)
  if (!isVacancyPubliclyAccessible(v)) return null
  await attachLocations([v])
  return attachQuestions(v)
}

export async function listVacancies(filters: { status?: string; q?: string } = {}): Promise<CareerVacancy[]> {
  if (!isSupabaseConfigured()) return []
  let query = supabase
    .from("career_vacancies")
    .select(VACANCY_SELECT)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
  if (filters.status) query = query.eq("status", filters.status)
  if (filters.q) query = query.ilike("title", `%${filters.q}%`)
  const { data } = await query
  const list = (data || []).map(mapVacancy)
  await attachLocations(list)
  // Application counts per vacancy
  const { data: counts } = await supabase
    .from("career_applications")
    .select("vacancy_id")
    .in("vacancy_id", list.map((v) => v.id))
  if (counts) {
    const tally = new Map<string, number>()
    for (const r of counts as { vacancy_id: string }[]) tally.set(r.vacancy_id, (tally.get(r.vacancy_id) || 0) + 1)
    for (const v of list) v.application_count = tally.get(v.id) || 0
  }
  return list
}

export async function getVacancy(id: string): Promise<CareerVacancy | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase
    .from("career_vacancies")
    .select(VACANCY_SELECT)
    .eq("id", id)
    .maybeSingle()
  if (!data) return null
  const v = mapVacancy(data)
  await attachLocations([v])
  return attachQuestions(v)
}

export async function countApplications(vacancyId: string): Promise<number> {
  if (!isSupabaseConfigured()) return 0
  const { count } = await supabase
    .from("career_applications")
    .select("id", { count: "exact", head: true })
    .eq("vacancy_id", vacancyId)
  return count ?? 0
}

/* ─── Applications ─── */

export async function findActiveDuplicate(vacancyId: string, email: string): Promise<CareerApplication | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase
    .from("career_applications")
    .select("id, reference_number, status")
    .eq("vacancy_id", vacancyId)
    .ilike("email", email.trim())
    .not("status", "in", "(REJECTED,WITHDRAWN,BLACKLISTED)")
    .maybeSingle()
  return (data as CareerApplication | null) ?? null
}

export async function getApplicationByReference(reference: string): Promise<CareerApplication | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase
    .from("career_applications")
    .select("*, career_vacancies(title, slug)")
    .eq("reference_number", reference)
    .maybeSingle()
  if (!data) return null
  const row = data as Record<string, unknown>
  const app = row as unknown as CareerApplication
  const vac = row.career_vacancies as { title?: string; slug?: string } | null
  app.vacancy_title = vac?.title
  app.vacancy_slug = vac?.slug
  return app
}

export async function changeApplicationStatus(
  applicationId: string,
  newStatus: ApplicationStatus,
  changedBy: { id: string | null; name: string | null },
  reason?: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  if (!APPLICATION_STATUSES.includes(newStatus)) return false

  const { data: app } = await supabase
    .from("career_applications")
    .select("status")
    .eq("id", applicationId)
    .single()
  if (!app) return false
  if (app.status === newStatus) return true

  const { error } = await supabase
    .from("career_applications")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", applicationId)
  if (error) return false

  await supabase.from("career_application_status_history").insert({
    application_id: applicationId,
    previous_status: app.status,
    new_status: newStatus,
    changed_by: changedBy.id,
    changed_by_name: changedBy.name,
    reason: reason || null,
  })
  return true
}

/* ─── Talent pool ─── */

export async function getCandidateByEmail(email: string): Promise<CandidateProfile | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase
    .from("career_candidate_profiles")
    .select("*")
    .ilike("email", email.trim())
    .is("deleted_at", null)
    .maybeSingle()
  return (data as CandidateProfile | null) ?? null
}

/* ─── Lifecycle sweep (cron) ───
 * Applies automatic transitions:
 *  - SCHEDULED → PUBLISHED when scheduled_publish_at has passed
 *  - PUBLISHED → CLOSED when deadline passed (auto_close_on_deadline)
 *  - PUBLISHED → CLOSED when application cap reached (auto_close_on_max_applications)
 *  - Deployment ACTIVE/PLANNED → COMPLETED when end_date has passed
 */
export async function runCareersLifecycle(now = new Date()): Promise<{ published: string[]; closed: string[]; deploymentsCompleted: string[] }> {
  const result = { published: [] as string[], closed: [] as string[], deploymentsCompleted: [] as string[] }
  if (!isSupabaseConfigured()) return result

  const iso = now.toISOString()

  // 1. Scheduled publications
  const { data: scheduled } = await supabase
    .from("career_vacancies")
    .select("id, title")
    .eq("status", "SCHEDULED")
    .lte("scheduled_publish_at", iso)
    .is("deleted_at", null)
  for (const v of scheduled || []) {
    const { error } = await supabase
      .from("career_vacancies")
      .update({ status: "PUBLISHED", published_at: iso, updated_at: iso })
      .eq("id", v.id)
      .eq("status", "SCHEDULED") // guard against concurrent changes
    if (!error) result.published.push(v.id)
  }

  // 2. Deadline auto-close
  const { data: expired } = await supabase
    .from("career_vacancies")
    .select("id")
    .eq("status", "PUBLISHED")
    .eq("auto_close_on_deadline", true)
    .lt("application_closes_at", iso)
    .is("deleted_at", null)
  for (const v of expired || []) {
    const { error } = await supabase
      .from("career_vacancies")
      .update({ status: "CLOSED", closed_at: iso, updated_at: iso })
      .eq("id", v.id)
      .eq("status", "PUBLISHED")
    if (!error) result.closed.push(v.id)
  }

  // 3. Max-applications auto-close
  const { data: capped } = await supabase
    .from("career_vacancies")
    .select("id, max_applications")
    .eq("status", "PUBLISHED")
    .eq("auto_close_on_max_applications", true)
    .not("max_applications", "is", null)
    .is("deleted_at", null)
  for (const v of capped || []) {
    const count = await countApplications(v.id)
    if (v.max_applications != null && count >= v.max_applications) {
      const { error } = await supabase
        .from("career_vacancies")
        .update({ status: "CLOSED", closed_at: iso, updated_at: iso })
        .eq("id", v.id)
        .eq("status", "PUBLISHED")
      if (!error) result.closed.push(v.id)
    }
  }

  // 4. Deployment auto-complete
  const today = iso.slice(0, 10)
  const { data: ended } = await supabase
    .from("career_deployments")
    .select("id")
    .in("status", ["PLANNED", "ACTIVE"])
    .lt("end_date", today)
  for (const d of ended || []) {
    const { error } = await supabase
      .from("career_deployments")
      .update({ status: "COMPLETED", updated_at: iso })
      .eq("id", d.id)
      .in("status", ["PLANNED", "ACTIVE"])
    if (!error) result.deploymentsCompleted.push(d.id)
  }

  return result
}
