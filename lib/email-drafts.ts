import { z } from "zod"
import { EMAIL_LAYOUTS } from "./email-layout"
import { leadEmailAttachmentsSchema } from "./lead-email-attachments"

export const EMAIL_DRAFT_KINDS = ["leads", "partners", "creators"] as const
export type EmailDraftKind = (typeof EMAIL_DRAFT_KINDS)[number]
export const emailDraftSchema = z.object({
  subject: z.string().max(500),
  bodyHtml: z.string().max(50000),
  layout: z.enum(EMAIL_LAYOUTS),
  recipient: z.union([z.email(), z.literal("")]).optional(),
  replyContext: z.object({ emailId: z.uuid(), replyAll: z.boolean() }).nullable().optional(),
  attachments: leadEmailAttachmentsSchema.default([]),
})
export type EmailDraft = z.infer<typeof emailDraftSchema>
