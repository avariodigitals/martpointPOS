import { NextResponse } from "next/server"
import fs from "fs"
import path from "path"
import crypto from "crypto"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { UserRole } from "@/lib/admin-auth"

const leadsPath = path.join(process.cwd(), "data", "leads.json")

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

function readLeads(): LeadRecord[] {
  try {
    if (!fs.existsSync(leadsPath)) return []
    const data = fs.readFileSync(leadsPath, "utf-8")
    return (JSON.parse(data).leads || []) as LeadRecord[]
  } catch {
    return []
  }
}

function writeLeads(leads: LeadRecord[]) {
  const dir = path.dirname(leadsPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(leadsPath, JSON.stringify({ leads }, null, 2), "utf-8")
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

  const leads = readLeads()
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

    const leads = readLeads()
    const idx = leads.findIndex((l) => l.id === id)
    if (idx === -1) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    if (status) leads[idx].status = status
    if (notes !== undefined) leads[idx].notes = notes
    if (assignedTo !== undefined) leads[idx].assignedTo = assignedTo
    leads[idx].updatedAt = new Date().toISOString()

    writeLeads(leads)
    return NextResponse.json({ success: true, lead: leads[idx] })
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

    const lead: LeadRecord = {
      id: crypto.randomUUID(),
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
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    const leads = readLeads()
    leads.unshift(lead)
    writeLeads(leads)

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

    const leads = readLeads()
    const filtered = leads.filter((l) => l.id !== id)
    if (filtered.length === leads.length) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    writeLeads(filtered)
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete lead" }, { status: 500 })
  }
}
