import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { createSignedDocUrl } from "@/lib/partner-documents"
import { listApplicationComplianceDocuments } from "@/lib/partner-compliance"
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

  const complianceDocuments = await listApplicationComplianceDocuments(id)

  return NextResponse.json({
    application: app,
    documents: docsWithUrls,
    complianceDocuments,
    requiredComplianceDocuments: (app.required_compliance_documents as string[]) || [],
    history: history || [],
  })
}

/* ─── PATCH: edit application fields (admin correction) ─── */
const EDITABLE_FIELDS = [
  "full_name", "business_name", "email", "phone", "whatsapp",
  "country", "state", "city", "business_address", "website",
  "linkedin", "social_profile", "registration_number", "year_established",
  "team_size", "estimated_customer_base", "current_products_services",
  "reason_for_applying", "relevant_experience", "expected_monthly_opportunities",
  "industries_served", "geographic_coverage", "requested_partner_type",
  "applicant_type",
] as const

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  const { id } = await params
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    const changed: string[] = []
    for (const field of EDITABLE_FIELDS) {
      if (field in body) {
        update[field] = body[field]
        changed.push(field)
      }
    }
    if (changed.length === 0) {
      return NextResponse.json({ error: "No editable fields provided" }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from("partner_applications")
      .update(update)
      .eq("id", id)
      .select()
      .single()
    if (error || !updated) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 })
    }

    const ctx = auditContextFromSession(session, request)
    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.PARTNER_APPLICATION_STATUS_CHANGED,
      entityType: AUDIT_ENTITIES.PARTNER_APPLICATION,
      entityId: id,
      metadata: { editedFields: changed },
    })

    return NextResponse.json({ success: true, application: updated })
  } catch {
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 })
  }
}
