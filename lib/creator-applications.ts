/* ───────────────────────────  Creator applications  ───────────────────────────
 * Application lifecycle: submission -> AI review -> manual review ->
 * (optional) interview -> approve / waitlist / reject -> creator activation.
 * Mirrors the careers application pipeline conventions.
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import {
  nextApplicationReference,
  nextCreatorCodes,
  creatorTrackingUrl,
  mapCreatorApplication,
  PRIVACY_VERSION,
  type CreatorApplicationStatus,
  type CreatorPlatform,
  type CreatorApplication,
} from "./creators"
import { createCreatorAuthToken } from "./creator-auth"
import {
  sendCreatorNotification,
  buildCreatorInterviewIcs,
  pushCreatorNotification,
} from "./creator-notifications"
import { getGoogleSettings, isGoogleConnected, createMeetEvent } from "./google-calendar"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditContext } from "./audit"

const SITE_URL = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://martpoint.com.ng").replace(/\/$/, "")

/* ───────────────────────────  Submission  ─────────────────────────── */

export interface CreatorApplicationInput {
  fullName: string
  email: string
  phone: string
  whatsapp?: string
  country?: string
  state?: string
  city?: string
  dateOfBirth?: string
  ageConfirmed: boolean
  primaryCategory: string
  secondaryCategory?: string
  languages: string[]
  bio?: string
  experienceYears?: string
  primaryAudience?: string
  audienceLocations: string[]
  audienceAgeRange?: string
  audienceHasBusinessOwners?: boolean
  audienceIndustries: string[]
  portfolioLinks: { url: string; note?: string }[]
  whyCreator?: string
  introduceMartpoint?: string
  socialProfiles: {
    platform: CreatorPlatform
    profileUrl: string
    username?: string
    followers?: number
    typicalViews?: number
    typicalEngagement?: string
    isPrimary?: boolean
  }[]
}

export async function submitCreatorApplication(
  input: CreatorApplicationInput
): Promise<{ ok: boolean; reference?: string; applicationId?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Service unavailable" }

  const reference = await nextApplicationReference()
  const now = new Date().toISOString()

  const { data, error } = await supabase
    .from("creator_applications")
    .insert({
      reference_number: reference,
      full_name: input.fullName,
      email: input.email.trim().toLowerCase(),
      phone: input.phone,
      whatsapp: input.whatsapp || null,
      country: input.country || "Nigeria",
      state: input.state || null,
      city: input.city || null,
      date_of_birth: input.dateOfBirth || null,
      age_confirmed: input.ageConfirmed,
      primary_category: input.primaryCategory,
      secondary_category: input.secondaryCategory || null,
      languages: input.languages,
      bio: input.bio || null,
      experience_years: input.experienceYears || null,
      primary_audience: input.primaryAudience || null,
      audience_locations: input.audienceLocations,
      audience_age_range: input.audienceAgeRange || null,
      audience_has_business_owners: input.audienceHasBusinessOwners ?? null,
      audience_industries: input.audienceIndustries,
      portfolio_links: input.portfolioLinks,
      why_creator: input.whyCreator || null,
      introduce_martpoint: input.introduceMartpoint || null,
      consents: {
        accurate: true,
        publicContentReview: true,
        networkRules: true,
        noGuarantee: true,
      },
      consent_version: PRIVACY_VERSION,
      consented_at: now,
      status: "SUBMITTED",
      status_history: [{ status: "SUBMITTED", at: now, by: null }],
      submitted_at: now,
    })
    .select("id")
    .single()

  if (error || !data) {
    console.error("[creators] application insert failed:", error?.message)
    return { ok: false, error: "Failed to submit application" }
  }

  const applicationId = data.id as string

  if (input.socialProfiles.length > 0) {
    await supabase.from("creator_social_profiles").insert(
      input.socialProfiles.map((p, i) => ({
        application_id: applicationId,
        platform: p.platform,
        profile_url: p.profileUrl,
        username: p.username || null,
        followers: p.followers ?? null,
        typical_views: p.typicalViews ?? null,
        typical_engagement: p.typicalEngagement || null,
        is_primary: p.isPrimary ?? i === 0,
      }))
    )
  }

  return { ok: true, reference, applicationId }
}

