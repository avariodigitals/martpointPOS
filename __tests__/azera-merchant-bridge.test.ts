import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const f = vi.hoisted(() => ({
  business: "11111111-1111-4111-8111-111111111111",
  otherBusiness: "22222222-2222-4222-8222-222222222222",
  mapped: "11111111-1111-4111-8111-111111111111",
  missing: false,
  databaseError: false,
  queries: [] as { table: string; filters: Record<string, unknown> }[],
  update: vi.fn(),
  insert: vi.fn(),
  upload: vi.fn(),
  signed: vi.fn()
}))
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    from: (table: string) => {
      const trace = { table, filters: {} as Record<string, unknown> }
      f.queries.push(trace)
      let mutation = false
      const conversation = () => ({
        id: "conversation-one",
        business_id: f.business,
        external_id: "web-one",
        status: "open",
        waiting_for_agent: false,
        queue: null
      })
      const q = {
        select: () => q,
        eq: (key: string, value: unknown) => {
          trace.filters[key] = value
          return q
        },
        order: () => q,
        update: (data: unknown) => {
          mutation = true
          f.update(data)
          return q
        },
        insert: (data: unknown) => {
          mutation = true
          f.insert(data)
          return q
        },
        maybeSingle: async () => ({
          data:
            table === "azera_business_store_mappings"
              ? { business_id: f.mapped }
              : f.missing
                ? null
                : conversation(),
          error: f.databaseError ? { message: "offline" } : null
        }),
        single: async () => ({
          data: table === "azera_messages" ? { id: "upload-one" } : { ...conversation(), status: "closed" },
          error: null
        }),
        then: <T>(resolve: (result: { data: unknown[] | null; error: null }) => T) =>
          Promise.resolve({ data: mutation ? null : [], error: null }).then(resolve)
      }
      return q
    },
    storage: { from: () => ({ upload: f.upload, createSignedUrl: f.signed }) }
  }
}))

import { GET } from "@/app/api/azera/merchant/messages/route"
import { POST as end } from "@/app/api/azera/merchant/end/route"
import { POST as upload } from "@/app/api/azera/merchant/upload/route"
import { issueConversationToken, verifyConversationToken } from "@/lib/azera-public-auth"

beforeEach(() => {
  vi.clearAllMocks()
  f.queries = []
  f.mapped = f.business
  f.missing = false
  f.databaseError = false
  vi.stubEnv("AZERA_PUBLIC_CHAT_SECRET", "test-chat-secret")
  vi.stubEnv("AZERA_PHP_BRIDGE_SECRET", "test-bridge-secret")
  f.upload.mockResolvedValue({ error: null })
  f.signed.mockResolvedValue({ data: { signedUrl: "https://example.test/audio" } })
})
afterEach(() => {
  vi.unstubAllEnvs()
})
function token() {
  return issueConversationToken({
    conversationId: "conversation-one",
    businessId: f.business,
    externalId: "web-one"
  })
}
function headers(bridge = true, credential = token()) {
  return {
    ...(credential ? { "x-azera-chat-token": credential } : {}),
    ...(bridge ? { "x-martpoint-chat-bridge": "test-bridge-secret", "x-martpoint-store-id": "1" } : {})
  }
}
function poll(id = "1", bridge = true, credential = token(), external = "web-one") {
  return GET(
    new Request(
      `https://example.test/api/azera/merchant/messages?business_id=${id}&external_id=${external}`,
      { headers: headers(bridge, credential) }
    )
  )
}
function close(id: unknown = 1, bridge = true, external = "web-one") {
  return end(
    new Request("https://example.test/api/azera/merchant/end", {
      method: "POST",
      headers: { ...headers(bridge), "content-type": "application/json" },
      body: JSON.stringify({ business_id: id, external_id: external })
    })
  )
}
function voice(id = "1", external = "web-one") {
  const form = new FormData()
  form.set("business_id", id)
  form.set("external_id", external)
  form.set("message_type", "voice")
  form.set("file", new File(["audio"], "voice.webm", { type: "audio/webm" }))
  return upload(
    new Request("https://example.test/api/azera/merchant/upload", {
      method: "POST",
      headers: headers(),
      body: form
    })
  )
}

describe("PHP merchant chat polling", () => {
  it("opens a new trusted chat with an empty transcript, not an outage", async () => {
    f.missing = true
    const response = await poll("1", true, "")
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ success: true, data: { conversation: null, messages: [] } })
    expect(f.insert).not.toHaveBeenCalled()
  })
  it("accepts the authenticated PHP store integer after a conversation token is issued", async () => {
    const response = await poll()
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(f.queries.find((query) => query.table === "azera_business_store_mappings")?.filters.store_id).toBe(
      1
    )
    expect(f.queries.find((query) => query.table === "azera_conversations")?.filters.channel).toBe("website")
  })
  it("restores an existing PHP thread and issues a fresh token when its old token expires", async () => {
    const response = await poll("1", true, "expired-token")
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.data.conversation_token).not.toBe("expired-token")
    expect(verifyConversationToken(json.data.conversation_token)?.businessId).toBe(f.business)
  })
  it("preserves website clients using a canonical UUID and valid token without a PHP bridge", async () => {
    expect((await poll(f.business, false)).status).toBe(200)
  })
  it("does not accept a numeric store ID without the authenticated bridge", async () => {
    expect((await poll("1", false)).status).toBe(404)
  })
  it("rejects a query store different from the PHP session store", async () => {
    expect((await poll("2")).status).toBe(404)
  })
  it("rejects a valid bridge store mapped to a different business", async () => {
    f.mapped = f.otherBusiness
    expect((await poll()).status).toBe(404)
  })
  it("rejects a substituted canonical business UUID", async () => {
    expect((await poll(f.otherBusiness)).status).toBe(404)
  })
  it("rejects a substituted external visitor identity", async () => {
    expect((await poll("1", true, token(), "another-visitor")).status).toBe(404)
  })
  it("does not present a database outage as a new empty chat", async () => {
    f.databaseError = true
    expect((await poll()).status).toBe(503)
  })
  it("requires bridge authorization to recover an invalid token", async () => {
    expect((await poll("1", false, "expired-token")).status).toBe(403)
  })
})

describe("PHP merchant chat ending and uploads", () => {
  it("ends the same store's authenticated conversation using the PHP integer", async () => {
    expect((await close()).status).toBe(200)
    expect(f.update).toHaveBeenCalledWith(expect.objectContaining({ status: "closed" }))
  })
  it("cannot end another business's chat", async () => {
    f.mapped = f.otherBusiness
    expect((await close()).status).toBe(404)
    expect(f.update).not.toHaveBeenCalled()
  })
  it("cannot end a chat with substituted visitor identity", async () => {
    expect((await close(1, true, "other-visitor")).status).toBe(404)
    expect(f.update).not.toHaveBeenCalled()
  })
  it("stores authorized voice uploads under canonical conversation identity, never PHP input", async () => {
    expect((await voice()).status).toBe(200)
    expect(f.upload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${f.business}/web-one/`)),
      expect.any(Uint8Array),
      expect.any(Object)
    )
  })
  it("cannot upload with a different visitor or business identity", async () => {
    expect((await voice("1", "other-visitor")).status).toBe(404)
    expect((await voice(f.otherBusiness)).status).toBe(404)
    expect(f.upload).not.toHaveBeenCalled()
    expect(f.insert).not.toHaveBeenCalled()
  })
})
