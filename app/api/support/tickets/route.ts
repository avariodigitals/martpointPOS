import { NextResponse } from "next/server"
import { getCustomerSupportSession } from "@/lib/customer-support-auth"
import { createTicket, addMessage, getSlaState, type SupportPriority } from "@/lib/support"
import { supabase } from "@/lib/supabase"

function ok<T>(data: T) {
  return NextResponse.json({ success: true, data })
}

function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

const VALID_CATEGORIES = [
  "SOFTWARE", "LOGIN_ACCOUNT", "POS", "INVENTORY", "PRODUCTS", "REPORTS", "ONLINE_STORE",
  "CONFIGURATION", "TRAINING", "BILLING", "LICENSING", "SECURITY", "PRIVACY_DATA",
  "HARDWARE_GUIDANCE", "FEATURE_REQUEST", "OTHER",
]

const VALID_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"]

export async function GET() {
  const session = await getCustomerSupportSession()
  if (!session) return err("Unauthorized", 401)

  try {
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("business_id", session.businessId)
      .order("created_at", { ascending: false })

    if (error) return err(error.message, 500)

    const enriched = await Promise.all(
      (data || []).map(async (t) => ({
        ...t,
        sla_state: await getSlaState(t.resolution_due_at as string | null),
      }))
    )

    return ok(enriched)
  } catch (e) {
    return err(String(e), 500)
  }
}

export async function POST(request: Request) {
  const session = await getCustomerSupportSession()
  if (!session) return err("Unauthorized", 401)

  try {
    const body = await request.json()
    const { subject, description, category, priority } = body

    if (!subject || !subject.trim()) return err("Subject is required")
    if (!category || !VALID_CATEGORIES.includes(category)) return err("Invalid category")
    if (!priority || !VALID_PRIORITIES.includes(priority)) return err("Invalid priority")

    const ticket = await createTicket({
      business_id: session.businessId,
      created_by_type: "CUSTOMER",
      created_by_id: session.businessId,
      source: "DIRECT",
      category,
      priority: priority as SupportPriority,
      subject: subject.trim(),
      description: (description || "").trim() || null,
    })

    if ((description || "").trim()) {
      await addMessage(
        ticket.id,
        "CUSTOMER",
        session.businessId,
        (description || "").trim(),
        "PUBLIC"
      )
    }

    return ok(ticket)
  } catch (e) {
    return err(String(e), 500)
  }
}
