import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { auditContextFromPartnerSession } from "@/lib/audit"
import { getOnboardingTasks, updateOnboardingTask, submitOnboardingComplete } from "@/lib/partner-onboarding"
import { canPartnerAccessBusiness } from "@/lib/partner-auth"
import { z } from "zod"

const taskUpdateSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETED"]),
  notes: z.string().optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({
    session,
    permission: "onboarding:manage_assigned",
    capability: "CUSTOMER_ONBOARDING",
  })
  if (!auth.authorized) return auth.response!

  const access = await canPartnerAccessBusiness(session.partnerId, businessId, {
    partnerUserId: session.partnerUserId,
    userPermission: "onboarding:manage_assigned",
    orgCapability: "CUSTOMER_ONBOARDING",
    requiredAccessLevel: "ONBOARDING_MANAGER",
  })
  if (!access.allowed) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  const tasks = await getOnboardingTasks(businessId)
  return NextResponse.json({ tasks })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({
    session,
    permission: "onboarding:manage_assigned",
    capability: "CUSTOMER_ONBOARDING",
  })
  if (!auth.authorized) return auth.response!

  const access = await canPartnerAccessBusiness(session.partnerId, businessId, {
    partnerUserId: session.partnerUserId,
    userPermission: "onboarding:manage_assigned",
    orgCapability: "CUSTOMER_ONBOARDING",
    requiredAccessLevel: "ONBOARDING_MANAGER",
  })
  if (!access.allowed) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 })
  }

  try {
    const body = await request.json()
    const parsed = taskUpdateSchema.safeParse(body)
    if (!parsed.success) {
      const ctx = auditContextFromPartnerSession(session, request)
      const result = await submitOnboardingComplete(businessId, session.partnerId, session.partnerUserId, ctx)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    const ctx = auditContextFromPartnerSession(session, request)
    const result = await updateOnboardingTask(parsed.data.taskId, session.partnerUserId, parsed.data.status, parsed.data.notes, ctx)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

    const tasks = await getOnboardingTasks(businessId)
    return NextResponse.json({ success: true, tasks })
  } catch {
    return NextResponse.json({ error: "Failed to process onboarding action" }, { status: 500 })
  }
}
