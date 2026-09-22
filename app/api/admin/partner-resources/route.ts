import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import {
  listAllPartnerResources,
  listPartnerResourcesForPartner,
  listPartnerCapabilities,
  createPartnerResource,
  deletePartnerResource,
  getSignedResourceUrl,
} from "@/lib/partner-service"
import type { PartnerType } from "@/lib/partners"
import type { PartnerOrgCapability } from "@/lib/partner-permissions"

export async function GET(request: Request) {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied

  const { searchParams } = new URL(request.url)
  const partnerId = searchParams.get("partnerId")

  // Per-partner view for the partner detail "Guides"/"Docs" tabs:
  // shared = resources visible to this partner via visibility rules,
  // personal = resources scoped privately to this partner.
  if (partnerId) {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Not configured" }, { status: 500 })
    }
    const { data: partner } = await supabase
      .from("partners")
      .select("id, partner_type")
      .eq("id", partnerId)
      .single()
    if (!partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 })
    }

    const [{ data: personalRows }, capabilities] = await Promise.all([
      supabase
        .from("partner_resources")
        .select("*")
        .eq("partner_id", partnerId)
        .order("created_at", { ascending: false }),
      listPartnerCapabilities(partnerId),
    ])
    const visible = await listPartnerResourcesForPartner(
      partnerId,
      partner.partner_type as PartnerType,
      capabilities
    )

    const withUrls = async (rows: Record<string, unknown>[]) =>
      Promise.all(rows.map(async (r) => ({ ...r, signedUrl: await getSignedResourceUrl(r) })))

    return NextResponse.json({
      shared: await withUrls(visible.filter((r) => !r.partner_id)),
      personal: await withUrls((personalRows || []) as Record<string, unknown>[]),
    })
  }

  const resources = await listAllPartnerResources()
  const resourcesWithUrls = await Promise.all(
    resources.map(async (r) => ({
      ...r,
      signedUrl: await getSignedResourceUrl(r),
    }))
  )
  return NextResponse.json({ resources: resourcesWithUrls })
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
        partnerId: body.partnerId,
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
