/* ───────────────────────────  Creator Network core  ───────────────────────────
 * Shared constants, types and data access for the MartPoint Creator Network.
 * Conventions mirror lib/partners.ts / lib/careers.ts.
 */

import { supabase, isSupabaseConfigured } from "./supabase"

/* ───────────────────────────  Constants  ───────────────────────────
 * Pure constants live in creator-constants.ts (client-safe, no server
 * imports) and are re-exported here for convenience. */

export {
  CREATOR_APPLICATION_STATUSES,
  CREATOR_APPLICATION_STATUS_LABELS,
  CREATOR_APPLICATION_STATUS_COLORS,
  publicCreatorApplicationStatus,
  CREATOR_STATUSES,
  CONTENT_CATEGORIES,
  CREATOR_PLATFORMS,
  CREATOR_PLATFORM_LABELS,
  EXPERIENCE_OPTIONS,
  CHALLENGE_STATUSES,
  SUBMISSION_STATUSES,
  SUBMISSION_STATUS_LABELS,
  REWARD_STATUSES,
  RESOURCE_CATEGORIES,
  RESOURCE_CATEGORY_LABELS,
  LEARNING_CATEGORIES,
  LEARNING_CATEGORY_LABELS,
  FLAG_TYPES,
  PRIVACY_VERSION,
} from "./creator-constants"

export type {
  CreatorApplicationStatus,
  CreatorStatus,
  CreatorPlatform,
  ChallengeStatus,
  SubmissionStatus,
  RewardStatus,
  ResourceCategory,
  LearningCategory,
  CreatorFlagType,
} from "./creator-constants"

import type { CreatorApplicationStatus, CreatorPlatform, CreatorStatus } from "./creator-constants"

/* ───────────────────────────  Types  ─────────────────────────── */

export interface CreatorSocialProfile {
  id: string
  applicationId: string
  creatorId: string | null
  platform: CreatorPlatform
  profileUrl: string
  username: string | null
  followers: number | null
  typicalViews: number | null
  typicalEngagement: string | null
  isPrimary: boolean
}

export interface CreatorApplication {
  id: string
  referenceNumber: string
  fullName: string
  email: string
  phone: string
  whatsapp: string | null
  country: string
  state: string | null
  city: string | null
  dateOfBirth: string | null
  ageConfirmed: boolean
  profilePhotoPath: string | null
  primaryCategory: string
  secondaryCategory: string | null
  languages: string[]
  bio: string | null
  experienceYears: string | null
  primaryAudience: string | null
  audienceLocations: string[]
  audienceAgeRange: string | null
  audienceHasBusinessOwners: boolean | null
  audienceIndustries: string[]
  portfolioLinks: { url: string; note?: string }[]
  whyCreator: string | null
  introduceMartpoint: string | null
  status: CreatorApplicationStatus
  statusHistory: { status: string; at: string; by?: string | null; reason?: string | null }[]
  reviewedByName: string | null
  reviewedAt: string | null
  decisionReason: string | null
  createdCreatorId: string | null
  submittedAt: string
  createdAt: string
}

export interface CreatorRecord {
  id: string
  creatorId: string
  referralCode: string
  applicationId: string
  fullName: string
  email: string
  phone: string | null
  whatsapp: string | null
  country: string
  state: string | null
  city: string | null
  photoPath: string | null
  primaryCategory: string | null
  bio: string | null
  status: CreatorStatus
  levelId: string | null
  levelName: string | null
  levelLabel: string | null
  lastLoginAt: string | null
  activatedAt: string | null
  createdAt: string
}

export interface CreatorLevel {
  id: string
  name: string
  label: string
  description: string | null
  sortOrder: number
  requirements: Record<string, number>
  benefits: string | null
  active: boolean
}

/* ───────────────────────────  Mappers  ─────────────────────────── */

