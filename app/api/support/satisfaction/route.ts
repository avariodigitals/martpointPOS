import { NextResponse } from "next/server"
import crypto from "crypto"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { notifyAllAdmins } from "@/lib/admin-notifications"
import { sendTicketRequesterEmail, recordTicketEmail } from "@/lib/support-ticket-email"

export async function POST(request: Request) {
  if (!isSupabaseConfigured())
    return NextResponse.json({ error: "Support is temporarily unavailable" }, { status: 503 })
  const body = await request.json().catch(() => null)
  if (
    !body ||
    !/^[\da-f-]{36}$/i.test(body.ticketId || "") ||
    typeof body.token !== "string" ||
    body.token.length > 200 ||
    !["satisfied", "not_satisfied"].includes(body.response)
  )
    return NextResponse.json({ error: "Choose a satisfaction response" }, { status: 400 })
  const tokenHash = crypto.createHash("sha256").update(body.token).digest("hex")
  const { data: ticket, error } = await supabase.rpc("support_submit_feedback", {
    p_ticket_id: body.ticketId,
    p_token_hash: tokenHash,
    p_response: body.response
  })
  if (error) {
    console.error("[ticket feedback]", error.message)
    return NextResponse.json({ error: "We could not save your response. Please retry." }, { status: 500 })
  }
  if (!ticket)
    return NextResponse.json(
      { error: "This feedback link has already been used or the ticket is no longer awaiting confirmation." },
      { status: 410 }
    )
  const message =
    body.response === "satisfied"
      ? "Thank you for confirming that your issue is resolved. Your support ticket is now closed."
      : "Thank you for letting us know. Your ticket has been reopened and our support team will follow up."
  const result = await sendTicketRequesterEmail({
    ticket,
    message,
    actorId: ticket.resolution_actor_id || ticket.assigned_admin_user_id,
    subjectPrefix: body.response === "satisfied" ? "Resolution confirmed — ticket closed" : "Ticket reopened"
  })
  await recordTicketEmail(ticket, message, result)
  if (body.response === "not_satisfied")
    await notifyAllAdmins({
      type: "SUPPORT_TICKET_REOPENED",
      title: "Customer still needs help",
      message: `${ticket.ticket_number}: ${ticket.subject}`,
      deep_link: `/admin/support/${ticket.id}`,
      source_type: "support_ticket",
      source_id: ticket.id,
      roles: ["Admin", "Customer Care", "Tech"]
    })
  return NextResponse.json({ success: true, response: body.response })
}
