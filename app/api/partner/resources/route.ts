import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner, getPartnerCapabilities } from "@/lib/partner-auth"
import { listPartnerResourcesForPartner, getSignedResourceUrl } from "@/lib/partner-service"

export async function GET() {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "partner:resources:view" })
  if (!auth.authorized) return auth.response!

  const partner = auth.partner!
  const capabilities = await getPartnerCapabilities(partner.id)
  const resources = await listPartnerResourcesForPartner(partner.partnerType, capabilities)
  const resourcesWithUrls = await Promise.all(
    resources.map(async (r) => {
      const url = await getSignedResourceUrl(r)
      return { ...r, signedUrl: url }
    })
  )

  return NextResponse.json({ resources: resourcesWithUrls })
}
