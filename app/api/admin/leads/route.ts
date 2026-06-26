import { NextResponse } from "next/server"
import crypto from "crypto"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

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
  message?: string
  source: string
  status: "New" | "Contacted" | "Qualified" | "Proposal" | "Won" | "Lost"
  assignedTo?: string
  notes?: string
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
    message: row.message,
    source: row.source,
    status: row.status,
    assignedTo: row.assigned_to,
    notes: row.notes,
    submittedAt: row.submitted_at,
    updatedAt: row.updated_at,
  }))

  return NextResponse.json({ leads })
}

/* ─── PUT (update status, notes, assignedTo) ─── */
export async function PUT(request: Request) {
  const denied = await guardLeadsAccess()
  if (denied) return denied

  try {
    const body = await request.json()
    const { id, status, notes, assignedTo } = body

    if (!id) {
      return NextResponse.json({ error: "Lead ID is required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (status) updateData.status = status
    if (notes !== undefined) updateData.notes = notes
    if (assignedTo !== undefined) updateData.assigned_to = assignedTo

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
      message: data.message,
      source: data.source,
      status: data.status,
      assignedTo: data.assigned_to,
      notes: data.notes,
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

/* ─── DELETE ─── */
export async function DELETE(request: Request) {
  const denied = await guardLeadsAccess()
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "Lead ID is required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
    }

    const { error } = await supabase.from("leads").delete().eq("id", id)

    if (error) {
      console.error("[Supabase Lead Delete Error]", error)
      return NextResponse.json({ error: "Lead not found or delete failed" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 })
  }
}
