import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { uploadPrivateFile, PARTNER_RESOURCES_BUCKET, validatePartnerFile } from "@/lib/partner-documents"

export async function POST(request: Request) {
  const { denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  try {
    const form = await request.formData()
    const file = form.get("file")
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "File is required" }, { status: 400 })
    }

    const validation = validatePartnerFile({ type: file.type, size: file.size })
    if (validation) {
      return NextResponse.json({ error: validation }, { status: 400 })
    }

    const bytes = Buffer.from(await file.arrayBuffer())
    const storagePath = `admin/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`
    const upload = await uploadPrivateFile(PARTNER_RESOURCES_BUCKET, storagePath, file.name, file.type, bytes)

    if (!upload.ok || !upload.doc) {
      return NextResponse.json({ error: upload.error || "Upload failed" }, { status: 500 })
    }

    return NextResponse.json({ success: true, storagePath: upload.doc.storagePath })
  } catch {
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 })
  }
}
