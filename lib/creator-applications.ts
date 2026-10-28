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
  type CreatorPlatform
} from "./creators"
import { createCreatorAuthToken } from "./creator-auth"
import {
  sendCreatorNotification,
  buildCreatorInterviewIcs,
  pushCreatorNotification
} from "./creator-notifications"
import { getGoogleSettings, isGoogleConnected, createMeetEvent, deleteCalendarEvent } from "./google-calendar"
import { getUserById } from "./admin-auth"
import { getEmailSettings, sendEmail, REPLY_TO } from "./email"
import { renderCreatorEmail } from "./creator-email"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditContext } from "./audit"
import { notifyAllAdmins } from "./admin-notifications"
import {
  summarizeCreatorQuestions,
  type CreatorQuestionTrackingRow,
  type CreatorReplyFilter
} from "./creator-question-summary"

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
        noGuarantee: true
      },
      consent_version: PRIVACY_VERSION,
      consented_at: now,
      status: "SUBMITTED",
      status_history: [{ status: "SUBMITTED", at: now, by: null }],
      submitted_at: now
    })
    .select("id")
    .single()

  if (error || !data) {
    console.error("[creators] application insert failed:", error?.message)
    return { ok: false, error: "Failed to submit application" }
  }

  const applicationId = data.id as string

  await notifyAllAdmins({
    type: "CREATOR_APPLICATION_SUBMITTED",
    title: "New creator application",
    message: `${reference}: ${input.fullName}`,
    deep_link: `/admin/creators/applications/${applicationId}`,
    source_type: "creator_application",
    source_id: applicationId,
    roles: ["Admin", "Digital Marketer"],
    email: {
      route: "creator_application",
      subject: `New Creator Application — ${reference}`,
      text: `A new creator application needs review.\n\nReference: ${reference}\nApplicant: ${input.fullName}\n\nOpen Creator Applications in the Admin Portal:\n/admin/creators/applications/${applicationId}`
    }
  })

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
        is_primary: p.isPrimary ?? i === 0
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
    ...((row.status_history as {
      status: string
      at: string
      by?: string | null
      reason?: string | null
    }[]) || []),
    { status, at: new Date().toISOString(), by: actor.name ?? null, reason: reason ?? null }
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
      updated_at: new Date().toISOString()
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
  meetingKind: "interview" | "meeting"
  title: string | null
  inviteStatus: string
}

