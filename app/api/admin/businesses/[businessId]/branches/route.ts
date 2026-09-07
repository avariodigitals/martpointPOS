import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession } from "@/lib/audit"
import { listBusinessBranches, addBusinessBranch, deleteBusinessBranch } from "@/lib/businesses"
import { z } from "zod"

const createSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  isHeadquarters: z.boolean().optional(),
})

export async function GET(_: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params
  const auth = await authorizeAdmin("businesses", "view")
  if (auth.denied) return auth.denied
  const branches = await listBusinessBranches(businessId)
  return NextResponse.json({ branches })
}

export async function POST(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params
  const auth = await authorizeAdmin("businesses", "manage")
  if (auth.denied) return auth.denied

  try {
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    const ctx = auditContextFromSession(auth.session, request)
    const result = await addBusinessBranch(businessId, parsed.data, ctx)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true, branch: result.branch })
  } catch {
    return NextResponse.json({ error: "Failed to add branch" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  await params
  const auth = await authorizeAdmin("businesses", "manage")
  if (auth.denied) return auth.denied

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Branch id required" }, { status: 400 })
  const ctx = auditContextFromSession(auth.session, request)
  const ok = await deleteBusinessBranch(id, ctx)
  if (!ok) return NextResponse.json({ error: "Failed to delete branch" }, { status: 500 })
  return NextResponse.json({ success: true })
}
