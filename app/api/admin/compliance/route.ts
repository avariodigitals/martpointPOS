import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import {
  listRequirements,
  createComplianceRecord,
  submitDocument,
  reviewCompliance,
  requestReplacement,
  setComplianceExpiry,
  type ComplianceRecord,
} from "@/lib/compliance"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

type ComplianceStatus = ComplianceRecord["status"]

/* ─── GET ─── */
export async function GET(request: Request) {
  const { session, denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)
    const subjectType = searchParams.get("subject_type") || undefined
    const businessId = searchParams.get("business")
    const partnerId = searchParams.get("partner")
    const status = searchParams.get("status")
    const requirement = searchParams.get("requirement")

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: true, records: [], requirements: [] })
    }

    const requirements = await listRequirements(subjectType)

    let q = supabase.from("compliance_records").select("*").order("updated_at", { ascending: false })
    if (subjectType) q = q.eq("subject_type", subjectType)
    if (businessId) q = q.eq("business_id", businessId)
    if (partnerId) q = q.eq("partner_id", partnerId)
    if (status) q = q.eq("status", status)
    if (requirement) q = q.eq("requirement_type", requirement)

    const { data: records, error } = await q
    if (error) throw error

    const [businesses, partners, users] = await Promise.all([
      supabase.from("businesses").select("id, business_name"),
      supabase.from("partners").select("id, business_name"),
      supabase.from("users").select("id, name"),
    ])

    const businessMap = new Map<string, string>()
    for (const b of (businesses.data || []) as Array<{ id: string; business_name: string }>) {
      businessMap.set(b.id, b.business_name)
    }

    const partnerMap = new Map<string, string>()
    for (const p of (partners.data || []) as Array<{ id: string; business_name: string }>) {
      partnerMap.set(p.id, p.business_name)
    }

    const userMap = new Map<string, string>()
    for (const u of (users.data || []) as Array<{ id: string; name: string }>) {
      userMap.set(u.id, u.name)
    }

    const list = ((records || []) as Array<Record<string, unknown>>).map((r) => ({
      ...(r as Record<string, unknown>),
      business_name: r.business_id ? businessMap.get(r.business_id as string) || null : null,
      partner_name: r.partner_id ? partnerMap.get(r.partner_id as string) || null : null,
      reviewer_name: r.reviewed_by ? userMap.get(r.reviewed_by as string) || null : null,
    }))

    return NextResponse.json({ success: true, records: list, requirements })
  } catch (err) {
    console.error("[Compliance API GET]", err)
    return NextResponse.json({ error: "Failed to load compliance data" }, { status: 500 })
  }
}

/* ─── POST ─── */
export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  try {
    const body = await request.json()
    const { action, data } = body as { action: string; data: Record<string, unknown> }

    if (!action || !data) {
      return NextResponse.json({ error: "Missing action or data" }, { status: 400 })
    }

    if (action === "create_record") {
      const record = await createComplianceRecord({
        subject_type: data.subject_type as "BUSINESS" | "PARTNER",
        business_id: data.business_id as string | undefined,
        partner_id: data.partner_id as string | undefined,
        requirement_type: data.requirement_type as string,
        requested_by: session?.userId,
        public_note: data.public_note as string | undefined,
      })
      return NextResponse.json({ success: true, record })
    }

    if (action === "request_replacement") {
      const record = await requestReplacement(
        data.record_id as string,
        data.reason as string,
        session?.userId
      )
      return NextResponse.json({ success: true, record })
    }

    if (action === "submit_document") {
      const record = await submitDocument(
        data.record_id as string,
        data.document_path as string,
        session?.userId as string,
        "ADMIN"
      )
      return NextResponse.json({ success: true, record })
    }

    if (action === "review") {
      const record = await reviewCompliance(
        data.record_id as string,
        data.status as "VERIFIED" | "REJECTED" | "EXPIRED",
        session?.userId as string,
        data.public_note as string | undefined,
        data.internal_notes as string | undefined,
        data.expires_at as string | undefined
      )
      return NextResponse.json({ success: true, record })
    }

    if (action === "set_expiry") {
      const record = await setComplianceExpiry(
        data.record_id as string,
        data.expires_at as string,
        session?.userId as string
      )
      return NextResponse.json({ success: true, record })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    console.error("[Compliance API POST]", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