export async function listInterviews(applicationId: string): Promise<CreatorInterview[]> {
  if (!isSupabaseConfigured()) return []
  const { data, error } = await supabase
    .from("creator_interviews")
    .select("*")
    .eq("application_id", applicationId)
    .order("created_at", { ascending: false })
  if (error) throw new Error("Could not load creator meetings")
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
    meetingKind: r.meeting_kind === "meeting" ? "meeting" : "interview",
    title: (r.title as string | null) ?? null,
    inviteStatus: (r.invite_status as string) || "unknown"
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
  meetingKind?: "interview" | "meeting"
  title?: string
  requireGoogleMeet?: boolean
  actor: { id: string; name: string }
}): Promise<{
  ok: boolean
  interviewId?: string
  meetingUrl?: string | null
  warning?: string
  error?: string
}> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Service unavailable" }

  const { data: app } = await supabase
    .from("creator_applications")
    .select("*")
    .eq("id", input.applicationId)
    .is("deleted_at", null)
    .maybeSingle()
  if (!app) return { ok: false, error: "Application not found" }
  const application = mapCreatorApplication(app)
  const kind = input.meetingKind || "interview"
  const title =
    input.title?.trim() ||
    `MartPoint Creator ${kind === "meeting" ? "Meeting" : "Interview"} — ${application.fullName}`
  if (!Number.isFinite(Date.parse(input.scheduledAt)) || Date.parse(input.scheduledAt) <= Date.now())
    return { ok: false, error: "Choose a future meeting time" }
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 10 || input.durationMinutes > 240)
    return { ok: false, error: "Choose a duration between 10 and 240 minutes" }

  // Attach a Google Meet link when the workspace Google account is connected.
  let meetingUrl: string | null = null
  let googleEventId: string | null = null
  try {
    const gs = await getGoogleSettings()
    if (input.requireGoogleMeet && !isGoogleConnected(gs))
      return { ok: false, error: "Connect Google in Settings → Google Meet before scheduling this meeting" }
    if (isGoogleConnected(gs)) {
      const start = new Date(input.scheduledAt)
      const end = new Date(start.getTime() + input.durationMinutes * 60_000)
      const ev = await createMeetEvent({
        summary: title,
        description: `Creator Network ${kind} for ${application.referenceNumber}.${input.notes ? `\n\n${input.notes}` : ""}`,
        start,
        end,
        timezone: "Africa/Lagos",
        attendeeEmail: application.email,
        attendeeName: application.fullName,
        sendUpdates: kind === "meeting" // Google invitation plus our branded ICS; legacy interviews keep their existing invite.
      })
      meetingUrl = ev.meetLink
      googleEventId = ev.eventId
    }
  } catch (err) {
    console.error("[creators] meet link failed:", err)
    if (input.requireGoogleMeet)
      return {
        ok: false,
        error:
          err instanceof Error ? err.message : "Google Meet could not be created. No meeting was scheduled."
      }
  }

  const { data: interview, error } = await supabase
    .from("creator_interviews")
    .insert({
      application_id: input.applicationId,
      meeting_kind: kind,
      title,
      invite_status: "pending",
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
      created_by_name: input.actor.name
    })
    .select("id")
    .single()

  if (error || !interview) {
    if (googleEventId)
      await deleteCalendarEvent(googleEventId).catch((cleanupError) =>
        console.error("[creators] orphan calendar cleanup failed", cleanupError)
      )
    return { ok: false, error: "Failed to schedule interview" }
  }

  if (
    kind === "interview" &&
    !application.createdCreatorId &&
    !["APPROVED", "REJECTED", "REMOVED", "SUSPENDED"].includes(application.status)
  ) {
    await changeCreatorApplicationStatus(input.applicationId, "INTERVIEW_SCHEDULED", input.actor)
  }

  // Email invite with ICS attachment (best-effort)
  const when = new Date(input.scheduledAt).toLocaleString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos"
  })
  const ics = buildCreatorInterviewIcs({
    id: interview.id as string,
    summary: title,
    start: new Date(input.scheduledAt),
    durationMinutes: input.durationMinutes,
    attendeeEmail: application.email,
    attendeeName: application.fullName,
    meetingLink: meetingUrl,
    location: input.meetingLocation || null
  })
  let sent = false
  try {
    if (kind === "meeting") {
      const [sender, settings] = await Promise.all([getUserById(input.actor.id), getEmailSettings()])
      const body = `Hello ${application.fullName},\n\nYou are invited to ${title}.\n\nWhen: ${when} (Nigeria time, WAT)\nDuration: ${input.durationMinutes} minutes\n${meetingUrl ? `Google Meet: ${meetingUrl}\n` : ""}${input.notes ? `\nAgenda: ${input.notes}\n` : ""}\nPlease use the attached calendar invitation to save the meeting.`
      const content = await renderCreatorEmail(body, sender?.signatureHtml || "<p>MartPoint Creator Team</p>")
      sent = await sendEmail({
        to: application.email,
        subject: title,
        ...content,
        replyTo: REPLY_TO.creators,
        route: "creator_application",
        useRouteRecipients: false,
        attachments: [ics]
      })
      await supabase
        .from("creator_application_emails")
        .insert({
          application_id: input.applicationId,
          direction: "outbound",
          from_email: settings.fromEmail,
          to_email: application.email,
          subject: title,
          body_text: content.text,
          body_html: content.html,
          status: sent ? "sent" : "failed",
          provider: settings.provider,
          sent_by: input.actor.id,
          sent_by_name: input.actor.name,
          metadata: { meeting_id: interview.id, reply_to: REPLY_TO.creators }
        })
    } else
      sent = await sendCreatorNotification({
        template: "creator_interview_invite",
        to: application.email,
        applicationId: input.applicationId,
        // Copy the Digital team so creator interviews are traceable per function.
        cc: "digitals@martpoint.com.ng",
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
          statusUrl: `${SITE_URL()}/creators/application-status`
        },
        attachments: [ics]
      })
  } catch (emailError) {
    console.error("[creators] meeting invite failed", emailError)
  }
  const { error: inviteSaveError } = await supabase
    .from("creator_interviews")
    .update({ invite_status: sent ? "accepted" : "failed" })
    .eq("id", interview.id)
  return {
    ok: true,
    interviewId: interview.id as string,
    meetingUrl,
    warning: !sent
      ? "Meeting saved, but its invitation email was not accepted. Share the join link and check Email Settings; do not schedule it again."
      : inviteSaveError
        ? "Invitation accepted, but delivery status could not be saved."
        : undefined
  }
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
    // A revoked approval can be reviewed and approved again. Reuse the
    // existing creator identity rather than creating a duplicate account.
    const { data: existingCreator } = await supabase
      .from("creators")
      .select("id, creator_id, referral_code, status")
      .eq("id", application.createdCreatorId)
      .maybeSingle()
    if (existingCreator && application.status !== "APPROVED" && existingCreator.status === "SUSPENDED") {
      const restoredAt = new Date().toISOString()
      const { error: restoreError } = await supabase
        .from("creators")
        .update({
          status: "PENDING_ACTIVATION",
          status_reason: null,
          activated_at: restoredAt,
          activated_by: actor.id,
          updated_at: restoredAt
        })
        .eq("id", existingCreator.id)
      if (restoreError) return { ok: false, error: "Could not restore the creator account" }

      await changeCreatorApplicationStatus(applicationId, "APPROVED", actor)
      const tokenResult = await createCreatorAuthToken(existingCreator.id as string, "SET_PASSWORD", actor.id)
      const setPasswordUrl =
        tokenResult.ok && tokenResult.token ? `${SITE_URL()}/creator/set-password/${tokenResult.token}` : ""
      void sendCreatorNotification({
        template: "creator_approved",
        to: application.email,
        creatorId: existingCreator.id as string,
        applicationId,
        vars: {
          fullName: application.fullName,
          reference: application.referenceNumber,
          creatorId: existingCreator.creator_id as string,
          referralCode: existingCreator.referral_code as string,
          trackingUrl: creatorTrackingUrl(existingCreator.referral_code as string),
          setPasswordUrl,
          loginUrl: `${SITE_URL()}/creator/login`
        }
      })
      await pushCreatorNotification({
        creatorId: existingCreator.id as string,
        type: "ACCOUNT",
        title: "Your creator account is approved again",
        body: "Your application has completed review. Complete onboarding to unlock challenges.",
        link: "/creator"
      })
      await recordAudit(ctx, {
        action: AUDIT_ACTIONS.CREATOR_APPROVED,
        entityType: AUDIT_ENTITIES.CREATOR_APPLICATION,
        entityId: applicationId,
        metadata: {
          creatorId: existingCreator.id,
          creatorCode: existingCreator.creator_id,
          referralCode: existingCreator.referral_code,
          restored: true
        }
      })
      return {
        ok: true,
        creatorId: existingCreator.id as string,
        creatorCode: existingCreator.creator_id as string
      }
    }
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
      activated_by: actor.id
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
      .eq("id", applicationId)
  ])
  await changeCreatorApplicationStatus(applicationId, "APPROVED", actor)

  // First-login token → set-password email.
  const tokenResult = await createCreatorAuthToken(creatorUuid, "SET_PASSWORD", actor.id)
  const setPasswordUrl =
    tokenResult.ok && tokenResult.token ? `${SITE_URL()}/creator/set-password/${tokenResult.token}` : ""

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
      loginUrl: `${SITE_URL()}/creator/login`
    }
  })

  await pushCreatorNotification({
    creatorId: creatorUuid,
    type: "ACCOUNT",
    title: "Welcome to the MartPoint Creator Network",
    body: "Your application was approved. Complete onboarding to unlock challenges.",
    link: "/creator"
  })

  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.CREATOR_APPROVED,
    entityType: AUDIT_ENTITIES.CREATOR_APPLICATION,
    entityId: applicationId,
    metadata: { creatorId: creatorUuid, creatorCode: codes.creatorId, referralCode: codes.referralCode }
  })

  return { ok: true, creatorId: creatorUuid, creatorCode: codes.creatorId }
}

