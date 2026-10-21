import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner, getPartnerCapabilities } from "@/lib/partner-auth"
import { listPartnerResourcesForPartner } from "@/lib/partner-service"
import { PARTNER_RESOURCES_BUCKET } from "@/lib/partner-documents"
import { isSupabaseConfigured, supabase } from "@/lib/supabase"

export const dynamic = "force-dynamic"

function safeFilename(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "martpoint-resource"
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "partner:resources:view" })
  if (!auth.authorized) return auth.response!
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 503 })

  const { id } = await params
  const partner = auth.partner!
  const capabilities = await getPartnerCapabilities(partner.id)
  const resources = await listPartnerResourcesForPartner(partner.id, partner.partnerType, capabilities)
  const resource = resources.find((item) => item.id === id)
  if (!resource) return NextResponse.json({ error: "Resource not found" }, { status: 404 })

  const storagePath = typeof resource.storage_path === "string" ? resource.storage_path : ""
  if (!storagePath) {
    const url = [resource.file_url, resource.external_url].find((value) => typeof value === "string" && value)
    if (!url) return NextResponse.json({ error: "No downloadable file is attached" }, { status: 404 })
    return NextResponse.redirect(url as string)
  }

  const { data, error } = await supabase.storage.from(PARTNER_RESOURCES_BUCKET).download(storagePath)
  if (error || !data) {
    return NextResponse.json({ error: "Resource file is unavailable" }, { status: 404 })
  }

  const title = typeof resource.title === "string" ? resource.title : "martpoint-resource"
  const pathFilename = storagePath.split("/").pop() || ""
  const extension = pathFilename.includes(".") ? pathFilename.slice(pathFilename.lastIndexOf(".")) : ""
  const filename = `${safeFilename(title)}${extension && !title.toLowerCase().endsWith(extension.toLowerCase()) ? extension : ""}`

  return new Response(data, {
    headers: {
      "Content-Type": data.type || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  })
}
