import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export interface CustomerRecord {
  id: string
  fullName: string
  businessName: string
  email: string
  phone: string
  businessType: string
  productInterest: string
  relationship: "pleased" | "neutral" | "unhappy"
  testimonial: string
  feedbackToken: string
  tickets: Array<{ id: string; type: "complaint" | "resolution"; note: string; createdAt: string }>
  checks: Record<string, { done: boolean; remarks: string }>
  feedback: Record<string, unknown>
  submittedAt: string
  updatedAt: string
}

async function guardCustomersAccess() {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "customers")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  return null
}

/* ─── GET: all Won leads (customers) ─── */
export async function GET() {
  const denied = await guardCustomersAccess()
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ customers: [] })
  }

  const { data, error } = await supabase
    .from("leads")
    .select("*")
    .eq("status", "Won")
    .order("updated_at", { ascending: false })

  if (error) {
    console.error("[Supabase Customers GET Error]", error)
    return NextResponse.json({ error: "Failed to fetch customers" }, { status: 500 })
  }

  const customers: CustomerRecord[] = (data || []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    businessName: row.business_name,
    email: row.email,
    phone: row.phone,
    businessType: row.business_type,
    productInterest: row.product_interest,
    relationship: row.relationship || "neutral",
    testimonial: row.testimonial || "",
    feedbackToken: row.feedback_token,
    tickets: row.tickets || [],
    checks: row.checks || {
      deployment: { done: false, remarks: "" },
      configuration: { done: false, remarks: "" },
      testing: { done: false, remarks: "" },
      training: { done: false, remarks: "" },
      handover: { done: false, remarks: "" },
    },
    feedback: row.feedback || {},
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
  }))

  return NextResponse.json({ customers })
}

/* ─── PUT: update customer record ─── */
export async function PUT(request: Request) {
  const denied = await guardCustomersAccess()
  if (denied) return denied

  try {
    const body = await request.json()
    const { id, relationship, testimonial, tickets, checks, feedback } = body

    if (!id) {
      return NextResponse.json({ error: "Customer ID is required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (relationship !== undefined) updateData.relationship = relationship
    if (testimonial !== undefined) updateData.testimonial = testimonial
    if (tickets !== undefined) updateData.tickets = tickets
    if (checks !== undefined) updateData.checks = checks
    if (feedback !== undefined) updateData.feedback = feedback

    const { data, error } = await supabase
      .from("leads")
      .update(updateData)
      .eq("id", id)
      .eq("status", "Won")
      .select()
      .single()

    if (error || !data) {
      console.error("[Supabase Customer Update Error]", error)
      return NextResponse.json({ error: "Update failed" }, { status: 500 })
    }

    return NextResponse.json({ success: true, customer: data })
  } catch {
    return NextResponse.json({ error: "Failed to update customer" }, { status: 500 })
  }
}