/**
 * Reverse an accidental approval without deleting the application or creator
 * identity. The account is suspended immediately and the application returns
 * to manual review so another authorised reviewer can make the next decision.
 */
export async function revokeCreatorApproval(
  applicationId: string,
  actor: { id: string; name: string },
  ctx: AuditContext,
  reason: string
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Service unavailable" }
  const trimmedReason = reason.trim()
  if (trimmedReason.length < 5) return { ok: false, error: "A reason is required to revoke approval." }

  const { data: row } = await supabase
    .from("creator_applications")
    .select("id, full_name, email, reference_number, status, created_creator_id")
    .eq("id", applicationId)
    .maybeSingle()
  if (!row) return { ok: false, error: "Application not found" }
  if (!row.created_creator_id)
    return { ok: false, error: "This application has no creator account to suspend." }

  const { data: creator } = await supabase
    .from("creators")
    .select("id, creator_id, status, status_reason")
    .eq("id", row.created_creator_id)
    .maybeSingle()
  if (!creator) return { ok: false, error: "The linked creator account could not be found." }
  if (creator.status === "REMOVED")
    return { ok: false, error: "A removed creator account cannot be reopened from this application." }

  const now = new Date().toISOString()
  const { error: creatorError } = await supabase
    .from("creators")
    .update({ status: "SUSPENDED", status_reason: trimmedReason, updated_at: now })
    .eq("id", creator.id)
  if (creatorError) return { ok: false, error: "Could not suspend the creator account." }

  const changed = await changeCreatorApplicationStatus(applicationId, "MANUAL_REVIEW", actor, trimmedReason)
  if (!changed) {
    await supabase
      .from("creators")
      .update({
        status: creator.status,
        status_reason: creator.status_reason ?? null,
        updated_at: new Date().toISOString()
      })
      .eq("id", creator.id)
    return { ok: false, error: "Creator was suspended, but the application could not return to review." }
  }

  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.CREATOR_SUSPENDED,
    entityType: AUDIT_ENTITIES.CREATOR,
    entityId: creator.id as string,
    metadata: {
      applicationId,
      reference: row.reference_number,
      reason: trimmedReason,
      reversedApproval: true
    }
  })
  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.CREATOR_APPLICATION_STATUS_CHANGED,
    entityType: AUDIT_ENTITIES.CREATOR_APPLICATION,
    entityId: applicationId,
    metadata: { status: "MANUAL_REVIEW", reason: trimmedReason, reversedApproval: true }
  })

  await notifyAllAdmins({
    type: "CREATOR_APPROVAL_REVOKED",
    title: "Creator approval revoked",
    message: `${row.reference_number}: ${row.full_name} returned to Manual Review. ${trimmedReason}`,
    deep_link: `/admin/creators/applications/${applicationId}`,
    source_type: "creator_application",
    source_id: applicationId,
    roles: ["Admin", "Digital Marketer"]
  }).catch((error) => {
    console.error("[creator] approval-revoked admin notification failed", error)
  })

  const statusUrl = `${SITE_URL()}/creators/application-status`
  void sendCreatorNotification({
    template: "creator_announcement",
    to: row.email as string,
    creatorId: creator.id as string,
    applicationId,
    vars: {
      fullName: row.full_name as string,
      title: "An update to your MartPoint Creator application",
      body: `Your Creator Network approval has been placed on hold while we complete a further review. Reason: ${trimmedReason}`,
      linkUrl: `Check your application status: ${statusUrl}`,
      portalUrl: statusUrl
    }
  })
  await pushCreatorNotification({
    creatorId: creator.id as string,
    type: "ACCOUNT",
    title: "Your creator approval is on hold",
    body: "Your account is temporarily suspended while your application returns to review.",
    link: "/creator"
  })

  return { ok: true }
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
    created_by_name: actor.name
  })
  return !error
}

