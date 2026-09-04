import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession } from "@/lib/audit"
import { getBusinessEntitlement, updateBusinessEntitlement } from "@/lib/partner-onboarding"
import { z } from "zod"

const schema = z.object({
  planCode: z.string().optional().nullable(),
  maxBranches: z.coerce.number().int().min(0).optional(),
  maxUsers: z.coerce.number().int().min(0).optional(),
  onlineStoreEnabled: z.boolean().optional(),
  implementationEnabled: z.boolean().optional(),
  subscriptionStatus: z.enum(["ACTIVE", "SUSPENDED", "CANCELLED", "PENDING"]).optional(),
  effectiveFrom: z.string().optional(),
  effectiveUntil: z.string().optional().nullable(),
})

export async function GET(_: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params
  const auth = await authorizeAdmin("businesses", "view")
  if (auth.denied) return auth.denied
  const entitlement = await getBusinessEntitlement(businessId)
  if (!entitlement) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ entitlement })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params
  const auth = await authorizeAdmin("businesses", "manage")
  if (auth.denied) return auth.denied

  try {
    const body = await request.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const ctx = auditContextFromSession(auth.session, request)
    const result = await updateBusinessEntitlement(businessId, parsed.data as unknown as Parameters<typeof updateBusinessEntitlement>[1], auth.session.userId, ctx)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    const entitlement = await getBusinessEntitlement(businessId)
    return NextResponse.json({ entitlement })
  } catch {
    return NextResponse.json({ error: "Failed to update entitlement" }, { status: 500 })
  }
}
