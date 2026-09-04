import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import {
  grantPartnerCapability,
  revokePartnerCapability,
  listPartnerCapabilities,
} from "@/lib/partner-service"
import type { PartnerOrgCapability } from "@/lib/partner-auth"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied

  const { partnerId } = await params
  const capabilities = await listPartnerCapabilities(partnerId)
  return NextResponse.json({ capabilities })
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
    const { capability, expiresAt } = body
    if (!capability) {
      return NextResponse.json({ error: "Capability is required" }, { status: 400 })
    }

    const result = await grantPartnerCapability(
      partnerId,
      capability as PartnerOrgCapability,
      session!.userId,
      expiresAt ?? null
    )
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to grant capability" }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  const { partnerId } = await params
  const { searchParams } = new URL(request.url)
  const capability = searchParams.get("capability")
  if (!capability) {
    return NextResponse.json({ error: "Capability is required" }, { status: 400 })
  }

  const result = await revokePartnerCapability(
    partnerId,
    capability as PartnerOrgCapability,
    session!.userId
  )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ success: true })
}