export async function listCreatorAdminNotes(filter: {
  applicationId?: string
  creatorId?: string
}): Promise<CreatorAdminNote[]> {
  if (!isSupabaseConfigured()) return []
  let q = supabase
    .from("creator_admin_notes")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)
  if (filter.applicationId) q = q.eq("application_id", filter.applicationId)
  if (filter.creatorId) q = q.eq("creator_id", filter.creatorId)
  const { data } = await q
  return (data || []).map((r) => ({
    id: r.id as string,
    applicationId: (r.application_id as string | null) ?? null,
    creatorId: (r.creator_id as string | null) ?? null,
    note: r.note as string,
    authorName: (r.created_by_name as string | null) ?? null,
    createdAt: r.created_at as string
  }))
}

/* ───────────────────────────  Delete (soft)  ─────────────────────────── */

export async function isApplicationDeleted(applicationId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { data } = await supabase
    .from("creator_applications")
    .select("deleted_at")
    .eq("id", applicationId)
    .maybeSingle()
  return Boolean(data?.deleted_at)
}

export async function deleteCreatorApplication(
  applicationId: string,
  actor: { id: string; name: string },
  ctx: AuditContext,
  reason?: string | null
): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Service unavailable" }

  const { data: row } = await supabase
    .from("creator_applications")
    .select("id, full_name, email, reference_number, status, created_creator_id, deleted_at")
    .eq("id", applicationId)
    .maybeSingle()
  if (!row) return { ok: false, error: "Application not found" }
  if (row.deleted_at) return { ok: false, error: "Application is already deleted" }
  if (row.created_creator_id) {
    return {
      ok: false,
      error: "This application was approved and has a creator account — suspend the creator instead."
    }
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from("creator_applications")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", applicationId)
  if (error) return { ok: false, error: "Delete failed" }

  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.CREATOR_APPLICATION_DELETED,
    entityType: AUDIT_ENTITIES.CREATOR_APPLICATION,
    entityId: applicationId,
    metadata: {
      reference: row.reference_number,
      applicant: row.full_name,
      status: row.status,
      reason: reason ?? null
    }
  })

  return { ok: true }
}

