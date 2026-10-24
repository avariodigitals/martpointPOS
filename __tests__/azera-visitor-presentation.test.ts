import { describe, expect, it } from "vitest"
import { visitorChatRecord } from "@/lib/azera-visitor-presentation"

describe("Azera visitor responses", () => {
  it("keeps the answer but removes internal evidence from new and reloaded messages", () => {
    const stored = {
      id: "reply-1", message: "You can request a demo from our team.", author_type: "ai",
      metadata: { knowledge_refs: [{ id: "internal-1", title: "Internal sales handbook" }] },
      sources: [{ title: "Internal sales handbook" }], knowledge_refs: ["internal-1"],
    }
    expect(visitorChatRecord(stored)).toEqual({ id: "reply-1", message: stored.message, author_type: "ai" })
    // Staff retain the original evidence; presentation must not mutate storage.
    expect(stored.metadata.knowledge_refs[0].title).toBe("Internal sales handbook")
  })

  it("preserves attachment fields and signed download URLs", () => {
    expect(visitorChatRecord({
      id: "attachment-1", message_type: "file", attachment_path: "conversation/file.pdf",
      attachment_url: "https://files.example.test/signed", metadata: { knowledge_refs: [] },
    })).toEqual({
      id: "attachment-1", message_type: "file", attachment_path: "conversation/file.pdf", attachment_url: "https://files.example.test/signed",
    })
  })

  it("preserves queue and handoff information needed for real service updates", () => {
    expect(visitorChatRecord({ id: "conversation-1", waiting_for_agent: true, queue_position: 2, knowledge_refs: ["internal-1"] }))
      .toEqual({ id: "conversation-1", waiting_for_agent: true, queue_position: 2 })
  })
})
