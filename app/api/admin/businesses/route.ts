import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession } from "@/lib/audit"
import {
  convertLeadToBusiness,
  getBusinessById,
  listBusinesses,
  searchBusinesses,
  updateBusiness,
  type BusinessStatus,
} from "@/lib/businesses"

/* ─── GET: list businesses ─── */
export async function GET(request: Request) {
  const { denied } = await authorizeAdmin("businesses", "view")
  if (denied) return denied
  const { searchParams } = new URL(request.url)
  const id = searchParams.get("id")
  if (id) {
    const business = await getBusinessById(id)
    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 })
    }
    return NextResponse.json({ business })
  }
  const search = searchParams.get("search")
  const businesses = search ? await searchBusinesses(search) : await listBusinesses()
  return NextResponse.json({ businesses })
}

/* ─── POST: convert a Won lead into a business ─── */
export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("businesses", "create")
  if (denied) return denied

  try {
    const body = await request.json()
    const { leadId, ...overrides } = body
    if (!leadId) {
      return NextResponse.json({ error: "leadId is required" }, { status: 400 })
    }
    const ctx = auditContextFromSession(session, request)
    const result = await convertLeadToBusiness(leadId, ctx, overrides)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }
    return NextResponse.json({
      success: true,
      business: result.business,
      alreadyExists: result.alreadyExists ?? false,
    })
  } catch {
    return NextResponse.json({ error: "Failed to create business" }, { status: 500 })
  }
}

/* ─── PUT: update a business ─── */
export async function PUT(request: Request) {
  const { session, denied } = await authorizeAdmin("businesses", "update")
  if (denied) return denied

  try {
    const body = await request.json()
    const { id, ...updates } = body
    if (!id) {
      return NextResponse.json({ error: "Business ID is required" }, { status: 400 })
    }
    const ctx = auditContextFromSession(session, request)
    const business = await updateBusiness(id, updates, ctx)
    if (!business) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 })
    }
    return NextResponse.json({ success: true, business })
  } catch {
    return NextResponse.json({ error: "Failed to update business" }, { status: 500 })
  }
}

export type { BusinessStatus }
