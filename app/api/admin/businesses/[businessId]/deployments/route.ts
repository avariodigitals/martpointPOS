import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession } from "@/lib/audit"
import { getBusinessDeployment, updateBusinessDeployment } from "@/lib/partner-onboarding"
import { z } from "zod"

const schema = z.object({
  status: z.enum(["PENDING", "PROVISIONING", "PROVISIONED", "CONFIGURATION", "LIVE", "SUSPENDED", "FAILED"]).optional(),
  environmentUrl: z.string().optional().nullable(),
  adminUrl: z.string().optional().nullable(),
  onlineStoreUrl: z.string().optional().nullable(),
  provisionedAt: z.string().optional().nullable(),
  goLiveAt: z.string().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
})

export async function GET(_: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params
  const auth = await authorizeAdmin("businesses", "view")
  if (auth.denied) return auth.denied
  const deployment = await getBusinessDeployment(businessId)
  return NextResponse.json({ deployment })
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
    const result = await updateBusinessDeployment(businessId, parsed.data as unknown as Parameters<typeof updateBusinessDeployment>[1], auth.session.userId, ctx)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    const deployment = await getBusinessDeployment(businessId)
    return NextResponse.json({ deployment })
  } catch {
    return NextResponse.json({ error: "Failed to update deployment" }, { status: 500 })
  }
}