export function mapCreatorApplication(row: Record<string, unknown>): CreatorApplication {
  return {
    id: row.id as string,
    referenceNumber: row.reference_number as string,
    fullName: row.full_name as string,
    email: row.email as string,
    phone: row.phone as string,
    whatsapp: (row.whatsapp as string | null) ?? null,
    country: (row.country as string) || "Nigeria",
    state: (row.state as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    dateOfBirth: (row.date_of_birth as string | null) ?? null,
    ageConfirmed: (row.age_confirmed as boolean) ?? false,
    profilePhotoPath: (row.profile_photo_path as string | null) ?? null,
    primaryCategory: row.primary_category as string,
    secondaryCategory: (row.secondary_category as string | null) ?? null,
    languages: (row.languages as string[]) ?? [],
    bio: (row.bio as string | null) ?? null,
    experienceYears: (row.experience_years as string | null) ?? null,
    primaryAudience: (row.primary_audience as string | null) ?? null,
    audienceLocations: (row.audience_locations as string[]) ?? [],
    audienceAgeRange: (row.audience_age_range as string | null) ?? null,
    audienceHasBusinessOwners: (row.audience_has_business_owners as boolean | null) ?? null,
    audienceIndustries: (row.audience_industries as string[]) ?? [],
    portfolioLinks: (row.portfolio_links as { url: string; note?: string }[]) ?? [],
    whyCreator: (row.why_creator as string | null) ?? null,
    introduceMartpoint: (row.introduce_martpoint as string | null) ?? null,
    status: row.status as CreatorApplicationStatus,
    statusHistory: (row.status_history as CreatorApplication["statusHistory"]) ?? [],
    reviewedByName: (row.reviewed_by_name as string | null) ?? null,
    reviewedAt: (row.reviewed_at as string | null) ?? null,
    decisionReason: (row.decision_reason as string | null) ?? null,
    createdCreatorId: (row.created_creator_id as string | null) ?? null,
    submittedAt: row.submitted_at as string,
    createdAt: row.created_at as string,
  }
}

export function mapSocialProfile(row: Record<string, unknown>): CreatorSocialProfile {
  return {
    id: row.id as string,
    applicationId: row.application_id as string,
    creatorId: (row.creator_id as string | null) ?? null,
    platform: row.platform as CreatorPlatform,
    profileUrl: row.profile_url as string,
    username: (row.username as string | null) ?? null,
    followers: (row.followers as number | null) ?? null,
    typicalViews: (row.typical_views as number | null) ?? null,
    typicalEngagement: (row.typical_engagement as string | null) ?? null,
    isPrimary: (row.is_primary as boolean) ?? false,
  }
}

export function mapCreator(row: Record<string, unknown>): CreatorRecord {
  const level = row.creator_levels as { name?: string; label?: string } | null | undefined
  return {
    id: row.id as string,
    creatorId: row.creator_id as string,
    referralCode: row.referral_code as string,
    applicationId: row.application_id as string,
    fullName: row.full_name as string,
    email: row.email as string,
    phone: (row.phone as string | null) ?? null,
    whatsapp: (row.whatsapp as string | null) ?? null,
    country: (row.country as string) || "Nigeria",
    state: (row.state as string | null) ?? null,
    city: (row.city as string | null) ?? null,
    photoPath: (row.photo_path as string | null) ?? null,
    primaryCategory: (row.primary_category as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    status: row.status as CreatorStatus,
    levelId: (row.level_id as string | null) ?? null,
    levelName: (level?.name as string | null) ?? null,
    levelLabel: (level?.label as string | null) ?? null,
    lastLoginAt: (row.last_login_at as string | null) ?? null,
    activatedAt: (row.activated_at as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}

/* ───────────────────────────  Reference / code generation  ─────────────────────────── */

/** MCA-2026-00001 style application references (atomic via DB sequence). */
export async function nextApplicationReference(): Promise<string> {
  const year = new Date().getFullYear()
  if (!isSupabaseConfigured()) {
    return `MCA-${year}-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`
  }
  const { data, error } = await supabase.rpc("increment_creator_application_seq")
  if (error || typeof data !== "number") {
    console.error("[creators] application seq failed:", error?.message)
    return `MCA-${year}-${String(Math.floor(Math.random() * 99999)).padStart(5, "0")}`
  }
  return `MCA-${year}-${String(data).padStart(5, "0")}`
}

/** Atomic creator sequence → { creatorId: "MPC-00001", referralCode: "MP-00001" } */
export async function nextCreatorCodes(): Promise<{ creatorId: string; referralCode: string }> {
  const { data, error } = await supabase.rpc("increment_creator_seq")
  const seq = !error && typeof data === "number" ? data : Math.floor(Math.random() * 99999)
  return {
    creatorId: `MPC-${String(seq).padStart(5, "0")}`,
    referralCode: `MP-${String(seq).padStart(5, "0")}`,
  }
}

export function creatorTrackingUrl(referralCode: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || "https://martpoint.com.ng").replace(/\/$/, "")
  return `${base}/?ref=${referralCode}`
}

/* ───────────────────────────  Data access  ─────────────────────────── */

export async function getCreatorApplicationById(id: string): Promise<CreatorApplication | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from("creator_applications")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (error || !data) return null
  return mapCreatorApplication(data)
}

export async function getApplicationSocialProfiles(applicationId: string): Promise<CreatorSocialProfile[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("creator_social_profiles")
    .select("*")
    .eq("application_id", applicationId)
    .order("is_primary", { ascending: false })
  return (data || []).map(mapSocialProfile)
}

export async function getCreatorById(id: string): Promise<CreatorRecord | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from("creators")
    .select("*, creator_levels(name, label)")
    .eq("id", id)
    .maybeSingle()
  if (error || !data) return null
  return mapCreator(data)
}

export async function getCreatorByEmail(email: string): Promise<(CreatorRecord & { passwordHash: string | null }) | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from("creators")
    .select("*, creator_levels(name, label)")
    .ilike("email", email.trim().toLowerCase())
    .maybeSingle()
  if (error || !data) return null
  return { ...mapCreator(data), passwordHash: (data.password_hash as string | null) ?? null }
}

export async function getCreatorByReferralCode(code: string): Promise<CreatorRecord | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from("creators")
    .select("*, creator_levels(name, label)")
    .ilike("referral_code", code.trim())
    .maybeSingle()
  if (error || !data) return null
  return mapCreator(data)
}

export async function listCreatorLevels(): Promise<CreatorLevel[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("creator_levels")
    .select("*")
    .order("sort_order", { ascending: true })
  return (data || []).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    label: r.label as string,
    description: (r.description as string | null) ?? null,
    sortOrder: (r.sort_order as number) ?? 0,
    requirements: (r.requirements as Record<string, number>) ?? {},
    benefits: (r.benefits as string | null) ?? null,
    active: (r.active as boolean) ?? true,
  }))
}

/* ───────────────────────────  Module settings  ───────────────────────────
 * Creator Network settings live under settings.data.creator alongside the
 * other module settings — no new settings table.
 */

export interface CreatorSettings {
  /** Require onboarding completion before challenge submissions. */
  requireOnboardingForSubmissions: boolean
  /** Automatically trigger AI assessment when an application is submitted. */
  autoAiReview: boolean
  /** Minimum applicant age. */
  minimumAge: number
}

export const DEFAULT_CREATOR_SETTINGS: CreatorSettings = {
  requireOnboardingForSubmissions: true,
  autoAiReview: true,
  minimumAge: 18,
}
