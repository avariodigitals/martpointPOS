import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import {
  listPartnerCustomerAssignments,
  createPartnerCustomerAssignment,
  revokePartnerCustomerAssignment,
  setPartnerCustomerAssignmentStatus,
  movePartnerCustomerAssignment,
} from "@/lib/partner-service"
import type { AccessLevel } from "@/lib/partner-auth"
import { issueCustomerAssignmentDocument } from "@/lib/partner-generated-docs"
import { notifyPartnerCustomerEvent } from "@/lib/partner-notifications"
import { supabase } from "@/lib/supabase"

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

    const { data: business } = await supabase.from("businesses").select("business_name").eq("id", businessId).maybeSingle()
    await notifyPartnerCustomerEvent(partnerId, {
      subject: `Customer access assigned — ${business?.business_name || "MartPoint customer"}`,
      title: "Customer access assigned",
      businessName: business?.business_name || "MartPoint customer",
      body: "This customer is now assigned to your partner team. Your implementation users can access the customer workspace according to the assigned access level.",
      link: `${(process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng").replace(/\/$/, "")}/partner/customers/${businessId}`,
    })

    // Issue the Customer Assignment document (best-effort — assignment stands either way).
    try {
      const doc = await issueCustomerAssignmentDocument(result.assignment!.id as string, session!.userId)
      return NextResponse.json({ success: true, assignment: result.assignment, document: doc.document ?? null })
    } catch (e) {
      console.error("[assignments] document generation failed:", e)
      return NextResponse.json({ success: true, assignment: result.assignment })
    }
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  const { partnerId } = await params
  const body = await request.json().catch(() => ({}))
  const assignmentId = String(body.assignmentId || "")
  const action = String(body.action || "")
  if (!assignmentId) return NextResponse.json({ error: "Assignment ID is required" }, { status: 400 })

  const { data: currentAssignment } = await supabase
    .from("partner_customer_assignments")
    .select("partner_id, business_id, businesses(business_name)")
    .eq("id", assignmentId)
    .maybeSingle()
  const businessName = (currentAssignment?.businesses as { business_name?: string } | null)?.business_name || "MartPoint customer"
  const portalBase = (process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng").replace(/\/$/, "")

  if (action === "suspend" || action === "restore") {
    const result = await setPartnerCustomerAssignmentStatus(assignmentId, action === "suspend" ? "SUSPENDED" : "ACTIVE", session!.userId)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    await notifyPartnerCustomerEvent(String(currentAssignment?.partner_id || partnerId), {
      subject: `Customer assignment ${action === "suspend" ? "suspended" : "restored"} — ${businessName}`,
      title: `Customer assignment ${action === "suspend" ? "suspended" : "restored"}`,
      businessName,
      body: action === "suspend"
        ? "Access for this customer has been suspended by MartPoint. Your team will no longer be able to use the assigned customer workspace until it is restored."
        : "Access for this customer has been restored. Your implementation team can continue work from the partner portal.",
      link: `${portalBase}/partner/customers/${currentAssignment?.business_id || ""}`,
    })
    return NextResponse.json({ success: true })
  }

  if (action === "move") {
    const targetPartnerId = body.targetPartnerId ? String(body.targetPartnerId) : null
    const result = await movePartnerCustomerAssignment(assignmentId, targetPartnerId, session!.userId, body.notes ? String(body.notes) : undefined)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    await notifyPartnerCustomerEvent(String(currentAssignment?.partner_id || partnerId), {
      subject: `Customer assignment moved — ${businessName}`,
      title: "Customer assignment moved",
      businessName,
      body: targetPartnerId
        ? "MartPoint has moved this customer to another partner. Your team's access to the customer workspace has ended."
        : "MartPoint has taken this customer back. Your team's access to the customer workspace has ended.",
      link: `${portalBase}/partner/customers/${currentAssignment?.business_id || ""}`,
    })
    if (targetPartnerId) {
      await notifyPartnerCustomerEvent(targetPartnerId, {
        subject: `New customer assigned — ${businessName}`,
        title: "New customer assigned",
        businessName,
        body: "MartPoint has assigned this customer to your partner team. Your implementation users can now continue the customer workflow from the portal.",
        link: `${portalBase}/partner/customers/${currentAssignment?.business_id || ""}`,
      })
    }
    return NextResponse.json({ success: true, assignment: result.assignment ?? null, movedFrom: partnerId })
  }

  return NextResponse.json({ error: "Unknown assignment action" }, { status: 400 })
}
