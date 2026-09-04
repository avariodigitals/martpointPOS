import { NextResponse } from "next/server"
import { getSession } from "@/lib/admin-auth"
import { hasSupportAdminAction } from "@/lib/support-permissions"
import { uploadSupportAttachment, getSignedAttachmentUrl } from "@/lib/support-attachments"

function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return err("Unauthorized", 401)
  if (!hasSupportAdminAction(session.role, "support:create")) return err("Forbidden", 403)

  try {
    const body = await request.json()
    const { ticketId, fileName, mimeType, fileSize, fileBase64, isInternal } = body as {
      ticketId?: string
      fileName?: string
      mimeType?: string
      fileSize?: number
      fileBase64?: string
      isInternal?: boolean
    }

    if (!ticketId || !fileName || !mimeType || !fileBase64) {
      return err("ticketId, fileName, mimeType and fileBase64 are required")
    }

    const fileBytes = new Uint8Array(Buffer.from(fileBase64, "base64"))
    const size = fileSize ?? fileBytes.length

    const { record } = await uploadSupportAttachment({
      ticketId,
      fileName,
      mimeType,
      fileSize: size,
      fileBytes,
      authorType: "ADMIN",
      authorId: session.userId,
      isInternal: isInternal ?? false,
    })

    return NextResponse.json({ success: true, attachment: record })
  } catch (e) {
    console.error("[admin/support/attachments] POST", e)
    return err(String(e), 500)
  }
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return err("Unauthorized", 401)
  if (!hasSupportAdminAction(session.role, "support:view")) return err("Forbidden", 403)

  try {
    const { searchParams } = new URL(request.url)
    const attachmentId = searchParams.get("attachmentId")
    if (!attachmentId) return err("attachmentId required")

    const signedUrl = await getSignedAttachmentUrl(attachmentId, "ADMIN", session.userId)
    if (!signedUrl) return err("Could not generate signed URL", 500)

    return NextResponse.json({ success: true, signedUrl })
  } catch (e) {
    console.error("[admin/support/attachments] GET", e)
    return err(String(e), 403)
  }
}
