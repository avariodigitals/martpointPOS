import { NextResponse } from "next/server"
import { getPartnerSession, getPartnerById } from "@/lib/partner-auth"
import { supabase } from "@/lib/supabase"
import { canPartnerViewTicket } from "@/lib/support"
import { uploadSupportAttachment, getSignedAttachmentUrl } from "@/lib/support-attachments"

function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function POST(request: Request) {
  const session = await getPartnerSession()
  if (!session) return err("Unauthorized", 401)
  const partner = await getPartnerById(session.partnerId)
  if (!partner || partner.status !== "ACTIVE") return err("Account suspended", 403)

  try {
    const body = await request.json()
    const { ticketId, fileName, mimeType, fileSize, fileBase64 } = body as {
      ticketId?: string
      fileName?: string
      mimeType?: string
      fileSize?: number
      fileBase64?: string
    }

    if (!ticketId || !fileName || !mimeType || !fileBase64) {
      return err("ticketId, fileName, mimeType and fileBase64 are required")
    }

    const { data: ticket } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("id", ticketId)
      .single()
    if (!ticket) return err("Ticket not found", 404)

    const canAccess = await canPartnerViewTicket(session.partnerId, ticket as any, session.partnerUserId)
    if (!canAccess) return err("Forbidden", 403)

    const fileBytes = new Uint8Array(Buffer.from(fileBase64, "base64"))
    const size = fileSize ?? fileBytes.length

    const { record } = await uploadSupportAttachment({
      ticketId,
      fileName,
      mimeType,
      fileSize: size,
      fileBytes,
      authorType: "PARTNER",
      authorId: session.partnerUserId,
      isInternal: false,
    })

    return NextResponse.json({ success: true, attachment: record })
  } catch (e) {
    console.error("[partner/support/attachments] POST", e)
    return err(String(e), 500)
  }
}

export async function GET(request: Request) {
  const session = await getPartnerSession()
  if (!session) return err("Unauthorized", 401)

  try {
    const { searchParams } = new URL(request.url)
    const attachmentId = searchParams.get("attachmentId")
    if (!attachmentId) return err("attachmentId required")

    const signedUrl = await getSignedAttachmentUrl(attachmentId, "PARTNER", session.partnerId)
    if (!signedUrl) return err("Could not generate signed URL", 500)

    return NextResponse.json({ success: true, signedUrl })
  } catch (e) {
    console.error("[partner/support/attachments] GET", e)
    return err(String(e), 403)
  }
}
