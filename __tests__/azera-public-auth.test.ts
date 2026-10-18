import { describe, expect, it } from "vitest"
import { isConversationIdentityMatch, requireRetailBridge, resolveChatBusinessId } from "@/lib/azera-identity"
import { issueConversationToken, verifyConversationToken } from "@/lib/azera-public-auth"

describe("Azera conversation authorization", () => {
  const identity = {
    conversationId: "conversation-1",
    businessId: "business-1",
    externalId: "visitor-1",
  }

  it("issues an unpredictable token bound to one conversation", () => {
    const token = issueConversationToken(identity)
    expect(token).toContain(".")
    expect(verifyConversationToken(token)).toMatchObject(identity)
    expect(verifyConversationToken(`${token}tampered`)).toBeNull()
    expect(isConversationIdentityMatch(verifyConversationToken(token)!, {
      id: "conversation-1",
      business_id: "business-1",
      external_id: "visitor-1",
    })).toBe(true)
  })

  it("rejects identifier substitution", () => {
    const token = issueConversationToken(identity)
    const claims = verifyConversationToken(token)!
    expect(isConversationIdentityMatch(claims, {
      id: "conversation-2",
      business_id: "business-1",
      external_id: "visitor-1",
    })).toBe(false)
    expect(isConversationIdentityMatch(claims, {
      id: "conversation-1",
      business_id: "business-2",
      external_id: "visitor-1",
    })).toBe(false)
  })

  it("accepts only the configured PHP bridge secret", async () => {
    const previous = process.env.AZERA_PHP_BRIDGE_SECRET
    process.env.AZERA_PHP_BRIDGE_SECRET = "bridge-secret-for-test"
    expect(requireRetailBridge(new Request("https://example.test", { headers: { "x-martpoint-chat-bridge": "wrong" } }))).toBeTruthy()
    expect(requireRetailBridge(new Request("https://example.test", { headers: { "x-martpoint-chat-bridge": "bridge-secret-for-test" } }))).toBeNull()
    process.env.AZERA_PHP_BRIDGE_SECRET = previous
  })

  it("uses only the explicitly configured public business", async () => {
    const previous = process.env.AZERA_PUBLIC_BUSINESS_ID
    process.env.AZERA_PUBLIC_BUSINESS_ID = "support-business-uuid"
    await expect(resolveChatBusinessId(new Request("https://example.test"), "public_site", "attacker-business")).resolves.toMatchObject({ id: "support-business-uuid" })
    process.env.AZERA_PUBLIC_BUSINESS_ID = previous
  })
})

