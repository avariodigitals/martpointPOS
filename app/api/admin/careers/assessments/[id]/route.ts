import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { sendCareerNotification, buildInterviewVars, buildInterviewIcs } from "@/lib/careers-notifications"
import { changeApplicationStatus } from "@/lib/careers"
import { createMeetEvent, getGoogleSettings, isGoogleConnected } from "@/lib/google-calendar"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, ctx: Ctx) {
  const { denied } = await authorizeAdmin("careers.assessments.manage")
  if (denied) return denied
  const { id } = await ctx.params

  const { data: assessment } = await supabase
    .from("career_assessments")
    .select("*, career_vacancies(title, slug)")
    .eq("id", id)
    .maybeSingle()
  if (!assessment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: candidates } = await supabase
    .from("career_assessment_candidates")
    .select("*, career_applications(reference_number, full_name, email, status), career_candidate_profiles(reference_number, full_name, email)")
    .eq("assessment_id", id)
    .order("created_at")

  const rows = (candidates || []).map((c) => {
    const app = c.career_applications as { reference_number?: string; full_name?: string; email?: string; status?: string } | null
    const cand = c.career_candidate_profiles as { reference_number?: string; full_name?: string; email?: string } | null
    return {
      ...c,
      name: app?.full_name || cand?.full_name || "—",
      email: app?.email || cand?.email || "",
      reference: app?.reference_number || cand?.reference_number || "",
      application_status: app?.status,
      career_applications: undefined,
      career_candidate_profiles: undefined,
    }
  })

  return NextResponse.json({ assessment, candidates: rows })
}