/* ───────────────────────────  Admin listing helpers  ─────────────────────────── */

export interface CreatorApplicationListFilters {
  status?: CreatorApplicationStatus | null
  state?: string | null
  q?: string | null
  response?: CreatorReplyFilter | null
}

export async function listCreatorApplications(filters: CreatorApplicationListFilters = {}) {
  return (await listCreatorApplicationsPage(filters, 1, 500)).applications
}

export async function listCreatorApplicationsPage(
  filters: CreatorApplicationListFilters = {},
  page = 1,
  pageSize = 25
) {
  if (!isSupabaseConfigured()) throw new Error("Creator application tracking is unavailable")
  const safePage = Math.max(1, Math.floor(page) || 1)
  const safePageSize = Math.min(500, Math.max(1, Math.floor(pageSize) || 25))
  // Separate embeds: filter matching parents without losing the other rounds
  // from the summary. Filtering must happen before pagination, not after 500 rows.
  const filterEmbed = filters.response
    ? `,response_filter:creator_application_question_rounds${filters.response === "not_sent" ? "" : "!inner"}(id)`
    : ""
  let query = supabase
    .from("creator_applications")
    .select(
      `*,question_rounds:creator_application_question_rounds(status,submitted_at,first_viewed_at,initial_email_status,next_reminder_at)${filterEmbed}`,
      { count: "exact" }
    )
    .is("deleted_at", null)
    .order("submitted_at", { ascending: false })
    .order("id", { ascending: false })

  if (filters.status) query = query.eq("status", filters.status)
  if (filters.state) query = query.eq("state", filters.state)
  if (filters.q) {
    const q = filters.q.replace(/[%_,().\\"]/g, "").slice(0, 200)
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,reference_number.ilike.%${q}%`)
  }
  if (filters.response === "not_sent") query = query.is("response_filter", null)
  else if (filters.response) {
    const status =
      filters.response === "needs_review"
        ? "Submitted"
        : filters.response === "reviewed"
          ? "Reviewed"
          : "Sent"
    query = query.eq("response_filter.status", status)
    if (filters.response === "opened") query = query.not("response_filter.first_viewed_at", "is", null)
    if (filters.response === "not_opened") query = query.is("response_filter.first_viewed_at", null)
    if (filters.response === "email_failed")
      query = query.eq("response_filter.initial_email_status", "FAILED")
  }

  const { data, count, error } = await query.range((safePage - 1) * safePageSize, safePage * safePageSize - 1)
  if (error) throw new Error("Could not load creator application response tracking")
  const rows = (data || []) as unknown as Record<string, unknown>[]
  const apps = rows.map(mapCreatorApplication)
  const summaries = new Map(
    rows.map((row) => [
      row.id as string,
      summarizeCreatorQuestions((row.question_rounds || []) as CreatorQuestionTrackingRow[])
    ])
  )
  if (!apps.length) return { applications: [], total: count || 0, page: safePage, pageSize: safePageSize }

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
      .in("application_id", ids)
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

  return {
    total: count || 0,
    page: safePage,
    pageSize: safePageSize,
    applications: apps.map((a) => ({
      ...a,
      primaryPlatform: primaryPlatform.get(a.id) ?? null,
      aiScore: latestReview.get(a.id)?.score ?? null,
      aiRecommendation: latestReview.get(a.id)?.rec ?? null,
      questionSummary: summaries.get(a.id)!
    }))
  }
}

export async function listCreators(
  filters: { status?: string | null; q?: string | null; state?: string | null } = {}
) {
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
    query = query.or(
      `full_name.ilike.%${q}%,email.ilike.%${q}%,creator_id.ilike.%${q}%,referral_code.ilike.%${q}%`
    )
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
    totalApplications: 0,
    pendingReview: 0,
    approvalRate: 0,
    activeCreators: 0,
    creatorsByState: [] as { state: string; count: number }[],
    applicationsByState: [] as { state: string; count: number }[],
    activeChallenges: 0,
    pendingSubmissions: 0,
    totalLeads: 0,
    rewardsPaidKobo: 0
  }
  if (!isSupabaseConfigured()) return empty

  const [apps, creators, challenges, subs, leads, rewards] = await Promise.all([
    supabase.from("creator_applications").select("status, state").is("deleted_at", null),
    supabase.from("creators").select("status, state"),
    supabase.from("creator_challenges").select("id").eq("status", "ACTIVE"),
    supabase.from("creator_submissions").select("id").in("status", ["SUBMITTED", "UNDER_REVIEW"]),
    supabase.from("leads").select("id").not("creator_id", "is", null),
    supabase.from("creator_rewards").select("amount_kobo").eq("status", "PAID")
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
      ["SUBMITTED", "AI_REVIEWED", "MANUAL_REVIEW", "INTERVIEW_REQUESTED", "INTERVIEW_SCHEDULED"].includes(
        a.status as string
      )
    ).length,
    approvalRate: decided.length ? Math.round((approved / decided.length) * 100) : 0,
    activeCreators: creatorRows.filter((c) => c.status === "ACTIVE").length,
    creatorsByState: countBy(creatorRows as { state: string | null }[]),
    applicationsByState: countBy(appRows as { state: string | null }[]),
    activeChallenges: (challenges.data || []).length,
    pendingSubmissions: (subs.data || []).length,
    totalLeads: (leads.data || []).length,
    rewardsPaidKobo: (rewards.data || []).reduce((s, r) => s + ((r.amount_kobo as number) || 0), 0)
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
    approvedContent: 0,
    pendingSubmissions: 0,
    clicks: 0,
    leads: 0,
    demoBookings: 0,
    signups: 0,
    conversions: 0,
    pendingRewardsKobo: 0,
    approvedRewardsKobo: 0,
    paidRewardsKobo: 0,
    onboardingProgress: 0,
    onboardingStatus: "NOT_STARTED"
  }
  if (!isSupabaseConfigured()) return empty

  const [subs, referrals, rewards, onboarding] = await Promise.all([
    supabase.from("creator_submissions").select("status").eq("creator_id", creatorId),
    supabase.from("creator_referrals").select("event_type").eq("creator_id", creatorId),
    supabase.from("creator_rewards").select("status, amount_kobo").eq("creator_id", creatorId),
    supabase
      .from("creator_onboarding")
      .select("status, progress_pct")
      .eq("creator_id", creatorId)
      .maybeSingle()
  ])

  const subRows = subs.data || []
  const refRows = referrals.data || []
  const rewardRows = rewards.data || []
  const count = (t: string) => refRows.filter((r) => r.event_type === t).length

  return {
    approvedContent: subRows.filter((s) => s.status === "APPROVED").length,
    pendingSubmissions: subRows.filter((s) => ["SUBMITTED", "UNDER_REVIEW"].includes(s.status as string))
      .length,
    clicks: count("CLICK"),
    leads: count("LEAD"),
    demoBookings: count("DEMO"),
    signups: count("SIGNUP"),
    conversions: count("CUSTOMER"),
    pendingRewardsKobo: rewardRows
      .filter((r) => r.status === "PENDING")
      .reduce((s, r) => s + ((r.amount_kobo as number) || 0), 0),
    approvedRewardsKobo: rewardRows
      .filter((r) => r.status === "APPROVED" || r.status === "PROCESSING")
      .reduce((s, r) => s + ((r.amount_kobo as number) || 0), 0),
    paidRewardsKobo: rewardRows
      .filter((r) => r.status === "PAID")
      .reduce((s, r) => s + ((r.amount_kobo as number) || 0), 0),
    onboardingProgress: (onboarding.data?.progress_pct as number) ?? 0,
    onboardingStatus: (onboarding.data?.status as string) ?? "NOT_STARTED"
  }
}
