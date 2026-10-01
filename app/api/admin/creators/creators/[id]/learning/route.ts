import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { getCreatorLearningDetail, resetCreatorLearning } from "@/lib/creator-learning"
import { recordAudit, AUDIT_ACTIONS, auditContextFromSession } from "@/lib/audit"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

/** GET — creator onboarding/learning detail for the admin profile view. */
export async function GET(_: Request, { params }: Params) {
  const { denied } = await authorizeAdmin("creator.view")
  if (denied) return denied
  const { id } = await params
  const detail = await getCreatorLearningDetail(id)
  return NextResponse.json(detail)
}

const resetSchema = z.object({ action: z.literal("reset") })

/** POST {action:"reset"} — wipe learning progress + assessment attempts. */
export async function POST(request: Request, { params }: Params) {
  const { session, denied } = await authorizeAdmin("creator.assessment.manage")
  if (denied) return denied
  const { id } = await params
  try {
    resetSchema.parse(await request.json())
    const { error } = await resetCreatorLearning(id)
    if (error) return NextResponse.json({ error }, { status: 500 })
    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_LEARNING_RESET,
      entityType: "creator",
      entityId: id,
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 })
  }
}