/* ───────────────────────────  Status transitions  ─────────────────────────── */

export async function changeCreatorApplicationStatus(
  applicationId: string,
  status: CreatorApplicationStatus,
  actor: { id?: string | null; name?: string | null },
  reason?: string | null
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { data: row } = await supabase
    .from("creator_applications")
    .select("status, status_history")
    .eq("id", applicationId)
    .maybeSingle()
  if (!row) return false

  const history = [
    ...((row.status_history as { status: string; at: string; by?: string | null; reason?: string | null }[]) || []),
    { status, at: new Date().toISOString(), by: actor.name ?? null, reason: reason ?? null },
  ]

  const { error } = await supabase
    .from("creator_applications")
    .update({
      status,
      status_history: history,
      reviewed_by: actor.id ?? null,
      reviewed_by_name: actor.name ?? null,
      reviewed_at: new Date().toISOString(),
      decision_reason: reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", applicationId)
  return !error
}

/* ───────────────────────────  Interviews  ─────────────────────────── */

export interface CreatorInterview {
  id: string
  applicationId: string
  status: string
  scheduledAt: string | null
  durationMinutes: number
  meetingUrl: string | null
  meetingLocation: string | null
  interviewerName: string | null
  notes: string | null
  result: string | null
  createdAt: string
}

export async function listInterviews(applicationId: string): Promise<CreatorInterview[]> {
  if (!isSupabaseConfigured()) return []
  const { data } = await supabase
    .from("creator_interviews")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
  return (data || []).map((r) => ({
    id: r.id as string,
    applicationId: r.application_id as string,
    status: r.status as string,
    scheduledAt: (r.scheduled_at as string | null) ?? null,
    durationMinutes: (r.duration_minutes as number) ?? 30,
    meetingUrl: (r.meeting_url as string | null) ?? null,
    meetingLocation: (r.meeting_location as string | null) ?? null,
    interviewerName: (r.interviewer_name as string | null) ?? null,
    notes: (r.notes as string | null) ?? null,
    result: (r.result as string | null) ?? null,
    createdAt: r.created_at as string,
  }))
}

/** Request + schedule an interview, create a Meet link when Google is
 *  connected, and email the applicant an invite with an ICS attachment. */
export async function scheduleCreatorInterview(input: {
  applicationId: string
  scheduledAt: string // ISO
  durationMinutes: number
  meetingLocation?: string | null
  interviewerId?: string | null
  interviewerName?: string | null
  notes?: string | null
  actor: { id: string; name: string }
}): Promise<{ ok: boolean; interviewId?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Service unavailable" }

  const { data: app } = await supabase
    .from("creator_applications")
    .select("*")
    .eq("id", input.applicationId)
    .maybeSingle()
  if (!app) return { ok: false, error: "Application not found" }
  const application = mapCreatorApplication(app)

  // Attach a Google Meet link when the workspace Google account is connected.
  let meetingUrl: string | null = null
  let googleEventId: string | null = null
  try {
    const gs = await getGoogleSettings()
    if (isGoogleConnected(gs)) {
      const start = new Date(input.scheduledAt)
      const end = new Date(start.getTime() + input.durationMinutes * 60_000)
      const ev = await createMeetEvent({
        summary: `MartPoint Creator Interview — ${application.fullName}`,
        description: `Creator Network interview for ${application.referenceNumber}.`,
        start,
        end,
        timezone: "Africa/Lagos",
        attendeeEmail: application.email,
        attendeeName: application.fullName,
        sendUpdates: false, // we send our own branded invite with .ics
      })
      meetingUrl = ev.meetLink
      googleEventId = ev.eventId
    }
  } catch (err) {
    console.error("[creators] meet link failed:", err)
  }

  const { data: interview, error } = await supabase
    .from("creator_interviews")
    .insert({
      application_id: input.applicationId,
      status: "SCHEDULED",
      scheduled_at: input.scheduledAt,
      duration_minutes: input.durationMinutes,
      meeting_url: meetingUrl,
      meeting_location: input.meetingLocation || null,
      google_event_id: googleEventId,
      interviewer_id: input.interviewerId || input.actor.id,
      interviewer_name: input.interviewerName || input.actor.name,
      notes: input.notes || null,
      created_by: input.actor.id,
      created_by_name: input.actor.name,
    })
    .select("id")
    .single()

  if (error || !interview) {
    return { ok: false, error: "Failed to schedule interview" }
  }

  await changeCreatorApplicationStatus(input.applicationId, "INTERVIEW_SCHEDULED", input.actor)

  // Email invite with ICS attachment (best-effort)
  const when = new Date(input.scheduledAt).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
  const ics = buildCreatorInterviewIcs({
    id: interview.id as string,
    summary: `MartPoint Creator Interview — ${application.fullName}`,
    start: new Date(input.scheduledAt),
    durationMinutes: input.durationMinutes,
    attendeeEmail: application.email,
    attendeeName: application.fullName,
    meetingLink: meetingUrl,
    location: input.meetingLocation || null,
  })
  void sendCreatorNotification({
    template: "creator_interview_invite",
    to: application.email,
    applicationId: input.applicationId,
    vars: {
      fullName: application.fullName,
      reference: application.referenceNumber,
      interviewWhen: when,
      durationMinutes: input.durationMinutes,
      joinLine: meetingUrl ? `Join link: ${meetingUrl}\n` : "",
      joinBlock: meetingUrl
        ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 24px;"><tr><td style="border-radius:8px; background-color:#0057FF; text-align:center;"><a href="${meetingUrl}" target="_blank" style="display:inline-block; padding:14px 32px; font-size:15px; font-weight:600; color:#ffffff; text-decoration:none; border-radius:8px;">Join Video Interview</a></td></tr></table>`
        : "",
      locationLine: input.meetingLocation ? `Location: ${input.meetingLocation}\n` : "",
      locationBlock: input.meetingLocation
        ? `<p style="font-size:14px; color:#6b7280; margin:0 0 4px;">Location</p><p style="font-size:15px; font-weight:600; color:#111827; margin:0;">${input.meetingLocation}</p>`
        : "",
      notes: input.notes || "",
      statusUrl: `${SITE_URL()}/creators/application-status`,
    },
    attachments: [ics],
  })

  return { ok: true, interviewId: interview.id as string }
}

/* ───────────────────────────  Approval → Creator activation  ─────────────────────────── */

export async function approveCreatorApplication(
  applicationId: string,
  actor: { id: string; name: string },
  ctx: AuditContext
): Promise<{ ok: boolean; creatorId?: string; creatorCode?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Service unavailable" }

  const { data: appRow } = await supabase
    .from("creator_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle()
  if (!appRow) return { ok: false, error: "Application not found" }
  const application = mapCreatorApplication(appRow)

  if (application.createdCreatorId) {
    return { ok: false, error: "Application already approved" }
  }

  const codes = await nextCreatorCodes()

  // Default level = STARTER (lowest sort_order active level).
  const { data: starter } = await supabase
    .from("creator_levels")
    .select("id")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle()

  const now = new Date().toISOString()
  const { data: creatorRow, error } = await supabase
    .from("creators")
    .insert({
      creator_id: codes.creatorId,
      referral_code: codes.referralCode,
      application_id: applicationId,
      full_name: application.fullName,
      email: application.email,
      phone: application.phone,
      whatsapp: application.whatsapp,
      country: application.country,
      state: application.state,
      city: application.city,
      photo_path: application.profilePhotoPath,
      primary_category: application.primaryCategory,
      bio: application.bio,
      status: "PENDING_ACTIVATION",
      level_id: starter?.id ?? null,
      activated_at: now,
      activated_by: actor.id,
    })
    .select("id")
    .single()

  if (error || !creatorRow) {
    console.error("[creators] creator insert failed:", error?.message)
    return { ok: false, error: "Failed to create creator account" }
  }

  const creatorUuid = creatorRow.id as string

  // Link social profiles to the creator record + mark application approved.
  await Promise.all([
    supabase
      .from("creator_social_profiles")
      .update({ creator_id: creatorUuid })
      .eq("application_id", applicationId),
    supabase
      .from("creator_applications")
      .update({ created_creator_id: creatorUuid, updated_at: now })
      .eq("id", applicationId),
  ])
  await changeCreatorApplicationStatus(applicationId, "APPROVED", actor)

  // First-login token → set-password email.
  const tokenResult = await createCreatorAuthToken(creatorUuid, "SET_PASSWORD", actor.id)
  const setPasswordUrl = tokenResult.ok && tokenResult.token
    ? `${SITE_URL()}/creator/set-password/${tokenResult.token}`
    : ""

  void sendCreatorNotification({
    template: "creator_approved",
    to: application.email,
    creatorId: creatorUuid,
    applicationId,
    vars: {
      fullName: application.fullName,
      reference: application.referenceNumber,
      creatorId: codes.creatorId,
      referralCode: codes.referralCode,
      trackingUrl: creatorTrackingUrl(codes.referralCode),
      setPasswordUrl,
      loginUrl: `${SITE_URL()}/creator/login`,
    },
  })

  await pushCreatorNotification({
    creatorId: creatorUuid,
    type: "ACCOUNT",
    title: "Welcome to the MartPoint Creator Network",
    body: "Your application was approved. Complete onboarding to unlock challenges.",
    link: "/creator",
  })

  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.CREATOR_APPROVED,
    entityType: AUDIT_ENTITIES.CREATOR_APPLICATION,
    entityId: applicationId,
    metadata: { creatorId: creatorUuid, creatorCode: codes.creatorId, referralCode: codes.referralCode },
  })

  return { ok: true, creatorId: creatorUuid, creatorCode: codes.creatorId }
}

/* ───────────────────────────  Admin notes (internal — never shown to applicants)  ─── */

export interface CreatorAdminNote {
  id: string
  applicationId: string | null
  creatorId: string | null
  note: string
  authorName: string | null
  createdAt: string
}

export async function addCreatorAdminNote(
  input: { applicationId?: string; creatorId?: string; note: string },
  actor: { id: string; name: string }
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { error } = await supabase.from("creator_admin_notes").insert({
    application_id: input.applicationId ?? null,
    creator_id: input.creatorId ?? null,
    note: input.note,
    created_by: actor.id,
    created_by_name: actor.name,
  })
  return !error
}

export async function listCreatorAdminNotes(filter: {
  applicationId?: string
  creatorId?: string
}): Promise<CreatorAdminNote[]> {
  if (!isSupabaseConfigured()) return []
  let q = supabase.from("creator_admin_notes").select("*").order("created_at", { ascending: false }).limit(100)
  if (filter.applicationId) q = q.eq("application_id", filter.applicationId)
  if (filter.creatorId) q = q.eq("creator_id", filter.creatorId)
  const { data } = await q
  return (data || []).map((r) => ({
    id: r.id as string,
    applicationId: (r.application_id as string | null) ?? null,
    creatorId: (r.creator_id as string | null) ?? null,
    note: r.note as string,
    authorName: (r.created_by_name as string | null) ?? null,
    createdAt: r.created_at as string,
  }))
}

/* ───────────────────────────  Admin listing helpers  ─────────────────────────── */

export interface CreatorApplicationListFilters {
  status?: CreatorApplicationStatus | null
  state?: string | null
  q?: string | null
}

export async function listCreatorApplications(
  filters: CreatorApplicationListFilters = {}
): Promise<(CreatorApplication & { primaryPlatform?: string | null; aiScore?: number | null; aiRecommendation?: string | null })[]> {
  if (!isSupabaseConfigured()) return []
  let query = supabase
    .from("creator_applications")
    .select("*")
    .is("deleted_at", null)
    .order("submitted_at", { ascending: false })
    .limit(500)

  if (filters.status) query = query.eq("status", filters.status)
  if (filters.state) query = query.eq("state", filters.state)
  if (filters.q) {
    const q = filters.q.replace(/[%_]/g, "")
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,reference_number.ilike.%${q}%`)
  }

  const { data } = await query
  const apps = (data || []).map(mapCreatorApplication)
  if (apps.length === 0) return []

  // Attach latest AI score + primary platform for list display.
  const ids = apps.map((a) => a.id)
  const [{ data: reviews }, { data: profiles }] = await Promise.all([
    supabase
      .from("creator_ai_reviews")
      .select("application_id, total_score, recommendation, created_at")
      .in("application_id", ids)
      .eq("status", "COMPLETED")
      .order("created_at", { ascending: false }),
    supabase
      .from("creator_social_profiles")
      .select("application_id, platform, is_primary")
      .in("application_id", ids),
  ])

  const latestReview = new Map<string, { score: number; rec: string }>()
  for (const r of reviews || []) {
    const appId = r.application_id as string
    if (!latestReview.has(appId)) {
      latestReview.set(appId, { score: r.total_score as number, rec: r.recommendation as string })
    }
  }
  const primaryPlatform = new Map<string, string>()
  for (const p of profiles || []) {
    const appId = p.application_id as string
    if (p.is_primary || !primaryPlatform.has(appId)) primaryPlatform.set(appId, p.platform as string)
  }

  return apps.map((a) => ({
    ...a,
    primaryPlatform: primaryPlatform.get(a.id) ?? null,
    aiScore: latestReview.get(a.id)?.score ?? null,
    aiRecommendation: latestReview.get(a.id)?.rec ?? null,
  }))
}

export async function listCreators(filters: { status?: string | null; q?: string | null; state?: string | null } = {}) {
  if (!isSupabaseConfigured()) return []
  let query = supabase
    .from("creators")
    .select("*, creator_levels(name, label)")
    .neq("status", "REMOVED")
    .order("created_at", { ascending: false })
    .limit(500)

  if (filters.status) query = query.eq("status", filters.status)
  if (filters.state) query = query.eq("state", filters.state)
  if (filters.q) {
    const q = filters.q.replace(/[%_]/g, "")
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,creator_id.ilike.%${q}%,referral_code.ilike.%${q}%`)
  }
  const { data } = await query
  const { mapCreator } = await import("./creators")
  return (data || []).map(mapCreator)
}

