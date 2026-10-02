import { NextResponse } from "next/server"
import crypto from "crypto"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAuditBatch, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import type { StoredEstimate } from "@/lib/estimate-calculator"

interface LeadRecord {
  id: string
  fullName: string
  businessName: string
  email: string
  phone: string
  businessType: string
  productInterest: string
  branches: string
  staffSize: string
  challenge?: string
  estimate?: StoredEstimate | null
  message?: string
  source: string
  status: "New" | "Contacted" | "Qualified" | "Proposal" | "Won" | "Lost"
  assignedTo?: string
  notes?: string
  questionnaireToken?: string | null
  questionnaireStatus?: string
  questionnaireSentAt?: string | null
  questionnaireSubmittedAt?: string | null
  businessId?: string | null
  submittedAt: string
  updatedAt: string
}

async function guardLeadsAccess() {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "leads")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

/* ─── GET ─── */
export async function GET() {
  const denied = await guardLeadsAccess()
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ leads: [] })
  }

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .order("submitted_at", { ascending: false })

  if (error) {
    console.error("[Supabase Leads GET Error]", error)
    return NextResponse.json({ error: "Failed to fetch leads" }, { status: 500 })
  }

  const leads = (data || []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    businessName: row.business_name,
    email: row.email,
    phone: row.phone,
    businessType: row.business_type,
    productInterest: row.product_interest,
    branches: row.branches,
    staffSize: row.staff_size,
    challenge: row.challenge,
    estimate: row.estimate ?? null,
    message: row.message,
    source: row.source,
    status: row.status,
    assignedTo: row.assigned_to,
    notes: row.notes,
    questionnaireToken: row.questionnaire_token,
    questionnaireStatus: row.questionnaire_status,
    questionnaireSentAt: row.questionnaire_sent_at,
    questionnaireSubmittedAt: row.questionnaire_submitted_at,
    businessId: null as string | null,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
  }))

  const leadIds = leads.map((l) => l.id as string)
  if (leadIds.length > 0) {
    const { data: bizRows } = await supabase
      .from("businesses")
      .select("id, source_lead_id")
      .in("source_lead_id", leadIds)
    const bizByLead = new Map((bizRows || []).map((b) => [b.source_lead_id as string, b.id as string]))
    for (const lead of leads) lead.businessId = bizByLead.get(lead.id as string) ?? null
  }

  return NextResponse.json({ leads })
}

/* ─── PUT (update status, notes, assignedTo) ─── */
export async function PUT(request: Request) {
  const denied = await guardLeadsAccess()
  if (denied) return denied

  try {
    const body = await request.json()
    const { id, status, notes, assignedTo } = body
    const {
      fullName,
      businessName,
      email,
      phone,
      businessType,
      productInterest,
      branches,
      staffSize,
      challenge,
      message,
      source,
    } = body

    if (!id) {
      return NextResponse.json({ error: "Lead ID is required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status !== undefined) updateData.status = status
    if (notes !== undefined) updateData.notes = notes
    if (assignedTo !== undefined) updateData.assigned_to = assignedTo
    if (fullName !== undefined) updateData.full_name = fullName
    if (businessName !== undefined) updateData.business_name = businessName
    if (email !== undefined) updateData.email = email
    if (phone !== undefined) updateData.phone = phone
    if (businessType !== undefined) updateData.business_type = businessType
    if (productInterest !== undefined) updateData.product_interest = productInterest
    if (branches !== undefined) updateData.branches = branches
    if (staffSize !== undefined) updateData.staff_size = staffSize
    if (challenge !== undefined) updateData.challenge = challenge
    if (message !== undefined) updateData.message = message
    if (source !== undefined) updateData.source = source

    const { data, error } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error || !data) {
      console.error("[Supabase Lead Update Error]", error)
      return NextResponse.json({ error: "Lead not found or update failed" }, { status: 404 })
    }

    const lead = {
      id: data.id,
      fullName: data.full_name,
      businessName: data.business_name,
      email: data.email,
      phone: data.phone,
      businessType: data.business_type,
      productInterest: data.product_interest,
      branches: data.branches,
      staffSize: data.staff_size,
      challenge: data.challenge,
      estimate: data.estimate ?? null,
      message: data.message,
      source: data.source,
      status: data.status,
      assignedTo: data.assigned_to,
      notes: data.notes,
      questionnaireToken: data.questionnaire_token,
      questionnaireStatus: data.questionnaire_status,
      questionnaireSentAt: data.questionnaire_sent_at,
      questionnaireSubmittedAt: data.questionnaire_submitted_at,
      submittedAt: data.submitted_at,
      updatedAt: data.updated_at,
    }

    return NextResponse.json({ success: true, lead })
  } catch {
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 })
  }
}

