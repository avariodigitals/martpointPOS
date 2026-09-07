import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession } from "@/lib/audit"
import {
  convertLeadToBusiness,
  createBusiness,
  deleteBusiness,
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

/* ─── POST: convert a Won lead into a business or create manually ─── */
export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("businesses", "create")
  if (denied) return denied

  try {
    const body = await request.json()
    const { leadId, ...overrides } = body
    const ctx = auditContextFromSession(session, request)

    if (leadId) {
      const result = await convertLeadToBusiness(leadId, ctx, overrides)
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
      return NextResponse.json({
        success: true,
        business: result.business,
        alreadyExists: result.alreadyExists ?? false,
      })
    }

    // Manual creation
    const required = [
      "businessName",
      "primaryContactName",
      "primaryEmail",
      "primaryPhone",
      "businessType",
      "country",
      "state",
      "city",
    ] as const
    for (const field of required) {
      if (!overrides[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 })
      }
    }

    const result = await createBusiness(
      {
        businessName: overrides.businessName,
        legalName: overrides.legalName || null,
        primaryContactName: overrides.primaryContactName,
        primaryEmail: overrides.primaryEmail,
        primaryPhone: overrides.primaryPhone,
        businessType: overrides.businessType,
        industry: overrides.industry || "",
        country: overrides.country,
        state: overrides.state,
        city: overrides.city,
        address: overrides.address || "",
        website: overrides.website || null,
        status: (overrides.status as BusinessStatus) || "ONBOARDING",
        source: overrides.source || "DIRECT",
        onboardingOwner: overrides.onboardingOwner ?? null,
        onboardingHealth: overrides.onboardingHealth ?? "On Track",
        onboardingWaitingOn: overrides.onboardingWaitingOn ?? "None",
        blockerReason: overrides.blockerReason ?? null,
        blockerSince: overrides.blockerSince ?? null,
        targetGoLive: overrides.targetGoLive ?? null,
        onboardingStartedAt: overrides.onboardingStartedAt ?? null,
        onboardingProgress: overrides.onboardingProgress ?? 0,
      },
      ctx
    )
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }
    return NextResponse.json({ success: true, business: result.business })
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

/* ─── DELETE: remove a business ─── */
export async function DELETE(request: Request) {
  const { session, denied } = await authorizeAdmin("businesses", "delete")
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "Business ID required" }, { status: 400 })
    }
    const ctx = auditContextFromSession(session, request)
    const ok = await deleteBusiness(id, ctx)
    if (!ok) {
      return NextResponse.json({ error: "Failed to delete business" }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete business" }, { status: 500 })
  }
}

export type { BusinessStatus }