/* PATCH: update assessment fields, or invite candidates {invite: [{applicationId|candidateId}]}, or score {scores: [{id, score, notes}]} */
export async function PATCH(request: Request, ctx: Ctx) {
  const { session, denied } = await authorizeAdmin("careers.assessments.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { id } = await ctx.params
  const body = await request.json().catch(() => ({}))

  const { data: assessment } = await supabase
    .from("career_assessments")
    .select("*, career_vacancies(title)")
    .eq("id", id)
    .single()
  if (!assessment) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // Invite candidates (also flips application status to ASSESSMENT_INVITED)
  if (Array.isArray(body.invite)) {
    const rows = []
    for (const inv of body.invite.slice(0, 200)) {
      if (!inv.applicationId && !inv.candidateId) continue
      rows.push({
        assessment_id: id,
        application_id: inv.applicationId || null,
        candidate_id: inv.candidateId || null,
        invited_at: new Date().toISOString(),
      })
      if (inv.applicationId) {
        await changeApplicationStatus(inv.applicationId, "ASSESSMENT_INVITED", { id: session.userId, name: session.name }, "Assessment invitation")
      }
    }
    if (rows.length > 0) {
      await supabase.from("career_assessment_candidates").upsert(rows, { onConflict: "assessment_id,application_id" })
    }
    // Send invitations by email
    if (body.sendInvites === true) {
      const vacTitle = (assessment.career_vacancies as { title?: string } | null)?.title || ""
      const isInterview = assessment.assessment_type === "INTERVIEW"

      // For interviews, ensure a video link exists: use the stored link or
      // auto-create a Google Meet event when Google Calendar is connected.
      let meetingLink = (assessment.meeting_link as string | null) || null
      let meetingProvider = (assessment.meeting_provider as string | null) || null
      let googleEventId = (assessment.google_event_id as string | null) || null
      if (isInterview && !meetingLink && assessment.scheduled_at) {
        try {
          const g = await getGoogleSettings()
          if (isGoogleConnected(g)) {
            const duration = Number(assessment.duration_minutes) || 45
            const start = new Date(assessment.scheduled_at)
            const event = await createMeetEvent({
              summary: `Interview: ${assessment.name}${vacTitle ? ` — ${vacTitle}` : ""}`,
              description: `MartPoint careers interview.\nAssessment: ${assessment.name}`,
              start,
              end: new Date(start.getTime() + duration * 60_000),
              timezone: "Africa/Lagos",
              sendUpdates: false,
            })
            meetingLink = event.meetLink
            meetingProvider = "Google Meet"
            googleEventId = event.eventId
            await supabase
              .from("career_assessments")
              .update({ meeting_link: meetingLink, meeting_provider: meetingProvider, google_event_id: googleEventId, updated_at: new Date().toISOString() })
              .eq("id", id)
          }
        } catch (err) {
          console.error("[careers] Meet link generation failed:", err instanceof Error ? err.message : err)
        }
      }

      const duration = Number(assessment.duration_minutes) || 45
      const statusUrl = `${process.env.NEXT_PUBLIC_SITE_URL || ""}/careers/application-status`
      const details = [
        assessment.instructions,
        assessment.scheduled_at ? `Scheduled: ${new Date(assessment.scheduled_at).toLocaleString()}` : "",
        meetingLink ? `Join link: ${meetingLink}` : "",
        assessment.meeting_location ? `Location: ${assessment.meeting_location}` : "",
      ].filter(Boolean).join("\n")

      for (const inv of body.invite.slice(0, 200)) {
        let email = ""
        let name = ""
        let ref = ""
        if (inv.applicationId) {
          const { data: app } = await supabase.from("career_applications").select("email, full_name, reference_number").eq("id", inv.applicationId).single()
          email = app?.email || ""; name = app?.full_name || ""; ref = app?.reference_number || ""
        } else if (inv.candidateId) {
          const { data: c } = await supabase.from("career_candidate_profiles").select("email, full_name, reference_number").eq("id", inv.candidateId).single()
          email = c?.email || ""; name = c?.full_name || ""; ref = c?.reference_number || ""
        }
        if (!email) continue

        if (isInterview && assessment.scheduled_at) {
          const start = new Date(assessment.scheduled_at)
          void sendCareerNotification({
            template: "career_interview_invite",
            to: email,
            applicationId: inv.applicationId || null,
            candidateId: inv.candidateId || null,
            vars: buildInterviewVars({
              fullName: name, reference: ref, vacancyTitle: vacTitle,
              assessmentName: assessment.name, scheduledAt: start, durationMinutes: duration,
              meetingLink, meetingLocation: assessment.meeting_location || null,
              instructions: assessment.instructions || null, statusUrl,
            }),
            attachments: [buildInterviewIcs({
              id: `${id}-${inv.applicationId || inv.candidateId}`,
              summary: `Interview: ${assessment.name}${vacTitle ? ` — ${vacTitle}` : ""}`,
              start, durationMinutes: duration,
              attendeeEmail: email, attendeeName: name,
              meetingLink, location: assessment.meeting_location || null,
            })],
          })
        } else {
          void sendCareerNotification({
            template: "career_assessment_invite",
            to: email,
            applicationId: inv.applicationId || null,
            candidateId: inv.candidateId || null,
            vars: { fullName: name, reference: ref, vacancyTitle: vacTitle, assessmentName: assessment.name, assessmentDetails: details },
          })
        }
      }
      await supabase.from("career_assessments").update({ status: "INVITED", updated_at: new Date().toISOString() }).eq("id", id)
    }
    return NextResponse.json({ success: true })
  }

  // Score entry
  if (Array.isArray(body.scores)) {
    const passScore = assessment.pass_score != null ? Number(assessment.pass_score) : null
    for (const s of body.scores.slice(0, 500)) {
      const score = s.score == null || s.score === "" ? null : Number(s.score)
      if (score != null && (!Number.isFinite(score) || score < 0)) continue
      const passed = score == null || passScore == null ? null : score >= passScore
      await supabase
        .from("career_assessment_candidates")
        .update({
          score,
          passed,
          notes: s.notes ?? null,
          completed_at: score != null ? new Date().toISOString() : null,
          evaluator_id: session.userId,
          evaluator_name: session.name,
          updated_at: new Date().toISOString(),
        })
        .eq("id", s.id)
        .eq("assessment_id", id)
      // Flip linked application status
      const { data: link } = await supabase.from("career_assessment_candidates").select("application_id").eq("id", s.id).single()
      if (link?.application_id && score != null) {
        await changeApplicationStatus(link.application_id, "ASSESSMENT_COMPLETED", { id: session.userId, name: session.name }, `Assessment "${assessment.name}" scored ${score}`)
      }
    }
    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CAREER_ASSESSMENT_SCORED,
      entityType: AUDIT_ENTITIES.CAREER_ASSESSMENT,
      entityId: id,
      metadata: { count: body.scores.length },
    })
    return NextResponse.json({ success: true })
  }

  // Field updates
  const allowed = ["name", "assessment_type", "instructions", "max_score", "pass_score", "scheduled_at", "status", "vacancy_id", "meeting_link", "meeting_provider", "meeting_location", "duration_minutes"] as const
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) {
    if (body[k] !== undefined) patch[k] = body[k]
  }
  const { error } = await supabase.from("career_assessments").update(patch).eq("id", id)
  if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  return NextResponse.json({ success: true })
}
