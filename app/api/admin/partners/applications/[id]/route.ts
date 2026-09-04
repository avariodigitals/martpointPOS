import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { createSignedDocUrl } from "@/lib/partner-documents"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"

/* ─── GET: full application detail + documents (signed URLs) + status history ─── */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied

  const { id } = await params
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 })
  }

  const { data: app, error } = await supabase
    .from("partner_applications")
    .select("*")
    .eq("id", id)
    .single()
  if (error || !app) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 })
  }

  const { data: documents } = await supabase
    .from("partner_documents")
    .select("id, document_type, storage_path, original_filename, mime_type, file_size, verification_status, uploaded_at, verified_at")
    .eq("application_id", id)
    .order("uploaded_at", { ascending: true })

  // Generate short-lived signed URLs for admin viewing
  const docsWithUrls = await Promise.all(
    (documents || []).map(async (d: Record<string, unknown>) => {
      const url = await createSignedDocUrl(d.storage_path as string, 60)
      // Log document access
      if (session) {
        const ctx = auditContextFromSession(session, request)
        await recordAudit(ctx, {
          action: AUDIT_ACTIONS.PARTNER_DOCUMENT_ACCESSED,
          entityType: AUDIT_ENTITIES.PARTNER_DOCUMENT,
          entityId: d.id as string,
          metadata: { applicationId: id, filename: d.original_filename },
        })
      }
      return { ...d, signedUrl: url }
    })
  )

  const { data: history } = await supabase
    .from("partner_status_history")
    .select("previous_status, new_status, reason, changed_by, created_at")
    .eq("application_id", id)
    .order("created_at", { ascending: true })

  return NextResponse.json({ application: app, documents: docsWithUrls, history: history || [] })
}