/* ─── POST (create manually) ─── */
export async function POST(request: Request) {
  const denied = await guardLeadsAccess()
  if (denied) return denied

  try {
    const body = await request.json()
    const {
      fullName,
      businessName,
      email,
      phone,
      businessType,
      productInterest,
      branches,
      staffSize,
      challenge,
      message,
      source,
      status,
      notes,
      assignedTo,
    } = body

    if (!fullName || !businessName || !email || !phone || !businessType || !productInterest || !branches || !staffSize) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const leadId = crypto.randomUUID()
    const now = new Date().toISOString()

    const lead: LeadRecord = {
      id: leadId,
      fullName,
      businessName,
      email,
      phone,
      businessType,
      productInterest,
      branches,
      staffSize,
      challenge: challenge || "",
      message: message || "",
      source: source || "manual",
      status: status || "New",
      assignedTo: assignedTo || "",
      notes: notes || "",
      questionnaireStatus: "Not Sent",
      submittedAt: now,
      updatedAt: now,
    }

    if (isSupabaseConfigured()) {
      const { error } = await supabase.from("leads").insert({
        id: leadId,
        full_name: fullName,
        business_name: businessName,
        email,
        phone,
        business_type: businessType,
        product_interest: productInterest,
        branches,
        staff_size: staffSize,
        challenge: challenge || "",
        message: message || "",
        source: source || "manual",
        status: status || "New",
        assigned_to: assignedTo || "",
        notes: notes || "",
        submitted_at: now,
        updated_at: now,
      })
      if (error) {
        console.error("[Supabase Lead Insert Error]", error)
        return NextResponse.json({ error: "Failed to save lead" }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true, lead }, { status: 200 })
  } catch {
    return NextResponse.json({ error: "Failed to create lead" }, { status: 500 })
  }
}

/* ─── DELETE — single (?id=) or bulk (?ids=a,b,c). Purges all lead data. ─── */
export async function DELETE(request: Request) {
  const denied = await guardLeadsAccess()
  if (denied) return denied
  const session = await getSession()

  try {
    const { searchParams } = new URL(request.url)
    const ids = (
      searchParams.get("ids")?.split(",") ??
      (searchParams.get("id") ? [searchParams.get("id")!] : [])
    )
      .map((s) => s.trim())
      .filter(Boolean)

    if (ids.length === 0) {
      return NextResponse.json({ error: "Lead ID(s) required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    // Related rows that cascade in the schema are deleted explicitly anyway so a
    // database missing the cascade constraints can't block the delete. Failures
    // here are logged, not fatal — the final leads.delete() reports real errors.
    const cleanup = (label: string, promise: PromiseLike<{ error: { message: string } | null }>) =>
      Promise.resolve(promise).then((r) => {
        if (r?.error) console.error(`[Lead delete cleanup:${label}]`, r.error.message)
      })

    const { data: quotationRows } = await supabase.from("lead_quotations").select("id").in("lead_id", ids)
    const quotationIds = ((quotationRows as { id: string }[]) || []).map((q) => q.id)

    if (quotationIds.length) {
      await cleanup("quote_change_requests", supabase.from("lead_quote_change_requests").delete().in("quotation_id", quotationIds))
      await cleanup("quotation_items", supabase.from("lead_quotation_items").delete().in("quotation_id", quotationIds))
    }
    await cleanup("quotations", supabase.from("lead_quotations").delete().in("lead_id", ids))
    await cleanup("emails", supabase.from("lead_emails").delete().in("lead_id", ids))
    await cleanup("meetings", supabase.from("lead_meetings").delete().in("lead_id", ids))
    // onboarding.lead_id is a plain TEXT column (no FK) — purge the orphans.
    await cleanup("onboarding", supabase.from("onboarding").delete().in("lead_id", ids))

    // Unlink — these columns should be ON DELETE SET NULL, but null them first so
    // a database without that FK action still lets the lead be deleted.
    await cleanup("businesses", supabase.from("businesses").update({ source_lead_id: null }).in("source_lead_id", ids))
    await cleanup("creator_referrals", supabase.from("creator_referrals").update({ lead_id: null }).in("lead_id", ids))
    await cleanup("career_commissions", supabase.from("career_commissions").update({ lead_id: null }).in("lead_id", ids))
    await cleanup("career_pipeline_handovers", supabase.from("career_pipeline_handovers").update({ lead_id: null }).in("lead_id", ids))

    const { error, count } = await supabase.from("leads").delete({ count: "exact" }).in("id", ids)

    if (error) {
      console.error("[Supabase Lead Delete Error]", error)
      return NextResponse.json({ error: error.message || "Delete failed" }, { status: 500 })
    }
    if (count === 0) {
      return NextResponse.json({ error: "No matching leads found" }, { status: 404 })
    }

    const ctx = auditContextFromSession(session, request)
    await recordAuditBatch(
      ctx,
      ids.map((id) => ({ action: AUDIT_ACTIONS.LEAD_DELETED, entityType: AUDIT_ENTITIES.LEAD, entityId: id }))
    )

    return NextResponse.json({ success: true, deleted: count ?? ids.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Failed to delete lead(s): ${msg}` }, { status: 500 })
  }
}
