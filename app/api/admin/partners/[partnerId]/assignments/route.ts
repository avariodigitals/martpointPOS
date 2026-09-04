import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import {
  listPartnerCustomerAssignments,
  createPartnerCustomerAssignment,
  revokePartnerCustomerAssignment,
} from "@/lib/partner-service"
import type { AccessLevel } from "@/lib/partner-auth"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied

  const { partnerId } = await params
  const assignments = await listPartnerCustomerAssignments(partnerId)
  return NextResponse.json({ assignments })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  const { partnerId } = await params
  try {
    const body = await request.json()
    const { businessId, relationshipType, accessLevel, startsAt, expiresAt, notes } = body

    if (!businessId || !relationshipType || !accessLevel) {
      return NextResponse.json(
        { error: "Business, relationship type and access level are required" },
        { status: 400 }
      )
    }

    const result = await createPartnerCustomerAssignment({
      partnerId,
      businessId,
      relationshipType,
      accessLevel: accessLevel as AccessLevel,
      assignedBy: session!.userId,
      startsAt: startsAt || null,
      expiresAt: expiresAt || null,
      notes,
    })

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
    return NextResponse.json({ success: true, assignment: result.assignment })
  } catch {
    return NextResponse.json({ error: "Failed to create assignment" }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  { params: _params }: { params: Promise<{ partnerId: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const assignmentId = searchParams.get("assignmentId")
  if (!assignmentId) {
    return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 })
  }

  const result = await revokePartnerCustomerAssignment(assignmentId, session!.userId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ success: true })
}
