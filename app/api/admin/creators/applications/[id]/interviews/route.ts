import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { scheduleCreatorInterview, listInterviews } from "@/lib/creator-applications"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"

const schema = z.object({
  scheduledAt: z.string().min(1),
  durationMinutes: z.number().int().min(10).max(240).default(30),
  meetingLocation: z.string().max(300).optional().nullable(),
  interviewerName: z.string().max(120).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { denied } = await authorizeAdmin("creator.view")
  if (denied) return denied
  const { id } = await params
  return NextResponse.json({ interviews: await listInterviews(id) })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, denied } = await authorizeAdmin("creator.interview.manage")
  if (denied) return denied
  const { id } = await params

  try {
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
      actor: { id: session.userId, name: session.name || session.username },
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Failed to schedule" }, { status: 400 })
    }
    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_INTERVIEW_SCHEDULED,
      entityType: AUDIT_ENTITIES.CREATOR_INTERVIEW,
      entityId: result.interviewId,
      metadata: { applicationId: id, scheduledAt: body.scheduledAt },
    })
    return NextResponse.json({ success: true, interviewId: result.interviewId })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to schedule interview" }, { status: 500 })
  }
}
