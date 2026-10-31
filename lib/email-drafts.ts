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
  toRecipients: z.string().max(4000).optional(),
  ccRecipients: z.string().max(4000).optional(),
  attachments: leadEmailAttachmentsSchema.default([]),
})
export type EmailDraft = z.infer<typeof emailDraftSchema>

export type SavedEmailDraft = { draft: EmailDraft; updatedAt: string }

function sameAttachments(left: EmailDraft["attachments"], right: EmailDraft["attachments"]) {
  return left.length === right.length && left.every((file, index) =>
    file.filename === right[index].filename && file.content === right[index].content)
}

export function emailDraftUnchanged(draft: EmailDraft, saved: SavedEmailDraft | null): boolean {
  if (!saved || !sameAttachments(draft.attachments, saved.draft.attachments)) return false
  return (["subject", "bodyHtml", "layout", "recipient", "toRecipients", "ccRecipients"] as const)
    .every((key) => draft[key] === saved.draft[key]) &&
    (draft.replyContext?.emailId || null) === (saved.draft.replyContext?.emailId || null) &&
    Boolean(draft.replyContext?.replyAll) === Boolean(saved.draft.replyContext?.replyAll)
}

/** Reuse only the attachments in this exact private draft revision. */
export function emailDraftSavePayload(draft: EmailDraft, saved: SavedEmailDraft | null) {
  if (saved && draft.attachments.length && sameAttachments(draft.attachments, saved.draft.attachments)) {
    return { ...draft, attachments: undefined, attachmentsRevision: saved.updatedAt }
  }
  return draft
}
