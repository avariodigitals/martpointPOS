import { z } from "zod"

export const MAX_LEAD_EMAIL_ATTACHMENTS = 5
// Base64 expands by a third; leave room for the message in a hosted request.
export const MAX_LEAD_EMAIL_ATTACHMENT_BYTES = 3 * 1024 * 1024
export const LEAD_EMAIL_ATTACHMENT_HINT = "Up to 5 files, 3 MB combined. PDF, Word, Excel, PowerPoint and images."

export function base64ByteLength(content: string): number {
  return (content.length / 4) * 3 - (content.endsWith("==") ? 2 : content.endsWith("=") ? 1 : 0)
}

export const leadEmailAttachmentsSchema = z.array(z.object({
  filename: z.string().trim().min(1).max(255)
    .refine((value) => !/[\x00-\x1f\x7f/\\]/.test(value), "Invalid attachment filename"),
  content: z.string().min(1, "Attachment is empty")
    .max(4 * Math.ceil(MAX_LEAD_EMAIL_ATTACHMENT_BYTES / 3), "Attachments must be 3 MB combined or smaller")
    .regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/, "Invalid attachment content"),
})).max(MAX_LEAD_EMAIL_ATTACHMENTS, "Up to 5 attachments per email")
  .refine(
    (files) => files.reduce((total, file) => total + base64ByteLength(file.content), 0) <= MAX_LEAD_EMAIL_ATTACHMENT_BYTES,
    "Attachments must be 3 MB combined or smaller",
  )
