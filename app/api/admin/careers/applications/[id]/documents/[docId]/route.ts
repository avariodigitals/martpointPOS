import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { createCareerDocSignedUrl } from "@/lib/careers-storage"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"

export const dynamic = "force-dynamic"

/* GET: redirect to a short-lived signed URL for an applicant document.
 * Documents are private — never expose public storage URLs. */
export async function GET(request: Request, ctx: { params: Promise<{ id: string; docId: string }> }) {
  const { session, denied } = await authorizeAdmin("careers.applications.view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 503 })
  const { id, docId } = await ctx.params

  const { data: doc } = await supabase
    .from("career_application_documents")
    .select("id, storage_path, original_filename")
    .eq("id", docId)
    .eq("application_id", id)
    .single()
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const url = await createCareerDocSignedUrl(doc.storage_path, 120)
  if (!url) return NextResponse.json({ error: "Could not generate access link" }, { status: 500 })

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_DOCUMENT_ACCESSED,
    entityType: AUDIT_ENTITIES.CAREER_APPLICATION,
    entityId: id,
    metadata: { documentId: docId, filename: doc.original_filename },
  })

  return NextResponse.redirect(url)
}
