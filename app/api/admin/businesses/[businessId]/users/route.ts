import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession } from "@/lib/audit"
import { listBusinessUsers, addBusinessUser, deleteBusinessUser } from "@/lib/businesses"
import { z } from "zod"

const createSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().optional(),
  phone: z.string().optional(),
  role: z.enum(["OWNER", "MANAGER", "CASHIER", "STAFF", "ACCOUNTANT"]).optional(),
  branchId: z.string().uuid().optional().nullable(),
})

export async function GET(_: Request, { params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params
  const auth = await authorizeAdmin("businesses", "view")
  if (auth.denied) return auth.denied
  const users = await listBusinessUsers(businessId)
  return NextResponse.json({ users })
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
    const result = await addBusinessUser(businessId, parsed.data, ctx)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ success: true, user: result.user })
  } catch {
    return NextResponse.json({ error: "Failed to add user" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ businessId: string }> }) {
  await params
  const auth = await authorizeAdmin("businesses", "manage")
  if (auth.denied) return auth.denied

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "User id required" }, { status: 400 })
  const ctx = auditContextFromSession(auth.session, request)
  const ok = await deleteBusinessUser(id, ctx)
  if (!ok) return NextResponse.json({ error: "Failed to delete user" }, { status: 500 })
  return NextResponse.json({ success: true })
}
