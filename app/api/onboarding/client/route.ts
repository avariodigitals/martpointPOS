import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { setOnboardingStage } from "@/lib/businesses"

/* ─── GET: fetch onboarding record by ID ─── */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    const { data, error } = await supabase
      .from("onboarding")
      .select("*")
      .eq("id", id)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 })
    }

    // Find the canonical business linked to this onboarding's lead, if any.
    const { data: businessRow } = await supabase
      .from("businesses")
      .select("id, onboarding_stages, source_lead_id")
      .eq("source_lead_id", data.lead_id)
      .maybeSingle()

    const record = {
      id: data.id,
      leadId: data.lead_id,
      businessId: businessRow?.id as string | undefined,
      onboardingStages: businessRow?.onboarding_stages as Record<string, unknown> | undefined,
      fullName: data.full_name,
      businessName: data.business_name,
      email: data.email,
      phone: data.phone,
      productInterest: data.product_interest,
      status: data.status,
      setupQuestionsSent: data.setup_questions_sent,
      clientResponses: data.client_responses || {},
      documents: data.documents || [],
      signatureUrl: data.signature_url || "",
      notes: data.notes || "",
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    }

    return NextResponse.json({ record })
  } catch {
    return NextResponse.json({ error: "Failed to fetch record" }, { status: 500 })
  }
}

/* ─── POST: update client fields ─── */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { id, clientResponses, signatureName, documents } = body

    if (!id) {
      return NextResponse.json({ error: "ID is required" }, { status: 400 })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ error: "Database not configured" }, { status: 500 })
    }

    // Verify record exists
    const { data: existing } = await supabase
      .from("onboarding")
      .select("id, status, lead_id, business_id")
      .eq("id", id)
      .single()

    if (!existing) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      client_responses: clientResponses || {},
    }

    if (signatureName) {
      updateData.signature_url = `signed-by:${signatureName}`
    }

    if (documents && Array.isArray(documents)) {
      updateData.documents = documents
    }

    // Only allow update if not already completed or rejected
    if (existing.status === "Completed" || existing.status === "Rejected") {
      return NextResponse.json({ error: "This onboarding is already finalized" }, { status: 400 })
    }

    // Auto-advance to In Progress when client submits
    if (existing.status === "Pending") {
      updateData.status = "In Progress"
    }

    const { data, error } = await supabase
      .from("onboarding")
      .update(updateData)
      .eq("id", id)
      .select()
      .single()

    if (error || !data) {
      console.error("[Onboarding Client Update Error]", error)
      return NextResponse.json({ error: "Update failed" }, { status: 500 })
    }

    // Advance the canonical business onboarding to "Info Received" with the payload.
    const businessId = existing.business_id as string | undefined
    if (businessId) {
      try {
        await setOnboardingStage(businessId, "INFO_RECEIVED", true, { actorType: "SYSTEM", actorId: null, actorName: null }, { data: clientResponses })
      } catch (err) {
        console.error("[Onboarding Client Update] setOnboardingStage", err)
      }
    } else if (existing.lead_id) {
      const { data: businessRow } = await supabase
        .from("businesses")
        .select("id")
        .eq("source_lead_id", existing.lead_id)
        .maybeSingle()
      if (businessRow?.id) {
        try {
          await setOnboardingStage(businessRow.id as string, "INFO_RECEIVED", true, { actorType: "SYSTEM", actorId: null, actorName: null }, { data: clientResponses })
        } catch (err) {
          console.error("[Onboarding Client Update] setOnboardingStage", err)
        }
      }
    }

    return NextResponse.json({ success: true, record: data })
  } catch {
    return NextResponse.json({ error: "Failed to update record" }, { status: 500 })
  }
}
