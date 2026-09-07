import { NextResponse } from "next/server"
import { getCustomerSupportSession } from "@/lib/customer-support-auth"
import { getSlaState } from "@/lib/support"
import { supabase } from "@/lib/supabase"

function ok<T>(data: T) {
  return NextResponse.json({ success: true, data })
}

function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCustomerSupportSession()
  if (!session) return err("Unauthorized", 401)
  const { id } = await params

  try {
    const { data, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("id", id)
      .eq("business_id", session.businessId)
      .single()

    if (error || !data) return err("Ticket not found", 404)

    const slaState = await getSlaState(data.resolution_due_at as string | null)

    const { data: messages, error: msgError } = await supabase
      .from("support_ticket_messages")
      .select("*")
      .eq("ticket_id", id)
      .eq("visibility", "PUBLIC")
      .order("created_at", { ascending: true })

    if (msgError) return err(msgError.message, 500)

    const { data: events, error: evError } = await supabase
      .from("support_ticket_events")
      .select("id, ticket_id, event_type, actor_type, previous_value, new_value, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: false })

    if (evError) return err(evError.message, 500)

    return ok({
      ticket: { ...data, sla_state: slaState },
      messages: messages || [],
      events: events || [],
    })
  } catch (e) {
    return err(String(e), 500)
  }
}
