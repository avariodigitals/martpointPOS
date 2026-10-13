import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { recordStatusHistory } from "@/lib/partners"
import { supabase } from "@/lib/supabase"
import {
  listAssignments,
  assignAssessment,
  type AssignmentStatus,
} from "@/lib/partner-assessments"

const STATUSES: AssignmentStatus[] = [
  "PENDING", "IN_PROGRESS", "SUBMITTED", "GRADED", "EXPIRED", "WAIVED", "CANCELLED",
]

export async function GET(request: Request) {
  const auth = await authorizeAdmin("partners", "view")
  if (auth.denied) return auth.denied
  const params = new URL(request.url).searchParams
  const statusParam = params.get("status")
  const audienceParam = params.get("audience")
  const assignments = await listAssignments({
    applicationId: params.get("applicationId") || undefined,
    partnerId: params.get("partnerId") || undefined,
    audience: audienceParam === "APPLICANT" || audienceParam === "PARTNER" ? audienceParam : undefined,
    status: statusParam && STATUSES.includes(statusParam as AssignmentStatus)
      ? (statusParam as AssignmentStatus)
      : undefined,
    needsReview: params.get("needsReview") === "1",
  })
  return NextResponse.json({ assignments })
}

const postSchema = z.object({
  templateId: z.string().uuid(),
  applicationId: z.string().uuid().optional(),
  partnerId: z.string().uuid().optional(),
  audience: z.enum(["APPLICANT", "PARTNER"]),
  dueAt: z.string().datetime().nullable().optional(),
})

export async function POST(request: Request) {
  const auth = await authorizeAdmin("partners", "manage")
  if (auth.denied) return auth.denied
  const parsed = postSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid assignment" }, { status: 400 })
  }
  if (!parsed.data.applicationId && !parsed.data.partnerId) {
    return NextResponse.json({ error: "Choose an application or a partner" }, { status: 400 })
  }

  const result = await assignAssessment({
    ...parsed.data,
    dueAt: parsed.data.dueAt ?? null,
    actorId: auth.session.userId,
    actorName: auth.session.name || auth.session.username,
    origin: new URL(request.url).origin,
  })
  if (!result.ok || !result.assignment) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  const a = result.assignment
  await recordAudit(auditContextFromSession(auth.session, request), {
    action: AUDIT_ACTIONS.PARTNER_ASSESSMENT_ASSIGNED,
    entityType: AUDIT_ENTITIES.PARTNER_ASSESSMENT_ASSIGNMENT,
    entityId: a.id,
    metadata: {
      templateId: a.templateId,
      templateName: a.template.name,
      tierName: a.tier.name,
      audience: a.audience,
      applicationId: a.applicationId,
      partnerId: a.partnerId,
      emailSent: result.emailSent,
    },
  })
  if (a.applicationId) {
    const { data: app } = await supabase
      .from("partner_applications").select("status").eq("id", a.applicationId).maybeSingle()
    await recordStatusHistory(
      a.applicationId, null, (app?.status as string) ?? null, (app?.status as string) ?? "SUBMITTED",
      `Product knowledge assessment assigned: ${a.tier.name} — ${a.template.name} (${a.template.timeLimitMinutes} min, pass ${a.template.passingScore}%). Email ${result.emailSent ? "sent" : "FAILED — send the link manually"}.`,
      auth.session.userId,
      {
        changedByName: auth.session.name || auth.session.username,
        eventType: "ASSESSMENT_ASSIGNED",
      }
    )
  }
  return NextResponse.json({
    success: true,
    assignment: a,
    url: result.url,
    emailSent: result.emailSent,
  })
}
