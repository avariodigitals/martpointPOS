import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession } from "@/lib/audit"
import { setOnboardingHealth } from "@/lib/businesses"
import { z } from "zod"

const schema = z.object({
  onboardingOwner: z.string().nullable().optional(),
  onboardingHealth: z.enum(["On Track", "At Risk", "Blocked"]).optional(),
  onboardingWaitingOn: z.enum(["None", "Customer", "MartPoint", "Partner"]).optional(),
  blockerReason: z.string().nullable().optional(),
  targetGoLive: z.string().nullable().optional(),
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
    const result = await setOnboardingHealth(businessId, parsed.data, ctx)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to update onboarding health" }, { status: 500 })
  }
}
