import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { createPartnerResource, getSignedResourceUrl } from "@/lib/partner-service"
import { getActiveBrochureResource } from "@/lib/brochure"
import {
  uploadPrivateFile,
  validatePartnerFile,
  PARTNER_RESOURCES_BUCKET,
} from "@/lib/partner-documents"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET() {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied

  const resource = await getActiveBrochureResource()
  if (!resource) {
    return NextResponse.json({ resource: null })
  }

  const signedUrl = await getSignedResourceUrl(resource)
  return NextResponse.json({ resource: { ...resource, signedUrl } })
}

export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  try {
    const form = await request.formData()
    const file = form.get("file")
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "File is required" },
        { status: 400 }
      )
    }

    const validation = validatePartnerFile({ type: file.type, size: file.size })
    if (validation) {
      return NextResponse.json({ error: validation }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_")
    const storagePath = `brochures/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}-${safeName}`

    const upload = await uploadPrivateFile(
      PARTNER_RESOURCES_BUCKET,
      storagePath,
      file.name,
      file.type,
      bytes
    )

    if (!upload.ok || !upload.doc) {
      return NextResponse.json(
        { error: upload.error || "Upload failed" },
        { status: 500 }
      )
    }

    if (isSupabaseConfigured()) {
      await supabase
        .from("partner_resources")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("category", "Brochure")
        .eq("active", true)
    }

    const title = file.name.replace(/\.[^/.]+$/, "")
    const result = await createPartnerResource(
      {
        title,
        description: "MartPoint product brochure",
        category: "Brochure",
        visibility: "ALL",
        active: true,
        storagePath: upload.doc.storagePath,
      },
      session!.userId
    )

    if (!result.ok || !result.resource) {
      return NextResponse.json(
        { error: result.error || "Failed to save brochure" },
        { status: 500 }
      )
    }

    const signedUrl = await getSignedResourceUrl(result.resource)
    return NextResponse.json({
      success: true,
      resource: { ...result.resource, signedUrl },
    })
  } catch {
    return NextResponse.json(
      { error: "Failed to process upload" },
      { status: 500 }
    )
  }
}
