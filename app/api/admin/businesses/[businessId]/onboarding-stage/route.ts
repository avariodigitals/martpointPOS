import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession } from "@/lib/audit"
import { setOnboardingStage, ONBOARDING_STAGES } from "@/lib/businesses"
import { z } from "zod"

const schema = z.object({
  stage: z.enum(ONBOARDING_STAGES.map((s) => s.key) as [string, ...string[]]),
  completed: z.boolean(),
  force: z.boolean().optional(),
})

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params
  const auth = await authorizeAdmin("businesses", "manage")
  if (auth.denied) return auth.denied

  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const ctx = auditContextFromSession(auth.session, request)
    const result = await setOnboardingStage(businessId, parsed.data.stage as never, parsed.data.completed, ctx, {
      force: parsed.data.force,
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true, stages: result.stages })
  } catch {
    return NextResponse.json({ error: "Failed to update onboarding stage" }, { status: 500 })
  }
}
