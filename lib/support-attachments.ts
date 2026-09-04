import { supabase, isSupabaseConfigured } from "./supabase"
import { isSensitiveSupportCategory } from "./support-permissions"
import { canPartnerViewTicket, isTicketVisibleToPartner } from "./support"
import type { SupportTicket } from "./support"

const ALLOWED_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
])

const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".pdf", ".txt"])

const MAX_SIZE_BYTES = 5 * 1024 * 1024

function validateMime(mime: string, fileName: string): boolean {
  if (!ALLOWED_MIME_TYPES.has(mime)) return false
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf("."))
  if (!ALLOWED_EXTENSIONS.has(ext)) return false
  return true
}

export type AttachmentUploadInput = {
  ticketId: string
  fileName: string
  mimeType: string
  fileSize: number
  fileBytes: Uint8Array
  authorType: "ADMIN" | "PARTNER" | "CUSTOMER"
  authorId?: string | null
  isInternal?: boolean
}

export async function uploadSupportAttachment(input: AttachmentUploadInput) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("*")
    .eq("id", input.ticketId)
    .single()
  if (!ticket) throw new Error("Ticket not found")
  const t = ticket as SupportTicket

  if (input.authorType === "PARTNER") {
    if (isSensitiveSupportCategory(t.category)) throw new Error("Partners cannot upload to sensitive tickets")
    if (!t.assigned_partner_id) throw new Error("Partner not assigned to ticket")
  }

  if (!validateMime(input.mimeType, input.fileName)) {
    throw new Error("Invalid file type or extension")
  }
  if (input.fileSize > MAX_SIZE_BYTES) {
    throw new Error("File exceeds 5MB limit")
  }

  const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")
  const path = `${input.ticketId}/${crypto.randomUUID()}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from("support-attachments")
    .upload(path, input.fileBytes, {
      contentType: input.mimeType,
      upsert: false,
    })

  if (uploadError) throw new Error(`Attachment upload failed: ${uploadError.message}`)

  const { data, error } = await supabase
    .from("support_attachments")
    .insert({
      ticket_id: input.ticketId,
      storage_path: path,
      original_name: input.fileName,
      mime_type: input.mimeType,
      file_size: input.fileSize,
      uploaded_by_type: input.authorType,
      uploaded_by_id: input.authorId || null,
      is_internal: input.isInternal ?? false,
      created_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error || !data) throw new Error(`Attachment record failed: ${error?.message || "unknown"}`)
  return { record: data, path }
}

export async function getSignedAttachmentUrl(
  attachmentId: string,
  actorType: "ADMIN" | "PARTNER",
  actorId: string,
  expiresInSeconds = 120
): Promise<string | null> {
  if (!isSupabaseConfigured()) return null

  const { data: record } = await supabase
    .from("support_attachments")
    .select("*, support_tickets!inner(*)")
    .eq("id", attachmentId)
    .single()
  if (!record) throw new Error("Attachment not found")

  const attachment = record as { storage_path: string; is_internal: boolean; support_tickets: SupportTicket }

  if (attachment.is_internal && actorType !== "ADMIN") {
    throw new Error("Partners cannot access internal attachments")
  }

  const t = attachment.support_tickets
  if (isSensitiveSupportCategory(t.category) && actorType !== "ADMIN") {
    throw new Error("Partners cannot access sensitive ticket attachments")
  }

  if (actorType === "PARTNER") {
    if (!isTicketVisibleToPartner(t, actorId)) {
      throw new Error("Partner is not authorised for this ticket")
    }
  }

  const { data, error } = await supabase.storage
    .from("support-attachments")
    .createSignedUrl(attachment.storage_path, expiresInSeconds)

  if (error || !data) throw new Error(`Signed URL failed: ${error?.message || "unknown"}`)
  return data.signedUrl
}

export async function getSignedUploadUrl(_ticketId: string) {
  // Reserved for future pre-signed upload flow.
  throw new Error("Pre-signed upload not implemented; use uploadSupportAttachment")
}