/** Admin dashboard KPIs for the Creator Network section. */
export async function getCreatorNetworkStats(): Promise<{
  totalApplications: number
  pendingReview: number
  approvalRate: number
  activeCreators: number
  creatorsByState: { state: string; count: number }[]
  applicationsByState: { state: string; count: number }[]
  activeChallenges: number
  pendingSubmissions: number
  totalLeads: number
  rewardsPaidKobo: number
}> {
  const empty = {
    totalApplications: 0, pendingReview: 0, approvalRate: 0, activeCreators: 0,
    creatorsByState: [] as { state: string; count: number }[],
    applicationsByState: [] as { state: string; count: number }[],
    activeChallenges: 0, pendingSubmissions: 0, totalLeads: 0, rewardsPaidKobo: 0,
  }
  if (!isSupabaseConfigured()) return empty

  const [apps, creators, challenges, subs, leads, rewards] = await Promise.all([
    supabase.from("creator_applications").select("status, state").is("deleted_at", null),
    supabase.from("creators").select("status, state"),
    supabase.from("creator_challenges").select("id").eq("status", "ACTIVE"),
    supabase.from("creator_submissions").select("id").in("status", ["SUBMITTED", "UNDER_REVIEW"]),
    supabase.from("leads").select("id").not("creator_id", "is", null),
    supabase.from("creator_rewards").select("amount_kobo").eq("status", "PAID"),
  ])

  const appRows = apps.data || []
  const creatorRows = creators.data || []
  const decided = appRows.filter((a) => ["APPROVED", "REJECTED", "WAITLISTED"].includes(a.status as string))
  const approved = appRows.filter((a) => a.status === "APPROVED").length

  const countBy = (rows: { state: string | null }[]) => {
    const m = new Map<string, number>()
    for (const r of rows) {
      const s = (r.state as string | null) || "Unknown"
      m.set(s, (m.get(s) || 0) + 1)
    }
    return [...m.entries()].map(([state, count]) => ({ state, count })).sort((a, b) => b.count - a.count)
  }

  return {
    totalApplications: appRows.length,
    pendingReview: appRows.filter((a) =>
      ["SUBMITTED", "AI_REVIEWED", "MANUAL_REVIEW", "INTERVIEW_REQUESTED", "INTERVIEW_SCHEDULED"].includes(a.status as string)
    ).length,
    approvalRate: decided.length ? Math.round((approved / decided.length) * 100) : 0,
    activeCreators: creatorRows.filter((c) => c.status === "ACTIVE").length,
    creatorsByState: countBy(creatorRows as { state: string | null }[]),
    applicationsByState: countBy(appRows as { state: string | null }[]),
    activeChallenges: (challenges.data || []).length,
    pendingSubmissions: (subs.data || []).length,
    totalLeads: (leads.data || []).length,
    rewardsPaidKobo: (rewards.data || []).reduce((s, r) => s + ((r.amount_kobo as number) || 0), 0),
  }
}

