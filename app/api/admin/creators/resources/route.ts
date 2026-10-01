import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { listResources, saveResource } from "@/lib/creator-resources"
import { uploadCreatorResourceFile } from "@/lib/creator-storage"
import { recordAudit, AUDIT_ACTIONS, auditContextFromSession } from "@/lib/audit"
import { RESOURCE_CATEGORIES, RESOURCE_TYPES } from "@/lib/creator-constants"

export const dynamic = "force-dynamic"

export async function GET() {
  const { denied } = await authorizeAdmin("creator.resource.manage")
  if (denied) return denied
  const items = await listResources()
  return NextResponse.json({ items })
}

/** POST accepts multipart/form-data (optional file) — fields are plain form fields. */
export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("creator.resource.manage")
  if (denied) return denied

  try {
    const form = await request.formData()
    const name = String(form.get("name") || "").trim()
    const category = String(form.get("category") || "OTHER")
    const resourceType = String(form.get("resourceType") || "FILE")
    const description = String(form.get("description") || "")
    const externalUrl = String(form.get("externalUrl") || "")
    const version = String(form.get("version") || "")
    const usageNotes = String(form.get("usageNotes") || "")
    const active = form.get("active") !== "false"
    const sortOrder = Number(form.get("sortOrder") || 0)

    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 })
    if (!RESOURCE_CATEGORIES.includes(category as never)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 })
    }
    if (!RESOURCE_TYPES.includes(resourceType as never)) {
      return NextResponse.json({ error: "Invalid resource type" }, { status: 400 })
    }

    const file = form.get("file")
    let filePath: string | null = null
    if (file instanceof File && file.size > 0) {
      const buf = Buffer.from(await file.arrayBuffer())
      const up = await uploadCreatorResourceFile(file.name, file.type || "application/octet-stream", buf)
      if (!up.ok) return NextResponse.json({ error: up.error }, { status: 400 })
      filePath = up.storagePath!
    }
    if (!filePath && !externalUrl) {
      return NextResponse.json({ error: "Provide a file or an external URL" }, { status: 400 })
    }

    const { id, error } = await saveResource(
      {
        name, category: category as never, resourceType: resourceType as never,
        description: description || null, externalUrl: externalUrl || null,
        filePath, version: version || null, usageNotes: usageNotes || null,
        active, sortOrder,
      },
      session.userId
    )
    if (error) return NextResponse.json({ error }, { status: 400 })

    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_RESOURCE_CREATED,
      entityType: "creator_resource",
      entityId: id,
      metadata: { name, category },
    })
    return NextResponse.json({ success: true, id })
  } catch {
    return NextResponse.json({ error: "Failed to save resource" }, { status: 500 })
  }
}
