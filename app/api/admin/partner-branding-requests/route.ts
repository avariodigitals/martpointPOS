import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import { listAllBrandingRequests, fulfillPartnerBrandingRequest, createPartnerResource } from "@/lib/partner-service"
import { uploadPrivateFile, PARTNER_RESOURCES_BUCKET, validatePartnerFile } from "@/lib/partner-documents"

export async function GET() {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied

  const requests = await listAllBrandingRequests()
  return NextResponse.json({ requests })
}

export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  try {
    const form = await request.formData()
    const requestId = form.get("requestId") as string | null
    const file = form.get("file")

    if (!requestId || !file || !(file instanceof File)) {
      return NextResponse.json({ error: "Request ID and file are required" }, { status: 400 })
    }

    const { data: reqRow, error: reqErr } = await supabase
      .from("partner_branding_requests")
      .select("*, partners(id, partner_type)")
      .eq("id", requestId)
      .single()

    if (reqErr || !reqRow) return NextResponse.json({ error: "Branding request not found" }, { status: 404 })

    const validation = validatePartnerFile({ type: file.type, size: file.size })
    if (validation) return NextResponse.json({ error: validation }, { status: 400 })

    const partnerId = reqRow.partner_id as string
    const bytes = Buffer.from(await file.arrayBuffer())
    const storagePath = `branding/${requestId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`

    const upload = await uploadPrivateFile(PARTNER_RESOURCES_BUCKET, storagePath, file.name, file.type, bytes)
    if (!upload.ok || !upload.doc) return NextResponse.json({ error: upload.error || "Upload failed" }, { status: 500 })

    const resourceResult = await createPartnerResource(
      {
        title: reqRow.title as string,
        description: (reqRow.description as string) || "",
        category: "Branded Materials",
        storagePath: upload.doc.storagePath,
        visibility: "PARTNER",
        partnerId,
        active: true,
      },
      session!.userId
    )

    if (!resourceResult.ok || !resourceResult.resource) {
      return NextResponse.json({ error: resourceResult.error || "Failed to create resource" }, { status: 500 })
    }

    const fulfill = await fulfillPartnerBrandingRequest(requestId, resourceResult.resource.id as string, session!.userId)
    if (!fulfill.ok) return NextResponse.json({ error: fulfill.error }, { status: 500 })

    return NextResponse.json({ success: true, resourceId: resourceResult.resource.id })
  } catch {
    return NextResponse.json({ error: "Failed to fulfill request" }, { status: 500 })
  }
}
