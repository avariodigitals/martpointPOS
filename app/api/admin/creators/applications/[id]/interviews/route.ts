import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin, hasPermission } from "@/lib/admin-auth"
import { scheduleCreatorInterview, listInterviews } from "@/lib/creator-applications"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"
import { getGoogleSettings, isGoogleConnected } from "@/lib/google-calendar"
import { supabase } from "@/lib/supabase"

const schema = z.object({
  scheduledAt: z.string().min(1),
  durationMinutes: z.number().int().min(10).max(240).default(30),
  meetingLocation: z.string().max(300).optional().nullable(),
  interviewerName: z.string().max(120).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  meetingKind: z.enum(["interview", "meeting"]).default("interview"),
  title: z.string().trim().min(3).max(200).optional(),
  requireGoogleMeet: z.boolean().default(false)
})

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("creator.view")
  if (denied) return denied
  const { id } = await params
  try {
    const profile = await supabase
      .from("creator_applications")
      .select("id")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle()
    if (profile.error)
      return NextResponse.json({ error: "Could not verify creator application" }, { status: 503 })
    if (!profile.data) return NextResponse.json({ error: "Application not found" }, { status: 404 })
    const [interviews, google] = await Promise.all([listInterviews(id), getGoogleSettings()])
    return NextResponse.json(
      {
        interviews,
        googleConnected: isGoogleConnected(google),
        canManage: hasPermission(session.role, "creator.interview.manage")
      },
      { headers: { "Cache-Control": "private, no-store" } }
    )
  } catch {
    return NextResponse.json({ error: "Could not load creator meetings" }, { status: 503 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("creator.interview.manage")
  if (denied) return denied
  const { id } = await params

  try {
    if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
    const body = schema.parse(await request.json())
    if (Number.isNaN(Date.parse(body.scheduledAt))) {
      return NextResponse.json({ error: "Invalid date/time" }, { status: 400 })
    }
    const result = await scheduleCreatorInterview({
      applicationId: id,
      scheduledAt: body.scheduledAt,
      durationMinutes: body.durationMinutes,
      meetingLocation: body.meetingLocation,
      interviewerName: body.interviewerName,
      notes: body.notes,
      meetingKind: body.meetingKind,
      title: body.title,
      requireGoogleMeet: body.requireGoogleMeet,
      actor: { id: session.userId, name: session.name || session.username }
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Failed to schedule" }, { status: 400 })
    }
    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_INTERVIEW_SCHEDULED,
      entityType: AUDIT_ENTITIES.CREATOR_INTERVIEW,
      entityId: result.interviewId,
      metadata: {
        applicationId: id,
        scheduledAt: body.scheduledAt,
        meetingKind: body.meetingKind,
        title: body.title,
        meetingUrl: result.meetingUrl
      }
    })
    return NextResponse.json({
      success: true,
      interviewId: result.interviewId,
      meetingUrl: result.meetingUrl,
      warning: result.warning
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to schedule interview" }, { status: 500 })
  }
}