/** Creator portal overview metrics. */
export async function getCreatorOverviewStats(creatorId: string): Promise<{
  approvedContent: number
  pendingSubmissions: number
  clicks: number
  leads: number
  demoBookings: number
  signups: number
  conversions: number
  pendingRewardsKobo: number
  approvedRewardsKobo: number
  paidRewardsKobo: number
  onboardingProgress: number
  onboardingStatus: string
}> {
  const empty = {
    approvedContent: 0, pendingSubmissions: 0, clicks: 0, leads: 0, demoBookings: 0,
    signups: 0, conversions: 0, pendingRewardsKobo: 0, approvedRewardsKobo: 0,
    paidRewardsKobo: 0, onboardingProgress: 0, onboardingStatus: "NOT_STARTED",
  }
  if (!isSupabaseConfigured()) return empty

  const [subs, referrals, rewards, onboarding] = await Promise.all([
    supabase.from("creator_submissions").select("status").eq("creator_id", creatorId),
    supabase.from("creator_referrals").select("event_type").eq("creator_id", creatorId),
    supabase.from("creator_rewards").select("status, amount_kobo").eq("creator_id", creatorId),
    supabase.from("creator_onboarding").select("status, progress_pct").eq("creator_id", creatorId).maybeSingle(),
  ])

  const subRows = subs.data || []
  const refRows = referrals.data || []
  const rewardRows = rewards.data || []
  const count = (t: string) => refRows.filter((r) => r.event_type === t).length

  return {
    approvedContent: subRows.filter((s) => s.status === "APPROVED").length,
    pendingSubmissions: subRows.filter((s) => ["SUBMITTED", "UNDER_REVIEW"].includes(s.status as string)).length,
    clicks: count("CLICK"),
    leads: count("LEAD"),
    demoBookings: count("DEMO"),
    signups: count("SIGNUP"),
    conversions: count("CUSTOMER"),
    pendingRewardsKobo: rewardRows.filter((r) => r.status === "PENDING").reduce((s, r) => s + ((r.amount_kobo as number) || 0), 0),
    approvedRewardsKobo: rewardRows.filter((r) => r.status === "APPROVED" || r.status === "PROCESSING").reduce((s, r) => s + ((r.amount_kobo as number) || 0), 0),
    paidRewardsKobo: rewardRows.filter((r) => r.status === "PAID").reduce((s, r) => s + ((r.amount_kobo as number) || 0), 0),
    onboardingProgress: (onboarding.data?.progress_pct as number) ?? 0,
    onboardingStatus: (onboarding.data?.status as string) ?? "NOT_STARTED",
  }
}
