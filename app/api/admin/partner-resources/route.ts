import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import {
  listAllPartnerResources,
  createPartnerResource,
  deletePartnerResource,
} from "@/lib/partner-service"
import type { PartnerOrgCapability } from "@/lib/partner-permissions"

export async function GET() {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied

  const resources = await listAllPartnerResources()
  return NextResponse.json({ resources })
}

export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  try {
    const body = await request.json()
    const result = await createPartnerResource(
      {
        title: body.title,
        description: body.description,
        category: body.category,
        fileUrl: body.fileUrl,
        storagePath: body.storagePath,
        externalUrl: body.externalUrl,
        visibility: body.visibility,
        allowedPartnerTypes: body.allowedPartnerTypes,
        allowedCapabilities: body.allowedCapabilities as PartnerOrgCapability[] | undefined,
        active: body.active,
        publishedAt: body.publishedAt,
      },
      session!.userId
    )

    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
    return NextResponse.json({ success: true, resource: result.resource })
  } catch {
    return NextResponse.json({ error: "Failed to create resource" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (!id) {
    return NextResponse.json({ error: "Resource ID is required" }, { status: 400 })
  }

  const result = await deletePartnerResource(id, session!.userId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
  return NextResponse.json({ success: true })
}
