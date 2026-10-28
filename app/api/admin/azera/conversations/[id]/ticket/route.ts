import { NextResponse } from "next/server"
import { getSession, type UserRole } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import { createTicket, type SupportPriority } from "@/lib/support"
import { hasSupportAdminAction } from "@/lib/support-permissions"
import { getSupportRequester, resolveChatTicketRequester, REQUESTER_FIELDS, type RequesterType } from "@/lib/support-requester"

const priorities = new Set<SupportPriority>(["LOW", "NORMAL", "HIGH", "URGENT"])

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasSupportAdminAction(session.role as UserRole, "support:create")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { id } = await params
    const body = await request.json().catch(() => ({})) as { subject?: string; category?: string; priority?: string; description?: string; requesterName?: string; requesterEmail?: string; requesterOnBehalfOf?: string | null; requesterType?: RequesterType; requesterId?: string }
    const { data: conversation, error } = await supabase.from("azera_conversations").select("*").eq("id", id).single()
    if (error || !conversation) return NextResponse.json({ error: "Conversation not found" }, { status: 404 })
    if (conversation.ticket_id) return NextResponse.json({ error: "A ticket is already linked to this conversation", ticket_id: conversation.ticket_id }, { status: 409 })
    const requesterName = body.requesterName?.trim()
    const requesterEmail = body.requesterEmail?.trim().toLowerCase()
    if (!requesterName) return NextResponse.json({ error: "Enter the name of the person this ticket is for" }, { status: 400 })
    if (!requesterEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterEmail)) return NextResponse.json({ error: "Enter a valid email for ticket updates" }, { status: 400 })

    const subject = body.subject?.trim() || `Customer conversation — ${conversation.customer_name || conversation.external_id}`
    const priority = priorities.has(body.priority as SupportPriority) ? body.priority as SupportPriority : "NORMAL"
    const owner = body.requesterType && body.requesterId && body.requesterType in REQUESTER_FIELDS
      ? await getSupportRequester(body.requesterType,body.requesterId)
      : await resolveChatTicketRequester({ name:requesterName,email:requesterEmail,phone:conversation.customer_phone })
    if (!owner) return NextResponse.json({ error:"Select a valid requester profile" },{ status:400 })
    const ticket = await createTicket({
      [REQUESTER_FIELDS[owner.type]]:owner.id,
      created_by_type: "ADMIN",
      created_by_id: session.userId,
      source: "OMNICHANNEL",
      category: body.category || "OTHER",
      priority,
      subject,
      requester_name: requesterName,
      requester_email: requesterEmail,
      requester_on_behalf_of: body.requesterOnBehalfOf?.trim() || null,
      description: body.description?.trim() || `Created from ${conversation.channel} conversation ${conversation.id}.`,
    })

    // Carry the actual chat history into the support record; it must remain
    // understandable when agents continue the conversation from Support Desk.
    const { data: history, error: historyError } = await supabase.from("azera_messages")
      .select("author_type,author_id,message,created_at")
      .eq("conversation_id", id).order("created_at", { ascending: false }).limit(100)
    if (historyError) console.error("[Azera ticket bridge] history read failed:", historyError.message)
    if (history?.length) {
      const { error: copyError } = await supabase.from("support_ticket_messages").insert(history.reverse().map((item) => ({
        ticket_id: ticket.id,
        author_type: item.author_type === "customer" ? "CUSTOMER" : item.author_type === "agent" ? "ADMIN" : "SYSTEM",
        author_id: item.author_id,
        message: item.message,
        visibility: "PUBLIC",
        created_at: item.created_at,
      })))
      if (copyError) console.error("[Azera ticket bridge] history copy failed:", copyError.message)
    }

    const { error: linkError } = await supabase.from("azera_conversations").update({ ticket_id: ticket.id, updated_at: new Date().toISOString() }).eq("id", id)
    if (linkError) console.error("[Azera ticket bridge] conversation link failed:", linkError.message)
    return NextResponse.json({ success: true, ticket })
  } catch (error) {
    console.error("[Azera ticket bridge error]", error)
    return NextResponse.json({ error: "Failed to create ticket" }, { status: 500 })
  }
}
