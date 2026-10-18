import { NextResponse } from "next/server"
import { getSession, type UserRole } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import { createTicket, type SupportPriority } from "@/lib/support"
import { hasSupportAdminAction } from "@/lib/support-permissions"

const priorities = new Set<SupportPriority>(["LOW", "NORMAL", "HIGH", "URGENT"])

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasSupportAdminAction(session.role as UserRole, "support:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await request.json().catch(() => ({})) as { subject?: string; category?: string; priority?: string; description?: string }
    const { data: conversation, error } = await supabase.from("azera_conversations").select("*").eq("id", id).single()
    if (error || !conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    if (conversation.ticket_id) return NextResponse.json({ error: "A ticket is already linked to this conversation", ticket_id: conversation.ticket_id }, { status: 409 })

    const subject = body.subject?.trim() || `Customer conversation — ${conversation.customer_name || conversation.external_id}`
    const priority = priorities.has(body.priority as SupportPriority) ? body.priority as SupportPriority : "NORMAL"
    const ticket = await createTicket({
      business_id: conversation.business_id,
      created_by_type: "ADMIN",
      created_by_id: session.userId,
      source: "OMNICHANNEL",
      category: body.category || "OTHER",
      priority,
      subject,
      description: body.description?.trim() || `Created from ${conversation.channel} conversation ${conversation.id}.`,
    })

    await supabase.from("azera_conversations").update({ ticket_id: ticket.id, updated_at: new Date().toISOString() }).eq("id", id)
    return NextResponse.json({ success: true, ticket })
  } catch (error) {
    console.error("[Azera ticket bridge error]", error)
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 })
  }
}
