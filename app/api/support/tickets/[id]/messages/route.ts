import { NextResponse } from "next/server"
import { getCustomerSupportSession } from "@/lib/customer-support-auth"
import { addMessage } from "@/lib/support"
import { supabase } from "@/lib/supabase"

function ok<T>(data: T) {
  return NextResponse.json({ success: true, data })
}

function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCustomerSupportSession()
  if (!session) return err("Unauthorized", 401)
  const { id } = await params

  try {
    const body = await request.json()
    const message = (body.message || "").toString().trim()
    if (!message) return err("Message is required")

    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .select("id")
      .eq("id", id)
      .eq("business_id", session.businessId)
      .single()

    if (error || !ticket) return err("Ticket not found", 404)

    const msg = await addMessage(id, "CUSTOMER", session.businessId, message, "PUBLIC")
    return ok(msg)
  } catch (e) {
    return err(String(e), 500)
  }
}
