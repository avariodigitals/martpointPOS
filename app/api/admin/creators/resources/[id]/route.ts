import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { saveResource, deleteResource } from "@/lib/creator-resources"
import { uploadCreatorResourceFile } from "@/lib/creator-storage"
import { recordAudit, AUDIT_ACTIONS, auditContextFromSession } from "@/lib/audit"
import { RESOURCE_CATEGORIES, RESOURCE_TYPES } from "@/lib/creator-constants"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

export async function PUT(request: Request, { params }: Params) {
  const { session, denied } = await authorizeAdmin("creator.resource.manage")
  if (denied) return denied
  const { id } = await params

  try {
    const form = await request.formData()
    const name = String(form.get("name") || "").trim()
    const category = String(form.get("category") || "OTHER")
    const resourceType = String(form.get("resourceType") || "FILE")
    if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 })
    if (!RESOURCE_CATEGORIES.includes(category as never)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 })
    }
    if (!RESOURCE_TYPES.includes(resourceType as never)) {
      return NextResponse.json({ error: "Invalid resource type" }, { status: 400 })
    }

    const file = form.get("file")
    let filePath = String(form.get("existingFilePath") || "") || null
    if (file instanceof File && file.size > 0) {
      const buf = Buffer.from(await file.arrayBuffer())
      const up = await uploadCreatorResourceFile(file.name, file.type || "application/octet-stream", buf)
      if (!up.ok) return NextResponse.json({ error: up.error }, { status: 400 })
      filePath = up.storagePath!
    }
    const externalUrl = String(form.get("externalUrl") || "")
    if (!filePath && !externalUrl) {
      return NextResponse.json({ error: "Provide a file or an external URL" }, { status: 400 })
    }

    const { error } = await saveResource(
      {
        name, category: category as never, resourceType: resourceType as never,
        description: String(form.get("description") || "") || null,
        externalUrl: externalUrl || null, filePath,
        version: String(form.get("version") || "") || null,
        usageNotes: String(form.get("usageNotes") || "") || null,
        active: form.get("active") !== "false",
        sortOrder: Number(form.get("sortOrder") || 0),
      },
      session.userId,
      id
    )
    if (error) return NextResponse.json({ error }, { status: 400 })

    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_RESOURCE_UPDATED,
      entityType: "creator_resource",
      entityId: id,
      metadata: { name },
    })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to save resource" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const { session, denied } = await authorizeAdmin("creator.resource.manage")
  if (denied) return denied
  const { id } = await params
  const { error } = await deleteResource(id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CREATOR_RESOURCE_UPDATED,
    entityType: "creator_resource",
    entityId: id,
    metadata: { deleted: true },
  })
  return NextResponse.json({ success: true })
}
