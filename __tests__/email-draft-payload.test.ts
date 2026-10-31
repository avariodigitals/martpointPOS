import { describe, expect, it } from "vitest"
import { emailDraftSavePayload, emailDraftUnchanged, type EmailDraft } from "@/lib/email-drafts"

const draft: EmailDraft = {
  subject: "Proposal", bodyHtml: "<p>Hello</p>", layout: "normal",
  attachments: [{ filename: "proposal.pdf", content: Buffer.alloc(3 * 1024 * 1024).toString("base64") }]
}
const saved = { draft, updatedAt: "2026-10-31T10:00:00Z" }

describe("email draft save payload", () => {
  it("reduces a text edit with existing 3 MB attachments to under 1 KB", () => {
    const payload = emailDraftSavePayload({ ...draft, subject: "Revised proposal" }, saved)
    expect(JSON.stringify(payload).length).toBeLessThan(1024)
    expect(payload).toMatchObject({ subject: "Revised proposal", attachmentsRevision: saved.updatedAt })
  })
  it("uploads files on first save and when their bytes or names change", () => {
    for (const previous of [null, { ...saved, draft: { ...draft, attachments: [{ filename: "proposal.pdf", content: "YQ==" }] } }, { ...saved, draft: { ...draft, attachments: [{ ...draft.attachments[0], filename: "old.pdf" }] } }]) {
      expect(emailDraftSavePayload(draft, previous)).toEqual(draft)
    }
  })
  it("sends an explicit empty list when attachments are removed", () => {
    expect(emailDraftSavePayload({ ...draft, attachments: [] }, saved)).toEqual({ ...draft, attachments: [] })
  })
  it("skips a save only when all composer fields and files match", () => {
    expect(emailDraftUnchanged(draft, saved)).toBe(true)
    expect(emailDraftUnchanged(draft, null)).toBe(false)
    for (const change of [
      { subject: "Edited" }, { bodyHtml: "<p>Edited</p>" }, { layout: "branded" as const },
      { recipient: "ada@example.com" }, { toRecipients: "ada@example.com" }, { ccRecipients: "ada@example.com" },
      { replyContext: { emailId: "email-id", replyAll: true } }, { attachments: [] }
    ]) expect(emailDraftUnchanged({ ...draft, ...change }, saved)).toBe(false)
  })
})
