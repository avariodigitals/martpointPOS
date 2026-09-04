import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession } from "@/lib/audit"
import { getOnboardingTasks, verifyOnboardingTask, adminApproveGoLive } from "@/lib/partner-onboarding"
import { z } from "zod"

const schema = z.object({
  taskId: z.string().uuid().optional(),
  action: z.enum(["verify", "reopen", "approve_golive"]),
})

export async function GET(_: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params
  const auth = await authorizeAdmin("businesses", "view")
  if (auth.denied) return auth.denied
  const tasks = await getOnboardingTasks(businessId)
  return NextResponse.json({ tasks })
}

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params
  const auth = await authorizeAdmin("businesses", "manage")
  if (auth.denied) return auth.denied

  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

    const ctx = auditContextFromSession(auth.session, request)

    if (parsed.data.action === "verify" || parsed.data.action === "reopen") {
      if (!parsed.data.taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 })
      const result = await verifyOnboardingTask(parsed.data.taskId, auth.session.userId, parsed.data.action === "reopen", ctx)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    }

    if (parsed.data.action === "approve_golive") {
      const result = await adminApproveGoLive(businessId, auth.session.userId, ctx)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    }

    const tasks = await getOnboardingTasks(businessId)
    return NextResponse.json({ tasks })
  } catch {
    return NextResponse.json({ error: "Failed to process onboarding" }, { status: 500 })
  }
}
